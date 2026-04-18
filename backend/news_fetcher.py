"""
Financial news fetcher — polls ForexLive + FXStreet RSS every 60 seconds.
Classifies impact (HIGH/MEDIUM/LOW), detects affected currencies, deduplicates.

Note: Financial Juice requires authentication for live SignalR feed. We use
ForexLive (primary) and FXStreet (secondary) as free, high-quality alternatives.
Both are real-time and forex-focused.
"""
import asyncio
import hashlib
import re
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from typing import Callable

import httpx
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
SOURCES = [
    {"name": "ForexLive", "url": "https://www.forexlive.com/feed/",       "priority": 1},
    {"name": "FXStreet",  "url": "https://www.fxstreet.com/rss/news",     "priority": 2},
]
POLL_INTERVAL = 60   # seconds
MAX_ITEMS = 100      # keep last N items

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# ── Impact keyword sets ───────────────────────────────────────────────────────
HIGH_KEYWORDS = frozenset([
    "nfp", "non-farm payroll", "non farm payroll", "payrolls",
    "cpi", "consumer price index", "inflation", "pce",
    "fed", "fomc", "federal reserve", "rate decision", "rate hike", "rate cut",
    "interest rate", "monetary policy",
    "gdp", "gross domestic product",
    "powell", "lagarde", "bailey", "waller", "ueda", "kuroda",
    "emergency", "recession", "crisis", "war", "attack", "invasion",
    "sanctions", "default", "bankruptcy", "collapse",
    "ecb", "boe", "boj", "rba", "rbnz", "snb",
    "jobs report", "employment report",
])

MEDIUM_KEYWORDS = frozenset([
    "pmi", "purchasing managers", "ism",
    "retail sales", "consumer confidence",
    "unemployment", "jobless claims", "jolts", "adp",
    "trade balance", "current account", "budget",
    "manufacturing", "services", "industrial output",
    "housing", "building permits", "home sales",
    "producer price", "ppi",
    "earnings", "revenue", "profit",
    "oil", "crude", "energy", "gold",
    "central bank", "bank of",
    "tariff", "trade war", "import", "export",
])

# ── Currency / pair detection patterns ───────────────────────────────────────
CURRENCY_PATTERNS: dict[str, list[str]] = {
    "USD": ["dollar", "usd", "fed", "fomc", "powell", "us economy", "united states",
            "nfp", "us gdp", "us cpi", "us jobs", "trump", "whitehouse", "washington"],
    "EUR": ["euro", "eur", "ecb", "lagarde", "eurozone", "europe",
            "germany", "france", "spain", "italy", "deutsch"],
    "GBP": ["pound", "sterling", "gbp", "boe", "bailey", "uk", "britain",
            "england", "london", "sunak", "reeves"],
    "XAU": ["gold", "xau", "precious metal", "bullion", "oz", "troy"],
    "JPY": ["yen", "jpy", "boj", "ueda", "japan", "japanese", "nikkei"],
    "NZD": ["kiwi", "nzd", "rbnz", "new zealand"],
    "AUD": ["aussie", "aud", "rba", "australia", "australian"],
    "CAD": ["loonie", "cad", "boc", "canada", "canadian", "oil"],
    "CHF": ["franc", "chf", "snb", "swiss", "switzerland"],
}

# ── In-memory store ───────────────────────────────────────────────────────────
_news: list[dict] = []
_seen_ids: set[str] = set()


# ── Helpers ───────────────────────────────────────────────────────────────────
def _make_id(title: str, source: str) -> str:
    return hashlib.md5(f"{source}:{title.lower().strip()}".encode()).hexdigest()[:12]


def _detect_impact(text: str) -> str:
    lower = text.lower()
    if any(k in lower for k in HIGH_KEYWORDS):
        return "HIGH"
    if any(k in lower for k in MEDIUM_KEYWORDS):
        return "MEDIUM"
    return "LOW"


def _detect_currencies(text: str) -> list[str]:
    lower = text.lower()
    found = []
    for currency, patterns in CURRENCY_PATTERNS.items():
        if any(p in lower for p in patterns):
            found.append(currency)
    return found or ["GENERAL"]


def _parse_date(date_str: str | None) -> datetime:
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        return parsedate_to_datetime(date_str)
    except Exception:
        pass
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)


def _parse_rss(xml_text: str, source_name: str) -> list[dict]:
    """Parse RSS XML and return list of news items."""
    items = []
    try:
        soup = BeautifulSoup(xml_text, "xml")
        for item in soup.find_all("item"):
            title_el = item.find("title")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            # Some feeds prefix headlines with the site name
            for prefix in ("ForexLive:", "FXStreet:", "investingLive", "Investing.com"):
                if title.startswith(prefix):
                    title = title[len(prefix):].strip()

            pub_el = item.find("pubDate") or item.find("published") or item.find("dc:date")
            dt = _parse_date(pub_el.get_text(strip=True) if pub_el else None)

            link_el = item.find("link")
            link = link_el.get_text(strip=True) if link_el else ""

            news_id = _make_id(title, source_name)
            if news_id in _seen_ids:
                continue

            combined = title + " " + (link or "")
            currencies = _detect_currencies(combined)
            impact = _detect_impact(combined)

            items.append({
                "id":         news_id,
                "title":      title,
                "source":     source_name,
                "impact":     impact,
                "currencies": currencies,
                "timestamp":  dt.isoformat(),
                "utc_ts":     dt.timestamp(),
                "link":       link,
            })
    except Exception:
        pass
    return items


async def fetch_news_once() -> list[dict]:
    """Fetch all sources and return new items."""
    new_items = []
    async with httpx.AsyncClient(headers=HEADERS, timeout=12, follow_redirects=True) as client:
        for source in SOURCES:
            try:
                r = await client.get(source["url"])
                if r.status_code != 200:
                    continue
                parsed = _parse_rss(r.text, source["name"])
                new_items.extend(parsed)
            except Exception:
                pass  # never crash the loop

    # Sort by timestamp descending, deduplicate
    new_items.sort(key=lambda x: x["utc_ts"], reverse=True)
    truly_new = []
    for item in new_items:
        if item["id"] not in _seen_ids:
            _seen_ids.add(item["id"])
            truly_new.append(item)

    return truly_new


def _merge_news(new_items: list[dict]) -> None:
    """Merge new items into store, keep newest MAX_ITEMS."""
    global _news
    _news = (new_items + _news)[:MAX_ITEMS]


async def run_news_fetcher(broadcast: Callable) -> None:
    """
    Background loop: fetch every POLL_INTERVAL seconds,
    broadcast new items via WebSocket.
    """
    # Initial fetch — populate the store
    try:
        initial = await fetch_news_once()
        _merge_news(initial)
    except Exception:
        pass

    while True:
        await asyncio.sleep(POLL_INTERVAL)
        try:
            new_items = await fetch_news_once()
            if new_items:
                _merge_news(new_items)
                import json
                await broadcast(json.dumps({
                    "news_update": new_items,          # only the NEW items
                    "news_count": len(_news),
                }))
        except Exception:
            pass


def get_cached_news(limit: int = 50) -> list[dict]:
    """Return latest cached news for REST endpoint."""
    return _news[:limit]
