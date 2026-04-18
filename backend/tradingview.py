"""
TradingView CDP connector — reads live data from TradingView Desktop on port 9222.
Connects via CDP to the Electron app on port 9222.
"""
import asyncio
import json
import time
import aiohttp
from datetime import datetime, timezone

TV_CDP = "http://localhost:9222"

# ── Low-level CDP helpers ───────────────────────────────────────────────────────

async def _get_tab(session: aiohttp.ClientSession) -> str | None:
    """Find the main TradingView chart tab."""
    try:
        async with session.get(f"{TV_CDP}/json", timeout=aiohttp.ClientTimeout(total=3)) as r:
            tabs = await r.json(content_type=None)
        for tab in tabs:
            url = tab.get("url", "")
            if "tradingview" in url.lower() and tab.get("type") == "page":
                return tab["id"]
    except Exception:
        pass
    return None


async def _eval(session: aiohttp.ClientSession, tab_id: str, expression: str, timeout: float = 8.0) -> any:
    """Evaluate JavaScript in the TradingView tab via CDP WebSocket."""
    msg_id = int(time.time() * 1000) % 999999
    payload = {
        "id": msg_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": False,
        },
    }
    url = f"ws://localhost:9222/devtools/page/{tab_id}"
    try:
        async with session.ws_connect(url, timeout=aiohttp.ClientTimeout(total=timeout)) as ws:
            await ws.send_json(payload)
            deadline = time.time() + timeout
            async for msg in ws:
                if time.time() > deadline:
                    break
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    if data.get("id") == msg_id:
                        result = data.get("result", {})
                        rv = result.get("result", {})
                        if rv.get("type") == "string":
                            return json.loads(rv["value"])
                        return rv.get("value")
    except Exception:
        pass
    return None


# ── Public API ─────────────────────────────────────────────────────────────────

async def get_tv_tab(session: aiohttp.ClientSession) -> str | None:
    return await _get_tab(session)


async def get_quote(symbol: str = None) -> dict:
    """Get the current price for a symbol from the TradingView chart."""
    async with aiohttp.ClientSession() as session:
        tab_id = await _get_tab(session)
        if not tab_id:
            return {"error": "TradingView not reachable"}

        # Read last price from the chart's quote model
        expr = """
(function() {
  try {
    var w = _tvWidget || window.tvWidget;
    var chart = w._activeChartWidget || w.activeChart();
    var last = chart.model().mainSeries().lastValueData();
    return JSON.stringify({
      last: last ? last.price : null,
      symbol: chart.model().symbol()
    });
  } catch(e) { return JSON.stringify({error: e.message}); }
})()
"""
        result = await _eval(session, tab_id, expr)
        if result:
            return {**result, "timestamp": datetime.now(timezone.utc).isoformat()}
        return {"error": "could not read price", "symbol": symbol or "unknown"}


async def get_ohlcv_summary(symbol: str, timeframe: str = "60", count: int = 100) -> dict:
    """
    Pull OHLCV bars from TradingView chart via CDP.
    Uses the chart widget's internal bars data.
    Returns {"bars": [{open, high, low, close, volume, time}, ...]} oldest-first.
    """
    async with aiohttp.ClientSession() as session:
        tab_id = await _get_tab(session)
        if not tab_id:
            return {"error": "TradingView not reachable", "bars": []}

        # First switch to the target symbol + timeframe
        switch_expr = f"""
(function() {{
  try {{
    var w = _tvWidget || window.tvWidget;
    var chart = w._activeChartWidget || w.activeChart();
    chart.setSymbol("{symbol}", function() {{}});
    chart.setResolution("{timeframe}", function() {{}});
    return "switched";
  }} catch(e) {{ return "error:" + e.message; }}
}})()
"""
        await _eval(session, tab_id, switch_expr, timeout=3)
        await asyncio.sleep(1.5)  # Wait for chart to reload

        # Read bars from the main series
        bars_expr = f"""
(function() {{
  try {{
    var w = _tvWidget || window.tvWidget;
    var chart = w._activeChartWidget || w.activeChart();
    var series = chart.model().mainSeries();
    var data = series.data();
    var bars = data.bars();
    if (!bars) return JSON.stringify({{error: "no bars"}});

    var result = [];
    var len = bars.size();
    var start = Math.max(0, len - {count});
    for (var i = start; i < len; i++) {{
      var b = bars.get(i);
      if (b) result.push({{
        time: b.time || 0,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume || 0
      }});
    }}
    return JSON.stringify({{bars: result, symbol: "{symbol}", timeframe: "{timeframe}"}});
  }} catch(e) {{ return JSON.stringify({{error: e.message, bars: []}}); }}
}})()
"""
        result = await _eval(session, tab_id, bars_expr, timeout=10)
        if result and isinstance(result, dict) and result.get("bars"):
            return result
        return {"error": "ohlcv_unavailable", "bars": [], "symbol": symbol}


# ── UTC helpers ────────────────────────────────────────────────────────────────

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def in_kill_zone() -> bool:
    h = utc_now().hour
    return (6 <= h < 9) or (11 <= h < 14)

def kill_zone_name() -> str | None:
    h = utc_now().hour
    if 6 <= h < 9:
        return "London Kill Zone"
    if 11 <= h < 14:
        return "New York Kill Zone"
    return None
