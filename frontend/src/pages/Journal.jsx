import React, { useState, useEffect, useMemo, useCallback } from 'react'
import SessionReplay from '../components/SessionReplay'

const STORAGE_KEY = 'trading_journal'

// ── Pip / P&L helpers ─────────────────────────────────────────────────────────
const PIP_SIZE  = { XAUUSD: 0.1, GBPJPY: 0.01, USDJPY: 0.01, NZDJPY: 0.01 }
const PIP_VALUE = { XAUUSD: 100, GBPJPY: 6.67, NZDJPY: 6.67 }   // per standard lot

function getPipSize(pair)  { return PIP_SIZE[pair]  ?? 0.0001 }
function getPipValue(pair) { return PIP_VALUE[pair] ?? 10 }

function calcPips(entry, exitPrice, pair, direction) {
  if (!entry || !exitPrice) return null
  const raw = (parseFloat(exitPrice) - parseFloat(entry)) / getPipSize(pair)
  return direction === 'long' ? raw : -raw
}

function calcPnl(pips, lotSize, pair) {
  if (pips == null || !lotSize) return null
  return pips * getPipValue(pair) * parseFloat(lotSize)
}

function calcRR(entry, sl, tp, pair, direction) {
  if (!entry || !sl || !tp) return null
  const pipSize = getPipSize(pair)
  const risk   = Math.abs(parseFloat(entry) - parseFloat(sl)) / pipSize
  const reward = Math.abs(parseFloat(tp) - parseFloat(entry)) / pipSize
  return risk > 0 ? reward / risk : null
}

function iccGrade(kz, trendAligned, iccValid, rr) {
  let score = 0
  if (kz)          score++
  if (trendAligned) score++
  if (iccValid)    score++
  if (rr != null && rr >= 3) score++
  if (score === 4) return 'A'
  if (score === 3) return 'B'
  if (score === 2) return 'C'
  return 'F'
}

const GRADE_COLOR = { A: 'var(--green)', B: '#60a5fa', C: 'var(--gold)', F: 'var(--red)' }

// ── Persistence ───────────────────────────────────────────────────────────────
function loadTrades() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades))
}

// ── Outcome stats ─────────────────────────────────────────────────────────────
function calcOutcomeStats(trades) {
  const outcomed = trades.filter(t => t.outcome)
  if (!outcomed.length) return null
  const taken   = outcomed.filter(t => t.outcome === 'taken').length
  const missed  = outcomed.filter(t => t.outcome === 'missed').length
  const skipped = outcomed.filter(t => t.outcome === 'skipped').length
  const total   = outcomed.length
  // Win rate on taken trades that have a result
  const takenClosed = outcomed.filter(t => t.outcome === 'taken' && (t.result === 'win' || t.result === 'loss'))
  const takenWins   = takenClosed.filter(t => t.result === 'win').length
  return {
    total, taken, missed, skipped,
    takenPct:   Math.round(taken   / total * 100),
    missedPct:  Math.round(missed  / total * 100),
    skippedPct: Math.round(skipped / total * 100),
    takenWinRate: takenClosed.length ? Math.round(takenWins / takenClosed.length * 100) : null,
  }
}

// ── Stats calculator ──────────────────────────────────────────────────────────
function calcStats(trades) {
  const closed = trades.filter(t => t.result === 'win' || t.result === 'loss')
  if (!closed.length) return null
  const wins   = closed.filter(t => t.result === 'win')
  const losses = closed.filter(t => t.result === 'loss')
  const totalPips = closed.reduce((a, t) => a + (parseFloat(t.pips) || 0), 0)
  const totalPnl  = closed.reduce((a, t) => a + (parseFloat(t.pnl)  || 0), 0)
  const avgWin  = wins.length   ? wins.reduce((a, t) => a + (parseFloat(t.pips) || 0), 0)   / wins.length   : 0
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, t) => a + (parseFloat(t.pips) || 0), 0) / losses.length) : 0
  const wr = Math.round(wins.length / closed.length * 100)
  const pf = avgLoss > 0 ? (wins.length * avgWin) / (losses.length * avgLoss) : wins.length > 0 ? Infinity : 0
  const expectancy = (wr / 100 * avgWin) - ((1 - wr / 100) * avgLoss)

  // Average R:R from trades that have a calculated rr
  const rrList = closed.map(t => parseFloat(t.rr)).filter(r => !isNaN(r) && r > 0)
  const avgRR = rrList.length ? rrList.reduce((a, v) => a + v, 0) / rrList.length : null

  // Grade breakdown
  const grades = { A: 0, B: 0, C: 0, F: 0 }
  closed.forEach(t => { if (t.grade && grades[t.grade] !== undefined) grades[t.grade]++ })

  return {
    total: closed.length, open: trades.filter(t => !t.result || t.result === '').length,
    wins: wins.length, losses: losses.length, wr,
    totalPips: totalPips.toFixed(1), totalPnl: totalPnl.toFixed(2),
    avgWin: avgWin.toFixed(1), avgLoss: avgLoss.toFixed(1),
    pf: isFinite(pf) ? pf.toFixed(2) : '∞',
    expectancy: expectancy.toFixed(1),
    avgRR: avgRR ? avgRR.toFixed(2) : null,
    grades,
  }
}

// ── Equity Curve SVG ──────────────────────────────────────────────────────────
function EquityCurve({ trades }) {
  const closed = useMemo(() =>
    trades
      .filter(t => (t.result === 'win' || t.result === 'loss') && !isNaN(parseFloat(t.pips)))
      .sort((a, b) => a.date.localeCompare(b.date)),
  [trades])

  if (closed.length < 2) return null

  const W = 600, H = 120, PAD = { t: 12, b: 24, l: 40, r: 16 }
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b

  // Cumulative pips
  let cum = 0
  const points = closed.map((t, i) => {
    cum += parseFloat(t.pips) || 0
    return { i, cum, date: t.date, pips: parseFloat(t.pips) || 0 }
  })

  const minCum = Math.min(0, ...points.map(p => p.cum))
  const maxCum = Math.max(0, ...points.map(p => p.cum))
  const range  = maxCum - minCum || 1

  const toX = i => PAD.l + (i / (points.length - 1)) * cW
  const toY = c => PAD.t + cH - ((c - minCum) / range) * cH

  const zero  = toY(0)
  const polyPoints = points.map(p => `${toX(p.i)},${toY(p.cum)}`).join(' ')
  const areaPoints = `${toX(0)},${zero} ${polyPoints} ${toX(points.length - 1)},${zero}`

  const lastCum = points[points.length - 1].cum
  const isProfit = lastCum >= 0
  const lineColor = isProfit ? 'var(--green)' : 'var(--red)'
  const fillColor = isProfit ? 'rgba(34,211,165,0.12)' : 'rgba(248,113,113,0.12)'

  // X-axis labels: first, middle, last date
  const labels = [0, Math.floor(points.length / 2), points.length - 1].map(i => ({
    x: toX(i), label: points[i].date.slice(5), // MM-DD
  }))

  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Equity Curve — Cumulative Pips
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '0.85rem',
          color: isProfit ? 'var(--green)' : 'var(--red)',
        }}>
          {lastCum >= 0 ? '+' : ''}{lastCum.toFixed(1)} pips
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* Zero line */}
        <line x1={PAD.l} y1={zero} x2={W - PAD.r} y2={zero} stroke="var(--border)" strokeWidth="1" strokeDasharray="4,3"/>
        {/* Area fill */}
        <polygon points={areaPoints} fill={fillColor}/>
        {/* Line */}
        <polyline points={polyPoints} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round"/>
        {/* Last point dot */}
        <circle cx={toX(points.length - 1)} cy={toY(lastCum)} r="4" fill={lineColor}/>
        {/* Y axis labels */}
        {[minCum, 0, maxCum].filter((v, i, a) => a.indexOf(v) === i && a.length > 1).map((v, i) => (
          <text key={i} x={PAD.l - 4} y={toY(v) + 4} textAnchor="end" fill="var(--text-4)" fontSize="9" fontFamily="'JetBrains Mono', monospace">
            {v >= 0 ? '+' : ''}{v.toFixed(0)}
          </text>
        ))}
        {/* X labels */}
        {labels.map((l, i) => (
          <text key={i} x={l.x} y={H} textAnchor="middle" fill="var(--text-4)" fontSize="9">
            {l.label}
          </text>
        ))}
        {/* Trade dots */}
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.cum)} r="2"
            fill={p.pips >= 0 ? 'var(--green)' : 'var(--red)'} opacity="0.6"/>
        ))}
      </svg>
    </div>
  )
}

// ── Trade form ────────────────────────────────────────────────────────────────
const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NZDJPY', 'GBPJPY', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'Other']

const EMPTY_TRADE = {
  date:        new Date().toISOString().split('T')[0],
  pair:        'XAUUSD',
  direction:   'long',
  session:     'London',
  entry:       '',
  sl:          '',
  tp:          '',
  exitPrice:   '',
  lotSize:     '0.10',
  result:      '',
  pips:        '',
  pnl:         '',
  rr:          '',
  reasoning:   '',
  kz:          true,
  trendAligned: true,
  iccValid:    true,
  grade:       'A',
}

function TradeForm({ initial, onSave, onCancel, isEdit }) {
  const [form, setForm] = useState(initial)

  const set = useCallback((k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    // Auto-compute pips when exit price changes
    if (['exitPrice', 'entry', 'direction', 'pair'].includes(k)) {
      const pips = calcPips(next.entry, next.exitPrice, next.pair, next.direction)
      if (pips != null) {
        next.pips = pips.toFixed(1)
        const pnl = calcPnl(pips, next.lotSize, next.pair)
        if (pnl != null) next.pnl = pnl.toFixed(2)
      }
    }
    // Auto-compute pnl when pips or lotSize changes
    if (['pips', 'lotSize'].includes(k) && !next.exitPrice) {
      const pnl = calcPnl(parseFloat(next.pips), next.lotSize, next.pair)
      if (pnl != null) next.pnl = pnl.toFixed(2)
    }
    // Auto-compute RR
    const rr = calcRR(next.entry, next.sl, next.tp, next.pair, next.direction)
    next.rr = rr != null ? rr.toFixed(2) : ''
    // Auto-compute grade
    next.grade = iccGrade(next.kz, next.trendAligned, next.iccValid, rr)
    return next
  }), [])

  const handleSubmit = (e) => {
    e.preventDefault()
    // Auto-determine result from pips if set
    const finalForm = { ...form }
    if (finalForm.exitPrice && finalForm.pips === '') {
      const p = calcPips(finalForm.entry, finalForm.exitPrice, finalForm.pair, finalForm.direction)
      if (p != null) {
        finalForm.pips = p.toFixed(1)
        finalForm.pnl  = (calcPnl(p, finalForm.lotSize, finalForm.pair) ?? 0).toFixed(2)
      }
    }
    if (!finalForm.result && finalForm.pips) {
      const p = parseFloat(finalForm.pips)
      finalForm.result = p > 0 ? 'win' : p < 0 ? 'loss' : 'breakeven'
    }
    onSave(finalForm)
  }

  const previewRR = form.rr ? parseFloat(form.rr).toFixed(1) : null
  const previewGrade = form.grade

  return (
    <div className="card" style={{ marginBottom: 24, borderTop: '3px solid var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{isEdit ? 'Edit Trade' : 'Log New Trade'}</div>
        {previewGrade && (
          <div style={{
            width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${GRADE_COLOR[previewGrade]}22`, border: `2px solid ${GRADE_COLOR[previewGrade]}`,
            fontWeight: 900, fontSize: '1rem', color: GRADE_COLOR[previewGrade],
          }}>{previewGrade}</div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Row 1: Date, Pair, Direction, Session */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
          <div>
            <label className="tool-label">Date</label>
            <input type="date" className="tool-input" value={form.date} onChange={e => set('date', e.target.value)} required />
          </div>
          <div>
            <label className="tool-label">Pair</label>
            <select className="tool-input" value={form.pair} onChange={e => set('pair', e.target.value)}>
              {PAIRS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="tool-label">Direction</label>
            <select className="tool-input" value={form.direction} onChange={e => set('direction', e.target.value)}>
              <option value="long">▲ Long</option>
              <option value="short">▼ Short</option>
            </select>
          </div>
          <div>
            <label className="tool-label">Session</label>
            <select className="tool-input" value={form.session} onChange={e => set('session', e.target.value)}>
              <option>London</option>
              <option>NY</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        {/* Row 2: Entry, SL, TP, Lot Size */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
          <div>
            <label className="tool-label">Entry</label>
            <input type="number" className="tool-input" step="any" placeholder="0.00000" value={form.entry} onChange={e => set('entry', e.target.value)} required />
          </div>
          <div>
            <label className="tool-label">Stop Loss</label>
            <input type="number" className="tool-input" step="any" placeholder="0.00000" value={form.sl} onChange={e => set('sl', e.target.value)} required />
          </div>
          <div>
            <label className="tool-label">Take Profit</label>
            <input type="number" className="tool-input" step="any" placeholder="0.00000" value={form.tp} onChange={e => set('tp', e.target.value)} required />
          </div>
          <div>
            <label className="tool-label">Lot Size</label>
            <input type="number" className="tool-input" step="0.01" min="0.01" placeholder="0.10" value={form.lotSize} onChange={e => set('lotSize', e.target.value)} required />
          </div>
        </div>

        {/* Row 3: Exit, Result, Pips (auto), P&L (auto) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
          <div>
            <label className="tool-label">Exit Price</label>
            <input type="number" className="tool-input" step="any" placeholder="Auto-calculates pips" value={form.exitPrice} onChange={e => set('exitPrice', e.target.value)} />
          </div>
          <div>
            <label className="tool-label">Result</label>
            <select className="tool-input" value={form.result} onChange={e => set('result', e.target.value)}>
              <option value="">Open / Pending</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Breakeven</option>
            </select>
          </div>
          <div>
            <label className="tool-label">Pips {form.exitPrice ? '(auto)' : ''}</label>
            <input type="number" className="tool-input" step="0.1" placeholder="auto from exit price" value={form.pips} onChange={e => set('pips', e.target.value)} style={{ color: form.exitPrice ? 'var(--gold)' : undefined }} />
          </div>
          <div>
            <label className="tool-label">P&amp;L $ {form.pips && form.lotSize ? '(auto)' : ''}</label>
            <input type="number" className="tool-input" step="0.01" placeholder="auto-computed" value={form.pnl} onChange={e => set('pnl', e.target.value)} style={{ color: form.pnl ? (parseFloat(form.pnl) >= 0 ? 'var(--green)' : 'var(--red)') : undefined }} />
          </div>
        </div>

        {/* R:R preview */}
        {previewRR && (
          <div style={{
            background: 'var(--surface-3)', borderRadius: 8, padding: '8px 12px',
            marginBottom: 14, display: 'flex', gap: 20, fontSize: '0.82rem',
          }}>
            <span>R:R <strong style={{ color: parseFloat(previewRR) >= 3 ? 'var(--green)' : 'var(--gold)' }}>{previewRR}:1</strong></span>
            <span>Grade <strong style={{ color: GRADE_COLOR[previewGrade] }}>{previewGrade}</strong></span>
            <span style={{ color: 'var(--text-4)' }}>
              {parseFloat(previewRR) >= 3 ? '✓ Meets 3:1 minimum' : '⚠ Below 3:1 target'}
            </span>
          </div>
        )}

        {/* ICC Compliance */}
        <div style={{ background: 'var(--surface-3)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            ICC Compliance — used for grading
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { key: 'kz',          label: 'Kill Zone active',   pts: '+1' },
              { key: 'trendAligned', label: 'Trend aligned (EMA50)', pts: '+1' },
              { key: 'iccValid',    label: 'Valid ICC setup',    pts: '+1' },
            ].map(({ key, label, pts }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={e => set(key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                <span style={{ color: form[key] ? 'var(--text)' : 'var(--text-3)' }}>{label}</span>
                <span style={{ color: form[key] ? 'var(--green)' : 'var(--text-4)', fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace" }}>{pts}</span>
              </label>
            ))}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-4)', alignSelf: 'center' }}>
              R:R ≥ 3:1 auto-checked
            </span>
          </div>
        </div>

        {/* Reasoning */}
        <div style={{ marginBottom: 16 }}>
          <label className="tool-label">Trade Reasoning</label>
          <textarea
            className="tool-input" rows={3}
            placeholder="Why did you take this trade? Was the ICC setup valid? What was the bias? Any news risk?"
            value={form.reasoning}
            onChange={e => set('reasoning', e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary">{isEdit ? 'Save Changes' : 'Log Trade'}</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

// ── Trade card ────────────────────────────────────────────────────────────────
function TradeCard({ trade, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const rr = trade.rr || (trade.entry && trade.sl && trade.tp
    ? calcRR(trade.entry, trade.sl, trade.tp, trade.pair, trade.direction)?.toFixed(1)
    : null)

  const pnlNum = parseFloat(trade.pnl)
  const pipsNum = parseFloat(trade.pips)
  const grade = trade.grade || iccGrade(trade.kz, trade.trendAligned, trade.iccValid, rr)
  const isOpen = !trade.result || trade.result === ''

  const borderColor = isOpen
    ? 'var(--border)'
    : trade.result === 'win' ? 'var(--green)' : trade.result === 'loss' ? 'var(--red)' : 'var(--text-4)'

  const dec = trade.pair === 'XAUUSD' ? 2 : trade.pair?.includes('JPY') ? 3 : 5

  return (
    <div style={{
      borderRadius: 'var(--r-lg)', overflow: 'hidden',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${borderColor}`,
      marginBottom: 0,
    }}>
      {/* Header row — always visible */}
      <div
        style={{ padding: '12px 16px', cursor: 'pointer', background: 'var(--surface-1)' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Grade ring */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${GRADE_COLOR[grade] || 'var(--text-4)'}22`,
            border: `2px solid ${GRADE_COLOR[grade] || 'var(--border)'}`,
            fontSize: '0.7rem', fontWeight: 900,
            color: GRADE_COLOR[grade] || 'var(--text-4)',
          }}>
            {grade}
          </div>

          {/* Pair + direction */}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '0.95rem' }}>
            {trade.pair}
          </span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 5,
            background: trade.direction === 'long' ? 'rgba(34,211,165,0.15)' : 'rgba(248,113,113,0.15)',
            color: trade.direction === 'long' ? 'var(--green)' : 'var(--red)',
          }}>
            {trade.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
          </span>

          {/* Session */}
          {trade.session && trade.session !== 'Other' && (
            <span className="tag tag-gray" style={{ fontSize: '0.65rem' }}>{trade.session} KZ</span>
          )}

          {/* Result */}
          {trade.outcome === 'missed' && (
            <span className="tag tag-gold">❌ MISSED ENTRY</span>
          )}
          {trade.outcome === 'skipped' && (
            <span className="tag tag-gray">⏭ SKIPPED</span>
          )}
          {!trade.outcome && !isOpen && (
            <span className={`tag ${trade.result === 'win' ? 'tag-green' : trade.result === 'loss' ? 'tag-red' : 'tag-gray'}`}>
              {trade.result === 'win' ? '✓ WIN' : trade.result === 'loss' ? '✗ LOSS' : 'BE'}
            </span>
          )}
          {!trade.outcome && isOpen && <span className="tag tag-gold">● OPEN</span>}

          {/* Pips */}
          {!isNaN(pipsNum) && trade.pips !== '' && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.82rem',
              color: pipsNum >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {pipsNum >= 0 ? '+' : ''}{pipsNum.toFixed(1)}p
            </span>
          )}

          {/* P&L dollars */}
          {!isNaN(pnlNum) && trade.pnl !== '' && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.82rem',
              color: pnlNum >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {pnlNum >= 0 ? '+$' : '-$'}{Math.abs(pnlNum).toFixed(2)}
            </span>
          )}

          {/* R:R */}
          {rr && <span className="tag tag-gold" style={{ fontSize: '0.65rem' }}>{parseFloat(rr).toFixed(1)}R</span>}

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: '0.75rem', color: 'var(--text-4)', fontFamily: "'JetBrains Mono', monospace" }}>{trade.date}</span>
          <span style={{ color: 'var(--text-4)', fontSize: '0.8rem' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          {/* Levels row */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12, fontSize: '0.82rem' }}>
            <span>Entry <strong style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{parseFloat(trade.entry).toFixed(dec)}</strong></span>
            <span>SL <strong style={{ color: 'var(--red)', fontFamily: 'monospace' }}>{parseFloat(trade.sl).toFixed(dec)}</strong></span>
            <span>TP <strong style={{ color: 'var(--green)', fontFamily: 'monospace' }}>{parseFloat(trade.tp).toFixed(dec)}</strong></span>
            {trade.exitPrice && <span>Exit <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{parseFloat(trade.exitPrice).toFixed(dec)}</strong></span>}
            {trade.lotSize  && <span>Size <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{trade.lotSize} lots</strong></span>}
          </div>

          {/* ICC checklist */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Kill Zone', val: trade.kz },
              { label: 'Trend Aligned', val: trade.trendAligned },
              { label: 'ICC Setup', val: trade.iccValid },
              { label: 'R:R ≥ 3:1', val: rr && parseFloat(rr) >= 3 },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem' }}>
                <span style={{ color: val ? 'var(--green)' : 'var(--text-4)' }}>{val ? '✓' : '○'}</span>
                <span style={{ color: val ? 'var(--text-2)' : 'var(--text-4)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Reasoning */}
          {trade.reasoning && (
            <div style={{
              fontSize: '0.82rem', color: 'var(--text-2)',
              background: 'var(--surface-3)', padding: '10px 14px', borderRadius: 8,
              lineHeight: 1.6, marginBottom: 12,
            }}>
              {trade.reasoning}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(trade)}>✏ Edit</button>
            <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => onDelete(trade.id)}>
              ✕ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Weekly group header ───────────────────────────────────────────────────────
function WeekGroup({ weekLabel, trades }) {
  const closed = trades.filter(t => t.result && t.result !== '')
  const weekPips = closed.reduce((a, t) => a + (parseFloat(t.pips) || 0), 0)
  const weekPnl  = closed.reduce((a, t) => a + (parseFloat(t.pnl)  || 0), 0)
  const wins = closed.filter(t => t.result === 'win').length

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 12px', borderRadius: 6,
        background: 'var(--surface-2)',
        marginBottom: 6,
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Week of {weekLabel}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{trades.length} trades · {wins}W/{closed.length - wins}L</span>
        {closed.length > 0 && (
          <>
            <span style={{
              fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              color: weekPips >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {weekPips >= 0 ? '+' : ''}{weekPips.toFixed(1)}p
            </span>
            {weekPnl !== 0 && (
              <span style={{
                fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                color: weekPnl >= 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {weekPnl >= 0 ? '+$' : '-$'}{Math.abs(weekPnl).toFixed(2)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Week grouping helper ──────────────────────────────────────────────────────
function groupByWeek(trades) {
  const groups = {}
  trades.forEach(t => {
    const d = new Date(t.date + 'T12:00:00')
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const key = monday.toISOString().split('T')[0]
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))   // newest week first
    .map(([key, ts]) => ({ key, trades: ts, label: key }))
}

// ── Grade distribution bar ────────────────────────────────────────────────────
function GradeBar({ grades, total }) {
  if (!total) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
        {['A', 'B', 'C', 'F'].map(g => {
          const pct = (grades[g] / total) * 100
          return pct > 0 ? (
            <div key={g} title={`${g}: ${grades[g]}`} style={{ flex: pct, background: GRADE_COLOR[g], borderRadius: 2 }} />
          ) : null
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: '0.68rem' }}>
        {['A', 'B', 'C', 'F'].map(g => grades[g] > 0 ? (
          <span key={g} style={{ color: GRADE_COLOR[g] }}>{g}: {grades[g]}</span>
        ) : null)}
      </div>
    </div>
  )
}

// ── Outcome summary panel ─────────────────────────────────────────────────────
function OutcomeSummary({ stats }) {
  if (!stats) return null
  const bars = [
    { label: 'Taken',   count: stats.taken,   pct: stats.takenPct,   color: 'var(--green)' },
    { label: 'Missed',  count: stats.missed,  pct: stats.missedPct,  color: 'var(--gold)'  },
    { label: 'Skipped', count: stats.skipped, pct: stats.skippedPct, color: 'var(--text-4)' },
  ]
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 16,
    }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        Signal Outcome Tracking — {stats.total} responses
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        {bars.map(({ label, count, pct, color }) => (
          <div key={label} style={{ flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginBottom: 3 }}>{label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.2rem', color }}>{count}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{pct}%</div>
          </div>
        ))}
        {stats.takenWinRate != null && (
          <div style={{ flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginBottom: 3 }}>Win Rate (taken)</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '1.2rem', color: stats.takenWinRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
              {stats.takenWinRate}%
            </div>
          </div>
        )}
      </div>
      {/* Proportion bar */}
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
        {bars.filter(b => b.count > 0).map(({ label, pct, color }) => (
          <div key={label} style={{ flex: pct, background: color, borderRadius: 2, minWidth: 2 }} title={`${label}: ${pct}%`} />
        ))}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginTop: 6 }}>
        You take {stats.takenPct}% of STRONG signals · skip {stats.skippedPct}% · miss entry on {stats.missedPct}%
      </div>
    </div>
  )
}

// ── Main Journal page ─────────────────────────────────────────────────────────
export default function Journal() {
  const [activeTab, setActiveTab] = useState('journal')  // 'journal' | 'replay'
  const [trades, setTrades]       = useState(loadTrades)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [filterPair, setFilterPair]     = useState('ALL')
  const [filterResult, setFilterResult] = useState('ALL')

  useEffect(() => saveTrades(trades), [trades])

  const stats        = useMemo(() => calcStats(trades), [trades])
  const outcomeStats = useMemo(() => calcOutcomeStats(trades), [trades])

  // Open trades = taken but result not yet recorded (real positions only)
  const openTrades = useMemo(() =>
    trades.filter(t => (!t.result || t.result === '') && t.outcome !== 'missed' && t.outcome !== 'skipped'),
  [trades])

  // Closed trades = win/loss only (excludes missed/skipped outcomes)
  const closedTrades = useMemo(() =>
    trades.filter(t => t.result === 'win' || t.result === 'loss' || t.result === 'breakeven'),
  [trades])

  const filteredClosed = useMemo(() => {
    let ts = closedTrades
    if (filterPair   !== 'ALL') ts = ts.filter(t => t.pair   === filterPair)
    if (filterResult !== 'ALL') ts = ts.filter(t => t.result === filterResult.toLowerCase())
    return ts.sort((a, b) => b.date.localeCompare(a.date))
  }, [closedTrades, filterPair, filterResult])

  const weekGroups = useMemo(() => groupByWeek(filteredClosed), [filteredClosed])
  const availablePairs = useMemo(() => ['ALL', ...new Set(trades.map(t => t.pair).filter(Boolean))], [trades])

  const handleSave = useCallback((form) => {
    if (editId) {
      setTrades(ts => ts.map(t => t.id === editId ? { ...form, id: editId } : t))
      setEditId(null)
    } else {
      setTrades(ts => [{ ...form, id: Date.now().toString() }, ...ts])
    }
    setShowForm(false)
  }, [editId])

  const handleEdit = useCallback((trade) => {
    setEditId(trade.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleDelete = useCallback((id) => {
    if (confirm('Delete this trade?')) setTrades(ts => ts.filter(t => t.id !== id))
  }, [])

  const editingTrade = editId ? trades.find(t => t.id === editId) : null

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Trade Journal</h1>
            <p className="page-subtitle">Log every trade · Auto P&amp;L · ICC grading · Weekly review</p>
          </div>
          {activeTab === 'journal' && (
            <button className="btn btn-primary" onClick={() => { setEditId(null); setShowForm(f => !f) }}>
              {showForm && !editId ? '✕ Cancel' : '+ Log Trade'}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'journal', label: '📓 Journal' },
          { id: 'replay',  label: '🎬 Session Replay' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0', fontWeight: 700,
              fontSize: '0.82rem', cursor: 'pointer', border: '1px solid var(--border)',
              borderBottom: activeTab === tab.id ? '1px solid var(--bg)' : '1px solid var(--border)',
              background: activeTab === tab.id ? 'var(--bg)' : 'var(--surface-2)',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-3)',
              marginBottom: activeTab === tab.id ? -1 : 0,
              touchAction: 'manipulation',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Session Replay tab */}
      {activeTab === 'replay' && <SessionReplay />}

      {/* Journal tab — hidden when replay is active */}
      {activeTab !== 'replay' && <>

      {/* Form */}
      {showForm && (
        <TradeForm
          initial={editingTrade || { ...EMPTY_TRADE, date: new Date().toISOString().split('T')[0] }}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditId(null) }}
          isEdit={!!editId}
        />
      )}

      {/* Stats */}
      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Win Rate</div>
              <div className={`stat-value ${stats.wr >= 40 ? 'green' : stats.wr >= 25 ? 'gold' : 'red'}`}>{stats.wr}%</div>
              <div className="stat-sub">{stats.wins}W / {stats.losses}L · {stats.total} closed</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total P&amp;L</div>
              <div className={`stat-value ${parseFloat(stats.totalPnl) >= 0 ? 'green' : 'red'}`}>
                {parseFloat(stats.totalPnl) >= 0 ? '+$' : '-$'}{Math.abs(parseFloat(stats.totalPnl)).toFixed(0)}
              </div>
              <div className="stat-sub">{parseFloat(stats.totalPips) >= 0 ? '+' : ''}{stats.totalPips} pips total</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Profit Factor</div>
              <div className={`stat-value ${parseFloat(stats.pf) >= 1.5 ? 'green' : parseFloat(stats.pf) >= 1 ? 'gold' : 'red'}`}>{stats.pf}</div>
              <div className="stat-sub">Avg W +{stats.avgWin}p · Avg L -{stats.avgLoss}p</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Expectancy</div>
              <div className={`stat-value ${parseFloat(stats.expectancy) >= 0 ? 'green' : 'red'}`}>
                {parseFloat(stats.expectancy) >= 0 ? '+' : ''}{stats.expectancy}
              </div>
              <div className="stat-sub">
                pips/trade{stats.avgRR ? ` · Avg R:R ${stats.avgRR}` : ''}
              </div>
            </div>
          </div>

          {/* Grade bar */}
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              ICC Grade Breakdown
            </div>
            <GradeBar grades={stats.grades} total={stats.total} />
          </div>
        </>
      )}

      {/* Equity curve */}
      <EquityCurve trades={trades} />

      {/* Signal outcome summary */}
      <OutcomeSummary stats={outcomeStats} />

      {/* Open trades */}
      {openTrades.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            Open Positions ({openTrades.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {openTrades.map(t => (
              <TradeCard key={t.id} trade={t} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      {closedTrades.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
            Filter:
          </div>
          {availablePairs.map(p => (
            <button
              key={p}
              onClick={() => setFilterPair(p)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: filterPair === p ? 'var(--gold)' : 'var(--surface-2)',
                color: filterPair === p ? '#000' : 'var(--text-3)',
              }}
            >{p}</button>
          ))}
          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
          {['ALL', 'WIN', 'LOSS', 'BREAKEVEN'].map(r => (
            <button
              key={r}
              onClick={() => setFilterResult(r)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: filterResult === r ? (r === 'WIN' ? 'var(--green)' : r === 'LOSS' ? 'var(--red)' : 'var(--surface-3)') : 'var(--surface-2)',
                color: filterResult === r && r !== 'ALL' ? '#fff' : filterResult === r ? 'var(--text)' : 'var(--text-3)',
              }}
            >{r}</button>
          ))}
        </div>
      )}

      {/* Trade history — grouped by week */}
      {trades.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📓</div>
          <div className="empty-state-title">No trades logged yet</div>
          <div className="empty-state-text">Click "+ Log Trade" to record your first trade. Signal cards can also auto-populate this journal via the "Paper Trade" button.</div>
        </div>
      ) : filteredClosed.length === 0 && openTrades.length > 0 ? null : (
        <>
          {filteredClosed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-3)', fontSize: '0.85rem' }}>
              No closed trades match the current filter.
            </div>
          ) : (
            weekGroups.map(({ key, trades: wTrades, label }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <WeekGroup weekLabel={label} trades={wTrades} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {wTrades.map(t => (
                    <TradeCard key={t.id} trade={t} onEdit={handleEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      </> /* end journal tab */}
    </div>
  )
}
