"""
Autonomous OHLCV price fetcher using Yahoo Finance (yfinance).

Fetches the last 200 H1 + 200 M15 candles for all tracked pairs every 5 minutes
and writes them directly into the shared _ohlcv_cache in main.py.

Yahoo Finance symbol mapping:
  XAUUSD → GC=F   (COMEX Gold Futures front month — more reliable than XAUUSD=X)
  EURUSD → EURUSD=X
  GBPUSD → GBPUSD=X
  GBPJPY → GBPJPY=X
"""
import asyncio
import logging
from datetime import timezone

logger = logging.getLogger(__name__)

# Pair → Yahoo Finance ticker
YF_SYMBOLS: dict[str, str] = {
    "XAUUSD": "GC=F",       # COMEX Gold Futures (more reliable than XAUUSD=X)
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "GBPJPY": "GBPJPY=X",
}

# Timeframe code → yfinance interval string + period for ~200 bars
_TF_MAP = {
    "60": ("1h",  "30d"),   # H1: 30 days ≈ 720 bars, we'll take last 200
    "15": ("15m", "8d"),    # M15: 8 days ≈ 768 bars, take last 200
}


def _fetch_bars_sync(yf_ticker: str, interval: str, period: str) -> list[dict]:
    """
    Blocking yfinance download — run in executor to avoid blocking event loop.
    Returns list of bar dicts: {time, open, high, low, close, volume}
    """
    import yfinance as yf

    ticker = yf.Ticker(yf_ticker)
    df = ticker.history(interval=interval, period=period, auto_adjust=True)

    if df is None or df.empty:
        return []

    bars = []
    for ts, row in df.iterrows():
        # ts is a pandas Timestamp — convert to UTC ISO string
        try:
            if hasattr(ts, 'tz_convert'):
                utc_ts = ts.tz_convert('UTC')
            elif hasattr(ts, 'tz_localize') and ts.tzinfo is None:
                utc_ts = ts.tz_localize('UTC')
            else:
                utc_ts = ts
            iso = utc_ts.isoformat()
        except Exception:
            iso = str(ts)

        bars.append({
            "time":   iso,
            "open":   float(row["Open"]),
            "high":   float(row["High"]),
            "low":    float(row["Low"]),
            "close":  float(row["Close"]),
            "volume": float(row.get("Volume", 0)),
        })

    # Return last 200 bars only
    return bars[-200:]


async def fetch_all_pairs(ohlcv_cache: dict) -> None:
    """
    Fetch H1 and M15 bars for all pairs and populate ohlcv_cache in-place.
    Runs yfinance downloads in thread pool so the event loop stays unblocked.
    """
    loop = asyncio.get_event_loop()

    for pair, yf_sym in YF_SYMBOLS.items():
        for tf_code, (interval, period) in _TF_MAP.items():
            try:
                bars = await loop.run_in_executor(
                    None, _fetch_bars_sync, yf_sym, interval, period
                )
                if bars:
                    key = f"{pair}_{tf_code}"
                    ohlcv_cache[key] = {
                        "bars":      bars,
                        "symbol":    pair,
                        "timeframe": tf_code,
                        "source":    "yfinance",
                    }
                    # Also keep plain-symbol key for H1 (backward compat)
                    if tf_code == "60":
                        ohlcv_cache[pair] = ohlcv_cache[key]
                    logger.debug("yfinance: %s %s → %d bars", pair, interval, len(bars))
                else:
                    logger.warning("yfinance: empty response for %s %s", pair, interval)
            except Exception as exc:
                logger.warning("yfinance fetch failed for %s %s: %s", pair, interval, exc)

        # Brief pause between pairs to avoid rate-limiting
        await asyncio.sleep(1)


async def run_price_fetcher(ohlcv_cache: dict, interval_seconds: int = 300) -> None:
    """
    Background task: fetch OHLCV data every `interval_seconds` (default 5 min).
    Runs an initial fetch immediately on startup, then loops.
    Writes directly into the shared ohlcv_cache dict passed in from main.py.
    """
    logger.info("Price fetcher starting — interval %ds, pairs: %s",
                interval_seconds, list(YF_SYMBOLS.keys()))

    while True:
        try:
            await fetch_all_pairs(ohlcv_cache)
            logger.info("Price fetcher: all pairs refreshed")
        except Exception as exc:
            logger.error("Price fetcher loop error: %s", exc)

        await asyncio.sleep(interval_seconds)
