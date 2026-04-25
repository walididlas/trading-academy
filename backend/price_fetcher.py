"""
Autonomous OHLCV price fetcher using Twelve Data API.

Fetches the last 200 H1 + 200 M15 candles for all tracked pairs every 5 minutes.

Rate limiting (free tier):
  - Max 8 requests/minute → 1 request every ~7.5s
  - We make 4 pairs × 2 timeframes = 8 calls per cycle
  - A 10s delay between each call spreads them over ~80s, safely under the limit

Weekend handling:
  - Forex markets are closed Saturday and Sunday UTC
  - All fetching is skipped on weekends; the existing cache stays valid

Required env var: TWELVEDATA_API_KEY
"""
import asyncio
import logging
import os
from datetime import datetime, timezone

import aiohttp

logger = logging.getLogger(__name__)

# Pair → Twelve Data symbol
TD_SYMBOLS: dict[str, str] = {
    "XAUUSD": "XAU/USD",
    "EURUSD": "EUR/USD",
    "GBPUSD": "GBP/USD",
    "GBPJPY": "GBP/JPY",
}

# Alias kept so main.py's /api/feed/status import still works unchanged
YF_SYMBOLS = TD_SYMBOLS

BASE_URL = "https://api.twelvedata.com/time_series"

# timeframe code → Twelve Data interval string
_TF_MAP: dict[str, str] = {
    "60": "1h",
    "15": "15min",
}

# Seconds between individual API calls — keeps us under 8 req/min on the free tier
_CALL_DELAY = 10


def _is_weekend() -> bool:
    """True on UTC Saturday (5) and Sunday (6) — forex markets closed."""
    return datetime.now(timezone.utc).weekday() >= 5


def _parse_bars(values: list[dict]) -> list[dict]:
    """
    Convert Twelve Data 'values' list to our bar format.
    TD returns values newest-first; we reverse to oldest-first.
    Datetime strings like "2024-01-01 10:00:00" are treated as UTC.
    """
    bars = []
    for v in reversed(values):
        try:
            dt = v["datetime"]
            # Normalise to ISO-8601 with UTC offset so downstream code parses cleanly
            if "T" not in dt and "+" not in dt and "Z" not in dt:
                dt = dt.replace(" ", "T") + "+00:00"
            bars.append({
                "time":   dt,
                "open":   float(v["open"]),
                "high":   float(v["high"]),
                "low":    float(v["low"]),
                "close":  float(v["close"]),
                "volume": float(v.get("volume") or 0),
            })
        except (KeyError, ValueError, TypeError):
            continue
    return bars[-200:]


async def _fetch_one(
    session: aiohttp.ClientSession,
    api_key: str,
    td_symbol: str,
    td_interval: str,
) -> list[dict]:
    """
    Fetch bars for a single pair + timeframe.
    Returns parsed bar list, or [] on any error.
    """
    params = {
        "symbol":     td_symbol,
        "interval":   td_interval,
        "outputsize": 200,
        "apikey":     api_key,
        "format":     "JSON",
    }
    try:
        async with session.get(
            BASE_URL,
            params=params,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as resp:
            if resp.status != 200:
                body = await resp.text()
                logger.warning(
                    "Twelve Data HTTP %d for %s %s: %s",
                    resp.status, td_symbol, td_interval, body[:200],
                )
                return []
            data = await resp.json(content_type=None)
    except Exception as exc:
        logger.warning(
            "Twelve Data request failed (%s %s): %s",
            td_symbol, td_interval, exc,
        )
        return []

    if data.get("status") == "error":
        logger.warning(
            "Twelve Data API error for %s %s: %s",
            td_symbol, td_interval, data.get("message", "unknown"),
        )
        return []

    values = data.get("values", [])
    if not values:
        logger.warning("Twelve Data: empty values for %s %s", td_symbol, td_interval)
        return []

    return _parse_bars(values)


async def fetch_all_pairs(ohlcv_cache: dict, session: aiohttp.ClientSession) -> None:
    """
    Fetch H1 and M15 bars for every pair, one request at a time with a
    _CALL_DELAY second pause between calls.

    Order: XAUUSD/1h, EURUSD/1h, GBPUSD/1h, GBPJPY/1h,
           XAUUSD/15min, EURUSD/15min, GBPUSD/15min, GBPJPY/15min
    Total: 8 calls × 10s delay = ~80 seconds, well within 8 req/min limit.
    """
    api_key = os.getenv("TWELVEDATA_API_KEY", "")
    if not api_key:
        logger.warning("TWELVEDATA_API_KEY not set — skipping price fetch")
        return

    first_call = True
    for tf_code, td_interval in _TF_MAP.items():
        for pair, td_symbol in TD_SYMBOLS.items():
            # Rate-limit: pause before every call except the very first
            if not first_call:
                await asyncio.sleep(_CALL_DELAY)
            first_call = False

            bars = await _fetch_one(session, api_key, td_symbol, td_interval)
            if not bars:
                continue

            key = f"{pair}_{tf_code}"
            ohlcv_cache[key] = {
                "bars":      bars,
                "symbol":    pair,
                "timeframe": tf_code,
                "source":    "twelvedata",
            }
            # Plain-symbol key for H1 backward compat with scanner
            if tf_code == "60":
                ohlcv_cache[pair] = ohlcv_cache[key]

            logger.debug(
                "Twelve Data: %s %s → %d bars",
                pair, td_interval, len(bars),
            )


async def run_price_fetcher(ohlcv_cache: dict, interval_seconds: int = 300) -> None:
    """
    Background task: fetch OHLCV data every `interval_seconds` (default 5 min).
    Skips entirely on weekends — forex markets are closed.
    Uses a persistent aiohttp session for connection reuse.
    """
    logger.info(
        "Price fetcher starting (Twelve Data) — interval %ds, pairs: %s",
        interval_seconds, list(TD_SYMBOLS.keys()),
    )
    async with aiohttp.ClientSession() as session:
        while True:
            if _is_weekend():
                logger.info("Price fetcher: weekend — skipping fetch, markets closed")
            else:
                try:
                    await fetch_all_pairs(ohlcv_cache, session)
                    logger.info("Price fetcher: all pairs refreshed via Twelve Data")
                except Exception as exc:
                    logger.error("Price fetcher loop error: %s", exc)

            await asyncio.sleep(interval_seconds)
