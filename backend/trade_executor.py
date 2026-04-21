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

async def get_account_info() -> dict:
    """Return balance, equity, free margin."""
    return await _get("/account-information")

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
    elif "JPY" in pair:
        pip_val = 6.67       # approx $1000 / 150
    else:
        pip_val = 10.0       # standard forex

    risk_amount = balance * risk_pct / 100
    raw_lots    = risk_amount / (pip_dist * pip_val)
    lots        = max(0.01, round(raw_lots / _volume_step(pair)) * _volume_step(pair))
    return round(lots, 2)
