import React, { useState, useEffect, useRef } from 'react'
import { API_BASE } from '../config'
import { useAlerts } from '../contexts/AlertContext'
import { useAccount } from '../hooks/useAccount'
import { useCalendar } from '../hooks/useCalendar'
import AccountSetupModal from '../components/AccountSetupModal'
import SetupDiagram from '../components/SetupDiagram'
import NewsFeed from '../components/NewsFeed'
import NewsShield from '../components/NewsShield'
import CalendarStrip from '../components/CalendarStrip'

const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NZDJPY']

// ── Morocco Kill Zone clock ───────────────────────────────────────────────────
function KillZoneClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const morMins = utcMins + 60
  const morH = Math.floor(morMins / 60) % 24
  const morM = morMins % 60
  const morStr = `${String(morH).padStart(2,'0')}:${String(morM).padStart(2,'0')}`

  const inLondon = utcMins >= 9 * 60 && utcMins < 12 * 60
  const inNY     = utcMins >= 14 * 60 + 30 && utcMins < 17 * 60 + 30
  const inKZ     = inLondon || inNY

  function nextKZ() {
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
            fontWeight: 700, color: inKZ ? 'var(--gold)' : 'var(--text)',
          }}>
            {morStr}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { name: 'London', mor: '10:00–13:00', utcStart: 9*60, utcEnd: 12*60 },
            { name: 'NY',     mor: '15:30–18:30', utcStart: 14*60+30, utcEnd: 17*60+30 },
          ].map(z => {
            const active = utcMins >= z.utcStart && utcMins < z.utcEnd
            return (
              <div key={z.name} style={{
                padding: '8px 12px', borderRadius: 'var(--r)',
                background: active ? 'var(--gold-pale)' : 'var(--surface-2)',
                border: `1px solid ${active ? 'var(--gold-ring)' : 'var(--border)'}`,
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: active ? 'var(--gold)' : 'var(--text-2)' }}>{z.name} KZ</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{z.mor}</div>
                {active && <div style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 700, marginTop: 2 }}>● ACTIVE</div>}
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label-caps" style={{ marginBottom: 3 }}>{next.active ? 'Now Active' : 'Opens In'}</div>
          <div style={{ fontWeight: 700, color: next.active ? 'var(--gold)' : 'var(--text)' }}>{next.name}</div>
          <div style={{ fontSize: '0.85rem', color: next.active ? 'var(--green)' : 'var(--text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
            {next.label}
          </div>
        </div>
      </div>
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

// ── STRONG signal card ────────────────────────────────────────────────────────
function SignalCard({ signal, calcLots, riskPct, onPaperTrade, onSetAlert, onExecute, newsRisk, autoTradingPaused, spread }) {
  const [expanded, setExpanded] = useState(signal.grade === 'STRONG')
  const [paperDone, setPaperDone] = useState(false)
  const [alertSet, setAlertSet] = useState(false)
  const [execState, setExecState] = useState(null)   // null | 'loading' | 'done' | 'error' | 'spread' | 'news'

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

  async function handleExecute() {
    if (execState === 'loading') return
    setExecState('loading')
    try {
      const pos = calcLots ? calcLots(signal.entry, signal.sl, signal.pair) : null
      const lots = pos?.lots ?? 0.01
      const result = await onExecute(signal, lots)
      if (result === true) {
        setExecState('done')
      } else if (result?.type === 'spread') {
        setExecState('spread')
      } else if (result?.type === 'news') {
        setExecState('news')
      } else {
        setExecState('error')
      }
      setTimeout(() => setExecState(null), 6000)
    } catch (_) {
      setExecState('error')
      setTimeout(() => setExecState(null), 6000)
    }
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
              {spread && (
                <span style={{
                  fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                  background: spread.ok ? 'rgba(34,211,165,0.1)' : 'rgba(248,113,113,0.15)',
                  color: spread.ok ? 'var(--green)' : 'var(--red)',
                  border: `1px solid ${spread.ok ? 'rgba(34,211,165,0.25)' : 'rgba(248,113,113,0.3)'}`,
                }} title={`Max: ${spread.max_pips} pips`}>
                  {spread.spread_pips}p
                </span>
              )}
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

          {/* Auto-trading indicator for STRONG signals */}
          {signal.grade === 'STRONG' && signal.entry != null && (
            autoTradingPaused ? (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: '0.75rem', color: 'var(--red)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                Auto-trading PAUSED — use Resume button above to re-enable
              </div>
            ) : (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(34,211,165,0.07)', border: '1px solid rgba(34,211,165,0.2)',
                fontSize: '0.75rem', color: 'var(--green)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                Auto-trading ON — will execute on MT5 when METAAPI_TOKEN is configured
              </div>
            )
          )}

          {/* Action buttons */}
          {signal.entry != null && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm"
                style={{
                  flex: 1, minWidth: 110,
                  background: execState === 'done'   ? 'var(--green)'
                    : (execState === 'error' || execState === 'spread' || execState === 'news') ? 'var(--red)'
                    : execState === 'loading' ? 'var(--surface-3)'
                    : 'var(--green)',
                  color: execState === 'loading' ? 'var(--text-3)' : '#000',
                  fontWeight: 700,
                  opacity: execState === 'loading' ? 0.7 : 1,
                  touchAction: 'manipulation',
                }}
                onClick={handleExecute}
                disabled={execState === 'loading'}
              >
                {execState === 'loading' ? 'Sending…'
                  : execState === 'done'   ? '✓ Placed!'
                  : execState === 'spread' ? '⚠ Spread!'
                  : execState === 'news'   ? '⚡ News!'
                  : execState === 'error'  ? '✗ Failed'
                  : '▶ Execute'}
              </button>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Signals() {
  const { signals: ctxSignals, news, wsStatus, permission, requestPermission, autoTradingPaused, setAutoTradingPaused } = useAlerts()
  const { balance, setBalance, riskPct, setRiskPct, calcLots, hasBalance } = useAccount()
  const { getNewsRiskForPair, riskByPair, nextEventByPair } = useCalendar()
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [spreads, setSpreads] = useState({})   // { XAUUSD: { spread_pips, max_pips, ok } }
  const priceAlerts = useRef({})  // { pair: entry }

  // Seed from REST, then WS takes over
  useEffect(() => {
    fetch(`${API_BASE}/api/signals`)
      .then(r => r.json())
      .then(d => { setSignals(d.signals || []); setLastRefresh(new Date()); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [])

  // Hydrate auto-trade paused state from backend
  useEffect(() => {
    fetch(`${API_BASE}/api/trade/status`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.paused_reason) setAutoTradingPaused(true) })
      .catch(() => {})
  }, [])

  // Poll live spreads every 30s for active signal pairs
  useEffect(() => {
    const PAIRS_TO_WATCH = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NZDJPY']
    async function fetchSpreads() {
      const results = await Promise.allSettled(
        PAIRS_TO_WATCH.map(p =>
          fetch(`${API_BASE}/api/spread/${p}`).then(r => r.json()).then(d => [p, d])
        )
      )
      setSpreads(prev => {
        const next = { ...prev }
        results.forEach(r => {
          if (r.status === 'fulfilled') {
            const [pair, data] = r.value
            if (data.ok) next[pair] = data
          }
        })
        return next
      })
    }
    fetchSpreads()
    const interval = setInterval(fetchSpreads, 30000)
    return () => clearInterval(interval)
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

  async function handleExecute(signal, lots) {
    try {
      const res = await fetch(`${API_BASE}/api/trade/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair:      signal.pair,
          direction: signal.direction,
          lots,
          entry:     signal.entry,
          sl:        signal.sl,
          tp:        signal.tp1,
        }),
      })
      const data = await res.json()
      if (data.ok) return true
      // Return the block type so the card can show the right label
      return { type: data.type ?? 'error', error: data.error }
    } catch (_) {
      return { type: 'error' }
    }
  }

  async function handleResume() {
    try {
      await fetch(`${API_BASE}/api/trade/resume`, { method: 'POST' })
      setAutoTradingPaused(false)
    } catch (_) {
      setAutoTradingPaused(false)  // optimistic
    }
  }

  const activeSignals   = signals.filter(s => s.grade === 'STRONG' || s.grade === 'WATCH')
  const monitoring      = signals.filter(s => s.grade === 'MONITORING')
  const utcMins         = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  const inKZ            = (utcMins >= 9 * 60 && utcMins < 12 * 60) || (utcMins >= 14 * 60 + 30 && utcMins < 17 * 60 + 30)

  return (
    <div className="page fade-in">
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

      {/* Notification prompt */}
      {permission === 'default' && (
        <div style={{
          background: 'var(--gold-pale)', border: '1px solid var(--gold-ring)',
          borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>🔔</span>
          <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-2)' }}>
            Enable notifications for STRONG signal alerts (score ≥80)
          </span>
          <button className="btn btn-secondary btn-sm" onClick={requestPermission}>Enable</button>
        </div>
      )}

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

      {/* News risk strip — 4 pairs traffic light */}
      <CalendarStrip riskByPair={riskByPair} nextEventByPair={nextEventByPair} />

      {/* Auto-trading paused banner */}
      {autoTradingPaused && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '1.2rem' }}>🛑</span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--red)' }}>Auto-Trading Paused</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 2 }}>
              2 consecutive losses this session. Review your setups before resuming.
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--green)', color: '#000', fontWeight: 700, touchAction: 'manipulation', minHeight: 44, minWidth: 80 }}
            onClick={handleResume}
          >
            Resume
          </button>
        </div>
      )}

      {lastRefresh && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginBottom: 12 }}>
          Last scan {lastRefresh.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })} Morocco · Scans every 2 min
        </div>
      )}

      {/* Active signals (STRONG + WATCH) */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : (
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
                  onExecute={handleExecute}
                  newsRisk={getNewsRiskForPair(s.pair)}
                  autoTradingPaused={autoTradingPaused}
                  spread={spreads[s.pair] ?? null}
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
