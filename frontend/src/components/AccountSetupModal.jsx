import React, { useState } from 'react'

export default function AccountSetupModal({ onSave }) {
  const [balance, setBalance] = useState('')
  const [risk, setRisk] = useState('1')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const b = parseFloat(balance)
    if (!b || b < 100) {
      setError('Enter a valid balance (minimum $100)')
      return
    }
    onSave(b, parseFloat(risk))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-mid)',
        borderRadius: 'var(--r-xl)', padding: 32, width: '100%', maxWidth: 400,
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚙️</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Account Setup</h2>
        <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', marginBottom: 24, lineHeight: 1.6 }}>
          Enter your trading account balance. This is used to calculate exact position sizes on every signal.
          Stored locally on your device — never sent anywhere.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="tool-label">Account Balance (USD)</label>
            <input
              type="number"
              className="tool-input"
              placeholder="e.g. 5000"
              min="100"
              step="100"
              value={balance}
              onChange={e => { setBalance(e.target.value); setError('') }}
              autoFocus
              style={{ fontSize: 18, fontWeight: 700 }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="tool-label">Risk Per Trade</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {['0.5', '1', '1.5', '2'].map(v => (
                <button
                  key={v} type="button"
                  className={`btn btn-sm ${risk === v ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setRisk(v)}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
              {balance && parseFloat(balance) > 0
                ? `= $${(parseFloat(balance) * parseFloat(risk) / 100).toFixed(2)} per trade`
                : 'Enter balance to see dollar amount'}
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 14 }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1rem' }}>
            Save &amp; Start Trading
          </button>
        </form>
      </div>
    </div>
  )
}
