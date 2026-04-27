import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../config'

// ── Circular SVG gauge ────────────────────────────────────────────────────────
// Shows equity as % of start-of-day. Arc fills from top, clockwise.
// Zone colours: >97% green, 95-97% yellow, <95% red.
function EquityGauge({ equity, startEquity, lossPct, paused }) {
  const SIZE  = 120
  const R     = 46
  const CX    = SIZE / 2
  const CY    = SIZE / 2
  const STROKE = 8
  const CIRC  = 2 * Math.PI * R

  // pct of daily budget remaining (0-100 maps to 0-100% of arc)
  // We show how much of the 5% limit has been consumed
  const consumed   = Math.min(Math.max(lossPct, 0), 5)   // capped at 5
  const arcFill    = consumed / 5                         // 0→1
  const dashOffset = CIRC * (1 - arcFill)

  const trackColor = '#1e2230'
  const fillColor  = lossPct >= 5   ? '#ef4444'
                   : lossPct >= 3   ? '#f5a623'
                   : lossPct >= 1   ? '#f5a623'
                   : '#22d3ee'

  const labelColor = lossPct >= 5   ? 'var(--red)'
                   : lossPct >= 3   ? 'var(--gold)'
                   : 'var(--green)'

  const equityDisplay = equity != null ? `$${equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
  const pctDisplay    = startEquity ? `${lossPct >= 0 ? '-' : '+'}${Math.abs(lossPct).toFixed(2)}%` : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={SIZE} height={SIZE} style={{ overflow: 'visible' }}>
        {/* Track */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={trackColor}
          strokeWidth={STROKE}
        />
        {/* Fill arc — starts at top (−90°), clockwise */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={fillColor}
          strokeWidth={STROKE}
          strokeDasharray={CIRC}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
        />
        {/* Limit tick marks at 1%, 3%, 5% */}
        {[1, 3, 5].map(pct => {
          const angle  = (pct / 5) * 360 - 90
          const rad    = (angle * Math.PI) / 180
          const x1 = CX + (R - STROKE / 2 - 2) * Math.cos(rad)
          const y1 = CY + (R - STROKE / 2 - 2) * Math.sin(rad)
          const x2 = CX + (R + STROKE / 2 + 2) * Math.cos(rad)
          const y2 = CY + (R + STROKE / 2 + 2) * Math.sin(rad)
          return <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#374151" strokeWidth={1.5} />
        })}
        {/* Centre equity value */}
        <text x={CX} y={CY - 8} textAnchor="middle" fill="var(--text)"
          fontSize={equity != null && equity > 99999 ? 11 : 13}
          fontFamily="'JetBrains Mono', monospace" fontWeight="700">
          {equityDisplay}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" fill={labelColor}
          fontSize={10} fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          {startEquity ? pctDisplay : 'equity'}
        </text>
        {paused && (
          <text x={CX} y={CY + 22} textAnchor="middle" fill="var(--red)"
            fontSize={8} fontFamily="'JetBrains Mono', monospace">
            PAUSED
          </text>
        )}
      </svg>

      {/* Zone legend */}
      <div style={{ display: 'flex', gap: 8, fontSize: '0.6rem', color: 'var(--text-4)' }}>
        <span style={{ color: '#22d3ee' }}>●</span><span>OK</span>
        <span style={{ color: '#f5a623' }}>●</span><span>-3%</span>
        <span style={{ color: '#ef4444' }}>●</span><span>-5% limit</span>
      </div>
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Tile({ label, value, sub, color, large }) {
  return (
    <div style={{
      background: 'var(--surface-2)', borderRadius: 8,
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: large ? '1.2rem' : '1rem',
        fontWeight: 800,
        color: color ?? 'var(--text)',
        lineHeight: 1.1,
      }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>{sub}</div>
      )}
    </div>
  )
}

// ── Streak indicator ──────────────────────────────────────────────────────────
function StreakTile({ streak, streakType }) {
  const isWin  = streakType === 'win'
  const color  = isWin ? 'var(--green)' : streakType === 'loss' ? 'var(--red)' : 'var(--text-3)'
  const icon   = isWin ? '🔥' : streakType === 'loss' ? '🛑' : '—'
  const label  = streak > 0 ? `${streak} ${streakType}${streak > 1 ? 's' : ''}` : '—'

  return (
    <Tile
      label="Streak"
      value={streak > 0 ? `${icon} ${label}` : '—'}
      color={color}
    />
  )
}

// ── Warning banner ────────────────────────────────────────────────────────────
function RiskBanner({ lossPct, paused }) {
  if (paused) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8, marginBottom: 12,
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
        fontSize: '0.78rem', color: 'var(--red)', fontWeight: 600,
      }}>
        🛑 Auto-trading paused — daily loss limit reached. Resets at London open.
      </div>
    )
  }
  if (lossPct >= 3) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8, marginBottom: 12,
        background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.3)',
        fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 600,
      }}>
        ⚠️ Down {lossPct.toFixed(1)}% today — approaching 5% limit. Trade very selectively.
      </div>
    )
  }
  return null
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function DrawdownPanel() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState(null)

  const fetch_ = useCallback(() => {
    fetch(`${API_BASE}/api/trade/account`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setLastFetch(new Date()) })
      .catch(() => setLoading(false))
  }, [])

  // Initial fetch + 60s poll
  useEffect(() => {
    fetch_()
    const t = setInterval(fetch_, 60000)
    return () => clearInterval(t)
  }, [fetch_])

  // ── No token / loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="label-caps" style={{ marginBottom: 8 }}>Account Performance</div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Loading account data…</div>
      </div>
    )
  }

  if (!data?.ok) {
    // Live account data not available — show journal-based stats only
    return <JournalFallback />
  }

  // ── Live account data ─────────────────────────────────────────────────────────
  const {
    equity, balance, start_equity,
    today_pnl, loss_pct,
    wins_today, losses_today, total_closed, win_rate,
    streak, streak_type,
    max_drawdown,
    paused,
  } = data

  const pnlColor = today_pnl > 0 ? 'var(--green)' : today_pnl < 0 ? 'var(--red)' : 'var(--text-3)'
  const wrColor  = win_rate == null ? 'var(--text-3)'
                 : win_rate >= 60   ? 'var(--green)'
                 : win_rate >= 40   ? 'var(--gold)'
                 : 'var(--red)'

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div className="label-caps">Account Performance</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 2 }}>
            Live · {lastFetch ? `updated ${lastFetch.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ touchAction: 'manipulation' }}
          onClick={fetch_}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Risk warning banner */}
      <RiskBanner lossPct={loss_pct ?? 0} paused={paused} />

      {/* Gauge + stats side by side */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
        {/* Circular gauge */}
        <div style={{ flexShrink: 0 }}>
          <EquityGauge
            equity={equity}
            startEquity={start_equity}
            lossPct={loss_pct ?? 0}
            paused={paused}
          />
          <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-4)', marginTop: 4 }}>
            5% daily loss limit
          </div>
        </div>

        {/* Right: stat tiles grid */}
        <div style={{ flex: 1, minWidth: 220, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Tile
            label="Today P&L"
            value={today_pnl >= 0 ? `+$${today_pnl.toFixed(2)}` : `-$${Math.abs(today_pnl).toFixed(2)}`}
            sub={start_equity ? `${loss_pct > 0 ? '-' : '+'}${Math.abs(loss_pct).toFixed(2)}% of start` : undefined}
            color={pnlColor}
            large
          />
          <Tile
            label="Win Rate"
            value={win_rate != null ? `${win_rate}%` : '—'}
            sub={total_closed > 0 ? `${wins_today}W / ${losses_today}L (${total_closed} trades)` : 'no trades today'}
            color={wrColor}
          />
          <StreakTile streak={streak ?? 0} streakType={streak_type} />
          <Tile
            label="Max Drawdown"
            value={max_drawdown > 0 ? `-$${max_drawdown.toFixed(2)}` : '$0'}
            sub="worst intraday dip"
            color={max_drawdown > 0 ? 'var(--red)' : 'var(--text-3)'}
          />
        </div>
      </div>

      {/* Divider + balance row */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 10,
        display: 'flex', gap: 16, flexWrap: 'wrap',
        fontSize: '0.72rem', color: 'var(--text-3)',
      }}>
        <span>Balance <strong style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>${balance?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong></span>
        {start_equity && <span>Day started <strong style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>${start_equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong></span>}
        <span>Drawdown limit <strong style={{ color: 'var(--red)', fontFamily: "'JetBrains Mono', monospace" }}>
          {start_equity ? `$${(start_equity * 0.05).toFixed(2)}` : '5% of start'}
        </strong></span>
      </div>
    </div>
  )
}

// ── Fallback: journal-based stats ────────────────────────────────────────────
function JournalFallback() {
  const today = new Date().toISOString().split('T')[0]

  const trades = React.useMemo(() => {
    try {
      const all = JSON.parse(localStorage.getItem('trading_journal') || '[]')
      return all.filter(t => t.date === today && t.result)
    } catch { return [] }
  }, [today])

  const wins   = trades.filter(t => t.result === 'win')
  const losses = trades.filter(t => t.result === 'loss')
  const pnl    = trades.reduce((a, t) => a + (parseFloat(t.pnl) || 0), 0)
  const wr     = trades.length ? Math.round(wins.length / trades.length * 100) : null

  // Consecutive streak
  let streak = 0, streakType = null
  for (let i = 0; i < trades.length; i++) {
    const kind = trades[i].result === 'win' ? 'win' : 'loss'
    if (streakType === null) streakType = kind
    if (kind === streakType) streak++
    else break
  }

  const pnlColor = pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-3)'
  const wrColor  = wr == null ? 'var(--text-3)' : wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--gold)' : 'var(--red)'

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div className="label-caps">Today's Performance</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 2 }}>From journal entries</div>
        </div>
      </div>

      {trades.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', textAlign: 'center', padding: '16px 0' }}>
          No closed trades logged today
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
          <Tile
            label="Today P&L"
            value={pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
            color={pnlColor}
            large
          />
          <Tile
            label="Win Rate"
            value={wr != null ? `${wr}%` : '—'}
            sub={`${wins.length}W / ${losses.length}L`}
            color={wrColor}
          />
          <StreakTile streak={streak} streakType={streakType} />
          <Tile
            label="Trades"
            value={trades.length}
            sub="closed today"
            color="var(--text)"
          />
        </div>
      )}
    </div>
  )
}
