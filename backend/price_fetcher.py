"""
Autonomous OHLCV price fetcher using Twelve Data API.

Fetches the last 200 H1 + 200 M15 candles for all tracked pairs every 5 minutes
and writes them directly into the shared _ohlcv_cache in main.py.

Twelve Data symbol mapping:
  XAUUSD → XAU/USD
  EURUSD → EUR/USD
  GBPUSD → GBP/USD
  GBPJPY → GBP/JPY

All 4 pairs are fetched in a single batch call per timeframe, keeping daily
API usage to ~576 calls (2 calls × 288 five-minute intervals) — well within
the free-tier limit of 800 calls/day.

Required env var: TWELVEDATA_API_KEY
"""
import asyncio
import logging
import os

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


async def fetch_all_pairs(ohlcv_cache: dict, session: aiohttp.ClientSession) -> None:
    """
    Fetch H1 and M15 bars for all pairs in exactly two HTTP requests
    (one per timeframe) using Twelve Data's batch symbol feature.
    Populates ohlcv_cache in-place.
    """
    api_key = os.getenv("TWELVEDATA_API_KEY", "")
    if not api_key:
        logger.warning("TWELVEDATA_API_KEY not set — skipping price fetch")
        return

    # e.g. "XAU/USD,EUR/USD,GBP/USD,GBP/JPY"
    symbols_str = ",".join(TD_SYMBOLS.values())

    for tf_code, td_interval in _TF_MAP.items():
        params = {
            "symbol":     symbols_str,
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
                    logger.warning(
                        "Twelve Data HTTP %d for %s (body: %s)",
                        resp.status, td_interval, await resp.text(),
                    )
                    continue
                data = await resp.json(content_type=None)
        except Exception as exc:
            logger.warning("Twelve Data request failed (%s): %s", td_interval, exc)
            continue

        # Batch response shape: { "XAU/USD": { values: [...], status: "ok" }, ... }
        # Single-symbol fallback (shouldn't occur with 4 symbols but handle it):
        if "values" in data:
            first_td_sym = next(iter(TD_SYMBOLS.values()))
            data = {first_td_sym: data}

        for pair, td_sym in TD_SYMBOLS.items():
            result = data.get(td_sym)
            if not result:
                logger.warning("Twelve Data: no data block for %s (%s)", td_sym, td_interval)
                continue
            if result.get("status") == "error":
                logger.warning(
                    "Twelve Data error for %s %s: %s",
                    td_sym, td_interval, result.get("message", "unknown"),
                )
                continue
            values = result.get("values", [])
            if not values:
                logger.warning("Twelve Data: empty values for %s %s", td_sym, td_interval)
                continue

            bars = _parse_bars(values)
            if not bars:
                continue

            key = f"{pair}_{tf_code}"
            ohlcv_cache[key] = {
                "bars":      bars,
                "symbol":    pair,
                "timeframe": tf_code,
                "source":    "twelvedata",
            }
            # Keep plain-symbol key for H1 (backward compat with scanner)
            if tf_code == "60":
                ohlcv_cache[pair] = ohlcv_cache[key]

            logger.debug("Twelve Data: %s %s → %d bars", pair, td_interval, len(bars))


async def run_price_fetcher(ohlcv_cache: dict, interval_seconds: int = 300) -> None:
    """
    Background task: fetch OHLCV data every `interval_seconds` (default 5 min).
    Uses a single persistent aiohttp session for connection reuse.
    Runs an initial fetch immediately on startup, then sleeps.
    """
    logger.info(
        "Price fetcher starting (Twelve Data) — interval %ds, pairs: %s",
        interval_seconds, list(TD_SYMBOLS.keys()),
    )
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                await fetch_all_pairs(ohlcv_cache, session)
                logger.info("Price fetcher: all pairs refreshed via Twelve Data")
            except Exception as exc:
                logger.error("Price fetcher loop error: %s", exc)
            await asyncio.sleep(interval_seconds)
