import React, { useState, useEffect } from 'react'
import { useAccount } from '../hooks/useAccount'

const PIP = { GBPUSD: 0.0001, EURUSD: 0.0001, GBPJPY: 0.01, USDJPY: 0.01, AUDUSD: 0.0001, USDCAD: 0.0001, NZDUSD: 0.0001 }
const PIP_VALUE = { GBPUSD: 10, EURUSD: 10, GBPJPY: 10, USDJPY: 10, AUDUSD: 10, USDCAD: 10, NZDUSD: 10 } // per standard lot, approx

function PipCalculator() {
  const [pair, setPair] = useState('GBPUSD')
  const [lots, setLots] = useState('0.1')
  const [pips, setPips] = useState('50')
  const pipVal = PIP_VALUE[pair] || 10
  const result = parseFloat(lots) * parseFloat(pips) * pipVal

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 16 }}>💰 Pip Calculator</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label className="tool-label">Currency Pair</label>
          <select className="tool-input" value={pair} onChange={e => setPair(e.target.value)}>
            {Object.keys(PIP).map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="tool-label">Lot Size</label>
          <input type="number" className="tool-input" step="0.01" min="0.01" value={lots} onChange={e => setLots(e.target.value)} />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>0.01 = micro | 0.1 = mini | 1.0 = standard</div>
        </div>
        <div>
          <label className="tool-label">Number of Pips</label>
          <input type="number" className="tool-input" step="1" min="1" value={pips} onChange={e => setPips(e.target.value)} />
        </div>
      </div>
      <div className="tool-result">
        <div className="tool-result-label">Profit / Loss</div>
        <div className="tool-result-value">${isNaN(result) ? '—' : result.toFixed(2)}</div>
        <div className="tool-result-unit">USD ({pips} pips on {lots} lots of {pair})</div>
      </div>
    </div>
  )
}

function PositionSizer() {
  const [balance, setBalance] = useState('10000')
  const [risk, setRisk] = useState('1')
  const [pair, setPair] = useState('GBPUSD')
  const [slPips, setSlPips] = useState('30')

  const pipVal = PIP_VALUE[pair] || 10
  const riskAmount = parseFloat(balance) * parseFloat(risk) / 100
  const lots = riskAmount / (parseFloat(slPips) * pipVal)

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 16 }}>📐 Position Sizer</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label className="tool-label">Account Balance (USD)</label>
          <input type="number" className="tool-input" step="100" value={balance} onChange={e => setBalance(e.target.value)} />
        </div>
        <div>
          <label className="tool-label">Risk Per Trade (%)</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {['0.5', '1', '1.5', '2'].map(v => (
              <button key={v} type="button" className={`btn btn-sm ${risk === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setRisk(v)}>{v}%</button>
            ))}
          </div>
          <input type="number" className="tool-input" step="0.1" min="0.1" max="5" value={risk} onChange={e => setRisk(e.target.value)} />
        </div>
        <div>
          <label className="tool-label">Currency Pair</label>
          <select className="tool-input" value={pair} onChange={e => setPair(e.target.value)}>
            {Object.keys(PIP).map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="tool-label">Stop Loss (pips)</label>
          <input type="number" className="tool-input" step="1" min="1" value={slPips} onChange={e => setSlPips(e.target.value)} />
        </div>
      </div>
      <div className="tool-result">
        <div className="tool-result-label">Lot Size to Trade</div>
        <div className="tool-result-value">{isNaN(lots) || !isFinite(lots) ? '—' : lots.toFixed(2)}</div>
        <div className="tool-result-unit">lots (risking ${(parseFloat(balance) * parseFloat(risk) / 100).toFixed(2)} = {risk}% of account)</div>
      </div>
      {!isNaN(lots) && isFinite(lots) && (
        <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
          At {slPips} pips SL: ${(lots * pipVal * parseFloat(slPips)).toFixed(2)} max loss | At {parseFloat(slPips) * 3} pips TP (3:1): +${(lots * pipVal * parseFloat(slPips) * 3).toFixed(2)} max profit
        </div>
      )}
    </div>
  )
}

function RRCalculator() {
  const [pair, setPair] = useState('GBPUSD')
  const [entry, setEntry] = useState('')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [direction, setDir] = useState('long')

  const pip = PIP[pair] || 0.0001
  const entryN = parseFloat(entry); const slN = parseFloat(sl); const tpN = parseFloat(tp)
  const risk = !isNaN(entryN) && !isNaN(slN) ? Math.abs(entryN - slN) / pip : null
  const reward = !isNaN(entryN) && !isNaN(tpN) ? Math.abs(tpN - entryN) / pip : null
  const rr = risk && reward ? reward / risk : null

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 16 }}>⚖️ R:R Calculator</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['long', 'short'].map(d => (
            <button key={d} type="button" className={`btn btn-sm ${direction === d ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setDir(d)}>
              {d === 'long' ? '▲ Long' : '▼ Short'}
            </button>
          ))}
        </div>
        <div>
          <label className="tool-label">Pair</label>
          <select className="tool-input" value={pair} onChange={e => setPair(e.target.value)}>
            {Object.keys(PIP).map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        {[['entry', 'Entry Price', entry, setEntry], ['sl', 'Stop Loss', sl, setSl], ['tp', 'Take Profit', tp, setTp]].map(([k, label, val, set]) => (
          <div key={k}>
            <label className="tool-label">{label}</label>
            <input type="number" className="tool-input" step="0.00001" placeholder="0.00000" value={val} onChange={e => set(e.target.value)} />
          </div>
        ))}
      </div>
      <div className="tool-result">
        <div className="tool-result-label">Risk : Reward</div>
        <div className="tool-result-value" style={{ color: rr ? (rr >= 3 ? 'var(--green)' : rr >= 2 ? 'var(--gold)' : 'var(--red)') : 'var(--gold)' }}>
          {rr ? `1 : ${rr.toFixed(2)}` : '—'}
        </div>
        {risk && reward && (
          <div className="tool-result-unit">Risk: {risk.toFixed(1)} pips | Reward: {reward.toFixed(1)} pips</div>
        )}
      </div>
      {rr && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: rr >= 3 ? 'rgba(16,185,129,0.08)' : rr >= 2 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', fontSize: '0.82rem', color: 'var(--text-2)' }}>
          {rr >= 3 ? '✅ Excellent setup. At this R:R, you only need to win 25% of trades to be profitable.' :
           rr >= 2 ? '⚠️ Acceptable, but aim for 3:1 minimum. Consider a wider TP at the next BSL/SSL pool.' :
           '❌ Too low. Below 2:1 is not worth the risk unless your win rate is very high. Pass on this trade.'}
        </div>
      )}
    </div>
  )
}

function SessionClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  const utcH = time.getUTCHours(); const utcM = time.getUTCMinutes(); const utcS = time.getUTCSeconds()
  const utcStr = `${String(utcH).padStart(2,'0')}:${String(utcM).padStart(2,'0')}:${String(utcS).padStart(2,'0')}`

  const sessions = [
    { name: 'Asian', icon: '🌏', open: 23, close: 8, color: 'var(--purple)' },
    { name: 'London', icon: '🇬🇧', open: 7, close: 16, color: 'var(--blue)' },
    { name: 'New York', icon: '🗽', open: 12, close: 21, color: 'var(--green)' },
  ]

  const kz = [
    { name: 'London Kill Zone', open: 6, close: 9, color: 'var(--gold)' },
    { name: 'NY Kill Zone', open: 11, close: 14, color: 'var(--gold)' },
  ]

  const isActive = (open, close) => {
    if (open < close) return utcH >= open && utcH < close
    return utcH >= open || utcH < close
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>🕐 Session Clock</div>
      <div style={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 800, color: 'var(--gold)', marginBottom: 4 }}>{utcStr}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 16 }}>UTC (Coordinated Universal Time)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...sessions, ...kz].map(s => {
          const active = isActive(s.open, s.close)
          return (
            <div key={s.name} className={`clock-zone ${active ? (s.color === 'var(--gold)' ? 'killzone' : 'active') : ''}`}>
              <div style={{ display: 'flex', align: 'center', gap: 8, alignItems: 'center' }}>
                <span>{s.icon || '⏰'}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: active ? s.color : 'var(--text-2)' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{String(s.open).padStart(2,'0')}:00 – {String(s.close).padStart(2,'0')}:00 UTC</div>
                </div>
              </div>
              {active ? <span className="tag" style={{ background: `${s.color}22`, color: s.color }}>● OPEN</span> : <span className="tag tag-gray">Closed</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BreakevenCalc() {
  const [rr, setRr] = useState('3')
  const breakeven = 1 / (1 + parseFloat(rr)) * 100

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 16 }}>📊 Breakeven Win Rate</div>
      <div>
        <label className="tool-label">Your R:R Ratio (1:X)</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {['2', '2.5', '3', '4', '5'].map(v => (
            <button key={v} type="button" className={`btn btn-sm ${rr === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setRr(v)}>{v}:1</button>
          ))}
        </div>
        <input type="range" min="1" max="10" step="0.5" value={rr} onChange={e => setRr(e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
      </div>
      <div className="tool-result">
        <div className="tool-result-label">Minimum Win Rate to Break Even</div>
        <div className="tool-result-value">{breakeven.toFixed(1)}%</div>
        <div className="tool-result-unit">at {rr}:1 R:R ratio</div>
      </div>
      <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.7 }}>
        At <strong>{rr}:1</strong> R:R, you break even at <strong>{breakeven.toFixed(1)}%</strong> win rate.<br />
        If you win <strong>{(breakeven + 5).toFixed(0)}%</strong>+, you are consistently profitable.<br />
        At <strong>{(breakeven + 10).toFixed(0)}%</strong> win rate: every 10 trades = <strong style={{ color: 'var(--green)' }}>+{((breakeven / 100 + 0.10) * parseFloat(rr) * 10 - (1 - (breakeven / 100 + 0.10)) * 10).toFixed(1)}R profit</strong>
      </div>
    </div>
  )
}

function AccountSettings() {
  const { balance, setBalance, riskPct, setRiskPct, hasBalance } = useAccount()
  const [bal, setBal] = useState(balance ? String(balance) : '')
  const [risk, setRisk] = useState(String(riskPct))
  const [saved, setSaved] = useState(false)

  function handleSave(e) {
    e.preventDefault()
    const b = parseFloat(bal)
    const r = parseFloat(risk)
    if (!isNaN(b) && b > 0) setBalance(b)
    if (!isNaN(r) && r > 0) setRiskPct(r)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="card" style={{ border: '1px solid var(--gold-ring)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>⚙️ Account Settings</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: 16 }}>
        Used for position sizing on every signal. Stored locally on your device.
      </div>
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 12 }}>
        <div>
          <label className="tool-label">Account Balance (USD)</label>
          <input
            type="number" className="tool-input"
            placeholder="e.g. 5000" min="100" step="100"
            value={bal} onChange={e => setBal(e.target.value)}
          />
          {hasBalance && <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: 4 }}>✓ Currently: ${balance?.toLocaleString()}</div>}
        </div>
        <div>
          <label className="tool-label">Risk Per Trade (%)</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {['0.5', '1', '1.5', '2'].map(v => (
              <button key={v} type="button"
                className={`btn btn-sm ${risk === v ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }} onClick={() => setRisk(v)}>{v}%
              </button>
            ))}
          </div>
          {bal && parseFloat(bal) > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              = ${(parseFloat(bal) * parseFloat(risk) / 100).toFixed(2)} per trade
            </div>
          )}
        </div>
        <button type="submit" className={`btn ${saved ? 'btn-primary' : 'btn-secondary'}`}>
          {saved ? '✓ Saved!' : 'Save Account Settings'}
        </button>
      </form>
    </div>
  )
}

export default function Tools() {
  return (
    <div className="page-wide fade-in" style={{ padding: '32px 24px' }}>
      <div className="page-header">
        <h1 className="page-title">Tools</h1>
        <p className="page-subtitle">Professional trading calculators. Use these on every trade.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <AccountSettings />
        <SessionClock />
        <RRCalculator />
        <PositionSizer />
        <PipCalculator />
        <BreakevenCalc />
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>📋 Quick Reference</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.8 }}>
            <div><strong style={{ color: 'var(--gold)' }}>Kill Zones:</strong><br />London: 06:00–09:00 UTC<br />New York: 11:00–14:00 UTC</div>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div><strong style={{ color: 'var(--gold)' }}>Pips:</strong><br />GBPUSD/EURUSD: 0.0001<br />GBPJPY/USDJPY: 0.01</div>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div><strong style={{ color: 'var(--gold)' }}>ICC Rules:</strong><br />Body ratio ≥ 60%<br />Correction ≥ 30%<br />Max 10 bars to wait<br />R:R minimum 3:1</div>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div><strong style={{ color: 'var(--gold)' }}>Risk Rules:</strong><br />Max 1-2% per trade<br />Stop after 2 losses/day<br />Stop after 3% drawdown/week</div>
          </div>
        </div>
      </div>
    </div>
  )
}
