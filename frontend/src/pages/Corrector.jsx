import React, { useState } from 'react'

const EMPTY = {
  pair: 'GBPUSD', direction: 'long', entry: '', sl: '', tp: '',
  inKillZone: '', trendAligned: '', baseCandle: '',
  correction: '', sessionNotes: ''
}

function analyzeTrade(form) {
  const checks = []
  let score = 0

  const inKZ = form.inKillZone === 'yes'
  checks.push({ ok: inKZ, label: 'Kill Zone timing', detail: inKZ ? 'Trade taken during London or NY Kill Zone ✓' : 'Trade NOT in a Kill Zone — the ICC setup requires institutional timing. Outside KZ = random price, not institutional.' })
  if (inKZ) score++

  const trendOk = form.trendAligned === 'yes'
  checks.push({ ok: trendOk, label: 'Trend alignment (EMA50 H1)', detail: trendOk ? 'Trading in direction of EMA50 trend ✓' : 'Trading AGAINST the EMA50 trend. This is fighting the dominant order flow. Only take longs above EMA50, shorts below.' })
  if (trendOk) score++

  const baseOk = form.baseCandle === 'strong'
  checks.push({ ok: baseOk, label: 'Base Candle quality', detail: baseOk ? 'Strong base candle identified (≥60% body ratio) ✓' : form.baseCandle === 'weak' ? 'Weak base candle — body ratio below 60%. This does not show institutional conviction. Wait for a stronger impulse.' : 'Base candle not assessed. Always identify the last strong candle before entering.' })
  if (baseOk) score++

  const corrOk = form.correction === 'yes'
  checks.push({ ok: corrOk, label: 'Correction (pullback) before entry', detail: corrOk ? 'Entry taken after proper correction into base candle zone ✓' : 'No correction before entry — you may have chased the move. ICC requires: Indication → Correction → Continuation. Entering on the Indication candle itself gives worse entry and a larger stop.' })
  if (corrOk) score++

  const entry = parseFloat(form.entry)
  const sl = parseFloat(form.sl)
  const tp = parseFloat(form.tp)
  let rr = null
  let rrOk = false
  if (entry && sl && tp) {
    rr = Math.abs(tp - entry) / Math.abs(entry - sl)
    rrOk = rr >= 2.5
  }
  checks.push({ ok: rrOk, label: 'Risk:Reward ratio', detail: rr ? (rrOk ? `R:R is ${rr.toFixed(1)}:1 — above the 2.5:1 minimum ✓` : `R:R is only ${rr.toFixed(1)}:1 — below the 2.5:1 minimum. You need at least 3:1 to have positive expectancy at a 33% win rate. Consider a more distant TP (next BSL/SSL pool).`) : 'Entry, SL, or TP missing — cannot calculate R:R.' })
  if (rrOk) score++

  const grade = score === 5 ? 'A' : score === 4 ? 'B' : score === 3 ? 'C' : 'F'
  const verdict = score === 5 ? 'Excellent setup. All conditions met. This is exactly the kind of trade to repeat.' :
    score === 4 ? 'Good trade. One condition not met — review the failed check and improve for next time.' :
    score === 3 ? 'Average. Three conditions met. You need to be more selective — only trade A and B quality setups.' :
    score <= 2 ? 'Poor setup. This trade should not have been taken. Review the fundamentals before trading again.' : ''

  return { checks, score, grade, verdict, rr }
}

export default function Corrector() {
  const [form, setForm] = useState(EMPTY)
  const [result, setResult] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAnalyze = (e) => {
    e.preventDefault()
    setResult(analyzeTrade(form))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">Trade Corrector</h1>
        <p className="page-subtitle">Grade every trade you took. Find your leaks. Improve systematically.</p>
      </div>

      {result && (
        <div className="card" style={{ marginBottom: 24, borderColor: result.grade === 'A' ? 'var(--green)' : result.grade === 'B' ? 'var(--gold)' : result.grade === 'C' ? 'rgba(245,158,11,0.4)' : 'var(--red)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div className={`grade-badge grade-${result.grade}`} style={{ width: 56, height: 56, fontSize: '1.5rem' }}>{result.grade}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Trade Grade: {result.score}/5</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-2)', marginTop: 2 }}>{result.verdict}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            {result.checks.map((check, i) => (
              <div key={i} className="check-item">
                <span className="check-icon">{check.ok ? '✅' : '❌'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: check.ok ? 'var(--green)' : 'var(--red)' }}>{check.label}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginTop: 2 }}>{check.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {result.rr && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-3)' }}>Calculated R:R: </span>
              <strong style={{ color: result.rr >= 2.5 ? 'var(--green)' : 'var(--red)' }}>{result.rr.toFixed(2)}:1</strong>
              {result.rr >= 3 && <span style={{ color: 'var(--text-3)' }}> — Excellent. This is the kind of setup that builds accounts.</span>}
              {result.rr >= 2.5 && result.rr < 3 && <span style={{ color: 'var(--text-3)' }}> — Acceptable. Push for 3:1 minimum when possible.</span>}
              {result.rr < 2.5 && <span style={{ color: 'var(--red)' }}> — Too low. Below 2.5:1 you need a very high win rate to be profitable.</span>}
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setResult(null)}>Analyze Another Trade</button>
          </div>
        </div>
      )}

      {!result && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 20 }}>Analyze Your Trade</div>
          <form onSubmit={handleAnalyze}>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div>
                <label className="tool-label">Pair</label>
                <select className="tool-input" value={form.pair} onChange={e => set('pair', e.target.value)}>
                  <option>GBPUSD</option><option>GBPJPY</option><option>EURUSD</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="tool-label">Direction</label>
                <select className="tool-input" value={form.direction} onChange={e => set('direction', e.target.value)}>
                  <option value="long">Long (Buy)</option>
                  <option value="short">Short (Sell)</option>
                </select>
              </div>
            </div>

            <div className="grid-3" style={{ marginBottom: 20 }}>
              <div>
                <label className="tool-label">Entry Price</label>
                <input type="number" className="tool-input" step="0.00001" placeholder="1.35500" value={form.entry} onChange={e => set('entry', e.target.value)} />
              </div>
              <div>
                <label className="tool-label">Stop Loss</label>
                <input type="number" className="tool-input" step="0.00001" placeholder="1.35200" value={form.sl} onChange={e => set('sl', e.target.value)} />
              </div>
              <div>
                <label className="tool-label">Take Profit</label>
                <input type="number" className="tool-input" step="0.00001" placeholder="1.36400" value={form.tp} onChange={e => set('tp', e.target.value)} />
              </div>
            </div>

            <div className="divider" />
            <div style={{ fontWeight: 600, marginBottom: 14, marginTop: 16 }}>Setup Conditions</div>

            {[
              { key: 'inKillZone', label: 'Was this trade taken during a Kill Zone?', opts: [['yes', 'Yes — London (06:00-09:00 UTC) or NY (11:00-14:00 UTC)'], ['no', 'No — outside Kill Zones']], },
              { key: 'trendAligned', label: 'Was the trade direction aligned with the EMA50 trend on H1?', opts: [['yes', 'Yes — trading WITH the EMA50 trend'], ['no', 'No — trading AGAINST the EMA50']], },
              { key: 'correction', label: 'Did price pull back (correct) ≥30% into the base candle before your entry?', opts: [['yes', 'Yes — waited for the correction'], ['no', 'No — entered immediately on the Indication candle']], },
            ].map(({ key, label, opts }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label className="tool-label">{label}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {opts.map(([val, display]) => (
                    <button key={val} type="button"
                      className={`btn ${form[key] === val ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => set(key, val)}
                    >{display}</button>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <label className="tool-label">Base Candle quality</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['strong', 'Strong (≥60% body ratio)'], ['weak', 'Weak (small body, big wicks)'], ['unsure', 'Not assessed']].map(([val, display]) => (
                  <button key={val} type="button"
                    className={`btn ${form.baseCandle === val ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => set('baseCandle', val)}
                  >{display}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="tool-label">Session Notes (optional — what you observed)</label>
              <textarea className="tool-input" rows={3} placeholder="e.g. London KZ, GBPUSD, EMA50 bullish, Base candle at 07:15, correction to base at 08:00, continuation break at 08:15..." value={form.sessionNotes} onChange={e => set('sessionNotes', e.target.value)} style={{ resize: 'vertical' }} />
            </div>

            <button type="submit" className="btn btn-primary btn-lg">Analyze My Trade →</button>
          </form>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>What the Corrector Grades</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['⏰', 'Kill Zone timing', 'Institutional setups only happen during London and NY Kill Zones'],
            ['📈', 'Trend alignment', 'Trading with EMA50 direction on H1 is mandatory — no counter-trend trades'],
            ['🕯️', 'Base Candle quality', 'The base candle must show conviction: body ≥ 60% of range'],
            ['🔄', 'Correction before entry', 'Never enter on the Indication candle — wait for the pullback'],
            ['💰', 'Risk:Reward ratio', 'Minimum 2.5:1. Target 3:1 and above for positive expectancy'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 10, fontSize: '0.875rem' }}>
              <span>{icon}</span>
              <div><strong>{title}:</strong> <span style={{ color: 'var(--text-2)' }}>{desc}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
