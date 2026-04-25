import React, { useState, useEffect, useCallback } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function verdictColor(verdict) {
  if (verdict === 'Strong week')    return 'var(--green)'
  if (verdict === 'Rough week')     return 'var(--red)'
  return 'var(--text-2)'
}

function verdictIcon(verdict) {
  if (verdict === 'Strong week')    return '🏆'
  if (verdict === 'Rough week')     return '📉'
  return '➖'
}

function pnlColor(v) {
  return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-2)'
}

function fmtPnl(v) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`
}

function fmtWeek(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Single week card ──────────────────────────────────────────────────────────

function WeekCard({ report, index }) {
  const [expanded, setExpanded] = useState(index === 0)
  const v = report.verdict || 'Breakeven week'

  return (
    <div
      style={{
        background:    'var(--surface-2)',
        border:        `1px solid ${index === 0 ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius:  10,
        overflow:      'hidden',
        marginBottom:  8,
      }}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width:      '100%',
          background: 'none',
          border:     'none',
          padding:    '10px 14px',
          display:    'flex',
          alignItems: 'center',
          gap:        10,
          cursor:     'pointer',
          textAlign:  'left',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>{verdictIcon(v)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, color: verdictColor(v), fontSize: '0.85rem' }}>{v}</span>
            {index === 0 && (
              <span style={{
                background: 'var(--accent)', color: '#000', fontSize: '0.6rem',
                fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              }}>THIS WEEK</span>
            )}
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.7rem', marginTop: 2 }}>
            {fmtWeek(report.week_start)}
          </div>
        </div>
        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ color: pnlColor(report.total_pnl), fontWeight: 700, fontSize: '0.88rem' }}>
            {fmtPnl(report.total_pnl)}
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>
            {report.win_rate ?? '—'}% WR
          </span>
          <span style={{
            color:    'var(--text-4)',
            fontSize: '0.8rem',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>▼</span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding:       '4px 14px 14px',
          borderTop:     '1px solid var(--border)',
          display:       'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:           10,
        }}>
          {/* Stat tiles */}
          {[
            { label: 'Total Trades', value: report.total_trades ?? '—' },
            { label: 'Win Rate',     value: report.win_rate != null ? `${report.win_rate}%` : '—' },
            { label: 'Wins',         value: report.wins ?? '—', color: 'var(--green)' },
            { label: 'Losses',       value: report.losses ?? '—', color: 'var(--red)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background:   'var(--surface-3)',
              borderRadius: 8,
              padding:      '8px 10px',
            }}>
              <div style={{ color: 'var(--text-3)', fontSize: '0.65rem', marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: color || 'var(--text-1)' }}>{value}</div>
            </div>
          ))}

          {/* Best trade */}
          {report.best_trade && (
            <div style={{ background: 'var(--surface-3)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '0.65rem', marginBottom: 2 }}>Best Trade</div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--green)' }}>
                {report.best_trade.pair}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--green)' }}>
                {fmtPnl(report.best_trade.pnl)}
              </div>
            </div>
          )}

          {/* Worst trade */}
          {report.worst_trade && (
            <div style={{ background: 'var(--surface-3)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '0.65rem', marginBottom: 2 }}>Worst Trade</div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--red)' }}>
                {report.worst_trade.pair}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--red)' }}>
                {fmtPnl(report.worst_trade.pnl)}
              </div>
            </div>
          )}

          {/* Most active pair */}
          {report.most_active && (
            <div style={{
              gridColumn:   '1 / -1',
              background:   'var(--surface-3)',
              borderRadius: 8,
              padding:      '8px 10px',
              display:      'flex',
              justifyContent: 'space-between',
              alignItems:   'center',
            }}>
              <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>Most Active Pair</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.85rem' }}>
                {report.most_active}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WeeklyReportCard() {
  const [reports, setReports]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError]         = useState(null)

  const load = useCallback(async () => {
    try {
      const local = (() => {
        try { return JSON.parse(localStorage.getItem('weekly_reports') || '[]') } catch { return [] }
      })()

      const sorted = [...local]
        .sort((a, b) => (b.week_num ?? 0) - (a.week_num ?? 0))
        .slice(0, 8)

      setReports(sorted)
    } catch (e) {
      setError('Could not load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Listen for weekly_report WS events via localStorage changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'weekly_reports') load()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [load])

  const handleGenerate = async () => {
    setGenerating(true)
    await load()
    setGenerating(false)
  }

  return (
    <div style={{
      background:   'var(--surface-1)',
      border:       '1px solid var(--border)',
      borderRadius: 14,
      padding:      '16px 16px 12px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.15rem' }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-1)' }}>Weekly Reports</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background:   generating ? 'var(--surface-3)' : 'var(--accent)',
            color:        generating ? 'var(--text-3)' : '#000',
            border:       'none',
            borderRadius: 7,
            padding:      '4px 10px',
            fontSize:     '0.7rem',
            fontWeight:   700,
            cursor:       generating ? 'default' : 'pointer',
          }}
        >
          {generating ? 'Generating…' : 'Generate Now'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
          Loading reports…
        </div>
      ) : error ? (
        <div style={{ color: 'var(--red)', fontSize: '0.8rem', textAlign: 'center', padding: '12px 0' }}>
          {error}
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          color:      'var(--text-3)',
          fontSize:   '0.8rem',
          textAlign:  'center',
          padding:    '20px 0',
          lineHeight: 1.6,
        }}>
          No weekly reports yet.<br />
          Reports generate automatically every Sunday at 20:00 Morocco time.<br />
          <span style={{ color: 'var(--text-4)', fontSize: '0.72rem' }}>
            You can also tap "Generate Now" above.
          </span>
        </div>
      ) : (
        <div>
          {reports.map((r, i) => (
            <WeekCard key={r.week_num ?? r.week_start ?? i} report={r} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
