"""
Trading Academy — FastAPI backend
Endpoints:
  GET  /api/health       → server status
  GET  /api/signals      → latest ICC signal scan results
  POST /api/chat         → AI assistant (Claude)
  WS   /ws/signals       → live signal push via WebSocket
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# ── WebSocket connection manager ───────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: str):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ── Lifespan — start background scanner ───────────────────────────────────────

async def _kz_open_scheduler():
    """
    Every 60 seconds, check if a Kill Zone just opened.
    Morocco UTC+1: London = 10:00-13:00 MAT → 09:00-12:00 UTC
                   NY     = 15:30-18:30 MAT → 14:30-17:30 UTC
    Broadcasts {"killzone_open": "<name>", "morocco_time": "<HH:MM>"} once per session open.
    """
    last_fired: str | None = None
    while True:
        await asyncio.sleep(60)
        now = datetime.now(timezone.utc)
        t = now.hour * 60 + now.minute

        if 9 * 60 <= t < 9 * 60 + 2:
            name, morocco = "London Kill Zone", "10:00"
        elif 14 * 60 + 30 <= t < 14 * 60 + 32:
            name, morocco = "NY Kill Zone", "15:30"
        else:
            name = None

        if name and name != last_fired:
            last_fired = name
            await manager.broadcast(json.dumps({
                "killzone_open": name,
                "morocco_time": morocco,
                "pairs": ["XAUUSD", "EURUSD", "GBPUSD", "NZDJPY"],
            }))
        elif not name:
            last_fired = None  # reset so next open fires again


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scanner import run_scanner
    from tradingview import get_ohlcv_summary

    async def _get_ohlcv(symbol: str, timeframe: str = "60") -> dict:
        key = f"{symbol}_{timeframe}"
        if key in _ohlcv_cache:
            return _ohlcv_cache[key]
        # Fallback: try base symbol key (legacy)
        if symbol in _ohlcv_cache:
            return _ohlcv_cache[symbol]
        return await get_ohlcv_summary(symbol, timeframe=timeframe, count=120)

    from news_fetcher import run_news_fetcher
    from calendar_fetcher import run_calendar_fetcher

    scanner_task  = asyncio.create_task(run_scanner(manager.broadcast, _get_ohlcv))
    kz_task       = asyncio.create_task(_kz_open_scheduler())
    news_task     = asyncio.create_task(run_news_fetcher(manager.broadcast))
    calendar_task = asyncio.create_task(run_calendar_fetcher())

    yield

    for task in (scanner_task, kz_task, news_task, calendar_task):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="Trading Academy API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open for local dev; restrict to real domain on deploy
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    from tradingview import get_tv_tab
    import aiohttp
    tv_connected = False
    try:
        async with aiohttp.ClientSession() as session:
            tab = await get_tv_tab(session)
            tv_connected = tab is not None
    except Exception:
        pass

    return {
        "status": "ok",
        "tradingview": "connected" if tv_connected else "disconnected",
        "anthropic": "configured" if os.getenv("ANTHROPIC_API_KEY") else "missing_key",
    }


@app.get("/api/signals")
async def get_signals():
    from scanner import get_cached_signals
    return {"signals": get_cached_signals()}


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    from assistant import chat
    reply = await chat(req.message, req.history)
    return {"reply": reply}


class FeedRequest(BaseModel):
    symbol: str
    timeframe: str = "60"
    bars: list[dict]


# Cache for MCP-pushed OHLCV data
_ohlcv_cache: dict[str, dict] = {}


@app.post("/api/feed")
async def feed_ohlcv(req: FeedRequest):
    """Accept OHLCV data pushed from Claude/MCP and cache it for the scanner."""
    key = f"{req.symbol}_{req.timeframe}"
    _ohlcv_cache[key] = {"bars": req.bars, "symbol": req.symbol, "timeframe": req.timeframe}
    # Also store by plain symbol for backward compat (H1 = default)
    if req.timeframe == "60":
        _ohlcv_cache[req.symbol] = _ohlcv_cache[key]
    return {"ok": True, "bars": len(req.bars), "symbol": req.symbol, "timeframe": req.timeframe, "key": key}


@app.get("/api/feed/{symbol}")
async def get_feed(symbol: str, timeframe: str = "60"):
    key = f"{symbol.upper()}_{timeframe}"
    data = _ohlcv_cache.get(key) or _ohlcv_cache.get(symbol.upper())
    if not data:
        return {"symbol": symbol, "bars": 0, "cached": False}
    return {"symbol": symbol, "timeframe": timeframe, "bars": len(data.get("bars", [])), "cached": True}


@app.get("/api/news")
async def get_news(limit: int = 50):
    """Latest financial news items, newest first."""
    from news_fetcher import get_cached_news
    return {"news": get_cached_news(limit)}


@app.get("/api/calendar")
async def get_calendar():
    """Economic calendar data: upcoming events, risk by pair, next HIGH event."""
    from calendar_fetcher import get_cached_calendar
    return get_cached_calendar()


# ── Trade execution endpoints (MetaApi) ────────────────────────────────────────

class TradeRequest(BaseModel):
    pair:      str
    direction: str          # 'long' | 'short'
    lots:      float
    entry:     float
    sl:        float
    tp:        float        # TP1 used for the live order


class CloseRequest(BaseModel):
    position_id: str


class BreakevenRequest(BaseModel):
    position_id: str
    entry_price: float


@app.post("/api/trade/execute")
async def execute_trade(req: TradeRequest):
    """Place a market order on MT5 via MetaApi."""
    if not os.getenv("METAAPI_TOKEN"):
        return {"ok": False, "error": "METAAPI_TOKEN not configured"}
    try:
        from trade_executor import place_order
        result = await place_order(
            symbol=req.pair, direction=req.direction,
            lots=req.lots, entry=req.entry, sl=req.sl, tp=req.tp,
        )
        return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/trade/close")
async def close_trade(req: CloseRequest):
    """Close an open MT5 position by id."""
    try:
        from trade_executor import close_position
        result = await close_position(req.position_id)
        return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/trade/breakeven")
async def move_to_breakeven(req: BreakevenRequest):
    """Move SL to entry price (breakeven) on an open position."""
    try:
        from trade_executor import set_sl_to_breakeven
        result = await set_sl_to_breakeven(req.position_id, req.entry_price)
        return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/trade/positions")
async def get_open_positions():
    """Return all open MT5 positions."""
    if not os.getenv("METAAPI_TOKEN"):
        return {"ok": False, "positions": [], "error": "METAAPI_TOKEN not configured"}
    try:
        from trade_executor import get_positions
        positions = await get_positions()
        return {"ok": True, "positions": positions}
    except Exception as e:
        return {"ok": False, "positions": [], "error": str(e)}


# ── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws/signals")
async def ws_signals(websocket: WebSocket):
    await manager.connect(websocket)
    # Immediately send cached signals so client has data right away
    from scanner import get_cached_signals
    await websocket.send_text(json.dumps({"signals": get_cached_signals()}))
    try:
        while True:
            # Keep connection alive — client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
