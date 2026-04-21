import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE, WS_BASE } from '../config'

// Pair → currencies that affect it (mirrors backend PAIR_CURRENCIES)
const PAIR_CURRENCIES = {
  EURUSD: ['EUR', 'USD'], GBPUSD: ['GBP', 'USD'], XAUUSD: ['USD'],
  NZDJPY: ['NZD', 'JPY'], GBPJPY: ['GBP', 'JPY'], USDJPY: ['USD', 'JPY'],
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

  // Register service worker once
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
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
