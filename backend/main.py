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
                    "pairs":       ["XAUUSD", "EURUSD", "GBPUSD", "NZDJPY"],
                }
            }))
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
            # Reset consecutive-loss counter at each new session
            try:
                from scanner import reset_session_losses
                reset_session_losses()
            except Exception:
                pass
            await manager.broadcast(json.dumps({
                "killzone_open": open_name,
                "morocco_time":  open_mor,
                "pairs":         ["XAUUSD", "EURUSD", "GBPUSD", "NZDJPY"],
            }))
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
            else:
                last_warned = None
        except Exception:
            pass


# ── Weekly report storage (max 8 reports) ────────────────────────────────────
_weekly_reports: list[dict] = []


async def _weekly_report_scheduler():
    """
    Fires every 60s.
    On Sunday between 19:00 and 19:02 UTC (= 20:00–20:02 Morocco UTC+1),
    generate and broadcast the weekly performance report.
    Fires once per Sunday (keyed by ISO week number).
    """
    last_week_fired: int | None = None

    while True:
        await asyncio.sleep(60)
        try:
            now = datetime.now(timezone.utc)
            # Sunday = weekday 6, 19:00–19:02 UTC
            if now.weekday() != 6:
                continue
            if not (19 * 60 <= now.hour * 60 + now.minute < 19 * 60 + 2):
                continue
            week_num = now.isocalendar()[1]
            if week_num == last_week_fired:
                continue
            last_week_fired = week_num

            from trade_executor import get_weekly_stats
            stats = await get_weekly_stats()
            stats["generated_at"] = now.isoformat()
            stats["week_num"]     = week_num

            # Store — keep last 8
            _weekly_reports.append(stats)
            if len(_weekly_reports) > 8:
                _weekly_reports.pop(0)

            await manager.broadcast(json.dumps({"weekly_report": stats}))
        except Exception:
            pass


async def _position_monitor():
    """
    Every 30s — detect when MT5 positions close (SL/TP hit) and broadcast
    a position_closed notification with P&L.
    Only runs if METAAPI_TOKEN is configured.
    """
    if not os.getenv("METAAPI_TOKEN"):
        return

    prev_positions: dict[str, dict] = {}   # position_id → position dict

    while True:
        await asyncio.sleep(30)
        try:
            from trade_executor import get_positions
            positions = await get_positions()
            current_ids = {p["id"]: p for p in positions if "id" in p}

            # Positions that were open last cycle but are gone now → closed
            for pid, pos in prev_positions.items():
                if pid not in current_ids:
                    profit     = pos.get("profit") or pos.get("unrealizedProfit") or 0
                    pair       = pos.get("symbol", "")
                    direction  = pos.get("type", "").lower()  # buy/sell
                    reason     = "tp" if float(profit) > 0 else "sl"

                    # Attach stored signal snapshot for replay generation
                    signal_snapshot = None
                    try:
                        from scanner import get_signal_snapshot
                        signal_snapshot = get_signal_snapshot(pair)
                    except Exception:
                        pass

                    await manager.broadcast(json.dumps({
                        "position_closed": {
                            "pair":            pair,
                            "direction":       "long" if direction == "buy" else "short",
                            "reason":          reason,
                            "pnl":             round(float(profit), 2),
                            "signal_snapshot": signal_snapshot,
                            "close_ts":        datetime.now(timezone.utc).isoformat(),
                        }
                    }))

                    # Consecutive-loss guard
                    try:
                        from scanner import record_trade_result
                        pause_info = record_trade_result(float(profit) > 0)
                        if pause_info["should_pause"]:
                            await manager.broadcast(json.dumps({
                                "auto_trade_paused": {
                                    "reason": f"⚠️ Auto-trading paused — 2 consecutive losses. {pause_info['reason']} Review before resuming."
                                }
                            }))
                    except Exception:
                        pass

            prev_positions = current_ids

        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scanner import run_scanner
    from price_fetcher import run_price_fetcher

    async def _get_ohlcv(symbol: str, timeframe: str = "60") -> dict:
        """
        Return cached OHLCV data for the scanner.
        Priority: yfinance auto-cache → manually pushed MCP data → empty.
        No live TradingView call — Railway has no CDP connection.
        """
        key = f"{symbol}_{timeframe}"
        if key in _ohlcv_cache:
            return _ohlcv_cache[key]
        # Fallback: plain symbol key (H1 legacy)
        if symbol in _ohlcv_cache:
            return _ohlcv_cache[symbol]
        return {"bars": [], "symbol": symbol, "timeframe": timeframe}

    from news_fetcher import run_news_fetcher
    from calendar_fetcher import run_calendar_fetcher

    # Start price fetcher first so cache is warm before scanner's first run
    price_task        = asyncio.create_task(run_price_fetcher(_ohlcv_cache))
    scanner_task      = asyncio.create_task(run_scanner(manager.broadcast, _get_ohlcv))
    kz_task           = asyncio.create_task(_kz_open_scheduler())
    news_task         = asyncio.create_task(run_news_fetcher(manager.broadcast))
    calendar_task     = asyncio.create_task(run_calendar_fetcher())
    news_warn_task    = asyncio.create_task(_news_warning_scheduler())
    position_task     = asyncio.create_task(_position_monitor())
    weekly_task       = asyncio.create_task(_weekly_report_scheduler())

    yield

    for task in (price_task, scanner_task, kz_task, news_task, calendar_task,
                 news_warn_task, position_task, weekly_task):
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


@app.get("/api/feed/status")
async def get_feed_status():
    """
    Summary of what's currently in the OHLCV cache (bars count + source per key).
    Useful for verifying the yfinance price fetcher is working on Railway.
    """
    from price_fetcher import YF_SYMBOLS
    summary = {}
    for pair in YF_SYMBOLS:
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
    """Place a market order on MT5 via MetaApi, after spread and news checks."""
    if not os.getenv("METAAPI_TOKEN"):
        return {"ok": False, "error": "METAAPI_TOKEN not configured"}
    try:
        from trade_executor import place_order, check_spread
        from calendar_fetcher import get_news_risk_for_pair

        # ── News window block ──────────────────────────────────────────────────
        news_risk = get_news_risk_for_pair(req.pair, window_minutes=30)
        if news_risk.get("level") == "HIGH":
            evt       = news_risk.get("next_event") or (news_risk.get("events") or [None])[0]
            evt_title = evt.get("title", "HIGH news") if evt else "HIGH news"
            return {
                "ok":     False,
                "error":  f"HIGH-impact news within 30 min — {evt_title}",
                "type":   "news",
            }

        # ── Spread check ───────────────────────────────────────────────────────
        sp = await check_spread(req.pair)
        if not sp["ok"]:
            return {
                "ok":          False,
                "error":       f"Spread too wide — {sp['spread_pips']} pips (max {sp['max_pips']})",
                "spread_pips": sp["spread_pips"],
                "max_pips":    sp["max_pips"],
                "type":        "spread",
            }

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


@app.get("/api/backtest")
async def run_backtest(
    pairs:     str = "XAUUSD,EURUSD,GBPUSD,NZDJPY",
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


@app.get("/api/trade/account")
async def get_account_snapshot():
    """
    Returns live equity + today's closed-deal stats for the drawdown dashboard.
    Falls back gracefully when METAAPI_TOKEN is not set.
    """
    if not os.getenv("METAAPI_TOKEN"):
        return {"ok": False, "error": "METAAPI_TOKEN not configured"}
    try:
        from trade_executor import get_account_info, get_deals_today
        from scanner import get_auto_state

        info  = await get_account_info()
        deals = await get_deals_today()

        # ── Today's closed deals ───────────────────────────────────────────────
        # Filter to actual trade closes (type IN_OUT, OUT, etc.) with non-zero profit
        trade_deals = [
            d for d in deals
            if d.get("entryType") in ("DEAL_ENTRY_OUT", "OUT", "out")
            or d.get("type") in ("DEAL_TYPE_SELL", "DEAL_TYPE_BUY")
        ]

        today_pnl    = sum(float(d.get("profit", 0)) for d in deals)
        wins_today   = [d for d in deals if float(d.get("profit", 0)) > 0]
        losses_today = [d for d in deals if float(d.get("profit", 0)) < 0]
        total_closed = len(wins_today) + len(losses_today)
        win_rate     = round(len(wins_today) / total_closed * 100) if total_closed else None

        # Consecutive streak: walk backwards through deals sorted by time
        sorted_deals = sorted(deals, key=lambda d: d.get("time", ""), reverse=True)
        streak = 0
        streak_type = None
        for d in sorted_deals:
            p = float(d.get("profit", 0))
            if p == 0:
                continue
            kind = "win" if p > 0 else "loss"
            if streak_type is None:
                streak_type = kind
            if kind == streak_type:
                streak += 1
            else:
                break

        # Max drawdown today: minimum cumulative P&L at any point
        running = 0.0
        peak    = 0.0
        max_dd  = 0.0
        for d in sorted(deals, key=lambda x: x.get("time", "")):
            running += float(d.get("profit", 0))
            peak     = max(peak, running)
            dd       = peak - running
            max_dd   = max(max_dd, dd)

        # Daily loss % from scanner state
        auto = get_auto_state()
        start_eq = auto.get("daily_start_equity")
        equity   = float(info.get("equity") or info.get("balance") or 0)
        balance  = float(info.get("balance") or equity)

        if start_eq and start_eq > 0:
            loss_pct = (start_eq - equity) / start_eq * 100
        else:
            loss_pct = 0.0

        return {
            "ok":           True,
            "equity":       round(equity, 2),
            "balance":      round(balance, 2),
            "start_equity": round(start_eq, 2) if start_eq else None,
            "today_pnl":    round(today_pnl, 2),
            "loss_pct":     round(loss_pct, 2),
            "wins_today":   len(wins_today),
            "losses_today": len(losses_today),
            "total_closed": total_closed,
            "win_rate":     win_rate,
            "streak":       streak,
            "streak_type":  streak_type,
            "max_drawdown": round(max_dd, 2),
            "paused":       auto.get("paused_reason") is not None,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/spread/{pair}")
async def get_spread(pair: str):
    """Live spread for a pair in pips, compared against max allowed."""
    if not os.getenv("METAAPI_TOKEN"):
        return {"ok": False, "error": "METAAPI_TOKEN not configured"}
    try:
        from trade_executor import check_spread
        result = await check_spread(pair.upper())
        return {"ok": True, **result, "pair": pair.upper()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/trade/resume")
async def resume_auto_trading():
    """Manually re-enable auto-trading after a consecutive-loss pause."""
    from scanner import resume_auto_trading as _resume
    _resume()
    await manager.broadcast(json.dumps({"auto_trade_resumed": {"reason": "Manually resumed by user"}}))
    return {"ok": True}


@app.get("/api/trade/status")
async def get_auto_trade_status():
    """Return current auto-trade state (enabled, paused_reason, consecutive_losses)."""
    from scanner import get_auto_state
    return {"ok": True, **get_auto_state()}


@app.get("/api/reports/weekly")
async def get_weekly_reports():
    """Return the last 8 stored weekly performance reports (newest first)."""
    return {"ok": True, "reports": list(reversed(_weekly_reports))}


@app.post("/api/reports/weekly/generate")
async def generate_weekly_report():
    """Manually trigger a weekly report generation (for testing / on-demand)."""
    try:
        from trade_executor import get_weekly_stats
        now   = datetime.now(timezone.utc)
        stats = await get_weekly_stats()
        stats["generated_at"] = now.isoformat()
        stats["week_num"]     = now.isocalendar()[1]

        _weekly_reports.append(stats)
        if len(_weekly_reports) > 8:
            _weekly_reports.pop(0)

        await manager.broadcast(json.dumps({"weekly_report": stats}))
        return {"ok": True, "report": stats}
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
