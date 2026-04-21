"""
ICC Backtest Engine
Replays the scoring logic over historical OHLCV bars.

Key differences vs live scanner:
  - Kill Zone checked against each bar's own timestamp (not wall-clock time)
  - News criterion always assumed CLEAR (no historical news data)
  - Signals detected on transition: score >= threshold AND previous bar below threshold
  - Trade outcome determined by scanning forward bars for SL/TP1 touch
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

# ── Re-use pure price functions from scanner ───────────────────────────────────
from scanner import (
    _ema, _atr, _pip_size, _price_dec,
    _premium_discount_zone, _find_order_block, _find_fvg,
    _analyze_structure, _find_liquidity_targets,
    _swing_highs, _swing_lows,
)

PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "NZDJPY"]

# ── KZ from bar timestamp ──────────────────────────────────────────────────────
def _bar_in_kz(bar: dict) -> bool:
    ts = bar.get("time") or bar.get("timestamp") or 0
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return False
        t = dt.hour * 60 + dt.minute
    else:
        # Unix timestamp (seconds)
        dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
        t  = dt.hour * 60 + dt.minute
    return (9 * 60 <= t < 12 * 60) or (14 * 60 + 30 <= t < 17 * 60 + 30)


def _bar_ts(bar: dict) -> Optional[datetime]:
    ts = bar.get("time") or bar.get("timestamp") or 0
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return None
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc)
    except Exception:
        return None


# ── Scoring for a historical bar window ───────────────────────────────────────
def _score_bar(pair: str, h1_bars: list[dict], m15_bars: Optional[list[dict]]) -> dict:
    """
    Score a pair at the last bar of h1_bars (historical, no live time used).
    KZ derived from bar timestamp. News always assumed clear.
    """
    if len(h1_bars) < 55:
        return {"score": 0, "grade": "MONITORING", "direction": None, "criteria": {}}

    dec = _price_dec(pair)
    pip = _pip_size(pair)

    def fmt(p: float) -> float:
        return round(p, dec)

    closes    = [b["close"] for b in h1_bars]
    ema50_s   = _ema(closes, 50)
    if not ema50_s:
        return {"score": 0, "grade": "MONITORING", "direction": None, "criteria": {}}

    ema50_val = ema50_s[-1]
    current   = closes[-1]
    trend     = "long" if current > ema50_val else "short"
    atr       = _atr(h1_bars)

    score    = 0
    criteria: dict = {}

    # 1. Kill Zone — use bar timestamp
    in_kz = _bar_in_kz(h1_bars[-1])
    if in_kz:
        score += 25
        criteria["kill_zone"] = {"triggered": True, "points": 25, "detail": "KZ active"}
    else:
        criteria["kill_zone"] = {"triggered": False, "points": 0, "detail": "Outside KZ"}

    # 2. EMA50
    score += 10
    criteria["ema50"] = {
        "triggered": True, "points": 10,
        "detail": f"{'Above' if trend == 'long' else 'Below'} EMA50",
        "trend": trend,
    }

    # 3. Market structure
    structure = _analyze_structure(h1_bars)
    if structure and structure["direction"] == trend:
        score += 15
        criteria["market_structure"] = {"triggered": True, "points": 15, "detail": structure["type"]}
    else:
        criteria["market_structure"] = {"triggered": False, "points": 0, "detail": "No aligned structure"}

    # 4. Order block
    ob_h1  = _find_order_block(h1_bars, trend, pair)
    ob_m15 = _find_order_block(m15_bars, trend, pair) if (m15_bars and len(m15_bars) >= 20) else None
    ob     = ob_m15 or ob_h1
    if ob:
        score += 20
        criteria["order_block"] = {"triggered": True, "points": 20, "detail": f"{ob['type']}", "zone": ob}
    else:
        criteria["order_block"] = {"triggered": False, "points": 0, "detail": "No OB", "zone": None}

    # 5. FVG
    fvg = _find_fvg(h1_bars, trend, pair) or (_find_fvg(m15_bars, trend, pair) if m15_bars else None)
    if fvg:
        score += 15
        criteria["fvg"] = {"triggered": True, "points": 15, "detail": f"FVG {fvg['size_pips']:.1f}p", "zone": fvg}
    else:
        criteria["fvg"] = {"triggered": False, "points": 0, "detail": "No FVG", "zone": None}

    # 6. Premium / Discount
    pd_info = _premium_discount_zone(h1_bars, trend)
    if pd_info["correct"]:
        score += 10
        criteria["premium_discount"] = {"triggered": True, "points": 10, "detail": pd_info["zone"]}
    else:
        criteria["premium_discount"] = {"triggered": False, "points": 0, "detail": pd_info["zone"]}

    # 7. News clear — always TRUE in backtest (no historical news data)
    score += 5
    criteria["news_clear"] = {"triggered": True, "points": 5, "detail": "Assumed clear (backtest)"}

    # Grade
    if score >= 80:   grade = "STRONG"
    elif score >= 60: grade = "WATCH"
    else:             grade = "MONITORING"

    # Entry / SL / TP (same logic as live scorer)
    if ob:
        entry = ob["mid"]
    elif fvg:
        entry = fvg["mid"]
    else:
        entry = current

    sl_buffer = (0.4 * atr) if atr else (3 * pip)
    if trend == "long":
        sl_base   = ob["low"] if ob else fvg["low"] if fvg else min(b["low"] for b in h1_bars[-10:])
        sl        = fmt(sl_base - sl_buffer)
        risk_pips = max((entry - sl) / pip, 1)
    else:
        sl_base   = ob["high"] if ob else fvg["high"] if fvg else max(b["high"] for b in h1_bars[-10:])
        sl        = fmt(sl_base + sl_buffer)
        risk_pips = max((sl - entry) / pip, 1)

    liq = _find_liquidity_targets(h1_bars, trend, entry, pair)
    if trend == "long":
        tp1 = liq[0] if liq else fmt(entry + risk_pips * 1.5 * pip)
    else:
        tp1 = liq[0] if liq else fmt(entry - risk_pips * 1.5 * pip)

    rr = round(abs(tp1 - entry) / max(abs(entry - sl), pip), 2)

    return {
        "score": score, "grade": grade, "direction": trend,
        "criteria": criteria, "entry": fmt(entry),
        "sl": sl, "tp1": fmt(tp1), "rr": rr, "atr": atr,
    }


# ── Simulate trade outcome ─────────────────────────────────────────────────────
def _simulate_outcome(
    direction: str, entry: float, sl: float, tp1: float,
    forward_bars: list[dict],
    max_bars: int = 50,
) -> dict:
    """
    Scan forward_bars to see if SL or TP1 is hit first.
    Returns: { outcome: 'win'|'loss'|'open', rr_actual, bars_held }
    """
    risk = abs(entry - sl)
    if risk == 0:
        return {"outcome": "open", "rr_actual": 0, "bars_held": 0}

    for i, bar in enumerate(forward_bars[:max_bars]):
        if direction == "long":
            if bar["low"] <= sl:
                return {"outcome": "loss", "rr_actual": round(-1.0, 2), "bars_held": i + 1}
            if bar["high"] >= tp1:
                rr = round((tp1 - entry) / risk, 2)
                return {"outcome": "win", "rr_actual": rr, "bars_held": i + 1}
        else:
            if bar["high"] >= sl:
                return {"outcome": "loss", "rr_actual": round(-1.0, 2), "bars_held": i + 1}
            if bar["low"] <= tp1:
                rr = round((entry - tp1) / risk, 2)
                return {"outcome": "win", "rr_actual": rr, "bars_held": i + 1}

    # Still open after max_bars — mark as open (partial)
    return {"outcome": "open", "rr_actual": 0, "bars_held": max_bars}


# ── Per-pair backtest ──────────────────────────────────────────────────────────
def backtest_pair(
    pair: str,
    h1_bars: list[dict],
    m15_bars: Optional[list[dict]],
    min_score: int = 60,
    days: int = 30,
) -> dict:
    """
    Run the ICC backtest for one pair over the last `days` calendar days of data.
    Requires at least 60 H1 bars before the window to warm up indicators.
    """
    if not h1_bars or len(h1_bars) < 70:
        return {
            "pair": pair, "trades": [], "stats": None,
            "error": f"Insufficient data ({len(h1_bars)} bars — need 70+)",
            "bars_available": len(h1_bars),
        }

    # Find the cutoff timestamp (start of window)
    now_ts = _bar_ts(h1_bars[-1]) or datetime.now(timezone.utc)
    cutoff  = now_ts - timedelta(days=days)

    # Minimum 60 warm-up bars before any signal detection
    WARMUP = 60
    trades: list[dict] = []
    prev_score = 0

    for i in range(WARMUP, len(h1_bars) - 1):
        bar_dt = _bar_ts(h1_bars[i])
        if bar_dt and bar_dt < cutoff:
            prev_score = 0
            continue   # outside the requested window

        window_h1  = h1_bars[:i + 1]
        window_m15 = m15_bars[:i * 4] if m15_bars else None  # approx 4 M15 per H1

        result = _score_bar(pair, window_h1, window_m15)
        curr_score = result["score"]

        # Signal on grade threshold crossing (transition only)
        if curr_score >= min_score and prev_score < min_score:
            direction = result["direction"]
            entry     = result["entry"]
            sl        = result["sl"]
            tp1       = result["tp1"]
            rr        = result["rr"]

            if entry and sl and tp1 and direction:
                forward = h1_bars[i + 1:]
                outcome = _simulate_outcome(direction, entry, sl, tp1, forward)

                trade = {
                    "bar_idx":   i,
                    "ts":        bar_dt.isoformat() if bar_dt else None,
                    "score":     curr_score,
                    "direction": direction,
                    "entry":     entry,
                    "sl":        sl,
                    "tp1":       tp1,
                    "rr_planned": rr,
                    **outcome,
                }
                trades.append(trade)

        prev_score = curr_score

    # Compute stats
    closed = [t for t in trades if t["outcome"] != "open"]
    wins   = [t for t in closed if t["outcome"] == "win"]
    losses = [t for t in closed if t["outcome"] == "loss"]

    if not closed:
        stats = {
            "total": len(trades), "closed": 0, "wins": 0, "losses": 0,
            "win_rate": None, "avg_rr": None, "profit_factor": None,
            "best_rr": None, "worst_rr": None, "net_r": 0,
        }
    else:
        rr_vals   = [t["rr_actual"] for t in closed]
        win_rrs   = [t["rr_actual"] for t in wins]
        loss_rrs  = [abs(t["rr_actual"]) for t in losses]
        net_r     = sum(rr_vals)
        pf        = (sum(win_rrs) / sum(loss_rrs)) if loss_rrs and sum(loss_rrs) > 0 else None

        stats = {
            "total":          len(trades),
            "closed":         len(closed),
            "wins":           len(wins),
            "losses":         len(losses),
            "open":           len(trades) - len(closed),
            "win_rate":       round(len(wins) / len(closed) * 100) if closed else None,
            "avg_rr":         round(sum(win_rrs) / len(wins), 2) if wins else 0,
            "profit_factor":  round(pf, 2) if pf else None,
            "best_rr":        round(max(win_rrs), 2) if wins else None,
            "worst_rr":       round(min(rr_vals), 2) if rr_vals else None,
            "net_r":          round(net_r, 2),
        }

    # Equity curve: cumulative R after each closed trade
    equity_curve: list[dict] = []
    running = 0.0
    for t in trades:
        if t["outcome"] == "open":
            continue
        running += t["rr_actual"]
        equity_curve.append({
            "ts":         t["ts"],
            "cumulative": round(running, 2),
            "outcome":    t["outcome"],
            "pair":       pair,
        })

    return {
        "pair":            pair,
        "trades":          trades,
        "stats":           stats,
        "equity_curve":    equity_curve,
        "bars_available":  len(h1_bars),
    }


# ── Combined backtest across all pairs ────────────────────────────────────────
def run_backtest(
    ohlcv_cache: dict,
    pairs: list[str] = None,
    min_score: int   = 60,
    days: int        = 30,
) -> dict:
    """
    Main entry point called from main.py.
    ohlcv_cache: the `_ohlcv_cache` dict from main.py { "PAIR_TF": {bars:[...]} }
    """
    pairs = pairs or PAIRS
    results = []

    for pair in pairs:
        h1_key   = f"{pair}_60"
        m15_key  = f"{pair}_15"
        h1_data  = ohlcv_cache.get(h1_key) or ohlcv_cache.get(pair) or {}
        m15_data = ohlcv_cache.get(m15_key) or {}
        h1_bars  = h1_data.get("bars") or []
        m15_bars = m15_data.get("bars") or []

        result = backtest_pair(pair, h1_bars, m15_bars or None, min_score=min_score, days=days)
        results.append(result)

    # Combined summary
    all_trades  = [t for r in results for t in r["trades"] if t["outcome"] != "open"]
    all_wins    = [t for t in all_trades if t["outcome"] == "win"]
    all_losses  = [t for t in all_trades if t["outcome"] == "loss"]
    all_win_rrs = [t["rr_actual"] for t in all_wins]
    all_los_rrs = [abs(t["rr_actual"]) for t in all_losses]
    net_r       = sum(t["rr_actual"] for t in all_trades)
    pf = (sum(all_win_rrs) / sum(all_los_rrs)) if all_los_rrs and sum(all_los_rrs) > 0 else None

    combined = {
        "total_signals": sum(r["stats"]["total"] for r in results if r.get("stats")),
        "total_closed":  len(all_trades),
        "wins":          len(all_wins),
        "losses":        len(all_losses),
        "win_rate":      round(len(all_wins) / len(all_trades) * 100) if all_trades else None,
        "avg_rr":        round(sum(all_win_rrs) / len(all_wins), 2) if all_wins else None,
        "profit_factor": round(pf, 2) if pf else None,
        "net_r":         round(net_r, 2),
        "best_trade":    round(max(all_win_rrs), 2) if all_win_rrs else None,
        "worst_trade":   round(min(t["rr_actual"] for t in all_trades), 2) if all_trades else None,
    }

    return {
        "results":   results,
        "combined":  combined,
        "params":    {"pairs": pairs, "min_score": min_score, "days": days},
    }
