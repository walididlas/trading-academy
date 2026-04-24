"""
Auto trade manager — runs every 30 s alongside the position monitor.

Per-position rules (applied to every open MT5 position):
  1. Move SL to breakeven when price moves 1R in profit
  2. Partial close 50 % at TP1, update TP to TP2
  3. Trail SL 10 pips behind price after TP1 is hit
  4. Close stagnant position if open > 4 hours with no progress toward TP1
"""
import asyncio
import json
import os
from datetime import datetime, timezone

# Per-position management state
# { position_id: { be_moved, partial_done, trailing_active, opened_at, signal } }
_mgmt_state: dict[str, dict] = {}


def _pip_size(pair: str) -> float:
    pair = pair.upper()
    if "JPY" in pair:    return 0.01
    if pair == "XAUUSD": return 0.1
    return 0.0001


def _cleanup_closed(current_ids: set) -> None:
    """Remove state entries for positions that no longer exist."""
    for pid in list(_mgmt_state.keys()):
        if pid not in current_ids:
            del _mgmt_state[pid]


async def _manage(pos: dict, broadcast_fn) -> None:
    """Apply all 4 management rules to a single open position."""
    from trade_executor import modify_position, partial_close_position, close_position
    from push_notifier import send_push

    pid   = pos.get("id")
    pair  = pos.get("symbol", "").upper()
    ptype = pos.get("type", "").lower()   # "buy" | "sell"
    is_long = "buy" in ptype

    open_price    = float(pos.get("openPrice")    or pos.get("price")      or 0)
    current_price = float(pos.get("currentPrice") or pos.get("currentBid") or open_price)
    current_sl    = float(pos.get("stopLoss")     or 0)
    current_tp    = float(pos.get("takeProfit")   or 0)
    volume        = float(pos.get("volume")       or 0.01)
    pip           = _pip_size(pair)

    # ── Init state on first sight of this position ────────────────────────────
    if pid not in _mgmt_state:
        signal = None
        try:
            from scanner import get_signal_snapshot
            signal = get_signal_snapshot(pair)
        except Exception:
            pass
        _mgmt_state[pid] = {
            "be_moved":        False,
            "partial_done":    False,
            "trailing_active": False,
            "opened_at":       datetime.now(timezone.utc),
            "signal":          signal,
        }

    state  = _mgmt_state[pid]
    signal = state.get("signal") or {}

    # Derive key levels from signal snapshot; fall back to position data
    sig_entry = float(signal.get("entry") or open_price)
    sig_sl    = float(signal.get("sl")    or current_sl or 0)
    sig_tp1   = float(signal.get("tp1")   or current_tp or 0)
    sig_tp2   = float(signal.get("tp2")   or 0)
    pip_sl    = float(
        signal.get("pip_sl") or
        (abs(sig_entry - sig_sl) / pip if sig_sl else 0)
    )
    now = datetime.now(timezone.utc)

    # ── Rule 1: Move SL to breakeven at 1R profit ─────────────────────────────
    if not state["be_moved"] and pip_sl > 0 and current_sl != open_price:
        one_r    = open_price + pip_sl * pip if is_long else open_price - pip_sl * pip
        triggered = (is_long and current_price >= one_r) or \
                    (not is_long and current_price <= one_r)
        if triggered:
            try:
                await modify_position(pid, sl=open_price)
                state["be_moved"] = True
                await broadcast_fn(json.dumps({
                    "trade_management": {
                        "type":    "breakeven",
                        "pair":    pair,
                        "message": f"SL moved to breakeven @ {open_price}",
                    }
                }))
                asyncio.create_task(send_push(
                    title=f"✅ {pair} — Breakeven Activated",
                    body=f"SL moved to entry @ {open_price} · Trade is now risk-free",
                    tag=f"be-{pid}", type_="signal", url="/signals",
                ))
            except Exception:
                pass

    # ── Rule 2: Partial close at TP1, update TP to TP2 ───────────────────────
    if not state["partial_done"] and sig_tp1 > 0:
        tp1_hit = (is_long and current_price >= sig_tp1) or \
                  (not is_long and current_price <= sig_tp1)
        if tp1_hit:
            close_vol = round(max(0.01, round(volume * 0.5, 2)), 2)
            try:
                await partial_close_position(pid, close_vol)
                state["partial_done"]    = True
                state["trailing_active"] = True
                # Set TP to TP2 on the remaining half
                if sig_tp2 > 0:
                    try:
                        await modify_position(pid, tp=sig_tp2)
                    except Exception:
                        pass
                tp2_str = str(sig_tp2) if sig_tp2 else "N/A"
                await broadcast_fn(json.dumps({
                    "trade_management": {
                        "type":    "partial_close",
                        "pair":    pair,
                        "message": f"Closed {close_vol} lots @ TP1 {sig_tp1} · Remainder running to TP2 {tp2_str}",
                        "tp1":     sig_tp1,
                        "tp2":     sig_tp2,
                    }
                }))
                asyncio.create_task(send_push(
                    title=f"💰 {pair} — TP1 Hit · Partial Close",
                    body=f"Closed {close_vol} lots @ {sig_tp1} · Trailing to TP2 {tp2_str}",
                    tag=f"partial-{pid}", type_="signal", url="/signals",
                ))
            except Exception:
                pass

    # ── Rule 3: Trail SL 10 pips behind price (active after TP1 hit) ─────────
    if state["trailing_active"]:
        trail_pips = 10
        new_sl = round(current_price - trail_pips * pip, 5) if is_long \
            else round(current_price + trail_pips * pip, 5)
        should_move = (is_long  and (current_sl == 0 or new_sl > current_sl)) or \
                      (not is_long and (current_sl == 0 or new_sl < current_sl))
        if should_move:
            try:
                await modify_position(pid, sl=new_sl)
                # Trailing SL updates every 30s — only push every 10 pips moved
                # to avoid notification spam; use broadcast only
                await broadcast_fn(json.dumps({
                    "trade_management": {
                        "type":    "trailing_sl",
                        "pair":    pair,
                        "message": f"Trailing SL → {new_sl} (10 pips behind {current_price})",
                        "new_sl":  new_sl,
                    }
                }))
                # Push only if SL moved significantly (avoid notification flood)
                prev_sl = state.get("last_trail_sl", 0)
                if prev_sl == 0 or abs(new_sl - prev_sl) >= trail_pips * pip:
                    state["last_trail_sl"] = new_sl
                    asyncio.create_task(send_push(
                        title=f"📌 {pair} — Trailing SL Updated",
                        body=f"SL → {new_sl} · 10 pips behind {current_price}",
                        tag=f"trail-{pid}", type_="signal", url="/signals",
                    ))
            except Exception:
                pass

    # ── Rule 4: Close stagnant position after 4 hours with no progress ────────
    if not state["be_moved"] and not state["partial_done"]:
        age_h = (now - state["opened_at"]).total_seconds() / 3600
        if age_h >= 4:
            try:
                await close_position(pid)
                state["be_moved"] = True  # prevent re-trigger before monitor removes it
                await broadcast_fn(json.dumps({
                    "trade_management": {
                        "type":    "stagnant_close",
                        "pair":    pair,
                        "message": f"Position closed after {age_h:.1f}h with no progress toward TP1",
                    }
                }))
                asyncio.create_task(send_push(
                    title=f"⏱️ {pair} — Stagnant Trade Closed",
                    body=f"Position auto-closed after {age_h:.1f}h · No TP1 progress",
                    tag=f"stagnant-{pid}", type_="warning", url="/signals",
                ))
            except Exception:
                pass


async def run_trade_manager(broadcast_fn) -> None:
    """
    Background task — every 30 s, apply all 4 management rules to every open position.
    No-ops when METAAPI_TOKEN is not configured.
    """
    if not os.getenv("METAAPI_TOKEN"):
        return

    while True:
        await asyncio.sleep(30)
        try:
            from trade_executor import get_positions
            positions = await get_positions()
            if not isinstance(positions, list):
                continue

            current_ids = {p["id"] for p in positions if "id" in p}
            _cleanup_closed(current_ids)

            for pos in positions:
                if "id" in pos:
                    await _manage(pos, broadcast_fn)
        except Exception:
            pass
