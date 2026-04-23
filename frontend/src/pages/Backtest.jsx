import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { API_BASE } from '../config'

const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY']

// ── Equity curve SVG ──────────────────────────────────────────────────────────
function EquityCurveSVG({ points, width = 280, height = 80 }) {
  if (!points || points.length < 2) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', borderRadius: 6 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>insufficient trades</span>
      </div>
    )
  }

  const vals  = points.map(p => p.cumulative)
  const minV  = Math.min(0, ...vals)
  const maxV  = Math.max(0, ...vals)
  const range = maxV - minV || 1
  const PAD   = { t: 8, b: 8, l: 4, r: 4 }
  const W     = width  - PAD.l - PAD.r
  const H     = height - PAD.t - PAD.b

  const toX = (i) => PAD.l + (i / (points.length - 1)) * W
  const toY = (v) => PAD.t + ((maxV - v) / range) * H
  const zeroY = toY(0)

  // Build polyline path
  const pts = points.map((p, i) => `${toX(i)},${toY(p.cumulative)}`).join(' ')

  // Determine overall color
  const final = vals[vals.length - 1]
  const lineColor = final >= 0 ? '#22d3ee' : '#ef4444'

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {/* Zero line */}
      <line x1={PAD.l} y1={zeroY} x2={PAD.l + W} y2={zeroY}
        stroke="var(--border)" strokeWidth={1} strokeDasharray="3,3" />

      {/* Fill area */}
      <polygon
        points={`${PAD.l},${zeroY} ${pts} ${PAD.l + W},${zeroY}`}
        fill={lineColor} fillOpacity={0.08}
      />

      {/* Line */}
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />

      {/* Last dot */}
      <circle cx={toX(points.length - 1)} cy={toY(final)} r={3}
        fill={lineColor} />
    </svg>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Stat({ label, value, color, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.95rem', fontWeight: 800, color: color ?? 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: '0.62rem', color: 'var(--text-4)' }}>{sub}</div>}
    </div>
  )
}

// ── Combined summary card ─────────────────────────────────────────────────────
function SummaryCard({ combined, params }) {
  if (!combined) return null
  const pf   = combined.profit_factor
  const wr   = combined.win_rate
  const netR = combined.net_r

  const netCol = netR > 0 ? 'var(--green)' : netR < 0 ? 'var(--red)' : 'var(--text-3)'
  const wrCol  = wr == null ? 'var(--text-3)' : wr >= 55 ? 'var(--green)' : wr >= 40 ? 'var(--gold)' : 'var(--red)'
  const pfCol  = pf == null ? 'var(--text-3)' : pf >= 1.5 ? 'var(--green)' : pf >= 1 ? 'var(--gold)' : 'var(--red)'

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      padding: '18px 20px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div className="label-caps">Combined Performance — All Pairs</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 2 }}>
            Last {params?.days}d · Score ≥{params?.min_score} · {params?.pairs?.join(', ')}
          </div>
        </div>
        <div style={{
          fontSize: '0.68rem', color: 'var(--gold)',
          background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)',
          borderRadius: 6, padding: '4px 10px', fontWeight: 600,
        }}>
          ⚠ Simulated — past performance ≠ future results
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 16 }}>
        <Stat label="Signals" value={combined.total_signals} />
        <Stat label="Closed" value={combined.total_closed} sub={`${combined.wins}W / ${combined.losses}L`} />
        <Stat label="Win Rate" value={wr != null ? `${wr}%` : '—'} color={wrCol} />
        <Stat label="Avg R:R" value={combined.avg_rr != null ? `${combined.avg_rr}R` : '—'}
          color={combined.avg_rr >= 1 ? 'var(--green)' : 'var(--text-3)'} />
        <Stat label="Profit Factor" value={pf != null ? pf : '—'} color={pfCol} />
        <Stat label="Net R" value={netR != null ? `${netR > 0 ? '+' : ''}${netR}R` : '—'} color={netCol} />
        <Stat label="Best Trade" value={combined.best_trade != null ? `+${combined.best_trade}R` : '—'} color="var(--green)" />
        <Stat label="Worst Trade" value={combined.worst_trade != null ? `${combined.worst_trade}R` : '—'} color="var(--red)" />
      </div>
    </div>
  )
}

// ── Trade list inside pair card ───────────────────────────────────────────────
function TradeRow({ trade }) {
  const won  = trade.outcome === 'win'
  const open = trade.outcome === 'open'
  const date = trade.ts ? new Date(trade.ts).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' }) : '—'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
      borderRadius: 6, fontSize: '0.72rem',
      background: open ? 'var(--surface-2)' : won ? 'rgba(34,211,165,0.05)' : 'rgba(248,113,113,0.05)',
    }}>
      <span style={{ color: open ? 'var(--text-4)' : won ? 'var(--green)' : 'var(--red)', fontSize: '0.8rem', flexShrink: 0 }}>
        {open ? '○' : won ? '✓' : '✗'}
      </span>
      <span style={{ color: 'var(--text-3)', minWidth: 80, flexShrink: 0 }}>{date}</span>
      <span style={{
        fontWeight: 700, padding: '1px 6px', borderRadius: 4, fontSize: '0.65rem', flexShrink: 0,
        background: trade.direction === 'long' ? 'rgba(34,211,165,0.12)' : 'rgba(248,113,113,0.12)',
        color: trade.direction === 'long' ? 'var(--green)' : 'var(--red)',
      }}>
        {trade.direction === 'long' ? '▲' : '▼'} {trade.direction?.toUpperCase()}
      </span>
      <span style={{ color: 'var(--text-4)', flexShrink: 0 }}>{trade.score}pts</span>
      <span style={{ flex: 1 }} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, flexShrink: 0,
        color: open ? 'var(--text-4)' : won ? 'var(--green)' : 'var(--red)',
      }}>
        {open ? 'open' : won ? `+${trade.rr_actual}R` : `${trade.rr_actual}R`}
      </span>
      <span style={{ color: 'var(--text-4)', fontSize: '0.65rem', flexShrink: 0 }}>{trade.bars_held}h</span>
    </div>
  )
}

// ── Per-pair result card ───────────────────────────────────────────────────────
function PairCard({ result }) {
  const [showTrades, setShowTrades] = useState(false)
  const s = result.stats
  if (!s) return null

  const hasError = !!result.error
  const netCol = s.net_r > 0 ? 'var(--green)' : s.net_r < 0 ? 'var(--red)' : 'var(--text-3)'
  const wrCol  = s.win_rate == null ? 'var(--text-3)' : s.win_rate >= 55 ? 'var(--green)' : s.win_rate >= 40 ? 'var(--gold)' : 'var(--red)'
  const pfCol  = s.profit_factor == null ? 'var(--text-3)' : s.profit_factor >= 1.5 ? 'var(--green)' : s.profit_factor >= 1 ? 'var(--gold)' : 'var(--red)'

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1rem' }}>
            {result.pair}
          </span>
          {hasError ? (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>{result.error}</span>
          ) : (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>
              {result.bars_available} bars · {s.total} signals · {s.closed} closed
            </span>
          )}
        </div>
      </div>

      {!hasError && s.closed > 0 && (
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Left: stats grid */}
            <div style={{ flex: 1, minWidth: 240, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <Stat label="Win Rate" value={s.win_rate != null ? `${s.win_rate}%` : '—'} color={wrCol}
                sub={`${s.wins}W / ${s.losses}L`} />
              <Stat label="Profit Factor" value={s.profit_factor ?? '—'} color={pfCol} />
              <Stat label="Net R" value={`${s.net_r >= 0 ? '+' : ''}${s.net_r}R`} color={netCol} />
              <Stat label="Avg R:R" value={s.avg_rr != null ? `${s.avg_rr}R` : '—'}
                color={s.avg_rr >= 1 ? 'var(--green)' : 'var(--text-3)'} />
              <Stat label="Best Trade" value={s.best_rr != null ? `+${s.best_rr}R` : '—'} color="var(--green)" />
              <Stat label="Worst Trade" value={s.worst_rr != null ? `${s.worst_rr}R` : '—'} color="var(--red)" />
            </div>

            {/* Right: equity curve */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-4)', marginBottom: 4 }}>Equity (cumulative R)</div>
              <EquityCurveSVG points={result.equity_curve} width={240} height={72} />
            </div>
          </div>

          {/* Trade list toggle */}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 12, touchAction: 'manipulation' }}
            onClick={() => setShowTrades(v => !v)}
          >
            {showTrades ? '▲ Hide trades' : `▼ Show ${s.closed} trades`}
          </button>

          {showTrades && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {result.trades.map((t, i) => <TradeRow key={i} trade={t} />)}
            </div>
          )}
        </div>
      )}

      {!hasError && s.closed === 0 && (
        <div style={{ padding: '14px 16px', color: 'var(--text-3)', fontSize: '0.8rem' }}>
          No signals fired at this threshold. Try lowering min score or adding more OHLCV data via /api/feed.
        </div>
      )}
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterChips({ options, value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', minWidth: 60 }}>{label}</span>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
            border: '1px solid var(--border)', cursor: 'pointer', touchAction: 'manipulation',
            background: value === o.value ? 'var(--gold)' : 'var(--surface-2)',
            color: value === o.value ? '#000' : 'var(--text-3)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Backtest() {
  const [days,     setDays]     = useState(30)
  const [minScore, setMinScore] = useState(60)
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const run = useCallback(() => {
    setLoading(true)
    setError(null)
    const url = `${API_BASE}/api/backtest?days=${days}&min_score=${minScore}&pairs=XAUUSD,EURUSD,GBPUSD,GBPJPY`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError('Backend unavailable or no OHLCV data loaded.'); setLoading(false) })
  }, [days, minScore])

  // Auto-run on mount and filter change
  useEffect(() => { run() }, [run])

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Backtesting</h1>
            <p className="page-subtitle">Simulated ICC signal performance on historical OHLCV data</p>
          </div>
          <button className="btn btn-primary" onClick={run} disabled={loading} style={{ touchAction: 'manipulation' }}>
            {loading ? 'Running…' : '▶ Run Backtest'}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)',
        borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 20,
        fontSize: '0.78rem', color: 'var(--gold)', lineHeight: 1.5,
      }}>
        ⚠ <strong>Simulated historical performance only.</strong> This backtest uses cached OHLCV data from TradingView and applies the current ICC scoring rules retroactively. It does <strong>not</strong> account for slippage, spread, broker requotes, or look-ahead bias. Past signal performance does not guarantee future results. Use for pattern analysis and rule refinement only.
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 20,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <FilterChips
          label="Period"
          options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]}
          value={days}
          onChange={setDays}
        />
        <FilterChips
          label="Min Score"
          options={[{ value: 60, label: '≥60 WATCH' }, { value: 70, label: '≥70' }, { value: 80, label: '≥80 STRONG' }]}
          value={minScore}
          onChange={setMinScore}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--red)', fontSize: '0.82rem', padding: '12px 16px', background: 'rgba(248,113,113,0.08)', borderRadius: 'var(--r)', marginBottom: 20 }}>
          {error}
          <div style={{ marginTop: 6, color: 'var(--text-3)', fontSize: '0.72rem' }}>
            Push OHLCV data via the TradingView MCP tool: use <code>mcp__tradingview__data_get_ohlcv</code> then POST to <code>/api/feed</code> for each pair.
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 120, background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <>
          {/* Combined summary */}
          <SummaryCard combined={data.combined} params={data.params} />

          {/* Per-pair cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.results.map(r => <PairCard key={r.pair} result={r} />)}
          </div>

          {/* Data availability note */}
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r)', fontSize: '0.72rem', color: 'var(--text-4)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-3)' }}>Data availability:</strong> Backtest uses OHLCV bars cached by the backend.
            More bars = more signals detected. Push data via the MCP feed (<code>POST /api/feed</code>) to improve coverage.
            Current cache: {data.results.map(r => `${r.pair} ${r.bars_available}b`).join(' · ')}
          </div>
        </>
      )}
    </div>
  )
}
