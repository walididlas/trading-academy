/**
 * Trading Academy — Service Worker
 * Handles Web Push notifications (active on HTTPS deployment).
 */

self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// ── Push handler ─────────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json?.() ?? {}
  const options = {
    body:               data.body ?? '',
    icon:               '/icon-192.png',
    badge:              '/icon-192.png',
    data: {
      url:    data.url    ?? '/signals',
      type:   data.type   ?? '',
      pair:   data.pair   ?? '',
      signal: data.signal ?? null,
    },
    vibrate:            [200, 100, 200, 100, 200],
    requireInteraction: data.type === 'signal',
    tag:                data.tag ?? 'ta-alert',
  }
  e.waitUntil(self.registration.showNotification(data.title ?? 'Trading Academy', options))
})

// ── Notification click ────────────────────────────────────────────────────────
// All taps — action-button or body — navigate to the in-app outcome prompt.
// The Signals page reads ?outcome_pair= and shows the interactive UI.
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const nd   = e.notification.data ?? {}
  const pair = nd.pair ?? ''

  // Where to send the user
  const target = pair
    ? `/signals?outcome_pair=${encodeURIComponent(pair)}`
    : (nd.url ?? '/signals')

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Find any open window belonging to this origin
      const appWindow = list.find(c => {
        try { return new URL(c.url).origin === self.location.origin } catch { return false }
      })
      if (appWindow) {
        // App is open — tell it to navigate without a full reload
        appWindow.postMessage({ type: 'ta_navigate', url: target })
        return appWindow.focus()
      }
      // App is closed — open it
      return clients.openWindow(target)
    })
  )
})
