import React, { useEffect, useRef, useCallback } from 'react'
import { createChart, LineStyle } from 'lightweight-charts'
import { API_BASE } from '../config'

const HEIGHT = 220

// Signal-level definitions: which lines to draw and in what style
const LEVEL_DEFS = [
  { key: 'entry', color: '#f59e0b', title: 'Entry', lineWidth: 2, lineStyle: LineStyle.Solid   },
  { key: 'sl',    color: '#ef4444', title: 'SL',    lineWidth: 1, lineStyle: LineStyle.Dashed  },
  { key: 'tp1',   color: '#22c55e', title: 'TP1',   lineWidth: 1, lineStyle: LineStyle.Dashed  },
  { key: 'tp2',   color: '#16a34a', title: 'TP2',   lineWidth: 1, lineStyle: LineStyle.Dotted  },
]

/**
 * PairChart
 *
 * Renders an H1 candlestick chart for a single Forex pair using
 * lightweight-charts v4. When a STRONG or WATCH signal is passed,
 * entry / SL / TP price lines are drawn automatically.
 *
 * Props:
 *   pair    — "XAUUSD" | "EURUSD" | "GBPUSD" | "GBPJPY"
 *   signal  — signal object from scanner (or null/undefined)
 */
export default function PairChart({ pair, signal }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef(null)
  const plinesRef    = useRef([])        // handles of active price lines
  const loadedRef    = useRef(false)     // prevent double-fetch in StrictMode

  // ── Create chart once ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width:  el.clientWidth,
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
        fixLeftEdge:    true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale:  { mouseWheel: true, pinch: true },
    })

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

    // Responsive width
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  }, []) // run exactly once

  // ── Fetch H1 bars ─────────────────────────────────────────────────────────
  const loadBars = useCallback(async () => {
    if (!seriesRef.current) return
    try {
      const res = await fetch(`${API_BASE}/api/ohlcv/${pair}?timeframe=60&limit=120`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.bars?.length) return

      // Convert ISO-8601 strings → UTC unix seconds, deduplicate, sort ascending
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

      if (candles.length && seriesRef.current) {
        seriesRef.current.setData(candles)
        chartRef.current?.timeScale().scrollToRealTime()
      }
    } catch (_) {}
  }, [pair])

  // Initial load + 10-minute polling
  useEffect(() => {
    if (loadedRef.current) return   // StrictMode guard
    loadedRef.current = true
    loadBars()
    const t = setInterval(loadBars, 10 * 60 * 1000)
    return () => { clearInterval(t); loadedRef.current = false }
  }, [loadBars])

  // ── Signal price lines ────────────────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    // Remove old lines
    plinesRef.current.forEach(pl => { try { series.removePriceLine(pl) } catch (_) {} })
    plinesRef.current = []

    if (!signal?.entry) return

    plinesRef.current = LEVEL_DEFS
      .filter(({ key }) => signal[key] != null && +signal[key] > 0)
      .map(({ key, color, title, lineWidth, lineStyle }) =>
        series.createPriceLine({
          price:            +signal[key],
          color,
          lineWidth,
          lineStyle,
          title,
          axisLabelVisible: true,
        })
      )
  }, [signal])

  return <div ref={containerRef} style={{ width: '100%', height: HEIGHT }} />
}
