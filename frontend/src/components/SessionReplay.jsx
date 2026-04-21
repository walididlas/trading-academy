import React, { useState, useMemo } from 'react'

const REPLAY_KEY = 'session_replays'

const CRITERIA_LABELS = {
  kill_zone:        'Kill Zone',
  order_block:      'Order Block',
  fvg:              'Fair Value Gap',
  market_structure: 'Market Structure',
  ema50:            'EMA50 Trend',
  premium_discount: 'Premium/Discount',
  news_clear:       'News Clear',
}

const VERDICT_CFG = {
  target_hit:            { label: 'Target Hit ✅',             color: 'var(--green)', bg: 'rgba(34,211,165,0.1)',   border: 'rgba(34,211,165,0.25)' },
  good_trade_bad_outcome:{ label: 'Good Trade · Bad Outcome',  color: 'var(--gold)',  bg: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.25)' },
  criteria_missing:      { label: 'Criteria Missing ⚠',        color: 'var(--red)',   bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
}

function loadReplays() {
  try { return JSON.parse(localStorage.getItem(REPLAY_KEY) || '[]') } catch { return [] }
}

function fmt(val, decimals = 5) {
  if (val == null) return '—'
  return parseFloat(val).toFixed(decimals)
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-MA', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Casablanca',
  })
}

// ── Criteria grid ──────────────────────────────────────────────────────────────
function CriteriaGrid({ criteria, metCriteria, missCriteria }) {
  if (!criteria || Object.keys(criteria).length === 0) {
    return <div style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>No criteria data (manual trade)</div>
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
      {Object.entries(CRITERIA_LABELS).map(([key, label]) => {
        const hit    = criteria[key]?.triggered
        const detail = criteria[key]?.detail ?? ''
        return (
          <div key={key} style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            padding: '6px 8px', borderRadius: 6,
            background: hit ? 'rgba(34,211,165,0.07)' : 'rgba(248,113,113,0.06)',
            border: `1px solid ${hit ? 'rgba(34,211,165,0.2)' : 'rgba(248,113,113,0.15)'}`,
          }}>
            <span style={{ fontSize: '0.75rem', marginTop: 1, flexShrink: 0 }}>{hit ? '✅' : '❌'}</span>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: hit ? 'var(--green)' : 'var(--red)' }}>{label}</div>
              {detail && <div style={{ fontSize: '0.62rem', color: 'var(--text-4)', marginTop: 1, lineHeight: 1.3 }}>{detail}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Loss analysis ──────────────────────────────────────────────────────────────
function LossAnalysis({ verdict, missCriteria, criteria }) {
  if (verdict === 'target_hit') {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(34,211,165,0.07)', border: '1px solid rgba(34,211,165,0.2)', fontSize: '0.78rem', color: 'var(--green)' }}>
        ✅ Trade closed at target. All systems aligned.
      </div>
    )
  }
  if (verdict === 'good_trade_bad_outcome') {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)', fontSize: '0.78rem', color: 'var(--gold)', lineHeight: 1.5 }}>
        <strong>Good trade, bad outcome.</strong> All confluence criteria were met — this was a valid ICC setup. The market moved against the position. SL hits on valid setups are part of the process. No changes needed to the process.
      </div>
    )
  }
  // criteria_missing
  const missLabels = missCriteria.map(k => CRITERIA_LABELS[k] ?? k)
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '0.78rem', lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠ Criteria missing at entry</div>
      <div style={{ color: 'var(--text-2)', marginBottom: 6 }}>
        These criteria were <strong>not triggered</strong> when the trade was taken:
      </div>
      <ul style={{ margin: '0 0 6px 16px', padding: 0, color: 'var(--red)' }}>
        {missLabels.map(l => <li key={l} style={{ marginBottom: 2 }}>{l}</li>)}
      </ul>
      <div style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>
        Wait for all criteria to align before entering. A score ≥80 is required for STRONG grade.
      </div>
    </div>
  )
}

// ── Single replay card ─────────────────────────────────────────────────────────
function ReplayCard({ replay }) {
  const [open, setOpen] = useState(false)
  const cfg    = VERDICT_CFG[replay.verdict] ?? VERDICT_CFG.criteria_missing
  const isWin  = replay.reason === 'tp'
  const pnlStr = replay.pnl != null
    ? (replay.pnl >= 0 ? `+$${replay.pnl.toFixed(2)}` : `-$${Math.abs(replay.pnl).toFixed(2)}`)
    : '—'
  const pnlCol = replay.pnl > 0 ? 'var(--green)' : replay.pnl < 0 ? 'var(--red)' : 'var(--text-3)'
  const decPl  = replay.pair === 'XAUUSD' ? 2 : replay.pair?.includes('JPY') ? 3 : 5

  return (
    <div style={{
      borderRadius: 'var(--r-lg)',
      border: `1px solid ${cfg.border}`,
      borderLeft: `3px solid ${cfg.color}`,
      overflow: 'hidden',
      background: cfg.bg,
      marginBottom: 8,
    }}>
      {/* Header — always visible */}
      <div
        style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Pair + direction */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '0.95rem' }}>
              {replay.pair}
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5,
              background: replay.direction === 'long' ? 'rgba(34,211,165,0.15)' : 'rgba(248,113,113,0.15)',
              color: replay.direction === 'long' ? 'var(--green)' : 'var(--red)',
            }}>
              {replay.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5,
              background: isWin ? 'rgba(34,211,165,0.12)' : 'rgba(248,113,113,0.12)',
              color: isWin ? 'var(--green)' : 'var(--red)',
            }}>
              {isWin ? 'TP Hit' : 'SL Hit'}
            </span>
          </div>

          {/* P&L */}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '0.95rem', color: pnlCol, flexShrink: 0 }}>
            {pnlStr}
          </span>

          {/* Score */}
          {replay.score != null && (
            <span style={{
              fontSize: '0.7rem', color: 'var(--text-3)',
              fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
            }}>
              {replay.score}pts
            </span>
          )}

          {/* Expand chevron */}
          <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>

        {/* Verdict badge + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: '0.67rem', color: 'var(--text-4)' }}>{fmtDate(replay.ts)}</span>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Trade levels */}
          {(replay.entry || replay.sl || replay.tp1) && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Trade Levels
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem' }}>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-4)', marginBottom: 2 }}>ENTRY</div>
                  <div style={{ fontWeight: 700 }}>{fmt(replay.entry, decPl)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--red)', marginBottom: 2 }}>STOP LOSS</div>
                  <div style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(replay.sl, decPl)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--green)', marginBottom: 2 }}>TP1</div>
                  <div style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(replay.tp1, decPl)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: pnlCol, marginBottom: 2 }}>P&L</div>
                  <div style={{ fontWeight: 700, color: pnlCol }}>{pnlStr}</div>
                </div>
              </div>
            </div>
          )}

          {/* Confluence criteria */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Confluence at Entry
            </div>
            <CriteriaGrid
              criteria={replay.criteria}
              metCriteria={replay.met_criteria}
              missCriteria={replay.miss_criteria}
            />
          </div>

          {/* Verdict & analysis */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Post-Trade Analysis
            </div>
            <LossAnalysis
              verdict={replay.verdict}
              missCriteria={replay.miss_criteria ?? []}
              criteria={replay.criteria}
            />
          </div>

          {/* Snapshot time note */}
          {replay.snapshot_ts && (
            <div style={{ fontSize: '0.62rem', color: 'var(--text-4)' }}>
              Signal snapshot taken: {fmtDate(replay.snapshot_ts)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Session Replay tab ────────────────────────────────────────────────────
export default function SessionReplay() {
  const [replays] = useState(loadReplays)
  const [filterPair,    setFilterPair]    = useState('ALL')
  const [filterVerdict, setFilterVerdict] = useState('ALL')
  const [filterDate,    setFilterDate]    = useState('')

  const pairs = useMemo(() => ['ALL', ...new Set(replays.map(r => r.pair).filter(Boolean))], [replays])

  const filtered = useMemo(() => {
    let rs = replays
    if (filterPair    !== 'ALL') rs = rs.filter(r => r.pair === filterPair)
    if (filterVerdict !== 'ALL') rs = rs.filter(r => r.verdict === filterVerdict)
    if (filterDate)               rs = rs.filter(r => r.ts?.startsWith(filterDate))
    return rs
  }, [replays, filterPair, filterVerdict, filterDate])

  // Summary stats
  const stats = useMemo(() => {
    if (!replays.length) return null
    const tpHits = replays.filter(r => r.verdict === 'target_hit').length
    const goodBad = replays.filter(r => r.verdict === 'good_trade_bad_outcome').length
    const crisMiss = replays.filter(r => r.verdict === 'criteria_missing').length
    return { total: replays.length, tpHits, goodBad, crisMiss }
  }, [replays])

  if (replays.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 32 }}>
        <div className="empty-state-icon">🎬</div>
        <div className="empty-state-title">No session replays yet</div>
        <div className="empty-state-text">
          Replays are generated automatically each time a MetaApi position closes (SL or TP hit). They store the signal score, confluence criteria, and post-trade analysis.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Summary stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Replays</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Target Hit</div>
            <div className="stat-value green">{stats.tpHits}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Good Trade</div>
            <div className="stat-value gold">{stats.goodBad}</div>
            <div className="stat-sub">bad outcome</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Criteria Missing</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{stats.crisMiss}</div>
            <div className="stat-sub">avoidable losses</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter:</span>

        {/* Pair */}
        {pairs.map(p => (
          <button key={p} onClick={() => setFilterPair(p)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
            border: '1px solid var(--border)', cursor: 'pointer', touchAction: 'manipulation',
            background: filterPair === p ? 'var(--gold)' : 'var(--surface-2)',
            color: filterPair === p ? '#000' : 'var(--text-3)',
          }}>{p}</button>
        ))}

        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

        {/* Verdict */}
        {[
          { val: 'ALL',                   label: 'All' },
          { val: 'target_hit',            label: '✅ TP Hit' },
          { val: 'good_trade_bad_outcome',label: '🟡 Good Trade' },
          { val: 'criteria_missing',      label: '🔴 Criteria Missing' },
        ].map(v => (
          <button key={v.val} onClick={() => setFilterVerdict(v.val)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
            border: '1px solid var(--border)', cursor: 'pointer', touchAction: 'manipulation',
            background: filterVerdict === v.val ? 'var(--surface-3)' : 'var(--surface-2)',
            color: filterVerdict === v.val ? 'var(--text)' : 'var(--text-3)',
          }}>{v.label}</button>
        ))}

        {/* Date filter */}
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '4px 8px', fontSize: '0.72rem',
            color: 'var(--text)', outline: 'none',
          }}
        />
        {filterDate && (
          <button onClick={() => setFilterDate('')} style={{
            background: 'none', border: 'none', color: 'var(--text-4)',
            cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px',
          }}>✕</button>
        )}
      </div>

      {/* Replay cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: '0.85rem' }}>
          No replays match the current filters.
        </div>
      ) : (
        filtered.map(r => <ReplayCard key={r.id} replay={r} />)
      )}
    </div>
  )
}
