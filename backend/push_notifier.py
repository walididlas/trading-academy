"""
Web Push notification sender using VAPID keys (pywebpush).

Subscriptions are stored in memory. On Railway restart the browser re-subscribes
automatically the next time the app is opened — no database required.

Required environment variables:
  VAPID_PUBLIC_KEY   — base64url-encoded uncompressed EC P-256 public key (87 chars)
  VAPID_PRIVATE_KEY  — base64url-encoded 32-byte EC P-256 private key

URL routes embedded in push payloads so tapping the notification opens the right page:
  signal / outcome_check                    → /signals
  killzone / kz_warning                     → /signals
  news_warning                              → /signals
  weekly_report                             → /
"""
import asyncio
import json
import logging
import os

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY: str = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY:  str = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS = {"sub": "mailto:admin@trading-academy.app"}

# ── In-memory subscription store ──────────────────────────────────────────────
_subscriptions: list[dict] = []


def add_subscription(sub: dict) -> None:
    """Add or update a push subscription (dedup by endpoint)."""
    endpoint = sub.get("endpoint", "")
    if not endpoint:
        return
    remove_subscription(endpoint)   # remove old entry for same endpoint
    _subscriptions.append(sub)
    logger.info("Push subscription registered. Total subscribers: %d", len(_subscriptions))


def remove_subscription(endpoint: str) -> None:
    dead = [s for s in _subscriptions if s.get("endpoint") == endpoint]
    for s in dead:
        _subscriptions.remove(s)


def get_subscription_count() -> int:
    return len(_subscriptions)


# ── Sync sender (runs in thread pool) ─────────────────────────────────────────

def _send_one_sync(sub: dict, payload: str) -> str | None:
    """
    Send a single push notification.
    Returns the endpoint string if delivery failed with 410/404 (expired subscription).
    Raises on other errors.
    """
    from pywebpush import webpush, WebPushException
    try:
        webpush(
            subscription_info=sub,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return None
    except WebPushException as exc:
        resp = exc.response
        if resp is not None and resp.status_code in (404, 410):
            return sub.get("endpoint", "")
        raise exc


# ── Async public interface ─────────────────────────────────────────────────────

async def send_push(
    title:   str,
    body:    str,
    tag:     str  = "ta-alert",
    type_:   str  = "info",
    url:     str  = "/signals",
    pair:    str  = "",
    signal:  dict | None = None,
) -> None:
    """
    Send a Web Push notification to all registered subscribers.

    No-ops silently when:
    - VAPID_PRIVATE_KEY is not configured (local dev without env vars)
    - No subscribers are registered
    """
    if not VAPID_PRIVATE_KEY:
        return
    if not _subscriptions:
        return

    payload = json.dumps({
        "title":  title,
        "body":   body,
        "tag":    tag,
        "type":   type_,
        "url":    url,
        "pair":   pair,
        "signal": signal,
    })

    loop   = asyncio.get_event_loop()
    dead   = []
    errors = 0

    for sub in list(_subscriptions):
        try:
            expired = await loop.run_in_executor(None, _send_one_sync, sub, payload)
            if expired:
                dead.append(expired)
        except Exception as exc:
            errors += 1
            logger.warning("Push send error: %s", exc)

    for ep in dead:
        remove_subscription(ep)
        logger.info("Removed expired push subscription")

    if errors:
        logger.warning("%d push send error(s) for this batch", errors)


async def send_push_with_actions(
    title:   str,
    body:    str,
    tag:     str,
    actions: list[dict],
    pair:    str = "",
    signal:  dict | None = None,
) -> None:
    """
    Send a push notification that includes action buttons (e.g. outcome checks).
    The payload is read by the service worker, which renders the buttons.
    """
    if not VAPID_PRIVATE_KEY:
        return
    if not _subscriptions:
        return

    # Include only JSON-serialisable signal fields to keep payload compact
    sig_compact: dict | None = None
    if signal:
        sig_compact = {k: signal[k] for k in (
            "pair", "direction", "entry", "sl", "tp1", "tp2", "score", "grade",
            "timestamp", "expires_at",
        ) if k in signal}

    payload = json.dumps({
        "title":   title,
        "body":    body,
        "tag":     tag,
        "type":    "outcome_check",
        "url":     "/signals",
        "actions": actions,
        "pair":    pair,
        "signal":  sig_compact,
    })

    loop = asyncio.get_event_loop()
    dead   = []
    errors = 0

    for sub in list(_subscriptions):
        try:
            expired = await loop.run_in_executor(None, _send_one_sync, sub, payload)
            if expired:
                dead.append(expired)
        except Exception as exc:
            errors += 1
            logger.warning("Push send error (outcome): %s", exc)

    for ep in dead:
        remove_subscription(ep)

    if errors:
        logger.warning("%d push send error(s) for outcome batch", errors)
