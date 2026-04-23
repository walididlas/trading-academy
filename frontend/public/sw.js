/**
 * Trading Academy — Service Worker
 * Handles Web Push notifications (active on HTTPS deployment).
 * On local HTTP the SW registers but push events won't fire — in-app toasts cover that case.
 */

const CACHE = 'ta-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// ── Push handler (HTTPS only) ───────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json?.() ?? {}
  const title = data.title ?? 'Trading Academy'
  const options = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url ?? '/signals' },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: data.type === 'signal',  // stay visible for signals
    tag: data.tag ?? 'ta-alert',
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const target = e.notification.data?.url ?? '/'
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
