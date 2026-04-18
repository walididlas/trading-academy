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
              const dir = a.type === 'long' ? '▲ LONG' : '▼ SHORT'
              const title = `${a.pair} ${dir} Signal`
              const body = a.entry
                ? `Entry ${a.entry} · SL ${a.sl} · TP ${a.tp} · R:R ${a.rr}:1`
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
    <AlertContext.Provider value={{ signals, news, toasts, dismiss, permission, requestPermission, wsStatus, alertHistory, unreadCount, markRead }}>
      {children}
    </AlertContext.Provider>
  )
}

export const useAlerts = () => useContext(AlertContext)
