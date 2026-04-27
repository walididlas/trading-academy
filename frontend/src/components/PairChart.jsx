import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, LineStyle } from 'lightweight-charts'
import { API_BASE } from '../config'

const HEIGHT = 220

const LEVEL_DEFS = [
  { key: 'entry', color: '#f59e0b', title: 'Entry', lineWidth: 2, lineStyle: LineStyle.Solid  },
  { key: 'sl',    color: '#ef4444', title: 'SL',    lineWidth: 1, lineStyle: LineStyle.Dashed },
  { key: 'tp1',   color: '#22c55e', title: 'TP1',   lineWidth: 1, lineStyle: LineStyle.Dashed },
  { key: 'tp2',   color: '#16a34a', title: 'TP2',   lineWidth: 1, lineStyle: LineStyle.Dotted },
]

/**
 * PairChart — H1 candlestick chart for one Forex pair.
 *
 * Fetches from /api/candles/{pair} which serves cached bars or falls back
 * to a live Twelve Data call when the cache is cold.
 *
 * Props:
 *   pair    — "XAUUSD" | "EURUSD" | "GBPUSD" | "GBPJPY"
 *   signal  — scanner signal object (or null); draws Entry/SL/TP lines
 */
export default function PairChart({ pair, signal }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef(null)
  const plinesRef    = useRef([])

  const [status,   setStatus]   = useState('loading')  // 'loading'|'ok'|'empty'|'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [barCount, setBarCount] = useState(0)
  const [source,   setSource]   = useState('')

  // ── Create chart ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Use a safe fallback width — ResizeObserver corrects it immediately
    const w = el.getBoundingClientRect().width || el.parentElement?.getBoundingClientRect().width || 400

    let chart
    try {
      chart = createChart(el, {
        width:  w,
        height: HEIGHT,
        layout: {
          background: { color: '#0d1117' },
          textColor:  '#6b7280',
          fontSize:   11,
        },
        grid: {
          vertLines: { color: '#1a2035', style: LineStyle.Dotted },
          horzLines: { color: '#1a2035', style: LineStyle.Dotted },
        },
        crosshair:       { mode: 1 },
        rightPriceScale: { borderColor: '#374151' },
        timeScale: {
          borderColor:    '#374151',
          timeVisible:    true,
          secondsVisible: false,
          fixLeftEdge:    false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale:  { mouseWheel: true, pinch: true },
      })
    } catch (err) {
      setStatus('error')
      setErrorMsg(`Chart init failed: ${err.message}`)
      return
    }

    const series = chart.addCandlestickSeries({
      upColor:         '#22c55e',
      downColor:       '#ef4444',
      borderUpColor:   '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor:     '#22c55e',
      wickDownColor:   '#ef4444',
    })

    chartRef.current  = chart
    seriesRef.current = series

    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width && width > 0) chart.applyOptions({ width })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      try { chart.remove() } catch (_) {}
      chartRef.current  = null
      seriesRef.current = null
    }
  }, [])

  // ── Fetch bars ─────────────────────────────────────────────────────────────
  const loadBars = useCallback(async () => {
    if (!seriesRef.current) return
    setStatus('loading')

    const url = `${API_BASE}/api/candles/${pair}?timeframe=1h&limit=100`
    let data
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.text()
        let detail = `HTTP ${res.status}`
        try { detail = JSON.parse(body).detail ?? detail } catch (_) {}
        throw new Error(detail)
      }
      data = await res.json()
    } catch (err) {
      setStatus('error')
      setErrorMsg(`${err.message} · URL: ${url}`)
      return
    }

    if (!data.bars?.length) {
      setStatus('empty')
      setErrorMsg(`No bars returned (source: ${data.source ?? 'unknown'})`)
      return
    }

    // Convert ISO-8601 → unix seconds, deduplicate, sort ascending
    const seen    = new Set()
    const candles = data.bars
      .map(b => ({
        time:  Math.floor(new Date(b.time).getTime() / 1000),
        open:  +b.open,
        high:  +b.high,
        low:   +b.low,
        close: +b.close,
      }))
      .filter(b => b.time > 0 && !seen.has(b.time) && seen.add(b.time))
      .sort((a, b) => a.time - b.time)

    if (!candles.length) {
      setStatus('empty')
      setErrorMsg('All bars had invalid timestamps')
      return
    }

    try {
      seriesRef.current.setData(candles)
      chartRef.current?.timeScale().scrollToRealTime()
      setStatus('ok')
      setBarCount(candles.length)
      setSource(data.source ?? '')
    } catch (err) {
      setStatus('error')
      setErrorMsg(`Chart data error: ${err.message}`)
    }
  }, [pair])

  // Initial load + 10-minute polling
  useEffect(() => {
    loadBars()
    const t = setInterval(loadBars, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [loadBars])

  // ── Signal price lines ─────────────────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    plinesRef.current.forEach(pl => { try { series.removePriceLine(pl) } catch (_) {} })
    plinesRef.current = []
    if (!signal?.entry) return
    plinesRef.current = LEVEL_DEFS
      .filter(({ key }) => signal[key] != null && +signal[key] > 0)
      .map(({ key, color, title, lineWidth, lineStyle }) =>
        series.createPriceLine({ price: +signal[key], color, lineWidth, lineStyle, title, axisLabelVisible: true })
      )
  }, [signal])

  // ── Overlay states ─────────────────────────────────────────────────────────
  const overlay = status !== 'ok' ? (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(13,17,23,0.88)',
      borderRadius: 6, gap: 8, padding: 16,
      pointerEvents: 'none',
    }}>
      {status === 'loading' && (
        <>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '3px solid #374151', borderTopColor: '#f59e0b',
            animation: 'ta-spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Loading {pair} H1 data…</span>
        </>
      )}
      {(status === 'error' || status === 'empty') && (
        <>
          <span style={{ fontSize: '1.2rem' }}>{status === 'empty' ? '📭' : '⚠️'}</span>
          <span style={{ fontSize: '0.75rem', color: status === 'empty' ? '#6b7280' : '#ef4444',
                         textAlign: 'center', lineHeight: 1.5, wordBreak: 'break-all' }}>
            {errorMsg || 'No data'}
          </span>
          {status === 'error' && (
            <span style={{ fontSize: '0.68rem', color: '#4b5563' }}>
              Check TWELVEDATA_API_KEY on Railway
            </span>
          )}
        </>
      )}
    </div>
  ) : null

  return (
    <>
      {/* Inject spinner keyframe once */}
      <style>{`@keyframes ta-spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ position: 'relative' }}>
        {/* The chart canvas lives here */}
        <div ref={containerRef} style={{ width: '100%', height: HEIGHT }} />

        {/* Loading / error overlay sits on top */}
        {overlay}

        {/* Source badge — bottom-right when data is loaded */}
        {status === 'ok' && (
          <div style={{
            position: 'absolute', bottom: 4, right: 6,
            fontSize: '0.6rem', color: '#374151',
            pointerEvents: 'none',
          }}>
            {barCount} bars · {source}
            {' · '}
            <span
              style={{ color: '#4b5563', cursor: 'pointer', pointerEvents: 'all' }}
              onClick={loadBars}
            >
              ↺ refresh
            </span>
          </div>
        )}
      </div>
    </>
  )
}
