import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE, WS_BASE } from '../config'

// ── Web Push helpers ─────────────────────────────────────────────────────────
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

async function _subscribeToPush(registration) {
  try {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey || !registration.pushManager) return

    // Reuse existing subscription if present — just re-register with backend
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      await _postSubscription(existing)
      return
    }

    const sub = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: _urlBase64ToUint8Array(vapidKey),
    })
    await _postSubscription(sub)
  } catch (_) {
    // PushManager not supported, or permission denied — silent fallback
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

// ── Helpers for auto-journal entries ────────────────────────────────────────
function inferSession(isoTs) {
  try {
    const d = new Date(isoTs)
    const t = d.getUTCHours() * 60 + d.getUTCMinutes()
    if (t >= 9 * 60 && t < 12 * 60)           return 'London'
    if (t >= 14 * 60 + 30 && t < 17 * 60 + 30) return 'NY'
    return 'Other'
  } catch { return 'Other' }
}

function gradeFromScore(score) {
  if (score == null) return 'F'
  if (score >= 80)   return 'A'
  if (score >= 70)   return 'B'
  if (score >= 60)   return 'C'
  return 'F'
}

function getPipSize(pair) {
  if (!pair)             return 0.0001
  if (pair === 'XAUUSD') return 0.1
  if (pair.includes('JPY')) return 0.01
  return 0.0001
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
  const [wsStatus, setWsStatus] = useState('connecting')
  const [autoTradingPaused, setAutoTradingPaused] = useState(false)
  const idRef = useRef(0)
  const timersRef = useRef({})
  const signalsRef = useRef([])  // always-current ref for WS callback

  // Register service worker and subscribe to Web Push once
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        // If notification permission already granted, subscribe to push immediately
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          _subscribeToPush(reg)
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
    const result = await Notification.requestPermission()
    setPermission(result)
    // If granted, also subscribe to Web Push for background notifications
    if (result === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => _subscribeToPush(reg)).catch(() => {})
    }
    return result
  }, [])

  const markRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

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

            // ── Auto-execution confirmation ──────────────────────────────────
            if (data.auto_executed) {
              const x = data.auto_executed
              const dir = x.direction === 'long' ? '▲ BUY' : '▼ SELL'
              const title = `✅ Trade Placed — ${x.pair} ${dir}`
              const body  = `${x.lots} lots @ ${x.entry} · SL ${x.sl} · TP1 ${x.tp1}${x.order_id ? ` · ID ${x.order_id}` : ''}`
              addToast({ type: 'signal', title, body })
              showNativeNotif(title, body, `exec-${x.pair}`)
            }

            // ── Auto-execution failed ────────────────────────────────────────
            if (data.auto_execute_failed) {
              const f = data.auto_execute_failed
              addToast({ type: 'warning', title: `⚠ MT5 Error — ${f.pair}`, body: f.error })
            }

            // ── Daily loss limit or consecutive losses paused ────────────────
            if (data.auto_trade_paused) {
              setAutoTradingPaused(true)
              const title = '🛑 Auto-Trading Paused'
              const body  = data.auto_trade_paused.reason || '5% daily loss limit reached'
              addToast({ type: 'warning', title, body })
              showNativeNotif(title, body, 'auto-paused')
            }

            // ── Spread / news block ──────────────────────────────────────────
            if (data.spread_blocked) {
              const b = data.spread_blocked
              const title = b.type === 'news'
                ? `⚡ Trade blocked — HIGH news on ${b.pair}`
                : `⚠️ Trade blocked — spread too wide on ${b.pair}`
              const body = b.type === 'news'
                ? b.reason
                : `Current: ${b.spread_pips} pips · Max: ${b.max_pips} pips`
              addToast({ type: 'warning', title, body })
              showNativeNotif(title, body, `spread-${b.pair}`)
            }

            // ── Auto-trading manually resumed ────────────────────────────────
            if (data.auto_trade_resumed) {
              setAutoTradingPaused(false)
              addToast({ type: 'killzone', title: '✅ Auto-Trading Resumed', body: 'Bot is active again — monitoring for STRONG signals' })
            }

            // ── Position closed (SL or TP hit) ──────────────────────────────
            if (data.position_closed) {
              const c    = data.position_closed
              const won  = c.pnl >= 0
              const icon = won ? '🎯' : '🛑'
              const why  = c.reason === 'tp' ? 'TP Hit' : 'SL Hit'
              const title = `${icon} ${c.pair} — ${why}`
              const body  = `${c.direction === 'long' ? '▲ LONG' : '▼ SHORT'} · P&L ${won ? '+' : ''}$${c.pnl}`
              addToast({ type: won ? 'signal' : 'warning', title, body })
              showNativeNotif(title, body, `closed-${c.pair}`)

              // ── Generate and persist session replay entry ──────────────────
              try {
                const snap = c.signal_snapshot
                const criteria = snap?.criteria ?? {}
                const CRITERIA_KEYS = ['kill_zone','order_block','fvg','market_structure','ema50','premium_discount','news_clear']
                const metCriteria  = CRITERIA_KEYS.filter(k => criteria[k]?.triggered)
                const missCriteria = CRITERIA_KEYS.filter(k => !criteria[k]?.triggered)
                const score        = snap?.score ?? null
                const allMet       = missCriteria.length === 0 || (score != null && score >= 80)

                let verdict
                if (c.reason === 'tp') {
                  verdict = 'target_hit'
                } else if (allMet) {
                  verdict = 'good_trade_bad_outcome'  // full setup, SL hit
                } else {
                  verdict = 'criteria_missing'        // incomplete setup, SL hit
                }

                const replay = {
                  id:          `replay_${Date.now()}`,
                  ts:          c.close_ts ?? new Date().toISOString(),
                  pair:        c.pair,
                  direction:   c.direction,
                  reason:      c.reason,
                  pnl:         c.pnl,
                  score,
                  entry:       snap?.entry ?? null,
                  sl:          snap?.sl    ?? null,
                  tp1:         snap?.tp1   ?? null,
                  criteria,
                  met_criteria:  metCriteria,
                  miss_criteria: missCriteria,
                  verdict,
                  snapshot_ts: snap?.snapshot_ts ?? null,
                }

                const existing = JSON.parse(localStorage.getItem('session_replays') || '[]')
                localStorage.setItem('session_replays', JSON.stringify([replay, ...existing].slice(0, 200)))
              } catch (_) {}

              // ── Auto-journal entry ───────────────────────────────────────────
              try {
                const snap  = c.signal_snapshot
                const score = snap?.score ?? null
                let pips = ''
                if (snap?.entry != null && c.exit_price != null) {
                  const raw = (c.exit_price - snap.entry) / getPipSize(c.pair)
                  pips = (c.direction === 'long' ? raw : -raw).toFixed(1)
                }
                const journalEntry = {
                  id:           `auto_${Date.now()}`,
                  date:         (c.close_ts ?? new Date().toISOString()).slice(0, 10),
                  pair:         c.pair,
                  direction:    c.direction,
                  session:      inferSession(c.close_ts),
                  entry:        snap?.entry?.toString() ?? '',
                  sl:           snap?.sl?.toString() ?? '',
                  tp:           snap?.tp1?.toString() ?? '',
                  exitPrice:    c.exit_price?.toString() ?? '',
                  lotSize:      '',
                  result:       c.reason === 'tp' ? 'win' : 'loss',
                  pips,
                  pnl:          c.pnl?.toString() ?? '',
                  rr:           '',
                  kz:           snap?.criteria?.kill_zone?.triggered ?? false,
                  trendAligned: snap?.criteria?.ema50?.triggered ?? false,
                  iccValid:     (score ?? 0) >= 60,
                  grade:        gradeFromScore(score),
                  reasoning:    `Auto-logged: ${c.reason === 'tp' ? 'Target hit' : 'Stop loss hit'}. Score: ${score ?? 'N/A'}`,
                  signalScore:  score,
                  signalGrade:  snap?.grade ?? null,
                  auto:         true,
                }
                const existingJ = JSON.parse(localStorage.getItem('trading_journal') || '[]')
                const cutoff    = Date.now() - 5 * 60 * 1000
                const isDup     = existingJ.some(t =>
                  t.auto && t.pair === journalEntry.pair &&
                  t.date === journalEntry.date &&
                  t.direction === journalEntry.direction &&
                  parseInt(t.id?.replace('auto_', '') ?? '0', 10) > cutoff
                )
                if (!isDup) {
                  localStorage.setItem('trading_journal', JSON.stringify([journalEntry, ...existingJ]))
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
    <AlertContext.Provider value={{ signals, news, toasts, dismiss, permission, requestPermission, wsStatus, alertHistory, unreadCount, markRead, autoTradingPaused, setAutoTradingPaused }}>
      {children}
    </AlertContext.Provider>
  )
}

export const useAlerts = () => useContext(AlertContext)
