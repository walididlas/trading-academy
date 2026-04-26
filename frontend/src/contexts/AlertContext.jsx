import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE, WS_BASE } from '../config'

// ── Web Push helpers ─────────────────────────────────────────────────────────
const PUSH_VAPID_KEY_STORE = 'push_vapid_key'   // localStorage key tracking which VAPID was used

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  const output  = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function _postSubscription(sub) {
  try {
    await fetch(`${API_BASE}/api/push/subscribe`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(sub.toJSON()),
    })
  } catch (_) {}
}

/**
 * Subscribe (or force re-subscribe) to Web Push using the current VAPID key.
 * If a subscription with an OLD VAPID key exists it is unsubscribed first so
 * the new key takes effect immediately.
 * Returns true when a valid subscription with the current VAPID key is active.
 */
async function _subscribeToPush(registration) {
  try {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey || !registration.pushManager) return false

    const storedKey = localStorage.getItem(PUSH_VAPID_KEY_STORE)
    const existing  = await registration.pushManager.getSubscription()

    // Key rotation: old subscription uses a different VAPID key → nuke it
    if (existing && storedKey !== vapidKey) {
      try { await existing.unsubscribe() } catch (_) {}
    }

    // Fresh subscription needed (rotation or no prior sub)
    if (!existing || storedKey !== vapidKey) {
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: _urlBase64ToUint8Array(vapidKey),
      })
      await _postSubscription(sub)
      localStorage.setItem(PUSH_VAPID_KEY_STORE, vapidKey)
      return true
    }

    // Existing subscription is current — just re-register with backend (in case it restarted)
    await _postSubscription(existing)
    localStorage.setItem(PUSH_VAPID_KEY_STORE, vapidKey)
    return true
  } catch (_) {
    // PushManager not supported, or permission denied — silent fallback
    return false
  }
}

// Pair → currencies that affect it (mirrors backend PAIR_CURRENCIES)
const PAIR_CURRENCIES = {
  EURUSD: ['EUR', 'USD'], GBPUSD: ['GBP', 'USD'], XAUUSD: ['USD'],
  GBPJPY: ['GBP', 'JPY'], USDJPY: ['USD', 'JPY'],
  AUDUSD: ['AUD', 'USD'], USDCAD: ['USD', 'CAD'], USDCHF: ['USD', 'CHF'],
}

const AlertContext = createContext(null)

// ── Audio beep (Web Audio API, no file needed) ──────────────────────────────
function playBeep(type = 'signal') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'

    if (type === 'killzone') {
      // Two-tone ascending chime for KZ open
      osc.frequency.setValueAtTime(660, ctx.currentTime)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.18)
      gain.gain.setValueAtTime(0.35, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      osc.start(); osc.stop(ctx.currentTime + 0.8)
    } else {
      // Three short pulses for signal alert
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.22
        const o2 = ctx.createOscillator()
        const g2 = ctx.createGain()
        o2.connect(g2); g2.connect(ctx.destination)
        o2.type = 'sine'
        o2.frequency.setValueAtTime(880, t)
        g2.gain.setValueAtTime(0.4, t)
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
        o2.start(t); o2.stop(t + 0.18)
      }
    }
  } catch (_) {
    // AudioContext blocked before first user gesture — silent fallback
  }
}

// ── Native browser notification ─────────────────────────────────────────────
function showNativeNotif(title, body, tag = 'ta') {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/icon-192.png', tag, silent: false })
  } catch (_) {}
}

// ── Provider ────────────────────────────────────────────────────────────────
// ── Kill Zone check (Morocco UTC+1) ────────────────────────────────────────
function isInKillZone() {
  const now = new Date()
  const t = now.getUTCHours() * 60 + now.getUTCMinutes()
  return (t >= 9 * 60 && t < 12 * 60) || (t >= 14 * 60 + 30 && t < 17 * 60 + 30)
}

// ── Open trades from Journal localStorage ──────────────────────────────────
function getOpenTrades() {
  try {
    const trades = JSON.parse(localStorage.getItem('trading_journal') || '[]')
    return trades.filter(t => !t.result || t.result === '')
  } catch {
    return []
  }
}

// ── Outcome journal helpers ──────────────────────────────────────────────────
function _outcomeLabel(outcome) {
  if (outcome === 'taken')   return 'Took the trade'
  if (outcome === 'missed')  return 'Price never reached entry level'
  if (outcome === 'skipped') return 'Chose to skip this setup'
  return outcome
}

function _writeOutcomeToJournal(pair, outcome, signal, ts) {
  try {
    const stored = JSON.parse(localStorage.getItem(`ta_outcome_pending_${pair}`) || 'null')
    const sig    = signal ?? stored?.signal ?? {}
    const entry  = {
      id:          `outcome_${Date.now()}`,
      date:        (ts ?? new Date().toISOString()).slice(0, 10),
      pair:        pair,
      direction:   sig.direction ?? '',
      entry:       sig.entry?.toString() ?? '',
      sl:          sig.sl?.toString() ?? '',
      tp:          sig.tp1?.toString() ?? '',
      result:      outcome === 'taken' ? '' : outcome,   // '' = open/taken; 'missed'/'skipped'
      outcome,
      reasoning:   _outcomeLabel(outcome),
      signalScore: sig.score ?? null,
      signalGrade: sig.grade ?? null,
      auto:        true,
      type:        'outcome_check',
    }
    const existing = JSON.parse(localStorage.getItem('trading_journal') || '[]')
    const cutoff   = Date.now() - 2 * 60 * 60 * 1000   // 2-hour dedup window
    const isDup    = existing.some(t =>
      t.type === 'outcome_check' && t.pair === pair &&
      parseInt(t.id?.replace('outcome_', '') ?? '0', 10) > cutoff
    )
    if (!isDup) {
      localStorage.setItem('trading_journal', JSON.stringify([entry, ...existing]))
    }
  } catch (_) {}
}

export function AlertProvider({ children }) {
  const [signals, setSignals] = useState([])
  const [news, setNews] = useState([])
  const [toasts, setToasts] = useState([])
  const [alertHistory, setAlertHistory] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [wsStatus, setWsStatus] = useState('connecting')
  // Show our in-app permission modal automatically on first visit (when not yet asked)
  const [pushModalOpen, setPushModalOpen] = useState(() => {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission !== 'default') return false
    return localStorage.getItem('ta_push_modal_shown') !== '1'
  })
  const idRef = useRef(0)
  const timersRef = useRef({})
  const signalsRef = useRef([])  // always-current ref for WS callback

  // Register service worker; force re-subscription if VAPID key has rotated
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js')
      .then(async reg => {
        if (typeof Notification === 'undefined') return
        const perm = Notification.permission
        setPermission(perm)
        if (perm === 'granted') {
          // Always attempt subscription on load — _subscribeToPush handles rotation
          const ok = await _subscribeToPush(reg)
          setPushSubscribed(ok)
        }
      })
      .catch(() => {})
  }, [])

  const addToast = useCallback((toast) => {
    const id = ++idRef.current
    const ts = Date.now()
    setToasts(prev => [...prev, { ...toast, id }])
    // Persist to alert history (last 20)
    setAlertHistory(prev => [{ ...toast, id, ts }, ...prev].slice(0, 20))
    setUnreadCount(prev => prev + 1)
    // Auto-dismiss
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timersRef.current[id]
    }, toast.type === 'signal' ? 12000 : 7000)
    timersRef.current[id] = timer
    playBeep(toast.type)
  }, [])

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported'
    localStorage.setItem('ta_push_modal_shown', '1')
    setPushModalOpen(false)

    // Must be called from a user-gesture context (click) — iOS Safari enforces this
    const result = await Notification.requestPermission()
    setPermission(result)

    if (result !== 'granted' || !('serviceWorker' in navigator)) return result

    try {
      const reg = await navigator.serviceWorker.ready
      const ok  = await _subscribeToPush(reg)
      setPushSubscribed(ok)

      if (ok) {
        // Confirm subscription worked — fires a real push so user sees it immediately
        try {
          await fetch(`${API_BASE}/api/push/test`, { method: 'POST' })
        } catch (_) {}
        addToast({
          type:  'signal',
          title: '🔔 Notifications enabled',
          body:  'You will receive a test push now to confirm everything works.',
        })
      } else {
        addToast({
          type:  'warning',
          title: '⚠ Subscription failed',
          body:  'Permission granted but push registration failed. Try reloading.',
        })
      }
    } catch (_) {}

    return result
  }, [addToast])

  const dismissPushModal = useCallback(() => {
    localStorage.setItem('ta_push_modal_shown', '1')
    setPushModalOpen(false)
  }, [])

  /**
   * Hard-reset the push subscription:
   *  1. Clear stored VAPID key + modal-shown flag from localStorage
   *  2. Unregister every service worker
   *  3. Unsubscribe from pushManager on each registration
   *  4. Reset local pushSubscribed state so the banner reappears
   * Caller is responsible for invoking requestPermission() afterwards
   * from within the same user-gesture handler.
   */
  const resetPushSubscription = useCallback(async () => {
    // 1. Clear localStorage flags so the subscription flow starts clean
    localStorage.removeItem('ta_push_modal_shown')
    localStorage.removeItem(PUSH_VAPID_KEY_STORE)

    // 2+3. Unregister all SWs and unsubscribe from any push manager
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(async reg => {
          try {
            const sub = await reg.pushManager.getSubscription()
            if (sub) await sub.unsubscribe()
          } catch (_) {}
          try { await reg.unregister() } catch (_) {}
        }))
      } catch (_) {}
    }

    // 4. Reset local state — banner will reappear; actual Notification.permission
    //    is a browser value we cannot programmatically reset, but we sync our
    //    local copy so the UI reflects the real value after the next prompt.
    setPushSubscribed(false)
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission)
    }
  }, [])

  const markRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  // ── SW message listener — handles outcome action button clicks ─────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event) => {
      if (event.data?.type !== 'signal_outcome') return
      const { pair, outcome, signal, ts } = event.data
      _writeOutcomeToJournal(pair, outcome, signal, ts)
      const icon = outcome === 'taken' ? '✅' : outcome === 'missed' ? '❌' : '⏭'
      addToast({
        type:  outcome === 'taken' ? 'signal' : 'killzone',
        title: `${icon} ${pair} — ${_outcomeLabel(outcome)}`,
        body:  'Recorded in your journal',
      })
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [addToast])

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let ws
    let reconnectTimer

    function connect() {
      try {
        ws = new WebSocket(`${WS_BASE}/ws/signals`)
        ws.onopen = () => setWsStatus('connected')
        ws.onclose = () => {
          setWsStatus('disconnected')
          reconnectTimer = setTimeout(connect, 5000)
        }
        ws.onerror = () => ws.close()

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)

            if (data.signals) {
              setSignals(data.signals)
              signalsRef.current = data.signals
              // Store STRONG signal snapshots for outcome tracking
              data.signals.forEach(sig => {
                if (sig.grade === 'STRONG') {
                  localStorage.setItem(
                    `ta_outcome_pending_${sig.pair}`,
                    JSON.stringify({ signal: sig, pushed_at: Date.now() })
                  )
                } else {
                  localStorage.removeItem(`ta_outcome_pending_${sig.pair}`)
                }
              })
            }

            if (data.news_update) {
              const newItems = data.news_update
              setNews(prev => {
                const existing = new Set(prev.map(n => n.id))
                const fresh = newItems.filter(n => !existing.has(n.id))
                return [...fresh, ...prev].slice(0, 100)
              })
              // Confluence: HIGH news inside Kill Zone → special alert
              const highNews = newItems.filter(n => n.impact === 'HIGH')
              if (highNews.length && isInKillZone()) {
                highNews.forEach(item => {
                  addToast({ type: 'confluence', title: '⚡ HIGH CONFLUENCE', body: `Kill Zone + ${item.title}` })
                  showNativeNotif('⚡ HIGH CONFLUENCE', item.title, `conf-${item.id}`)
                })
              }
              // HIGH news + STRONG signal matching that currency → "NEWS RISK on STRONG signal"
              if (highNews.length) {
                const currentSignals = signalsRef.current
                // news items use `currencies` (array from news_fetcher)
                const getNewsCurrencies = (n) => n.currencies?.length ? n.currencies : []
                highNews.forEach(newsItem => {
                  const newsCurrencies = getNewsCurrencies(newsItem)
                  if (!newsCurrencies.length) return
                  const affectedPairs = Object.entries(PAIR_CURRENCIES)
                    .filter(([, curs]) => curs.some(c => newsCurrencies.includes(c)))
                    .map(([pair]) => pair)
                  const hitSignals = currentSignals.filter(
                    s => s.grade === 'STRONG' && affectedPairs.includes(s.pair)
                  )
                  hitSignals.forEach(sig => {
                    addToast({
                      type: 'warning',
                      title: `⛔ News Risk — ${sig.pair} STRONG signal`,
                      body: `${newsItem.title} · Do not enter until news clears`,
                    })
                    showNativeNotif(
                      `⛔ News Risk — ${sig.pair}`,
                      `${newsItem.title} · Wait before entering`,
                      `newsrisk-${sig.pair}`
                    )
                  })
                })
              }
              // Warn about open journal trades matching the news currencies
              const openTrades = getOpenTrades()
              if (highNews.length && openTrades.length) {
                const getNewsCurrencies = (n) => n.currencies?.length ? n.currencies : []
                const affectedTrades = openTrades.filter(t => {
                  const pairCurrencies = PAIR_CURRENCIES[t.pair?.toUpperCase()] ?? []
                  return highNews.some(n => getNewsCurrencies(n).some(c => pairCurrencies.includes(c)))
                })
                if (affectedTrades.length) {
                  addToast({
                    type: 'warning',
                    title: `⚠ High news — ${affectedTrades.length} open trade${affectedTrades.length > 1 ? 's' : ''} at risk`,
                    body: `${affectedTrades.map(t => t.pair).join(', ')} · ${highNews[0].title}`,
                  })
                } else {
                  addToast({
                    type: 'warning',
                    title: `⚠ High news — ${openTrades.length} open trade${openTrades.length > 1 ? 's' : ''}`,
                    body: highNews[0].title,
                  })
                }
              }
            }

            if (data.alert) {
              const a = data.alert
              const dir = a.direction === 'long' ? '▲ LONG' : '▼ SHORT'
              const title = `${a.pair} ${dir} Signal`
              const body = a.entry
                ? `Entry ${a.entry} · SL ${a.sl} · TP1 ${a.tp1 ?? a.tp} · Score ${a.score}`
                : a.reason
              addToast({ type: 'signal', title, body, signal: a })
              showNativeNotif(title, body, `signal-${a.pair}`)
            }

            if (data.killzone_open) {
              const title = `${data.killzone_open} OPEN`
              const body = `${data.morocco_time} Morocco · ICC setups active on ${(data.pairs || []).join(', ')}`
              addToast({ type: 'killzone', title, body })
              showNativeNotif(title, body, 'killzone')
            }

            // ── 5-min Kill Zone warning ──────────────────────────────────────
            if (data.kz_warning) {
              const kz = data.kz_warning
              const title = `⏰ ${kz.name} in ${kz.opens_in}`
              const body  = `${kz.morocco_time} Morocco · Prepare setups on ${(kz.pairs || []).join(', ')}`
              addToast({ type: 'killzone', title, body })
              showNativeNotif(title, body, 'kz-warning')
            }

            // ── Entry expired (4h without price reaching entry) ─────────────
            if (data.entry_expired) {
              const x   = data.entry_expired
              const dir = x.direction === 'long' ? '▲ LONG' : '▼ SHORT'
              const title = `⏱ ${x.pair} ${dir} — Entry Expired`
              const body  = `Price never reached ${x.entry} in 4h · Re-scanning for fresh setup`
              addToast({ type: 'warning', title, body })
              showNativeNotif(title, body, `expired-${x.pair}`)
              // Auto-log to journal
              try {
                const entry = {
                  id:          `expired_${Date.now()}`,
                  date:        (x.ts ?? new Date().toISOString()).slice(0, 10),
                  pair:        x.pair,
                  direction:   x.direction,
                  entry:       x.entry?.toString() ?? '',
                  result:      'missed',
                  outcome:     'missed',
                  reasoning:   `Entry expired — price never reached ${x.entry} within 4 hours`,
                  signalScore: x.score,
                  auto:        true,
                  type:        'entry_expired',
                }
                const existing = JSON.parse(localStorage.getItem('trading_journal') || '[]')
                const cutoff   = Date.now() - 4 * 60 * 60 * 1000
                const isDup    = existing.some(t =>
                  t.type === 'entry_expired' && t.pair === x.pair &&
                  parseInt(t.id?.replace('expired_', '') ?? '0', 10) > cutoff
                )
                if (!isDup) {
                  localStorage.setItem('trading_journal', JSON.stringify([entry, ...existing]))
                }
              } catch (_) {}
            }

            // ── Watch alert (score 70+) ──────────────────────────────────────
            if (data.watch_alert) {
              const w   = data.watch_alert
              const dir = w.direction === 'long' ? '▲ LONG' : '▼ SHORT'
              const title = `👀 ${w.pair} ${dir} — Watch (${w.score}pts)`
              const body  = w.reason || 'Score crossed 70 — monitor for entry'
              addToast({ type: 'killzone', title, body })
              showNativeNotif(title, body, `watch-${w.pair}`)
            }

            // ── Market structure break ───────────────────────────────────────
            if (data.structure_break) {
              const s   = data.structure_break
              const dir = s.direction === 'long' ? '▲' : '▼'
              const title = `📊 ${s.pair} ${dir} Structure Break (${s.score}pts)`
              const body  = s.detail || 'BOS/CHoCH confirmed'
              addToast({ type: 'killzone', title, body })
              showNativeNotif(title, body, `struct-${s.pair}`)
            }

            // ── Optimal entry zone reached ───────────────────────────────────
            if (data.entry_zone) {
              const z   = data.entry_zone
              const dir = z.direction === 'long' ? '▲ LONG' : '▼ SHORT'
              const title = `🎯 ${z.pair} ${dir} — Entry Zone (${z.score}pts)`
              const body  = `In ${z.zone} (${z.pct}% of range) — optimal for ${z.direction}`
              addToast({ type: 'signal', title, body })
              showNativeNotif(title, body, `zone-${z.pair}`)
            }

            // ── 30-min high-impact news warning ─────────────────────────────
            if (data.news_warning) {
              const n   = data.news_warning
              const cur = (n.currencies || []).join('/')
              const title = `⚡ HIGH News in ~${n.mins_until}min${cur ? ` — ${cur}` : ''}`
              const body  = n.title || 'High-impact event approaching'
              addToast({ type: 'confluence', title, body })
              showNativeNotif(title, body, `news-warn-${n.title}`)
            }

            // ── Weekly performance report ────────────────────────────────────
            if (data.weekly_report) {
              const r     = data.weekly_report
              const icon  = r.verdict === 'Strong week' ? '🏆' : r.verdict === 'Rough week' ? '📉' : '➖'
              const title = `${icon} Weekly Report — ${r.verdict}`
              const body  = `${r.total_trades} trades · ${r.win_rate}% WR · ${r.total_pnl >= 0 ? '+' : ''}$${r.total_pnl}`
              addToast({ type: r.verdict === 'Strong week' ? 'signal' : r.verdict === 'Rough week' ? 'warning' : 'killzone', title, body })
              showNativeNotif(title, body, 'weekly-report')
              try {
                const existing = JSON.parse(localStorage.getItem('weekly_reports') || '[]')
                const updated  = [r, ...existing].slice(0, 8)
                localStorage.setItem('weekly_reports', JSON.stringify(updated))
              } catch (_) {}
            }
          } catch (_) {}
        }
      } catch (_) {
        setWsStatus('disconnected')
      }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [addToast])

  // Seed news from REST on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/news?limit=50`)
      .then(r => r.json())
      .then(d => { if (d.news?.length) setNews(d.news) })
      .catch(() => {})
  }, [])

  return (
    <AlertContext.Provider value={{ signals, news, toasts, addToast, dismiss, permission, requestPermission, resetPushSubscription, pushSubscribed, wsStatus, alertHistory, unreadCount, markRead }}>
      {children}
    </AlertContext.Provider>
  )
}

export const useAlerts = () => useContext(AlertContext)
