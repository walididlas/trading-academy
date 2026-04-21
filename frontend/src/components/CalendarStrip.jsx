import React, { useState, useEffect } from 'react'

const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NZDJPY']

const TL = {
  HIGH:   { dot: '#ef4444', color: 'var(--red)',  label: 'HIGH',  bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)' },
  MEDIUM: { dot: '#f5a623', color: 'var(--gold)', label: 'MED',   bg: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.25)' },
  NONE:   { dot: '#22d3ee', color: 'var(--text-3)', label: 'CLEAR', bg: 'transparent',           border: 'var(--border)' },
}

function useLiveMins(utcTs) {
  const [mins, setMins] = useState(() => utcTs ? (utcTs - Date.now() / 1000) / 60 : null)
  useEffect(() => {
    if (!utcTs) return
    const t = setInterval(() => setMins((utcTs - Date.now() / 1000) / 60), 15000)
    return () => clearInterval(t)
  }, [utcTs])
  return mins
}

function fmtMins(mins) {
  if (mins == null || mins < 0) return null
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function PairChip({ pair, riskLevel, nextEvent }) {
  const mins    = useLiveMins(nextEvent?.utc_ts)
  const isClose = mins != null && mins <= 30
  const tl      = TL[riskLevel] ?? TL.NONE

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 10px', borderRadius: 8, flex: '1 1 0', minWidth: 100,
      background: tl.bg,
      border: `1px solid ${tl.border}`,
    }}>
      {/* Traffic dot */}
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: tl.dot, flexShrink: 0,
        boxShadow: riskLevel !== 'NONE' ? `0 0 5px ${tl.dot}` : 'none',
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Pair name */}
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.78rem', lineHeight: 1 }}>
          {pair}
        </div>
        {/* Status text */}
        <div style={{ fontSize: '0.62rem', color: tl.color, fontWeight: 600, marginTop: 2 }}>
          {tl.label}
        </div>
      </div>

      {/* Countdown */}
      {nextEvent && mins != null && mins >= 0 && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.68rem',
          fontWeight: 700,
          color: isClose ? tl.color : 'var(--text-4)',
          flexShrink: 0,
          textAlign: 'right',
        }}>
          {fmtMins(mins)}
        </div>
      )}
    </div>
  )
}

export default function CalendarStrip({ riskByPair = {}, nextEventByPair = {} }) {
  const anyRisk = PAIRS.some(p => (riskByPair[p]?.level ?? 'NONE') !== 'NONE')

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Section label */}
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>News Risk</span>
        {anyRisk && (
          <span style={{ fontSize: '0.6rem', color: 'var(--text-4)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            countdown to next event
          </span>
        )}
      </div>

      {/* 4-pair chips in a row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PAIRS.map(pair => (
          <PairChip
            key={pair}
            pair={pair}
            riskLevel={riskByPair[pair]?.level ?? 'NONE'}
            nextEvent={nextEventByPair[pair] ?? null}
          />
        ))}
      </div>
    </div>
  )
}
