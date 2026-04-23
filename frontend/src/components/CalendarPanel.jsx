import React, { useState, useEffect } from 'react'

const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'GBPJPY']

const PAIR_CURRENCIES = {
  XAUUSD: ['USD'], EURUSD: ['EUR','USD'], GBPUSD: ['GBP','USD'], GBPJPY: ['GBP','JPY'],
}

// Traffic light config
const IMPACT_CFG = {
  High:   { color: 'var(--red)',   bg: 'rgba(248,113,113,0.12)', dot: '#ef4444', label: 'HIGH',   icon: '🔴' },
  Medium: { color: 'var(--gold)',  bg: 'rgba(245,166,35,0.10)',  dot: '#f5a623', label: 'MED',    icon: '🟡' },
  Low:    { color: 'var(--text-3)',bg: 'transparent',            dot: '#6b7280', label: 'LOW',    icon: '🟢' },
}

function fmtMins(mins) {
  if (mins == null) return ''
  if (mins <= 0)    return 'now'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Live countdown that ticks every second
function useCountdown(utcTs) {
  const [secs, setSecs] = useState(() => utcTs ? Math.max(0, utcTs - Date.now() / 1000) : null)
  useEffect(() => {
    if (!utcTs) return
    const t = setInterval(() => setSecs(Math.max(0, utcTs - Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [utcTs])
  if (secs == null) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2,'0')}s`
  return `${String(s).padStart(2,'0')}s`
}

// Big hero countdown for the pinned next HIGH event
function HeroCountdown({ event }) {
  const display = useCountdown(event?.utc_ts)
  if (!event) return null
  const cfg  = IMPACT_CFG[event.impact] ?? IMPACT_CFG.Low
  const past = event.utc_ts < Date.now() / 1000

  return (
    <div style={{
      background: 'rgba(248,113,113,0.08)',
      border: '1px solid rgba(248,113,113,0.3)',
      borderRadius: 'var(--r-lg)',
      padding: '18px 20px',
      marginBottom: 14,
      display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          ⚡ Next HIGH-Impact Event
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
          {event.currency} · {new Date(event.utc_ts * 1000).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })} Morocco
          {event.affects_pairs?.length ? ` · affects ${event.affects_pairs.join(', ')}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '1.6rem', fontWeight: 800,
          color: past ? 'var(--text-3)' : 'var(--red)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {past ? 'released' : (display ?? '—')}
        </div>
        {!past && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 4 }}>
            DON'T TRADE
          </div>
        )}
      </div>
    </div>
  )
}

// Per-pair traffic light row
function PairRow({ pair, riskLevel, nextEvent, nextHighEvent }) {
  const display = useCountdown(nextEvent?.utc_ts)
  const past     = nextEvent ? nextEvent.utc_ts < Date.now() / 1000 : false

  // Determine effective traffic light:
  // If next event within 30m = that level, else green
  const minsUntil = nextEvent ? (nextEvent.utc_ts - Date.now() / 1000) / 60 : null
  const isClose   = minsUntil != null && minsUntil <= 30 && minsUntil >= -5
  const impact    = isClose ? (nextEvent?.impact ?? 'Low') : 'Low'
  const cfg       = IMPACT_CFG[impact] ?? IMPACT_CFG.Low

  // Use risk_by_pair level (30min window) for traffic light
  const tl = riskLevel === 'HIGH'   ? IMPACT_CFG.High
           : riskLevel === 'MEDIUM' ? IMPACT_CFG.Medium
           : IMPACT_CFG.Low

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', borderRadius: 8,
      background: tl.bg,
      border: `1px solid ${tl.color === 'var(--text-3)' ? 'var(--border)' : tl.color + '40'}`,
    }}>
      {/* Traffic light dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: tl.dot, flexShrink: 0,
        boxShadow: riskLevel !== 'NONE' ? `0 0 6px ${tl.dot}` : 'none',
      }} />

      {/* Pair */}
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.85rem', minWidth: 58 }}>
        {pair}
      </span>

      {/* Status label */}
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: tl.color, minWidth: 36 }}>
        {tl.label}
      </span>

      {/* Next event */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {nextEvent && !past ? (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {nextEvent.title?.split(' ').slice(0, 5).join(' ')}
            {nextEvent.title?.split(' ').length > 5 ? '…' : ''}
          </span>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
            {past && nextEvent ? 'just released' : 'clear next 24h'}
          </span>
        )}
      </div>

      {/* Countdown */}
      {nextEvent && !past && display && (
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem', fontWeight: 700,
          color: isClose ? tl.color : 'var(--text-3)',
          flexShrink: 0,
        }}>
          {display}
        </span>
      )}
    </div>
  )
}

// Single event row in the 24h list
function EventRow({ event }) {
  const cfg  = IMPACT_CFG[event.impact] ?? IMPACT_CFG.Low
  const past = event.utc_ts < Date.now() / 1000
  const display = useCountdown(past ? null : event.utc_ts)
  const morTime = new Date(event.utc_ts * 1000).toLocaleTimeString('fr-MA', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca',
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 6,
      opacity: past ? 0.45 : 1,
      background: past ? 'transparent' : cfg.bg,
    }}>
      <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>{cfg.icon}</span>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, minWidth: 38 }}>
        {morTime}
      </span>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: cfg.color, minWidth: 32, flexShrink: 0 }}>
        {event.currency}
      </span>
      <span style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.title}
      </span>
      {event.affects_pairs?.length > 0 && (
        <span style={{ fontSize: '0.62rem', color: 'var(--text-4)', flexShrink: 0 }}>
          {event.affects_pairs.join(' ')}
        </span>
      )}
      {!past && display && (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--text-3)', flexShrink: 0 }}>
          {display}
        </span>
      )}
    </div>
  )
}

export default function CalendarPanel({ calendar, riskByPair = {}, nextEventByPair = {}, upcoming24h = [] }) {
  const [showAll, setShowAll] = useState(false)

  // Find next HIGH event in 24h list
  const nextHigh = upcoming24h.find(e => e.impact === 'High' && e.utc_ts > Date.now() / 1000)
    ?? calendar?.next_high ?? null

  // Filter to HIGH + MEDIUM only for the list by default
  const significant = upcoming24h.filter(e => e.impact === 'High' || e.impact === 'Medium')
  const displayed   = showAll ? upcoming24h : significant.slice(0, 8)

  if (!calendar) {
    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="label-caps" style={{ marginBottom: 8 }}>Economic Calendar</div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Loading calendar…</div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div className="label-caps">Economic Calendar</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 2 }}>Next 24h · Morocco time</div>
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: '0.68rem', color: 'var(--text-4)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#ef4444' }}>●</span> HIGH — don't trade</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#f5a623' }}>●</span> MED — be careful</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#22d3ee' }}>●</span> clear</span>
        </div>
      </div>

      {/* Pinned next HIGH event */}
      {nextHigh && <HeroCountdown event={nextHigh} />}

      {/* Per-pair traffic lights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {PAIRS.map(pair => (
          <PairRow
            key={pair}
            pair={pair}
            riskLevel={riskByPair[pair]?.level ?? 'NONE'}
            nextEvent={nextEventByPair[pair] ?? null}
            nextHighEvent={nextHigh}
          />
        ))}
      </div>

      {/* 24h event list */}
      {displayed.length > 0 ? (
        <>
          <div className="label-caps" style={{ marginBottom: 6 }}>Upcoming Events</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {displayed.map((ev, i) => <EventRow key={`${ev.title}-${ev.utc_ts}-${i}`} event={ev} />)}
          </div>
          {significant.length > 8 && !showAll && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 10, width: '100%' }}
              onClick={() => setShowAll(true)}
            >
              Show all {upcoming24h.length} events
            </button>
          )}
        </>
      ) : (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
          No HIGH or MEDIUM events in next 24h for these pairs
        </div>
      )}
    </div>
  )
}
