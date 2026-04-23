"""
MetaApi REST trade executor.
Docs: https://metaapi.cloud/docs/client/restApi/
"""
import os
import httpx

METAAPI_TOKEN      = os.getenv("METAAPI_TOKEN", "")
METAAPI_ACCOUNT_ID = os.getenv("METAAPI_ACCOUNT_ID", "")
BASE_URL           = f"https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/{METAAPI_ACCOUNT_ID}"

# ── Pip / decimal helpers ─────────────────────────────────────────────────────

def _pip_size(pair: str) -> float:
    pair = pair.upper()
    if "JPY" in pair:  return 0.01
    if pair == "XAUUSD": return 0.1
    return 0.0001

def _volume_step(pair: str) -> float:
    """Minimum lot step — 0.01 for most brokers."""
    return 0.01

# ── Core helpers ──────────────────────────────────────────────────────────────

def _headers() -> dict:
    return {
        "auth-token": METAAPI_TOKEN,
        "Content-Type": "application/json",
    }

async def _get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{BASE_URL}{path}", headers=_headers())
        r.raise_for_status()
        return r.json()

async def _post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{BASE_URL}{path}", headers=_headers(), json=body)
        r.raise_for_status()
        return r.json()

# ── Public API ────────────────────────────────────────────────────────────────

# ── Max spread per pair (in pips) ────────────────────────────────────────────
MAX_SPREAD_PIPS: dict[str, float] = {
    "XAUUSD": 5.0,
    "EURUSD": 2.0,
    "GBPUSD": 3.0,
    "NZDJPY": 3.0,
    "GBPJPY": 3.0,
    "USDJPY": 2.0,
    "AUDUSD": 2.0,
    "USDCAD": 2.0,
    "USDCHF": 2.0,
}
DEFAULT_MAX_SPREAD_PIPS = 3.0


async def get_symbol_tick(symbol: str) -> dict:
    """
    Fetch live bid/ask for a symbol.
    Returns dict with at least {bid, ask, spread} where spread is in price units.
    """
    return await _get(f"/symbols/{symbol.upper()}/currentPrice")


async def check_spread(pair: str) -> dict:
    """
    Fetch live spread and compare against max allowed pips.
    Returns:
      { ok: bool, spread_pips: float, max_pips: float, bid: float, ask: float }
    Raises on network error — caller must catch.
    """
    tick     = await get_symbol_tick(pair)
    bid      = float(tick.get("bid") or tick.get("Bid") or 0)
    ask      = float(tick.get("ask") or tick.get("Ask") or 0)
    spread_price = abs(ask - bid)
    pip      = _pip_size(pair)
    spread_pips = round(spread_price / pip, 2)
    max_pips = MAX_SPREAD_PIPS.get(pair.upper(), DEFAULT_MAX_SPREAD_PIPS)
    return {
        "ok":          spread_pips <= max_pips,
        "spread_pips": spread_pips,
        "max_pips":    max_pips,
        "bid":         bid,
        "ask":         ask,
    }


async def get_account_info() -> dict:
    """Return balance, equity, free margin."""
    return await _get("/account-information")


async def get_deals_for_range(start_dt, end_dt) -> list[dict]:
    """Fetch deals closed between start_dt and end_dt (UTC datetime objects)."""
    start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_iso   = end_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    try:
        data = await _get(f"/history-deals/time/{start_iso}/{end_iso}")
        if isinstance(data, list):
            return data
        return data.get("deals", [])
    except Exception:
        return []


async def get_weekly_stats() -> dict:
    """
    Compute weekly performance stats from MetaApi deal history.
    Week = Monday 00:00 UTC → Sunday 23:59 UTC (current week).
    Returns structured stats including verdict.
    """
    from datetime import datetime, timezone, timedelta
    now   = datetime.now(timezone.utc)
    # Monday of current week
    monday = now - timedelta(days=now.weekday())
    week_start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end   = now

    deals = await get_deals_for_range(week_start, week_end)

    # Filter to actual closed trade deals with non-zero profit
    trade_deals = [
        d for d in deals
        if float(d.get("profit", 0)) != 0
    ]

    total_trades = len(trade_deals)
    if total_trades == 0:
        return {
            "ok":           True,
            "week_start":   week_start.isoformat(),
            "week_end":     week_end.isoformat(),
            "total_trades": 0,
            "wins":         0,
            "losses":       0,
            "win_rate":     0,
            "total_pnl":    0.0,
            "best_trade":   None,
            "worst_trade":  None,
            "most_active":  None,
            "verdict":      "Breakeven week",
        }

    wins   = [d for d in trade_deals if float(d.get("profit", 0)) > 0]
    losses = [d for d in trade_deals if float(d.get("profit", 0)) < 0]
    total_pnl = round(sum(float(d.get("profit", 0)) for d in trade_deals), 2)
    win_rate  = round(len(wins) / total_trades * 100) if total_trades else 0

    # Best / worst trade with R computation (approximate from profit magnitude)
    def _r(deal):
        """Approximate R as profit / average risk (we don't have exact SL stored)."""
        return round(float(deal.get("profit", 0)), 2)

    best_deal  = max(trade_deals, key=lambda d: float(d.get("profit", 0)))
    worst_deal = min(trade_deals, key=lambda d: float(d.get("profit", 0)))

    best_trade  = {"pair": best_deal.get("symbol", ""),  "pnl": round(float(best_deal.get("profit", 0)), 2)}
    worst_trade = {"pair": worst_deal.get("symbol", ""), "pnl": round(float(worst_deal.get("profit", 0)), 2)}

    # Most active pair
    from collections import Counter
    pair_counts  = Counter(d.get("symbol", "") for d in trade_deals)
    most_active  = pair_counts.most_common(1)[0][0] if pair_counts else None

    # Verdict
    if total_pnl > 0 and win_rate >= 55:
        verdict = "Strong week"
    elif total_pnl < 0:
        verdict = "Rough week"
    else:
        verdict = "Breakeven week"

    return {
        "ok":           True,
        "week_start":   week_start.isoformat(),
        "week_end":     week_end.isoformat(),
        "total_trades": total_trades,
        "wins":         len(wins),
        "losses":       len(losses),
        "win_rate":     win_rate,
        "total_pnl":    total_pnl,
        "best_trade":   best_trade,
        "worst_trade":  worst_trade,
        "most_active":  most_active,
        "verdict":      verdict,
    }


async def get_deals_today() -> list[dict]:
    """
    Fetch deals closed today (UTC) from MetaApi history.
    Returns list of deal dicts with at least: symbol, type, profit, time.
    """
    from datetime import datetime, timezone
    now   = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # MetaApi history/deals?startTime=...&endTime=...
    start_iso = start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_iso   = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    try:
        data = await _get(f"/history-deals/time/{start_iso}/{end_iso}")
        # API returns list directly or wrapped in {"deals": [...]}
        if isinstance(data, list):
            return data
        return data.get("deals", [])
    except Exception:
        return []

async def get_positions() -> list[dict]:
    """Return all open positions."""
    return await _get("/positions")

async def place_order(
    symbol:    str,
    direction: str,      # 'long' | 'short'
    lots:      float,
    entry:     float,    # used for comment; MetaApi market orders ignore openPrice
    sl:        float,
    tp:        float,
) -> dict:
    """
    Place a market order with SL and TP.
    Returns MetaApi response (contains orderId on success).
    """
    action = "ORDER_TYPE_BUY" if direction == "long" else "ORDER_TYPE_SELL"
    body = {
        "symbol":      symbol.upper(),
        "actionType":  action,
        "volume":      round(lots, 2),
        "stopLoss":    sl,
        "takeProfit":  tp,
        "comment":     f"TA-{symbol}-{direction[:1].upper()}",
    }
    return await _post("/trade", body)

async def close_position(position_id: str) -> dict:
    """Close a position by its MetaApi position id."""
    body = {
        "actionType": "POSITION_CLOSE_ID",
        "positionId": position_id,
    }
    return await _post("/trade", body)

async def set_sl_to_breakeven(position_id: str, entry_price: float) -> dict:
    """Move SL to entry (BE) on an open position."""
    body = {
        "actionType": "POSITION_MODIFY",
        "positionId": position_id,
        "stopLoss":   entry_price,
    }
    return await _post("/trade", body)

# ── Lot size calculator ───────────────────────────────────────────────────────

def calc_lots(balance: float, risk_pct: float, entry: float, sl: float, pair: str) -> float:
    """
    Standard 1% risk lot-size formula:
      risk_amount = balance * risk_pct / 100
      pip_distance = abs(entry - sl) / pip_size
      lot = risk_amount / (pip_distance * pip_value_per_lot)

    pip_value_per_lot (USD):
      XAUUSD  → $10 / pip (0.1 pip = $1, so 1 pip = $10)
      JPY pairs → $1000 / pip (approx at ~150 JPY)
      USD pairs → $10 / pip
    """
    pair = pair.upper()
    pip  = _pip_size(pair)
    dist = abs(entry - sl)
    if dist == 0:
        return 0.01

    pip_dist = dist / pip

    if pair == "XAUUSD":
        pip_val = 10.0       # $10 per pip per lot
    elif pair == "GBPJPY":
        pip_val = 7.0        # $7 per pip per lot (user-specified)
    elif "JPY" in pair:
        pip_val = 6.67       # approx $1000 / 150
    else:
        pip_val = 10.0       # standard forex

    risk_amount = balance * risk_pct / 100
    raw_lots    = risk_amount / (pip_dist * pip_val)
    lots        = max(0.01, round(raw_lots / _volume_step(pair)) * _volume_step(pair))
    return round(lots, 2)
