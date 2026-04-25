/**
 * Trading Academy — Service Worker
 * Handles Web Push notifications (active on HTTPS deployment).
 * On local HTTP the SW registers but push events won't fire — in-app toasts cover that case.
 */

const CACHE = 'ta-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// ── Push handler ────────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json?.() ?? {}
  const title = data.title ?? 'Trading Academy'
  const options = {
    body:               data.body ?? '',
    icon:               '/icon-192.png',
    badge:              '/icon-192.png',
    data: {
      url:     data.url     ?? '/signals',
      type:    data.type    ?? '',
      pair:    data.pair    ?? '',
      signal:  data.signal  ?? null,
    },
    vibrate:             [200, 100, 200, 100, 200],
    requireInteraction:  data.type === 'signal' || data.type === 'outcome_check',
    tag:                 data.tag ?? 'ta-alert',
    actions:             data.actions ?? [],
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const nd = e.notification.data ?? {}

  // ── Outcome action button (taken / missed / skipped) ─────────────────────
  if (e.action && nd.type === 'outcome_check') {
    const payload = {
      type:    'signal_outcome',
      pair:    nd.pair,
      outcome: e.action,   // 'taken' | 'missed' | 'skipped'
      signal:  nd.signal,
      ts:      new Date().toISOString(),
    }

    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        if (list.length > 0) {
          // App is open — postMessage so it can update localStorage in-place
          list.forEach(c => c.postMessage(payload))
          list[0].focus()
        } else {
          // App is closed — open it with URL params so Signals.jsx can process
          const params = new URLSearchParams({
            outcome: e.action,
            pair:    nd.pair,
          })
          clients.openWindow(`/signals?${params}`)
        }
      })
    )
    return
  }

  // ── Normal notification tap — navigate to the target URL ─────────────────
  const target = nd.url ?? '/'
  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const match = list.find(c => c.url.includes(self.location.origin))
        if (match) { match.focus(); return match.navigate(target) }
        return clients.openWindow(target)
      })
  )
})
