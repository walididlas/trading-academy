import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE } from '../config'
import { useAlerts } from '../contexts/AlertContext'
import { useAccount } from '../hooks/useAccount'
import { useCalendar } from '../hooks/useCalendar'
import AccountSetupModal from '../components/AccountSetupModal'
import SetupDiagram from '../components/SetupDiagram'
import NewsFeed from '../components/NewsFeed'
import NewsShield from '../components/NewsShield'
import CalendarStrip from '../components/CalendarStrip'
import PairChart from '../components/PairChart'

const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY']

// ── Weekend helper ─────────────────────────────────────────────────────────────
function isWeekend() {
  const d = new Date().getUTCDay()  // 0 = Sun, 6 = Sat
  return d === 0 || d === 6
}

// Minutes until next Monday 09:00 UTC (= London KZ open)
function minsUntilMondayOpen() {
  const now = new Date()
  const day = now.getUTCDay()       // 0=Sun, 6=Sat
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes()
  // Days until Monday
  const daysToMon = day === 0 ? 1 : day === 6 ? 2 : 0
  const totalMins = daysToMon * 24 * 60 + (9 * 60 - mins)
  return Math.max(0, totalMins)
}

// ── Morocco Kill Zone clock ───────────────────────────────────────────────────
function KillZoneClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const weekend = isWeekend()

  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const morMins = utcMins + 60
  const morH = Math.floor(morMins / 60) % 24
  const morM = morMins % 60
  const morStr = `${String(morH).padStart(2,'0')}:${String(morM).padStart(2,'0')}`

  const inLondon = !weekend && utcMins >= 9 * 60 && utcMins < 12 * 60
  const inNY     = !weekend && utcMins >= 14 * 60 + 30 && utcMins < 17 * 60 + 30
  const inKZ     = inLondon || inNY

  function nextKZ() {
    if (weekend) {
      const m = minsUntilMondayOpen()
      const h = Math.floor(m / 60), rem = m % 60
      return { name: 'London KZ Mon', label: h > 0 ? `${h}h ${rem}m` : `${rem}m`, active: false, closed: true }
    }
    if (inLondon) return { name: 'London KZ', label: 'ACTIVE', active: true }
    if (inNY)     return { name: 'NY KZ',     label: 'ACTIVE', active: true }
    let minsLeft
    if (utcMins < 9 * 60)          { minsLeft = 9 * 60 - utcMins }
    else if (utcMins < 14 * 60+30) { minsLeft = 14 * 60 + 30 - utcMins }
    else                           { minsLeft = (24 * 60 - utcMins) + 9 * 60 }
    const h = Math.floor(minsLeft / 60), m = minsLeft % 60
    const name = utcMins >= 9 * 60 && utcMins < 14 * 60 + 30 ? 'NY KZ' : 'London KZ'
    return { name, label: h > 0 ? `${h}h ${m}m` : `${m}m`, active: false }
  }
  const next = nextKZ()

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="label-caps" style={{ marginBottom: 3 }}>Morocco Time</div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '1.5rem',
            fontWeight: 700, color: inKZ ? 'var(--gold)' : weekend ? 'var(--text-3)' : 'var(--text)',
          }}>
            {morStr}
          </div>
          {weekend && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 2 }}>Weekend</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { name: 'London', mor: '10:00–13:00', utcStart: 9*60, utcEnd: 12*60 },
            { name: 'NY',     mor: '15:30–18:30', utcStart: 14*60+30, utcEnd: 17*60+30 },
          ].map(z => {
            const active = !weekend && utcMins >= z.utcStart && utcMins < z.utcEnd
            return (
              <div key={z.name} style={{
                padding: '8px 12px', borderRadius: 'var(--r)',
                background: weekend ? 'var(--surface-2)' : active ? 'var(--gold-pale)' : 'var(--surface-2)',
                border: `1px solid ${active ? 'var(--gold-ring)' : 'var(--border)'}`,
                opacity: weekend ? 0.45 : 1,
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: active ? 'var(--gold)' : 'var(--text-2)' }}>{z.name} KZ</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{z.mor}</div>
                {active && <div style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, marginTop: 2 }}>● ACTIVE</div>}
                {weekend && <div style={{ fontSize: '0.65rem', color: 'var(--text-4)', marginTop: 2 }}>Closed</div>}
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label-caps" style={{ marginBottom: 3 }}>
            {next.active ? 'Now Active' : next.closed ? 'Opens In' : 'Opens In'}
          </div>
          <div style={{ fontWeight: 700, color: next.active ? 'var(--gold)' : 'var(--text)' }}>{next.name}</div>
          <div style={{ fontSize: '0.85rem', color: next.active ? 'var(--green)' : 'var(--text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
            {next.label}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Weekend countdown (live ticker showing hours/mins until Monday open) ───────
function WeekendCountdown() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const m = Math.max(0, minsUntilMondayOpen())
  const h = Math.floor(m / 60), rem = m % 60
  const s = Math.floor((now - 0) / 1000 % 60)
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
      fontSize: '1rem', color: 'var(--text-2)',
    }}>
      {String(h).padStart(2,'0')}:{String(rem).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </div>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const grade   = score >= 80 ? 'STRONG' : score >= 60 ? 'WATCH' : 'MON'
  const color   = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--gold)' : 'var(--text-4)'
  const radius  = 22, cx = 26, cy = 26
  const circ    = 2 * Math.PI * radius
  const filled  = circ * (score / 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <svg width={52} height={52}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--surface-4)" strokeWidth={4} />
        <circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s' }}
        />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={color} fontFamily="sans-serif">
          {score}
        </text>
      </svg>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, color, letterSpacing: '0.06em', marginTop: 2 }}>{grade}</div>
    </div>
  )
}

// ── Criteria checklist ────────────────────────────────────────────────────────
function CriteriaList({ criteria }) {
  const LABELS = {
    kill_zone:        ['KZ Active',           25],
    order_block:      ['Order Block',         20],
    fvg:              ['Fair Value Gap',       15],
    market_structure: ['Market Structure',     15],
    ema50:            ['EMA50 Trend',          10],
    premium_discount: ['Premium / Discount',   10],
    news_clear:       ['News Clear',            5],
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Object.entries(LABELS).map(([key, [label, max]]) => {
        const c = criteria?.[key]
        const hit = c?.triggered
        const pts = c?.points ?? 0
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
            <span style={{ color: hit ? 'var(--green)' : 'var(--text-4)', fontSize: '0.7rem', flexShrink: 0 }}>
              {hit ? '✓' : '○'}
            </span>
            <span style={{ color: hit ? 'var(--text-2)' : 'var(--text-4)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c?.detail || label}
            </span>
            <span style={{ color: hit ? 'var(--green)' : 'var(--text-4)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
              +{pts}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Position size display ─────────────────────────────────────────────────────
function PositionInfo({ signal, calcLots, riskPct }) {
  const pos = calcLots ? calcLots(signal.entry, signal.sl, signal.pair) : null
  if (!pos) return null

  // Use actual R:R from signal if available, else 1/2/3
  const profitTP1 = signal.rr1 != null
    ? parseFloat((pos.riskUSD * signal.rr1).toFixed(2))
    : pos.profitTP1
  const profitTP2 = signal.rr2 != null
    ? parseFloat((pos.riskUSD * signal.rr2).toFixed(2))
    : pos.profitTP2
  const profitTP3 = signal.rr3 != null
    ? parseFloat((pos.riskUSD * signal.rr3).toFixed(2))
    : pos.profitTP3

  return (
    <div style={{ marginTop: 12 }}>
      {/* 2% cap warning */}
      {pos.capped && pos.warning && (
        <div style={{
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 6, padding: '7px 10px', marginBottom: 8,
          fontSize: '0.72rem', color: 'var(--gold)', lineHeight: 1.5,
        }}>
          ⚠️ {pos.warning}
        </div>
      )}

      <div style={{
        background: 'var(--surface-3)', borderRadius: 'var(--r)', padding: '10px 14px',
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px',
      }}>
        <div>
          <div style={{ fontSize: '0.67rem', color: 'var(--text-4)', marginBottom: 1 }}>
            Lot Size ({riskPct ?? 1}% risk)
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: pos.capped ? 'var(--gold)' : 'var(--green)' }}>
            {pos.lots} lots
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.67rem', color: 'var(--text-4)', marginBottom: 1 }}>Risk ({pos.slPips} pips)</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--red)' }}>
            −${pos.riskUSD}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.67rem', color: 'var(--text-4)', marginBottom: 1 }}>
            {signal.rr1 ? `TP1 (${signal.rr1.toFixed(1)}R)` : 'TP1 (1R)'}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', color: 'var(--green)' }}>
            +${profitTP1}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.67rem', color: 'var(--text-4)', marginBottom: 1 }}>
            {signal.rr2 ? `TP2 (${signal.rr2.toFixed(1)}R)` : 'TP2 (2R)'}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', color: 'var(--green)' }}>
            +${profitTP2}
          </div>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <div style={{ fontSize: '0.67rem', color: 'var(--text-4)', marginBottom: 1 }}>
            {signal.rr3 ? `TP3 (${signal.rr3.toFixed(1)}R)` : 'TP3 (3R)'}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem', color: 'var(--green)' }}>
            +${profitTP3}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Price levels table ────────────────────────────────────────────────────────
function LevelsTable({ signal }) {
  const dec = signal.pair === 'XAUUSD' ? 2 : signal.pair?.includes('JPY') ? 3 : 5
  const f = (v) => v?.toFixed(dec) ?? '—'
  const lt = signal.liq_type  // 'BSL' | 'SSL' | undefined
  const rr1 = signal.rr1, rr2 = signal.rr2, rr3 = signal.rr3
  const rrFmt = (r) => r != null ? `${r.toFixed(1)}:1` : null
  const rows = [
    { label: 'Entry',    value: signal.entry, color: 'var(--blue)',  pips: null,           rr: null },
    { label: 'Stop Loss',value: signal.sl,    color: 'var(--red)',   pips: signal.pip_sl,  rr: null },
    { label: lt ? `TP1 (${lt})` : `TP1 ${rrFmt(rr1) ? `(${rrFmt(rr1)})` : '(1:1)'}`,
      value: signal.tp1, color: 'var(--green)', pips: signal.pip_tp1,
      rr: `${rrFmt(rr1) ?? '1:1'} → move SL to BE` },
    { label: lt ? `TP2 (${lt})` : `TP2 ${rrFmt(rr2) ? `(${rrFmt(rr2)})` : '(2:1)'}`,
      value: signal.tp2, color: 'var(--green)', pips: signal.pip_tp2,
      rr: `${rrFmt(rr2) ?? '2:1'} → partial close` },
    { label: lt ? `TP3 (${lt})` : `TP3 ${rrFmt(rr3) ? `(${rrFmt(rr3)})` : '(3:1)'}`,
      value: signal.tp3, color: 'var(--green)', pips: signal.pip_tp3,
      rr: `${rrFmt(rr3) ?? '3:1'} → full exit` },
  ]

  return (
    <div style={{ marginTop: 12 }}>
      {rows.map(({ label, value, color, pips, rr }) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 0', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{label}</div>
            {rr && <div style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>{rr}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color, fontSize: '0.88rem' }}>
              {f(value)}
            </div>
            {pips != null && (
              <div style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>{pips} pips</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Expiry countdown ──────────────────────────────────────────────────────────
function ExpiryBadge({ expiresAt }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt) - Date.now()
      if (diff <= 0) { setLabel('Expired'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [expiresAt])

  const diff = new Date(expiresAt) - Date.now()
  const urgent = diff < 60 * 60 * 1000  // < 1 hour

  return (
    <span style={{
      fontSize: '0.65rem', color: urgent ? 'var(--red)' : 'var(--text-4)',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      ⏱ {label}
    </span>
  )
}

// ── Entry status badge ────────────────────────────────────────────────────────
function EntryStatusBadge({ status }) {
  if (!status || status === 'pending') return (
    <span style={{
      fontSize: '0.63rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: 'rgba(148,163,184,0.12)', color: 'var(--text-4)',
      border: '1px solid rgba(148,163,184,0.2)',
    }}>⏳ Pending</span>
  )
  if (status === 'reached') return (
    <span style={{
      fontSize: '0.63rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: 'rgba(34,211,165,0.12)', color: 'var(--green)',
      border: '1px solid rgba(34,211,165,0.25)',
    }}>✓ Entry Reached</span>
  )
  if (status === 'expired') return (
    <span style={{
      fontSize: '0.63rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: 'rgba(248,113,113,0.12)', color: 'var(--red)',
      border: '1px solid rgba(248,113,113,0.25)',
    }}>✗ Expired</span>
  )
  return null
}

// ── STRONG signal card ────────────────────────────────────────────────────────
function SignalCard({ signal, calcLots, riskPct, onPaperTrade, onSetAlert, newsRisk }) {
  const [expanded, setExpanded] = useState(signal.grade === 'STRONG')
  const [paperDone, setPaperDone] = useState(false)
  const [alertSet, setAlertSet] = useState(false)

  const isStrong  = signal.grade === 'STRONG'
  const isWatch   = signal.grade === 'WATCH'
  const isLong    = signal.direction === 'long'
  const hasHighRisk  = newsRisk?.level === 'HIGH'
  // Show red block banner only for STRONG + HIGH news
  const showNewsBlock = hasHighRisk && isStrong
  const borderCol = hasHighRisk
    ? 'var(--red)'
    : isStrong ? 'var(--green)' : isWatch ? 'var(--gold)' : 'var(--border)'
  const bgCol = hasHighRisk
    ? 'rgba(248,113,113,0.04)'
    : isStrong ? 'rgba(34,211,165,0.04)' : isWatch ? 'rgba(245,166,35,0.03)' : 'transparent'

  function handlePaperTrade() {
    onPaperTrade(signal)
    setPaperDone(true)
    setTimeout(() => setPaperDone(false), 3000)
  }

  function handleSetAlert() {
    onSetAlert(signal)
    setAlertSet(true)
    setTimeout(() => setAlertSet(false), 3000)
  }

  return (
    <div style={{
      borderRadius: 'var(--r-lg)', background: bgCol,
      border: `1px solid ${borderCol}`,
      borderLeft: `3px solid ${borderCol}`,
      overflow: 'hidden',
    }}>
      {/* RED NEWS RISK BANNER — only for STRONG signals with HIGH impact news */}
      {showNewsBlock && (
        <div style={{
          background: 'rgba(248,113,113,0.18)',
          borderBottom: '1px solid rgba(248,113,113,0.3)',
          padding: '7px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.78rem', fontWeight: 700, color: 'var(--red)',
        }}>
          <span>⛔</span>
          <span>HIGH IMPACT NEWS — WAIT &nbsp;·&nbsp; {newsRisk.next_event?.title}</span>
        </div>
      )}

      {/* Header — always visible */}
      <div
        style={{ padding: '14px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <ScoreRing score={signal.score} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: pair, direction, timeframe, expiry, news shield */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.05rem' }}>
                {signal.pair}
              </span>
              {signal.direction && (
                <span style={{
                  fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                  background: isLong ? 'rgba(34,211,165,0.15)' : 'rgba(248,113,113,0.15)',
                  color: isLong ? 'var(--green)' : 'var(--red)',
                }}>
                  {isLong ? '▲ LONG' : '▼ SHORT'}
                </span>
              )}
              {signal.timeframe && <span className="tag tag-gray">{signal.timeframe}</span>}
              {/* Premium / Discount zone pill */}
              {signal.premium_discount?.zone && (
                <span style={{
                  fontSize: '0.67rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: signal.premium_discount.correct
                    ? 'rgba(34,211,165,0.12)' : 'rgba(248,113,113,0.10)',
                  color: signal.premium_discount.correct ? 'var(--green)' : 'var(--text-4)',
                  border: `1px solid ${signal.premium_discount.correct ? 'rgba(34,211,165,0.25)' : 'rgba(248,113,113,0.2)'}`,
                }}>
                  {signal.premium_discount.zone}
                </span>
              )}
              {signal.entry_status && <EntryStatusBadge status={signal.entry_status} />}
              {signal.expires_at && <ExpiryBadge expiresAt={signal.expires_at} />}
              <NewsShield risk={newsRisk} />
            </div>
            {/* Row 2: confluence dots + ATR */}
            {signal.criteria && Object.keys(signal.criteria).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                {['kill_zone','order_block','fvg','market_structure','ema50','premium_discount','news_clear'].map(key => {
                  const hit = signal.criteria[key]?.triggered
                  return (
                    <div key={key} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: hit ? 'var(--green)' : 'var(--surface-4)',
                      flexShrink: 0,
                    }} title={key} />
                  )
                })}
                <span style={{ fontSize: '0.64rem', color: 'var(--text-4)', marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                  {signal.confluence_count ?? 0}/7
                </span>
                {signal.atr != null && (
                  <span style={{ fontSize: '0.64rem', color: 'var(--text-4)', marginLeft: 8 }}>
                    ATR {signal.atr}
                  </span>
                )}
              </div>
            )}
            {/* Row 3: status text */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.4 }}>
              {signal.reason || (signal.criteria?.kill_zone?.detail)}
            </div>
          </div>
          <span style={{ color: 'var(--text-3)', fontSize: '1rem', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {/* Left: criteria + levels + position */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Score Breakdown
              </div>
              <CriteriaList criteria={signal.criteria} />

              {signal.entry != null && (
                <>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Trade Levels
                  </div>
                  <LevelsTable signal={signal} />
                  <PositionInfo signal={signal} calcLots={calcLots} riskPct={riskPct} />
                </>
              )}
            </div>

            {/* Right: SVG diagram */}
            {signal.entry != null && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Setup Diagram
                </div>
                <SetupDiagram
                  entry={signal.entry}
                  sl={signal.sl}
                  tp1={signal.tp1}
                  tp2={signal.tp2}
                  tp3={signal.tp3}
                  direction={signal.direction}
                  pair={signal.pair}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          {signal.entry != null && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, minWidth: 110 }}
                onClick={handlePaperTrade}
              >
                {paperDone ? '✓ Logged!' : '📋 Paper Trade'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, minWidth: 110 }}
                onClick={handleSetAlert}
              >
                {alertSet ? '✓ Alert Set!' : '🔔 Alert'}
              </button>
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-4)' }}>
            Detected {new Date(signal.timestamp).toLocaleTimeString('fr-MA', {
              hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca'
            })} Morocco
          </div>
        </div>
      )}
    </div>
  )
}

// ── Monitoring row (score < 60) ───────────────────────────────────────────────
function MonitoringRow({ signal }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 'var(--r)',
      background: 'var(--surface-2)', border: '1px solid var(--border)',
    }}>
      <ScoreRing score={signal.score ?? 0} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{signal.pair}</span>
          {signal.direction && (
            <span style={{ fontSize: '0.7rem', color: signal.direction === 'long' ? 'var(--green)' : 'var(--red)' }}>
              {signal.direction === 'long' ? '▲' : '▼'}
            </span>
          )}
          {signal.ema50 && (
            <span className="tag tag-gray" style={{ fontSize: '0.65rem' }}>EMA {signal.ema50}</span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{signal.reason}</div>
      </div>
    </div>
  )
}

// ── Outcome prompt helpers ────────────────────────────────────────────────────
function _writeOutcomeEntry(pair, outcome, reason) {
  try {
    const stored = JSON.parse(localStorage.getItem(`ta_outcome_pending_${pair}`) || 'null')
    const sig = stored?.signal ?? {}
    const entry = {
      id:          `outcome_${Date.now()}`,
      date:        new Date().toISOString().slice(0, 10),
      pair,
      direction:   sig.direction ?? '',
      entry:       sig.entry?.toString() ?? '',
      sl:          sig.sl?.toString() ?? '',
      tp:          sig.tp1?.toString() ?? '',
      result:      outcome === 'taken' ? '' : outcome,
      outcome,
      reasoning:   reason.trim() ||
                   (outcome === 'taken'   ? 'Took the trade'
                  : outcome === 'missed'  ? 'Price never reached entry level'
                  : 'Chose to skip this setup'),
      signalScore: sig.score ?? null,
      signalGrade: sig.grade ?? null,
      auto:        true,
      type:        'outcome_check',
    }
    const existing = JSON.parse(localStorage.getItem('trading_journal') || '[]')
    const cutoff   = Date.now() - 2 * 60 * 60 * 1000
    const isDup    = existing.some(t =>
      t.type === 'outcome_check' && t.pair === pair &&
      parseInt(t.id?.replace('outcome_', '') ?? '0', 10) > cutoff
    )
    if (!isDup) {
      localStorage.setItem('trading_journal', JSON.stringify([entry, ...existing]))
    }
  } catch (_) {}
}

// ── Outcome prompt card ───────────────────────────────────────────────────────
function OutcomePromptCard({ pair, onDismiss }) {
  const sig = (() => {
    try { return JSON.parse(localStorage.getItem(`ta_outcome_pending_${pair}`) || 'null')?.signal ?? {} }
    catch { return {} }
  })()

  const [stage,   setStage]   = useState('choosing') // 'choosing' | 'reason'
  const [outcome, setOutcome] = useState(null)
  const [reason,  setReason]  = useState('')
  const [busy,    setBusy]    = useState(false)

  function choose(choice) {
    if (choice === 'taken') {
      _writeOutcomeEntry(pair, 'taken', '')
      onDismiss()
      return
    }
    setOutcome(choice)
    setStage('reason')
  }

  async function submit() {
    setBusy(true)
    _writeOutcomeEntry(pair, outcome, reason)
    try { await fetch(`${API_BASE}/api/rescan/${encodeURIComponent(pair)}`, { method: 'POST' }) } catch (_) {}
    onDismiss()
  }

  const dir   = sig.direction
  const arrow = dir === 'long' ? '▲ LONG' : dir === 'short' ? '▼ SHORT' : ''

  return (
    <div style={{
      background:   'var(--surface-1, #1a1f2e)',
      border:       '2px solid var(--gold-ring, #d97706)',
      borderRadius: 'var(--r, 10px)',
      padding:      '20px 18px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--gold, #f59e0b)', marginBottom: 2 }}>
            📋 Did you take this trade?
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)' }}>
            {pair} {arrow}
            {sig.entry && <span> · Entry {sig.entry}</span>}
            {sig.score  && <span> · {sig.score}pts</span>}
          </div>
        </div>
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', color: 'var(--text-4, #6b7280)',
          cursor: 'pointer', fontSize: '1.1rem', padding: 2,
        }}>✕</button>
      </div>

      {stage === 'choosing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => choose('taken')} style={btnStyle('#16a34a', '#dcfce7')}>
            ✅ Yes — Took It
          </button>
          <button onClick={() => choose('missed')} style={btnStyle('#b45309', '#fef3c7')}>
            ❌ No — Missed Entry (price didn't reach my level)
          </button>
          <button onClick={() => choose('skipped')} style={btnStyle('#6b7280', '#f3f4f6')}>
            ⏭ No — Skipped (chose not to take it)
          </button>
        </div>
      )}

      {stage === 'reason' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-2, #d1d5db)', fontWeight: 600 }}>
            {outcome === 'missed' ? '❌ Missed Entry' : '⏭ Skipped'} — what happened?
          </div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={
              outcome === 'missed'
                ? 'e.g. Price moved straight to TP without pulling back to entry…'
                : 'e.g. KZ was not active, news risk was too high…'
            }
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--surface-2, #111827)',
              border: '1px solid var(--border, #374151)',
              color: 'var(--text-1, #f9fafb)',
              fontSize: '0.875rem', resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStage('choosing')} style={{
              flex: 1, padding: '10px', background: 'transparent',
              border: '1px solid var(--border, #374151)', borderRadius: 8,
              color: 'var(--text-3, #9ca3af)', cursor: 'pointer', fontSize: '0.875rem',
            }}>
              ← Back
            </button>
            <button onClick={submit} disabled={busy} style={{
              flex: 2, padding: '10px', background: '#2563eb',
              border: 'none', borderRadius: 8, color: '#fff',
              cursor: busy ? 'default' : 'pointer', fontSize: '0.875rem',
              fontWeight: 700, opacity: busy ? 0.7 : 1,
              touchAction: 'manipulation',
            }}>
              {busy ? 'Logging…' : 'Log & Rescan Pair'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(borderColor, _bg) {
  return {
    padding: '12px 14px', background: 'var(--surface-2, #111827)',
    border: `1.5px solid ${borderColor}`, borderRadius: 8,
    color: 'var(--text-1, #f9fafb)', cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 600, textAlign: 'left',
    touchAction: 'manipulation',
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Signals() {
  const { signals: ctxSignals, news, wsStatus, permission, requestPermission, resetPushSubscription, pushSubscribed, addToast } = useAlerts()
  const { balance, setBalance, riskPct, setRiskPct, calcLots, hasBalance } = useAccount()
  const { getNewsRiskForPair, riskByPair, nextEventByPair } = useCalendar()
  const [searchParams, setSearchParams] = useSearchParams()
  const outcomePair = searchParams.get('outcome_pair') || null
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showCharts, setShowCharts] = useState(true)
  const priceAlerts = useRef({})  // { pair: entry }

  // Seed from REST, then WS takes over
  useEffect(() => {
    fetch(`${API_BASE}/api/signals`)
      .then(r => r.json())
      .then(d => { setSignals(d.signals || []); setLastRefresh(new Date()); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [])


  useEffect(() => {
    if (ctxSignals.length) {
      setSignals(ctxSignals)
      setLastRefresh(new Date())
      setLoading(false)
    }
  }, [ctxSignals])

  // Remove expired signals from UI
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => prev.map(s => {
        if (s.expires_at && new Date(s.expires_at) < new Date() && s.grade !== 'MONITORING') {
          return { ...s, grade: 'MONITORING', reason: 'Signal expired — entry zone passed', score: 0 }
        }
        return s
      }))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Price alert check
  useEffect(() => {
    const interval = setInterval(() => {
      // Check if any signal price alert has been reached
      Object.entries(priceAlerts.current).forEach(([pair, entryTarget]) => {
        const sig = signals.find(s => s.pair === pair)
        if (sig && sig.entry != null) {
          const close = sig.entry  // in real system, compare against live price
          // Simplified: alert fires once when signal enters STRONG
          if (sig.grade === 'STRONG') {
            delete priceAlerts.current[pair]
          }
        }
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [signals])

  function handlePaperTrade(signal) {
    try {
      const trades = JSON.parse(localStorage.getItem('trading_journal') || '[]')
      const pos = calcLots ? calcLots(signal.entry, signal.sl, signal.pair) : null
      const newTrade = {
        id:        Date.now().toString(),
        date:      new Date().toISOString().split('T')[0],
        pair:      signal.pair,
        direction: signal.direction,
        entry:     String(signal.entry),
        sl:        String(signal.sl),
        tp:        String(signal.tp3),
        lotSize:   String(pos?.lots ?? '0.01'),
        result:    '',
        pips:      '',
        pnl:       '',
        reasoning: `ICC Signal — Score ${signal.score}/100 (${signal.grade})`,
        screenshot:'',
        // Extended signal data
        tp1: String(signal.tp1),
        tp2: String(signal.tp2),
        signalScore: signal.score,
        signalGrade: signal.grade,
      }
      localStorage.setItem('trading_journal', JSON.stringify([newTrade, ...trades]))
    } catch (_) {}
  }

  function handleSetAlert(signal) {
    priceAlerts.current[signal.pair] = signal.entry
    // Store in localStorage for persistence
    try {
      const alerts = JSON.parse(localStorage.getItem('ta_price_alerts') || '{}')
      alerts[signal.pair] = { entry: signal.entry, signal, set_at: new Date().toISOString() }
      localStorage.setItem('ta_price_alerts', JSON.stringify(alerts))
    } catch (_) {}
  }

  const weekend         = isWeekend()
  const activeSignals   = weekend ? [] : signals.filter(s => s.grade === 'STRONG' || s.grade === 'WATCH')
  const monitoring      = weekend ? [] : signals.filter(s => s.grade === 'MONITORING')
  const utcMins         = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  const inKZ            = !weekend && ((utcMins >= 9 * 60 && utcMins < 12 * 60) || (utcMins >= 14 * 60 + 30 && utcMins < 17 * 60 + 30))

  return (
    <div className="page fade-in">
      {/* Push notification banner — rendered whenever subscription not confirmed.
          No modal, no timers, no context state. Disappears only when pushSubscribed. */}
      {!pushSubscribed && permission !== 'unsupported' && (
        <div style={{
          display:        'flex',
          alignItems:     'center',
          gap:            12,
          background:     permission === 'denied' ? 'rgba(180,83,9,0.18)' : '#1a3a5c',
          borderBottom:   `2px solid ${permission === 'denied' ? '#b45309' : '#2563eb'}`,
          padding:        '14px 16px',
          marginBottom:   16,
          marginLeft:     -16,
          marginRight:    -16,
          marginTop:      -16,
        }}>
          <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>
            {permission === 'denied' ? '🔕' : '🔔'}
          </span>
          <span style={{ flex: 1, fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.45 }}>
            {permission === 'denied'
              ? 'Notifications blocked — open your browser settings and allow notifications for this site.'
              : 'Enable push notifications to get STRONG signal alerts and Kill Zone warnings on your phone.'}
          </span>
          {permission !== 'denied' && (
            <button
              onClick={requestPermission}
              style={{
                flexShrink:    0,
                padding:       '10px 18px',
                background:    '#2563eb',
                color:         '#fff',
                border:        'none',
                borderRadius:  8,
                fontSize:      '0.9rem',
                fontWeight:    700,
                cursor:        'pointer',
                whiteSpace:    'nowrap',
                touchAction:   'manipulation',
              }}
            >
              Enable Now
            </button>
          )}
        </div>
      )}

      {/* Debug: Reset notifications — always visible so it works even when subscribed */}
      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <button
          onClick={async () => {
            await resetPushSubscription()
            await requestPermission()
          }}
          style={{
            padding:      '6px 12px',
            background:   'transparent',
            color:        'var(--text-4, #6b7280)',
            border:       '1px solid var(--border, #374151)',
            borderRadius: 6,
            fontSize:     '0.72rem',
            cursor:       'pointer',
            touchAction:  'manipulation',
          }}
        >
          🔄 Reset Notifications
        </button>
      </div>

      {/* Outcome prompt — shown when notification tap lands with ?outcome_pair=PAIR */}
      {outcomePair && (
        <OutcomePromptCard
          pair={outcomePair}
          onDismiss={() => setSearchParams({})}
        />
      )}

      {/* Account setup modal */}
      {showAccountModal && (
        <AccountSetupModal
          onSave={(bal, risk) => { setBalance(bal); setRiskPct(risk); setShowAccountModal(false) }}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Live Signals</h1>
            <p className="page-subtitle">Professional ICC + SMC Scanner · 6-factor scoring</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, color: wsStatus === 'connected' ? 'var(--green)' : 'var(--red)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {wsStatus === 'connected' ? 'Live' : 'Polling'}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAccountModal(true)}>
              ⚙️ {hasBalance ? `$${balance?.toLocaleString()}` : 'Set Balance'}
            </button>
          </div>
        </div>
      </div>



      {/* No balance warning */}
      {!hasBalance && activeSignals.length > 0 && (
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 14,
          fontSize: '0.82rem', color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>💰</span>
          <span>Set your account balance to see position sizes and dollar risk/profit on every signal.</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAccountModal(true)}>Set Balance</button>
        </div>
      )}

      <KillZoneClock />

      {/* Weekend banner */}
      {weekend && (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <span style={{ fontSize: '1.4rem' }}>🌙</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
              Weekend — Markets Closed
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>
              Opens Monday 10:00 Morocco · London Kill Zone · Auto-execution disabled
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', fontFamily: "'JetBrains Mono', monospace" }}>
              OPENS IN
            </div>
            <WeekendCountdown />
          </div>
        </div>
      )}

      {/* News risk strip — 4 pairs traffic light */}
      <CalendarStrip riskByPair={riskByPair} nextEventByPair={nextEventByPair} />

      {!weekend && lastRefresh && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginBottom: 12 }}>
          Last scan {lastRefresh.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })} Morocco · Scans every 2 min
        </div>
      )}

      {/* ── Weekend closed cards ────────────────────────────────────────────── */}
      {weekend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {PAIRS.map(pair => (
            <div key={pair} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 'var(--r)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              opacity: 0.7,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--surface-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '1.3rem' }}>🌙</span>
              </div>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, marginBottom: 3 }}>{pair}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Markets closed — opens Monday</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active signals (STRONG + WATCH) */}
      {!weekend && loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : !weekend && (
        <>
          {activeSignals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {activeSignals.map(s => (
                <SignalCard
                  key={s.pair}
                  signal={s}
                  calcLots={hasBalance ? calcLots : null}
                  riskPct={riskPct}
                  onPaperTrade={handlePaperTrade}
                  onSetAlert={handleSetAlert}
                  newsRisk={getNewsRiskForPair(s.pair)}
                />
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📡</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No setups meeting threshold</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
                All pairs score below 60/100. Watch the monitoring cards below for developing setups.
              </div>
            </div>
          )}

          {/* Monitoring section */}
          {monitoring.length > 0 && (
            <>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Monitoring ({monitoring.length} pairs)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {monitoring.map(s => <MonitoringRow key={s.pair} signal={s} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Live Charts ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 12,
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-4)',
                        textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Live Charts — H1 Candles
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCharts(v => !v)}
            style={{ fontSize: '0.72rem' }}
          >
            {showCharts ? 'Hide' : 'Show'} Charts
          </button>
        </div>

        {showCharts && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 14,
          }}>
            {PAIRS.map(pair => {
              const sig = signals.find(s =>
                s.pair === pair && (s.grade === 'STRONG' || s.grade === 'WATCH')
              ) ?? null
              return (
                <div key={pair} className="card" style={{ padding: '10px 12px' }}>
                  {/* Chart header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem',
                                   fontFamily: "'JetBrains Mono', monospace" }}>
                      {pair}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {sig && (
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 700,
                          padding: '2px 7px', borderRadius: 4,
                          background: sig.grade === 'STRONG'
                            ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)',
                          color: sig.grade === 'STRONG' ? 'var(--gold, #f59e0b)' : '#60a5fa',
                        }}>
                          {sig.grade} · {sig.score}pts
                        </span>
                      )}
                      {sig?.direction && (
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 700,
                          color: sig.direction === 'long' ? 'var(--green)' : 'var(--red)',
                        }}>
                          {sig.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Signal level legend */}
                  {sig?.entry && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 8,
                                  fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: '#f59e0b' }}>● Entry {sig.entry}</span>
                      {sig.sl  && <span style={{ color: '#ef4444' }}>● SL {sig.sl}</span>}
                      {sig.tp1 && <span style={{ color: '#22c55e' }}>● TP1 {sig.tp1}</span>}
                      {sig.tp2 && <span style={{ color: '#16a34a' }}>● TP2 {sig.tp2}</span>}
                    </div>
                  )}

                  <PairChart pair={pair} signal={sig} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* News feed */}
      <NewsFeed news={news} inKillZone={inKZ} />

      {/* Scoring guide */}
      <div className="card" style={{ marginTop: 20, fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Scoring System (max 100 pts)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          {[
            ['Kill Zone active', '+25'],
            ['Valid Order Block (M15/H1)', '+20'],
            ['Fair Value Gap', '+15'],
            ['Market Structure BOS/CHoCH', '+15'],
            ['EMA50 trend aligned', '+10'],
            ['Premium / Discount zone', '+10'],
            ['No high-impact news', '+5'],
          ].map(([label, pts]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>{label}</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pts}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>80-100 → STRONG</span> (alert) &nbsp;·&nbsp;
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>60-79 → WATCH</span> (page only) &nbsp;·&nbsp;
          <span style={{ color: 'var(--text-4)' }}>&lt;60 → Monitoring</span>
        </div>
      </div>
    </div>
  )
}
