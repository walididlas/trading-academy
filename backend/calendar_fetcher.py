"""
Economic calendar fetcher — ForexFactory weekly JSON.
Source: https://nfs.faireconomy.media/ff_calendar_thisweek.json

Fields: title, country (currency code), date (ISO with tz), impact, forecast, previous

Refreshes every 30 minutes. Exposes:
  get_upcoming_events(minutes)         → list of events in next N minutes
  get_news_risk_for_pair(pair, minutes) → {'level': 'HIGH'|'MEDIUM'|'NONE', 'events': [...]}
  get_next_high_event()                → next HIGH-impact event globally or None
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

# ── Config ────────────────────────────────────────────────────────────────────
CALENDAR_URL    = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
CALENDAR_URL_NW = "https://nfs.faireconomy.media/ff_calendar_nextweek.json"
REFRESH_INTERVAL = 30 * 60  # 30 minutes

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TradingAcademy/1.0)"}

# ── Currency → pairs that are affected ───────────────────────────────────────
PAIR_CURRENCIES: dict[str, list[str]] = {
    "EURUSD": ["EUR", "USD"],
    "GBPUSD": ["GBP", "USD"],
    "XAUUSD": ["USD"],          # gold moves on USD events primarily
    "NZDJPY": ["NZD", "JPY"],
    "GBPJPY": ["GBP", "JPY"],
    "USDJPY": ["USD", "JPY"],
    "AUDUSD": ["AUD", "USD"],
    "USDCAD": ["USD", "CAD"],
    "USDCHF": ["USD", "CHF"],
}

# ── In-memory store ───────────────────────────────────────────────────────────
_events: list[dict] = []   # parsed events with utc_ts field


def _parse_events(raw: list[dict]) -> list[dict]:
    """Parse raw calendar JSON → list of dicts with `utc_ts` (float)."""
    parsed = []
    for ev in raw:
        date_str = ev.get("date", "")
        impact   = ev.get("impact", "Low")
        if impact not in ("High", "Medium", "Low"):
            continue  # skip holidays / 'All'
        country = ev.get("country", "")
        if not country or country == "All":
            continue
        try:
            dt = datetime.fromisoformat(date_str)
            dt_utc = dt.astimezone(timezone.utc)
        except Exception:
            continue
        parsed.append({
            "title":     ev.get("title", ""),
            "currency":  country,
            "impact":    impact,
            "date":      date_str,
            "utc_ts":    dt_utc.timestamp(),
            "forecast":  ev.get("forecast", ""),
            "previous":  ev.get("previous", ""),
        })
    return parsed


async def _fetch_and_store() -> None:
    """Fetch calendar(s) and update _events."""
    global _events
    combined: list[dict] = []

    async with httpx.AsyncClient(headers=HEADERS, timeout=12, follow_redirects=True) as client:
        for url in (CALENDAR_URL, CALENDAR_URL_NW):
            try:
                r = await client.get(url)
                if r.status_code == 200:
                    raw = r.json()
                    combined.extend(_parse_events(raw))
            except Exception:
                pass

    if combined:
        # Sort by time, deduplicate by title+currency+ts
        seen = set()
        deduped = []
        for ev in sorted(combined, key=lambda x: x["utc_ts"]):
            key = (ev["title"], ev["currency"], int(ev["utc_ts"] // 60))
            if key not in seen:
                seen.add(key)
                deduped.append(ev)
        _events = deduped


async def run_calendar_fetcher() -> None:
    """Background loop: fetch once immediately, then every 30 minutes."""
    while True:
        try:
            await _fetch_and_store()
        except Exception:
            pass
        await asyncio.sleep(REFRESH_INTERVAL)


# ── Public API ────────────────────────────────────────────────────────────────

def _now_ts() -> float:
    return datetime.now(timezone.utc).timestamp()


def get_upcoming_events(minutes: int = 60) -> list[dict]:
    """Events that will happen in the next `minutes` minutes (future only)."""
    now = _now_ts()
    cutoff = now + minutes * 60
    return [
        {**ev, "minutes_until": round((ev["utc_ts"] - now) / 60, 1)}
        for ev in _events
        if now <= ev["utc_ts"] <= cutoff
    ]


def get_past_events(minutes: int = 20) -> list[dict]:
    """Events that happened in the last `minutes` minutes."""
    now = _now_ts()
    cutoff = now - minutes * 60
    return [
        {**ev, "minutes_ago": round((now - ev["utc_ts"]) / 60, 1)}
        for ev in _events
        if cutoff <= ev["utc_ts"] <= now
    ]


def get_news_risk_for_pair(pair: str, window_minutes: int = 30) -> dict:
    """
    Return news risk level for a given pair within the next `window_minutes`.

    Returns:
      { level: 'HIGH'|'MEDIUM'|'NONE',
        events: [...matching events with minutes_until],
        next_event: {...} | None }
    """
    currencies = PAIR_CURRENCIES.get(pair.upper(), [])
    upcoming = get_upcoming_events(window_minutes)
    also_past = get_past_events(5)  # events that JUST dropped (within 5 min)

    relevant = [
        ev for ev in (upcoming + also_past)
        if ev["currency"] in currencies
    ]
    relevant.sort(key=lambda x: x.get("utc_ts", 0))

    if not relevant:
        return {"level": "NONE", "events": [], "next_event": None}

    max_impact = "NONE"
    for ev in relevant:
        if ev["impact"] == "High":
            max_impact = "HIGH"
            break
        if ev["impact"] == "Medium" and max_impact == "NONE":
            max_impact = "MEDIUM"

    return {
        "level":      max_impact,
        "events":     relevant,
        "next_event": relevant[0] if relevant else None,
    }


def get_next_high_event() -> Optional[dict]:
    """Global next HIGH-impact event (for ticker countdown)."""
    now = _now_ts()
    highs = [ev for ev in _events if ev["impact"] == "High" and ev["utc_ts"] > now]
    if not highs:
        return None
    ev = min(highs, key=lambda x: x["utc_ts"])
    return {**ev, "minutes_until": round((ev["utc_ts"] - now) / 60, 1)}


def get_all_events_today() -> list[dict]:
    """All today's events for the calendar view."""
    now = _now_ts()
    today_start = now - (now % 86400)
    today_end   = today_start + 86400
    return [
        {**ev, "minutes_until": round((ev["utc_ts"] - now) / 60, 1)}
        for ev in _events
        if today_start <= ev["utc_ts"] <= today_end
    ]


def get_cached_calendar() -> dict:
    """Full calendar payload for REST endpoint."""
    return {
        "upcoming_30m":  get_upcoming_events(30),
        "upcoming_60m":  get_upcoming_events(60),
        "next_high":     get_next_high_event(),
        "today":         get_all_events_today(),
        "risk_by_pair":  {
            pair: get_news_risk_for_pair(pair)
            for pair in PAIR_CURRENCIES
        },
    }
