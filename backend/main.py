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
    Every 60s — fires two events per Kill Zone:
      1. kz_warning  5 min before open  (Morocco UTC+1)
      2. killzone_open at open
    London: 09:00 UTC / 10:00 Morocco  |  NY: 14:30 UTC / 15:30 Morocco
    """
    last_warning: str | None = None
    last_open:    str | None = None

    while True:
        await asyncio.sleep(60)
        now = datetime.now(timezone.utc)
        # Skip entirely on weekends — no Kill Zones fire Sat/Sun
        if now.weekday() >= 5:
            continue
        t   = now.hour * 60 + now.minute

        # ── 5-min warning ──────────────────────────────────────────────────────
        if 8 * 60 + 55 <= t < 8 * 60 + 57:
            warn_name, warn_mor = "London Kill Zone", "10:00"
        elif 14 * 60 + 25 <= t < 14 * 60 + 27:
            warn_name, warn_mor = "NY Kill Zone", "15:30"
        else:
            warn_name = None

        if warn_name and warn_name != last_warning:
            last_warning = warn_name
            await manager.broadcast(json.dumps({
                "kz_warning": {
                    "name":        warn_name,
                    "morocco_time": warn_mor,
                    "opens_in":    "5 minutes",
                    "pairs":       ["XAUUSD", "EURUSD", "GBPUSD", "GBPJPY"],
                }
            }))
            from push_notifier import send_push
            asyncio.create_task(send_push(
                title=f"⏰ {warn_name} in 5 minutes",
                body=f"{warn_mor} Morocco · Prepare setups on XAUUSD, EURUSD, GBPUSD, GBPJPY",
                tag="kz-warning", type_="killzone", url="/signals",
            ))
        elif not warn_name:
            last_warning = None

        # ── Open ───────────────────────────────────────────────────────────────
        if 9 * 60 <= t < 9 * 60 + 2:
            open_name, open_mor = "London Kill Zone", "10:00"
        elif 14 * 60 + 30 <= t < 14 * 60 + 32:
            open_name, open_mor = "NY Kill Zone", "15:30"
        else:
            open_name = None

        if open_name and open_name != last_open:
            last_open = open_name
            await manager.broadcast(json.dumps({
                "killzone_open": open_name,
                "morocco_time":  open_mor,
                "pairs":         ["XAUUSD", "EURUSD", "GBPUSD", "GBPJPY"],
            }))
            from push_notifier import send_push
            asyncio.create_task(send_push(
                title=f"🎯 {open_name} NOW OPEN",
                body=f"{open_mor} Morocco · ICC setups active on XAUUSD, EURUSD, GBPUSD, GBPJPY",
                tag="killzone", type_="killzone", url="/signals",
            ))
        elif not open_name:
            last_open = None


async def _news_warning_scheduler():
    """
    Every 60s — if next HIGH-impact event is 25–35 min away, fire a 30-min warning.
    Fires once per event (keyed by event title).
    """
    last_warned: str | None = None
    while True:
        await asyncio.sleep(60)
        try:
            from calendar_fetcher import get_cached_calendar
            cal = get_cached_calendar()
            nxt = cal.get("next_high") if cal else None
            if not nxt:
                continue
            mins_until = (nxt.get("utc_ts", 0) - datetime.now(timezone.utc).timestamp()) / 60
            if 25 <= mins_until <= 35:
                key = nxt.get("title", "")
                if key and key != last_warned:
                    last_warned = key
                    await manager.broadcast(json.dumps({
                        "news_warning": {
                            "title":      nxt.get("title", ""),
                            "currencies": nxt.get("currencies", []),
                            "mins_until": round(mins_until),
                            "impact":     "HIGH",
                        }
                    }))
                    cur = "/".join(nxt.get("currencies", []))
                    from push_notifier import send_push
                    asyncio.create_task(send_push(
                        title=f"⚡ HIGH News in ~{round(mins_until)} min{f' — {cur}' if cur else ''}",
                        body=nxt.get("title", "High-impact event approaching"),
                        tag=f"news-warn-{key[:30]}", type_="warning", url="/signals",
                    ))
            else:
                last_warned = None
        except Exception:
            pass




async def _get_ohlcv(symbol: str, timeframe: str = "60") -> dict:
    """
    Return cached OHLCV data for the scanner.
    Priority: yfinance auto-cache → manually pushed MCP data → empty.
    No live TradingView call — Railway has no CDP connection.
    """
    key = f"{symbol}_{timeframe}"
    if key in _ohlcv_cache:
        return _ohlcv_cache[key]
    if symbol in _ohlcv_cache:
        return _ohlcv_cache[symbol]
    return {"bars": [], "symbol": symbol, "timeframe": timeframe}


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scanner import run_scanner
    from price_fetcher import run_price_fetcher
    from news_fetcher import run_news_fetcher
    from calendar_fetcher import run_calendar_fetcher

    # Start price fetcher first so cache is warm before scanner's first run
    price_task     = asyncio.create_task(run_price_fetcher(_ohlcv_cache))
    scanner_task   = asyncio.create_task(run_scanner(manager.broadcast, _get_ohlcv))
    kz_task        = asyncio.create_task(_kz_open_scheduler())
    news_task      = asyncio.create_task(run_news_fetcher(manager.broadcast))
    calendar_task  = asyncio.create_task(run_calendar_fetcher())
    news_warn_task = asyncio.create_task(_news_warning_scheduler())

    yield

    for task in (price_task, scanner_task, kz_task, news_task, calendar_task,
                 news_warn_task):
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


@app.post("/api/rescan/{pair}")
async def rescan_pair_endpoint(pair: str):
    """
    Force an immediate rescan of a single pair.
    Called by the Signals page when the user reports a missed/skipped outcome,
    so we can check for a fresh setup and push a notification if one exists.
    """
    from scanner import rescan_pair
    result = await rescan_pair(pair.upper(), _get_ohlcv, manager.broadcast)
    return result


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


@app.get("/api/feed/status")
async def get_feed_status():
    """
    Summary of what's currently in the OHLCV cache (bars count + source per key).
    Useful for verifying the yfinance price fetcher is working on Railway.
    """
    from price_fetcher import TD_SYMBOLS
    summary = {}
    for pair in TD_SYMBOLS:
        for tf in ("60", "15"):
            key  = f"{pair}_{tf}"
            data = _ohlcv_cache.get(key)
            summary[key] = {
                "bars":   len(data["bars"]) if data else 0,
                "source": data.get("source", "manual") if data else "missing",
            }
    return {"ok": True, "cache": summary, "total_keys": len(_ohlcv_cache)}


@app.get("/api/feed/{symbol}")
async def get_feed(symbol: str, timeframe: str = "60"):
    key = f"{symbol.upper()}_{timeframe}"
    data = _ohlcv_cache.get(key) or _ohlcv_cache.get(symbol.upper())
    if not data:
        return {"symbol": symbol, "bars": 0, "cached": False}
    return {"symbol": symbol, "timeframe": timeframe, "bars": len(data.get("bars", [])), "cached": True, "source": data.get("source", "manual")}


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



@app.get("/api/backtest")
async def run_backtest(
    pairs:     str = "XAUUSD,EURUSD,GBPUSD,GBPJPY",
    min_score: int = 60,
    days:      int = 30,
):
    """
    Run ICC backtest over cached OHLCV data.
    params: pairs (comma-sep), min_score (60|70|80), days (7|14|30)
    """
    import asyncio
    from backtest import run_backtest as _run_backtest
    pair_list = [p.strip().upper() for p in pairs.split(",") if p.strip()]
    # Run in thread pool so we don't block the event loop
    result = await asyncio.get_event_loop().run_in_executor(
        None, _run_backtest, _ohlcv_cache, pair_list, min_score, days
    )
    return result


# ── Web Push endpoints ────────────────────────────────────────────────────────

@app.get("/api/push/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key so the browser can subscribe to push."""
    key = os.getenv("VAPID_PUBLIC_KEY", "")
    if not key:
        return {"ok": False, "error": "VAPID_PUBLIC_KEY not configured on server"}
    return {"ok": True, "publicKey": key}


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict
    expirationTime: float | None = None


@app.post("/api/push/subscribe")
async def push_subscribe(sub: PushSubscription):
    """Store a browser push subscription."""
    from push_notifier import add_subscription, get_subscription_count
    add_subscription(sub.model_dump())
    return {"ok": True, "subscribers": get_subscription_count()}


@app.delete("/api/push/subscribe")
async def push_unsubscribe(sub: PushSubscription):
    """Remove a push subscription."""
    from push_notifier import remove_subscription
    remove_subscription(sub.endpoint)
    return {"ok": True}


@app.get("/api/push/status")
async def push_status():
    """Return push system status (useful for debugging)."""
    from push_notifier import get_subscription_count
    return {
        "ok":          True,
        "subscribers": get_subscription_count(),
        "vapid_configured": bool(os.getenv("VAPID_PUBLIC_KEY")),
    }


@app.post("/api/push/test")
async def push_test():
    """Send a test push notification to all registered subscribers."""
    from push_notifier import send_push, get_subscription_count
    n = get_subscription_count()
    if n == 0:
        return {"ok": False, "error": "No subscribers registered"}
    if not os.getenv("VAPID_PRIVATE_KEY"):
        return {"ok": False, "error": "VAPID_PRIVATE_KEY not configured"}
    await send_push(
        title="🔔 Trading Academy — Test Notification",
        body="Push notifications are working correctly. VAPID is configured.",
        tag="ta-test",
        type_="killzone",
        url="/signals",
    )
    return {"ok": True, "sent_to": n}


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
