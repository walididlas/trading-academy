"""
Professional ICC + SMC Signal Scanner — 7-criterion algorithmic scoring.

Score out of 100 points:
  Kill Zone active               +25
  Valid Order Block (OB)         +20
  Fair Value Gap (FVG)           +15
  Market Structure (BOS/CHoCH)   +15
  EMA50 trend aligned            +10
  Premium / Discount zone        +10
  No recent high-impact news     +5

Grade thresholds:
  80-100 → STRONG (push notification + audio)
  60-79  → WATCH  (page only)
  <60    → MONITORING (status card only)

Upgrades vs v1:
  - Premium/Discount zone detection (new 7th criterion, +10 pts)
  - ATR-based SL placement (replaces fixed pip offset)
  - Swing-level TP targets (BSL/SSL liquidity pools instead of fixed 1R/2R/3R)
  - Multi-timeframe OB confluence detection (H1 + M15 both agree)
  - Fixed FVG pip-size bug (was hardcoded 0.0001 for all pairs)
  - Correct price decimal formatting per pair throughout
  - `confluence_count`, `premium_discount`, `atr`, `liq_targets` in signal output
"""
import asyncio
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Callable

# ── Config ────────────────────────────────────────────────────────────────────
PAIRS         = ["XAUUSD", "EURUSD", "GBPUSD", "GBPJPY"]
SCAN_INTERVAL = 120       # seconds
NEWS_WINDOW   = 20 * 60   # 20 min window for high-impact news penalty
SIGNAL_EXPIRY = 4 * 60 * 60

_last_signals: list[dict] = []

# ── Previous criteria state — for smart transition alerts ─────────────────────
_last_criteria: dict[str, dict] = {}   # pair → criteria dict from last scan

# ── Per-pair STRONG signal tracking (entry status + expiry) ───────────────────
_strong_state: dict[str, dict] = {}
# pair → { fired_at: ISO str, signal: dict, entry_status: 'pending'|'reached'|'expired' }


# ─────────────────────────────── Helpers ──────────────────────────────────────

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

def _is_weekend() -> bool:
    """True on UTC Saturday (5) and Sunday (6) — forex markets are closed."""
    return _utc_now().weekday() >= 5

def _total_mins(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute

def _in_kz() -> bool:
    t = _total_mins(_utc_now())
    return (9 * 60 <= t < 12 * 60) or (14 * 60 + 30 <= t < 17 * 60 + 30)

def _kz_name() -> str | None:
    t = _total_mins(_utc_now())
    if 9 * 60 <= t < 12 * 60:            return "London KZ"
    if 14 * 60 + 30 <= t < 17 * 60 + 30: return "NY KZ"
    return None

def _next_kz_text() -> str:
    t = _total_mins(_utc_now())
    if t < 9 * 60:
        m = 9 * 60 - t
        return f"London opens in {m // 60}h {m % 60}m (10:00 Morocco)"
    if t < 14 * 60 + 30:
        m = 14 * 60 + 30 - t
        return f"NY opens in {m // 60}h {m % 60}m (15:30 Morocco)"
    m = (24 * 60 - t) + 9 * 60
    return f"London tomorrow in {m // 60}h {m % 60}m"

def _pip_size(pair: str) -> float:
    if pair == "XAUUSD": return 0.10
    if "JPY" in pair:    return 0.01
    return 0.0001

def _price_dec(pair: str) -> int:
    if pair == "XAUUSD": return 2
    if "JPY" in pair:    return 3
    return 5

def _ema(values: list[float], period: int) -> list[float]:
    if len(values) < period:
        return []
    k = 2 / (period + 1)
    result = [sum(values[:period]) / period]
    for v in values[period:]:
        result.append(v * k + result[-1] * (1 - k))
    return result

def _atr(bars: list[dict], period: int = 14) -> float | None:
    """Average True Range (Wilder's method) over last `period` bars."""
    if len(bars) < period + 1:
        return None
    trs = []
    for i in range(1, len(bars)):
        b  = bars[i]
        pc = bars[i - 1]["close"]
        trs.append(max(
            b["high"] - b["low"],
            abs(b["high"] - pc),
            abs(b["low"]  - pc),
        ))
    if len(trs) < period:
        return None
    return sum(trs[-period:]) / period


# ─────────────────── Premium / Discount Zone ──────────────────────────────────

def _premium_discount_zone(bars: list[dict], trend: str) -> dict:
    """
    Classify current price position within the 20-bar range.
    Longs want discount (<50%), shorts want premium (>50%).
    """
    recent = bars[-20:]
    high   = max(b["high"] for b in recent)
    low    = min(b["low"]  for b in recent)
    rng    = high - low
    eq     = (high + low) / 2

    if rng == 0:
        return {"zone": "equilibrium", "pct": 50.0, "correct": True, "eq": eq}

    current = bars[-1]["close"]
    pct     = (current - low) / rng * 100   # 0 = at range low, 100 = at range high

    if pct < 37:
        zone = "deep discount"
    elif pct < 50:
        zone = "discount"
    elif pct < 63:
        zone = "equilibrium"
    elif pct < 80:
        zone = "premium"
    else:
        zone = "deep premium"

    correct = (pct < 50) if trend == "long" else (pct > 50)

    return {
        "zone":        zone,
        "pct":         round(pct, 1),
        "correct":     correct,
        "eq":          round(eq, 4),
        "range_high":  round(high, 4),
        "range_low":   round(low, 4),
    }


# ─────────────────── Order Block Detection ────────────────────────────────────

def _find_order_block(bars: list[dict], trend: str, pair: str = "") -> dict | None:
    """
    Find the most recent valid Order Block price is currently testing.
    Quality bar raised: body/range ≥ 40% (was 30%).
    Uses pair-correct decimal rounding.
    """
    if len(bars) < 10:
        return None

    dec     = _price_dec(pair)
    recent  = bars[-40:]
    current = bars[-1]["close"]
    candidates: list[dict] = []

    for i in range(len(recent) - 5):
        c    = recent[i]
        body = abs(c["close"] - c["open"])
        rng  = c["high"] - c["low"]
        if rng == 0 or body / rng < 0.40:
            continue

        next3 = recent[i + 1: i + 4]
        if not next3:
            continue

        if trend == "long" and c["close"] < c["open"]:
            # Bearish candle → potential bullish OB
            impulse_high = max(b["high"] for b in next3)
            if impulse_high <= c["high"]:
                continue
            ob_top = c["open"]   # bearish: open = top of body
            ob_bot = c["close"]  # bearish: close = bottom
            zone_reach = ob_top + (c["high"] - ob_top) * 0.3
            if ob_bot * 0.9995 <= current <= zone_reach:
                candidates.append({
                    "type":      "bullish_ob",
                    "high":      round(c["high"], dec),
                    "low":       round(c["low"],  dec),
                    "body_high": round(ob_top, dec),
                    "body_low":  round(ob_bot, dec),
                    "mid":       round((ob_top + ob_bot) / 2, dec),
                    "strength":  round(body / rng, 3),
                    "age":       len(recent) - i,
                })

        elif trend == "short" and c["close"] > c["open"]:
            # Bullish candle → potential bearish OB
            impulse_low = min(b["low"] for b in next3)
            if impulse_low >= c["low"]:
                continue
            ob_top = c["close"]  # bullish: close = top
            ob_bot = c["open"]   # bullish: open = bottom
            zone_floor = ob_bot - (ob_bot - c["low"]) * 0.3
            if zone_floor <= current <= ob_top * 1.0005:
                candidates.append({
                    "type":      "bearish_ob",
                    "high":      round(c["high"], dec),
                    "low":       round(c["low"],  dec),
                    "body_high": round(ob_top, dec),
                    "body_low":  round(ob_bot, dec),
                    "mid":       round((ob_top + ob_bot) / 2, dec),
                    "strength":  round(body / rng, 3),
                    "age":       len(recent) - i,
                })

    if not candidates:
        return None
    candidates.sort(key=lambda x: (-x["strength"], x["age"]))
    return candidates[0]


# ─────────────────── Fair Value Gap Detection ─────────────────────────────────

def _find_fvg(bars: list[dict], trend: str, pair: str = "") -> dict | None:
    """
    Detect a Fair Value Gap using pair-correct pip size (fixes v1 bug where
    all pairs used 0.0001, making XAUUSD FVGs nearly always pass).
    """
    if len(bars) < 3:
        return None

    pip                = _pip_size(pair)   # pair-specific
    gap_size_threshold = pip * 3           # minimum 3-pip gap

    recent    = bars[-30:]
    current   = bars[-1]["close"]
    candidates: list[dict] = []

    for i in range(len(recent) - 2):
        c1 = recent[i]
        c3 = recent[i + 2]

        if trend == "long":
            if c3["low"] > c1["high"]:
                fvg_low  = c1["high"]
                fvg_high = c3["low"]
                if fvg_high - fvg_low < gap_size_threshold:
                    continue
                if fvg_low * 0.9995 <= current <= fvg_high * 1.001:
                    candidates.append({
                        "type":      "bullish_fvg",
                        "high":      fvg_high,
                        "low":       fvg_low,
                        "mid":       (fvg_high + fvg_low) / 2,
                        "size_pips": round((fvg_high - fvg_low) / pip, 1),
                        "age":       len(recent) - i,
                    })

        elif trend == "short":
            if c3["high"] < c1["low"]:
                fvg_high = c1["low"]
                fvg_low  = c3["high"]
                if fvg_high - fvg_low < gap_size_threshold:
                    continue
                if fvg_low * 0.999 <= current <= fvg_high * 1.0005:
                    candidates.append({
                        "type":      "bearish_fvg",
                        "high":      fvg_high,
                        "low":       fvg_low,
                        "mid":       (fvg_high + fvg_low) / 2,
                        "size_pips": round((fvg_high - fvg_low) / pip, 1),
                        "age":       len(recent) - i,
                    })

    return min(candidates, key=lambda x: x["age"]) if candidates else None


# ─────────────────── Market Structure Analysis ────────────────────────────────

def _swing_highs(bars: list[dict], n: int = 3) -> list[dict]:
    result = []
    for i in range(n, len(bars) - n):
        if all(bars[i]["high"] >= bars[j]["high"]
               for j in range(i - n, i + n + 1) if j != i):
            result.append({"price": bars[i]["high"], "idx": i})
    return result

def _swing_lows(bars: list[dict], n: int = 3) -> list[dict]:
    result = []
    for i in range(n, len(bars) - n):
        if all(bars[i]["low"] <= bars[j]["low"]
               for j in range(i - n, i + n + 1) if j != i):
            result.append({"price": bars[i]["low"], "idx": i})
    return result

def _analyze_structure(bars: list[dict]) -> dict | None:
    if len(bars) < 30:
        return None
    recent = bars[-60:]
    sh     = _swing_highs(recent)
    sl     = _swing_lows(recent)
    if len(sh) < 2 or len(sl) < 2:
        return None

    sh1, sh2 = sh[-2], sh[-1]
    sl1, sl2 = sl[-2], sl[-1]
    price    = recent[-1]["close"]

    # Bullish BOS: Higher High + Higher Low
    if sh2["price"] > sh1["price"] and sl2["price"] > sl1["price"]:
        return {"type": "BOS",   "direction": "long",
                "detail": f"HH({sh2['price']:.4f}) + HL({sl2['price']:.4f})"}
    # Bearish BOS: Lower High + Lower Low
    if sh2["price"] < sh1["price"] and sl2["price"] < sl1["price"]:
        return {"type": "BOS",   "direction": "short",
                "detail": f"LH({sh2['price']:.4f}) + LL({sl2['price']:.4f})"}
    # Bullish CHoCH: bearish sequence, price clears previous swing high
    if sh2["price"] < sh1["price"] and price > sh1["price"]:
        return {"type": "CHoCH", "direction": "long",
                "detail": f"CHoCH above {sh1['price']:.4f}"}
    # Bearish CHoCH: bullish sequence, price breaks previous swing low
    if sl2["price"] > sl1["price"] and price < sl1["price"]:
        return {"type": "CHoCH", "direction": "short",
                "detail": f"CHoCH below {sl1['price']:.4f}"}
    return None


# ─────────────────── Liquidity Targets (BSL / SSL) ────────────────────────────

def _find_liquidity_targets(
    bars: list[dict], trend: str, entry: float, pair: str = ""
) -> list[float]:
    """
    Find swing-level liquidity pools as TP targets.
    Long  → BSL: swing highs above entry (where stops cluster)
    Short → SSL: swing lows  below entry
    Returns up to 3 targets nearest-first.
    """
    dec    = _price_dec(pair)
    recent = bars[-80:]

    if trend == "long":
        sh = _swing_highs(recent, n=2)
        targets = sorted(
            round(s["price"], dec)
            for s in sh if s["price"] > entry * 1.0003
        )
    else:
        sl = _swing_lows(recent, n=2)
        targets = sorted(
            (round(s["price"], dec) for s in sl if s["price"] < entry * 0.9997),
            reverse=True,
        )
    return targets[:3]


# ─────────────────── Main Scorer ──────────────────────────────────────────────

def _score_pair(
    pair: str,
    h1_bars: list[dict],
    m15_bars: list[dict] | None,
) -> dict:
    now = _utc_now()
    dec = _price_dec(pair)
    pip = _pip_size(pair)

    def fmt(p: float) -> float:
        return round(p, dec)

    # ── Not enough data ────────────────────────────────────────────────────────
    if not h1_bars or len(h1_bars) < 55:
        return {
            "pair": pair, "direction": None, "score": 0, "grade": "MONITORING",
            "reason": "Insufficient data — push OHLCV via /api/feed",
            "criteria": {}, "timestamp": now.isoformat(),
        }

    # ── EMA50 (sets trend direction — runs before scoring) ────────────────────
    closes    = [b["close"] for b in h1_bars]
    ema50_s   = _ema(closes, 50)
    if not ema50_s:
        return {"pair": pair, "score": 0, "grade": "MONITORING",
                "reason": "EMA50 not ready", "criteria": {}, "timestamp": now.isoformat()}

    ema50_val = ema50_s[-1]
    current   = closes[-1]
    trend     = "long" if current > ema50_val else "short"

    # ── ATR (for SL sizing) ───────────────────────────────────────────────────
    atr = _atr(h1_bars)

    score    = 0
    criteria: dict[str, dict] = {}

    # ── 1. Kill Zone (+25) ────────────────────────────────────────────────────
    in_kz   = _in_kz()
    kz_name = _kz_name()
    if in_kz:
        score += 25
        criteria["kill_zone"] = {"triggered": True,  "points": 25, "detail": kz_name}
    else:
        criteria["kill_zone"] = {"triggered": False, "points": 0,  "detail": _next_kz_text()}

    # ── 2. EMA50 aligned (+10) ────────────────────────────────────────────────
    score += 10
    ema_dist_pct = abs(current - ema50_val) / ema50_val * 100
    criteria["ema50"] = {
        "triggered": True, "points": 10,
        "detail": (f"{'Above' if trend == 'long' else 'Below'} EMA50 "
                   f"@{fmt(ema50_val)} ({ema_dist_pct:.2f}% separation)"),
        "trend": trend,
    }

    # ── 3. Market Structure (+15) ─────────────────────────────────────────────
    structure = _analyze_structure(h1_bars)
    if structure and structure["direction"] == trend:
        score += 15
        criteria["market_structure"] = {
            "triggered": True, "points": 15,
            "detail": f"{structure['type']} — {structure['detail']}",
        }
    else:
        miss = ("Structure unclear" if not structure
                else f"Structure {structure['direction']} ≠ trend {trend}")
        criteria["market_structure"] = {"triggered": False, "points": 0, "detail": miss}

    # ── 4. Order Block (+20) — prefer M15; bonus note for H1+M15 confluence ───
    ob_h1  = _find_order_block(h1_bars,  trend, pair)
    ob_m15 = (_find_order_block(m15_bars, trend, pair)
               if m15_bars and len(m15_bars) >= 20 else None)
    ob     = ob_m15 or ob_h1          # prefer finer timeframe
    ob_tf  = "M15" if ob_m15 else "H1"
    mtf    = bool(ob_h1 and ob_m15)   # both timeframes confirmed

    if ob:
        score += 20
        detail = (f"{ob_tf} {ob['type'].replace('_ob', '').title()} OB "
                  f"{fmt(ob['low'])}–{fmt(ob['high'])}")
        if mtf:
            detail += " · H1+M15 ✓"
        criteria["order_block"] = {
            "triggered": True, "points": 20,
            "detail": detail, "zone": ob, "mtf_confluence": mtf,
        }
    else:
        criteria["order_block"] = {
            "triggered": False, "points": 0,
            "detail": "No OB at current price", "zone": None, "mtf_confluence": False,
        }

    # ── 5. FVG (+15) — uses pair-correct pip size ─────────────────────────────
    fvg = _find_fvg(h1_bars, trend, pair) or (
          _find_fvg(m15_bars, trend, pair) if m15_bars else None)
    if fvg:
        score += 15
        criteria["fvg"] = {
            "triggered": True, "points": 15,
            "detail": f"FVG {fmt(fvg['low'])}–{fmt(fvg['high'])} ({fvg['size_pips']:.1f} pips)",
            "zone": fvg,
        }
    else:
        criteria["fvg"] = {
            "triggered": False, "points": 0, "detail": "No FVG in confluence", "zone": None,
        }

    # ── 6. Premium / Discount zone (+10) ─────────────────────────────────────
    pd_info = _premium_discount_zone(h1_bars, trend)
    if pd_info["correct"]:
        score += 10
        criteria["premium_discount"] = {
            "triggered": True, "points": 10,
            "detail": (f"In {pd_info['zone']} ({pd_info['pct']:.0f}% of range) "
                       f"— ideal entry zone for {trend}"),
        }
    else:
        criteria["premium_discount"] = {
            "triggered": False, "points": 0,
            "detail": (f"At {pd_info['pct']:.0f}% — needs "
                       f"{'discount <50%' if trend == 'long' else 'premium >50%'}"),
        }

    # ── 7. News clear (+5) ────────────────────────────────────────────────────
    try:
        from news_fetcher import get_cached_news
        recent_high = [
            n for n in get_cached_news(50)
            if n.get("impact") == "HIGH"
            and (now.timestamp() - n.get("utc_ts", 0)) < NEWS_WINDOW
        ]
        if not recent_high:
            score += 5
            criteria["news_clear"] = {
                "triggered": True, "points": 5,
                "detail": "No high-impact news in last 20min",
            }
        else:
            criteria["news_clear"] = {
                "triggered": False, "points": 0,
                "detail": f"{len(recent_high)} high-impact event(s) in last 20min",
            }
    except ImportError:
        score += 5
        criteria["news_clear"] = {"triggered": True, "points": 5, "detail": "News module unavailable"}

    # ── Confluence count ───────────────────────────────────────────────────────
    confluence_count = sum(1 for v in criteria.values() if v.get("triggered"))

    # ── Grade ─────────────────────────────────────────────────────────────────
    if score >= 80:
        grade = "STRONG"
    elif score >= 60:
        grade = "WATCH"
    else:
        missing = [k for k, v in criteria.items() if not v["triggered"]]
        return {
            "pair": pair, "direction": trend, "score": score, "grade": "MONITORING",
            "reason": f"Score {score}/100 — Need: {', '.join(missing[:3])}",
            "criteria": criteria,
            "ema50":            fmt(ema50_val),
            "atr":              round(atr, dec) if atr else None,
            "premium_discount": pd_info,
            "confluence_count": confluence_count,
            "timestamp":        now.isoformat(),
        }

    # ── Entry — OB mid → FVG mid → current price ─────────────────────────────
    if ob:
        entry = ob["mid"]
    elif fvg:
        entry = fvg["mid"]
    else:
        entry = current

    # ── SL — structural level + ATR buffer ───────────────────────────────────
    sl_buffer = (0.4 * atr) if atr else (3 * pip)
    if trend == "long":
        sl_base   = (ob["low"] if ob
                     else fvg["low"] if fvg
                     else min(b["low"] for b in h1_bars[-10:]))
        sl        = sl_base - sl_buffer
        risk_pips = max((entry - sl) / pip, 1)
    else:
        sl_base   = (ob["high"] if ob
                     else fvg["high"] if fvg
                     else max(b["high"] for b in h1_bars[-10:]))
        sl        = sl_base + sl_buffer
        risk_pips = max((sl - entry) / pip, 1)

    # ── TP — swing liquidity pools, fallback to mathematical R:R ─────────────
    liq = _find_liquidity_targets(h1_bars, trend, entry, pair)
    liq_type = "BSL" if trend == "long" else "SSL"

    if trend == "long":
        tp1 = liq[0] if len(liq) > 0 else fmt(entry + risk_pips * 1 * pip)
        tp2 = liq[1] if len(liq) > 1 else fmt(entry + risk_pips * 2 * pip)
        tp3 = liq[2] if len(liq) > 2 else fmt(entry + risk_pips * 3 * pip)
        risk_d = entry - sl if entry > sl else 1
        rr1  = round((tp1 - entry) / risk_d, 2)
        rr2  = round((tp2 - entry) / risk_d, 2)
        rr3  = round((tp3 - entry) / risk_d, 2)
        pt1  = round((tp1 - entry) / pip, 1)
        pt2  = round((tp2 - entry) / pip, 1)
        pt3  = round((tp3 - entry) / pip, 1)
    else:
        tp1 = liq[0] if len(liq) > 0 else fmt(entry - risk_pips * 1 * pip)
        tp2 = liq[1] if len(liq) > 1 else fmt(entry - risk_pips * 2 * pip)
        tp3 = liq[2] if len(liq) > 2 else fmt(entry - risk_pips * 3 * pip)
        risk_d = sl - entry if sl > entry else 1
        rr1  = round((entry - tp1) / risk_d, 2)
        rr2  = round((entry - tp2) / risk_d, 2)
        rr3  = round((entry - tp3) / risk_d, 2)
        pt1  = round((entry - tp1) / pip, 1)
        pt2  = round((entry - tp2) / pip, 1)
        pt3  = round((entry - tp3) / pip, 1)

    expires_at = (now + timedelta(seconds=SIGNAL_EXPIRY)).isoformat()

    return {
        "pair":             pair,
        "direction":        trend,
        "timeframe":        ob_tf if ob else "H1",
        "score":            score,
        "grade":            grade,
        "criteria":         criteria,
        "confluence_count": confluence_count,
        "premium_discount": pd_info,
        # Trade levels
        "entry":  fmt(entry),
        "sl":     fmt(sl),
        "tp1":    fmt(tp1),
        "tp2":    fmt(tp2),
        "tp3":    fmt(tp3),
        "rr1":    rr1,
        "rr2":    rr2,
        "rr3":    rr3,
        # Pip distances from entry
        "pip_sl":  round(risk_pips, 1),
        "pip_tp1": pt1,
        "pip_tp2": pt2,
        "pip_tp3": pt3,
        "pip_size": pip,
        # Liquidity pool targets
        "liq_targets": liq,
        "liq_type":    liq_type,
        # Zones (for setup diagram)
        "ob_zone":  ob,
        "fvg_zone": fvg,
        # Market context
        "ema50": fmt(ema50_val),
        "atr":   round(atr, dec) if atr else None,
        # Timestamps
        "timestamp":  now.isoformat(),
        "expires_at": expires_at,
    }


# ─────────────────── Outcome check ───────────────────────────────────────────

async def _schedule_outcome_check(pair: str, sig: dict) -> None:
    """
    30 minutes after a STRONG signal fires, send a follow-up push notification
    asking the user if they took the trade.  Three action buttons are included:
    taken / missed / skipped.
    """
    await asyncio.sleep(30 * 60)
    try:
        from push_notifier import send_push_with_actions
        _dir   = sig.get("direction", "long")
        _arrow = "▲ LONG" if _dir == "long" else "▼ SHORT"
        _entry = sig.get("entry", "—")
        await send_push_with_actions(
            title=f"📋 Did you take {pair} {_arrow}?",
            body=f"STRONG signal · Entry {_entry} · Score {sig.get('score')}pts · 30 min ago",
            tag=f"outcome-{pair}",
            actions=[
                {"action": "taken",   "title": "✅ Yes, taken"},
                {"action": "missed",  "title": "❌ Missed entry"},
                {"action": "skipped", "title": "⏭ Skipped"},
            ],
            pair=pair,
            signal=sig,
        )
    except Exception:
        pass


# ─────────────────── Scanner Loop ─────────────────────────────────────────────

async def run_scanner(broadcast: Callable, get_ohlcv_fn: Callable) -> None:
    """Background scanner. `get_ohlcv_fn(symbol, timeframe)` → {bars: [...]}"""
    global _last_signals, _last_criteria

    while True:
        try:
            # ── Weekend: markets closed — emit closed signals and skip scoring ──
            if _is_weekend():
                closed_signals = [
                    {
                        "pair":      pair,
                        "score":     0,
                        "grade":     "CLOSED",
                        "reason":    "Markets closed — opens Monday",
                        "direction": None,
                        "timestamp": _utc_now().isoformat(),
                        "criteria":  {},
                    }
                    for pair in PAIRS
                ]
                _last_signals = closed_signals
                await broadcast(json.dumps({"signals": closed_signals, "market_closed": True}))
                # Check every 5 minutes on weekends — no point scanning more often
                await asyncio.sleep(300)
                continue

            signals:       list[dict] = []
            strong_alerts: list[dict] = []
            smart_events:  list[dict] = []   # extra WS events for targeted alerts

            for pair in PAIRS:
                try:
                    h1_data  = await get_ohlcv_fn(pair, "60")
                    m15_data = await get_ohlcv_fn(pair, "15")
                    h1_bars  = h1_data.get("bars") or []
                    m15_bars = m15_data.get("bars") or []
                    sig = _score_pair(pair, h1_bars, m15_bars or None)
                except Exception as e:
                    sig = {
                        "pair": pair, "score": 0, "grade": "MONITORING",
                        "reason": f"Data error: {e}",
                        "timestamp": _utc_now().isoformat(), "criteria": {},
                    }

                signals.append(sig)

                now       = _utc_now()
                prev      = next((s for s in _last_signals if s.get("pair") == pair), None)
                prev_crit = _last_criteria.get(pair, {})
                curr_crit = sig.get("criteria", {})

                prev_grade = prev.get("grade") if prev else None
                prev_score = prev.get("score", 0) if prev else 0
                curr_score = sig.get("score", 0)

                # ── Entry status tracking (expiry + reached detection) ─────────
                curr_grade = sig.get("grade")
                if curr_grade == "STRONG":
                    if pair not in _strong_state or prev_grade != "STRONG":
                        # New STRONG — initialise tracking
                        _strong_state[pair] = {
                            "fired_at":     now.isoformat(),
                            "signal":       dict(sig),
                            "entry_status": "pending",
                        }
                    else:
                        st = _strong_state[pair]
                        if st["entry_status"] == "pending":
                            # Check if price reached original entry
                            cur_price  = h1_bars[-1]["close"] if h1_bars else None
                            orig_entry = st["signal"].get("entry")
                            direction  = st["signal"].get("direction")
                            if cur_price and orig_entry:
                                tol = 5 * _pip_size(pair)
                                ep  = float(orig_entry)
                                if ((direction == "long"  and cur_price <= ep + tol) or
                                        (direction == "short" and cur_price >= ep - tol)):
                                    st["entry_status"] = "reached"
                            # Check 4-hour expiry
                            try:
                                fired_dt = datetime.fromisoformat(st["fired_at"])
                                if (now - fired_dt).total_seconds() >= SIGNAL_EXPIRY:
                                    st["entry_status"] = "expired"
                                    orig_sig = st["signal"]
                                    smart_events.append({
                                        "entry_expired": {
                                            "pair":      pair,
                                            "direction": orig_sig.get("direction"),
                                            "entry":     orig_sig.get("entry"),
                                            "score":     orig_sig.get("score"),
                                            "fired_at":  st["fired_at"],
                                            "ts":        now.isoformat(),
                                        }
                                    })
                                    # Restart tracking with the current (fresh) signal
                                    _strong_state[pair] = {
                                        "fired_at":     now.isoformat(),
                                        "signal":       dict(sig),
                                        "entry_status": "pending",
                                    }
                                    # Schedule outcome check for fresh setup
                                    asyncio.create_task(_schedule_outcome_check(pair, sig))
                                    # Push fresh-setup alert if levels moved materially
                                    new_e  = float(sig.get("entry") or 0)
                                    orig_e = float(orig_sig.get("entry") or 0)
                                    if (abs(new_e - orig_e) > 5 * _pip_size(pair) or
                                            sig.get("direction") != orig_sig.get("direction")):
                                        try:
                                            from push_notifier import send_push
                                            _dir2   = sig.get("direction", "long")
                                            _arrow2 = "▲ BUY" if _dir2 == "long" else "▼ SELL"
                                            asyncio.create_task(send_push(
                                                title=f"🔄 {pair} {_arrow2} — Fresh Setup",
                                                body=(
                                                    f"Prev. entry expired · New entry {sig.get('entry')} "
                                                    f"· SL {sig.get('sl')} · TP1 {sig.get('tp1')} · Score {sig.get('score')}pts"
                                                ),
                                                tag=f"signal-{pair}", type_="signal", url="/signals",
                                            ))
                                        except Exception:
                                            pass
                            except Exception:
                                pass
                    sig["entry_status"] = _strong_state.get(pair, {}).get("entry_status", "pending")
                elif pair in _strong_state:
                    del _strong_state[pair]

                # ── STRONG transition → push alert (manual execution on MT5) ────
                if sig.get("grade") == "STRONG" and prev_grade != "STRONG":
                    strong_alerts.append(sig)
                    try:
                        from push_notifier import send_push
                        _dir   = sig.get("direction", "long")
                        _arrow = "▲ BUY" if _dir == "long" else "▼ SELL"
                        _entry = sig.get("entry", "—")
                        _sl    = sig.get("sl",    "—")
                        _tp1   = sig.get("tp1",   "—")
                        _tp2   = sig.get("tp2",   "—")
                        _psl   = sig.get("pip_sl")
                        _lots_hint = f" · ~{sig.get('pip_sl')}p SL" if _psl else ""
                        asyncio.create_task(send_push(
                            title=f"🔥 {pair} {_arrow} — {curr_score}pts STRONG",
                            body=(
                                f"Entry {_entry} · SL {_sl} · TP1 {_tp1} · TP2 {_tp2}"
                                f"{_lots_hint} · Tap to log outcome"
                            ),
                            tag=f"signal-{pair}", type_="signal", url="/signals",
                            pair=pair,
                        ))
                    except Exception:
                        pass
                    # Schedule 30-min outcome check
                    asyncio.create_task(_schedule_outcome_check(pair, sig))

                # ── Score crosses 70 for the first time (WATCH alert) ──────────
                elif curr_score >= 70 and prev_score < 70 and sig.get("grade") != "STRONG":
                    smart_events.append({
                        "watch_alert": {
                            "pair":      pair,
                            "score":     curr_score,
                            "direction": sig.get("direction"),
                            "reason":    sig.get("reason", ""),
                        }
                    })
                    try:
                        from push_notifier import send_push
                        _dir = sig.get("direction", "long")
                        _arrow = "▲" if _dir == "long" else "▼"
                        asyncio.create_task(send_push(
                            title=f"👀 {pair} {_arrow} Watch Signal ({curr_score}pts)",
                            body=sig.get("reason", "Score crossed 70 — monitor for entry"),
                            tag=f"watch-{pair}", type_="killzone", url="/signals",
                        ))
                    except Exception:
                        pass

                # ── Market structure break (criterion just turned True) ─────────
                ms_prev = prev_crit.get("market_structure", {}).get("triggered", False)
                ms_curr = curr_crit.get("market_structure", {}).get("triggered", False)
                if ms_curr and not ms_prev and curr_score >= 60:
                    smart_events.append({
                        "structure_break": {
                            "pair":      pair,
                            "direction": sig.get("direction"),
                            "detail":    curr_crit.get("market_structure", {}).get("detail", ""),
                            "score":     curr_score,
                        }
                    })

                # ── Optimal entry zone just reached ────────────────────────────
                pd_prev = prev_crit.get("premium_discount", {}).get("triggered", False)
                pd_curr = curr_crit.get("premium_discount", {}).get("triggered", False)
                if pd_curr and not pd_prev and curr_score >= 60:
                    pd     = sig.get("premium_discount", {})
                    smart_events.append({
                        "entry_zone": {
                            "pair":      pair,
                            "direction": sig.get("direction"),
                            "zone":      pd.get("zone", ""),
                            "pct":       pd.get("pct"),
                            "score":     curr_score,
                        }
                    })

                _last_criteria[pair] = curr_crit

            _last_signals = signals
            payload: dict = {"signals": signals}
            if strong_alerts:
                payload["alert"] = strong_alerts[0]

            await broadcast(json.dumps(payload))

            # Broadcast smart events individually (separate WS messages)
            for event in smart_events:
                await broadcast(json.dumps(event))

        except Exception:
            pass

        await asyncio.sleep(SCAN_INTERVAL)


def get_cached_signals() -> list[dict]:
    if _last_signals:
        return _last_signals
    return [
        {
            "pair": p, "score": 0, "grade": "MONITORING",
            "reason": "Starting up — first scan in ~2 minutes...",
            "timestamp": _utc_now().isoformat(), "criteria": {},
        }
        for p in PAIRS
    ]


async def rescan_pair(pair: str, get_ohlcv_fn: Callable, broadcast: Callable) -> dict:
    """
    Force an immediate single-pair scan (called when user reports missed/skipped outcome).
    Updates the cached signal for this pair, broadcasts updated signals,
    and fires a push notification if a fresh STRONG setup is found.
    """
    global _last_signals

    pair = pair.upper()
    if pair not in PAIRS:
        return {"error": f"Unknown pair: {pair}"}

    try:
        h1_data  = await get_ohlcv_fn(pair, "60")
        m15_data = await get_ohlcv_fn(pair, "15")
        h1_bars  = h1_data.get("bars") or []
        m15_bars = m15_data.get("bars") or []
        sig = _score_pair(pair, h1_bars, m15_bars or None)
    except Exception as e:
        return {"error": str(e)}

    # Splice the new signal into the cached list
    updated = [sig if s.get("pair") == pair else s for s in _last_signals]
    if not any(s.get("pair") == pair for s in updated):
        updated.append(sig)
    _last_signals = updated

    await broadcast(json.dumps({"signals": _last_signals}))

    # Push notification only if a fresh STRONG setup was found
    if sig.get("grade") == "STRONG" and pair not in _strong_state:
        _strong_state[pair] = {
            "fired_at":     _utc_now().isoformat(),
            "signal":       dict(sig),
            "entry_status": "pending",
        }
        try:
            from push_notifier import send_push
            _dir   = sig.get("direction", "long")
            _arrow = "▲ BUY" if _dir == "long" else "▼ SELL"
            await send_push(
                title=f"🔄 {pair} {_arrow} — Fresh Setup Found",
                body=(
                    f"Entry {sig.get('entry')} · SL {sig.get('sl')} "
                    f"· TP1 {sig.get('tp1')} · Score {sig.get('score')}pts"
                ),
                tag=f"signal-{pair}", type_="signal", url="/signals",
                pair=pair,
            )
        except Exception:
            pass

    return sig
