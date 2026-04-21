import { useState, useCallback } from 'react'

const BALANCE_KEY = 'ta_account_balance'
const RISK_KEY    = 'ta_account_risk_pct'

// ── Pip value per STANDARD LOT (100,000 units) in USD ────────────────────────
// Formula: pip_value = contract_size × pip_size
//   EURUSD/GBPUSD: 100,000 × 0.0001 = $10
//   XAUUSD:        100 oz  × $0.10  = $10   ← was wrongly 100, now corrected
//   NZDJPY/GBPJPY: 100,000 × 0.01 / ~150 ≈ $6.67
const PIP_VALUE_USD = {
  EURUSD:  10,
  GBPUSD:  10,
  AUDUSD:  10,
  USDCAD:  10,
  USDCHF:  10,
  XAUUSD:  10,    // 100 oz × $0.10/pip = $10 per pip per lot
  NZDJPY:  6.67,
  GBPJPY:  6.67,
  USDJPY:  6.67,
  DEFAULT: 10,
}

const PIP_SIZE = {
  XAUUSD:  0.10,
  DEFAULT_JPY: 0.01,
  DEFAULT: 0.0001,
}

function getPipSize(pair) {
  if (pair === 'XAUUSD') return 0.10
  if (pair?.includes('JPY')) return 0.01
  return 0.0001
}

function getPipValue(pair) {
  return PIP_VALUE_USD[pair?.toUpperCase()] ?? PIP_VALUE_USD.DEFAULT
}

// ── Core position-size calculator ─────────────────────────────────────────────
//
//   Lots = (Balance × Risk%) ÷ (SL_pips × pip_value_per_lot)
//
// Safety ceiling: actual dollar risk (lots × SL_pips × pip_value) must not
// exceed 2% of balance. If the minimum lot (0.01) already exceeds that, we
// warn but cannot size below 0.01.
//
export function calcPositionSize(balance, riskPct, entry, sl, pair) {
  if (!balance || !entry || !sl || balance <= 0) return null

  const pipSize  = getPipSize(pair)
  const pipValue = getPipValue(pair)
  const slDist   = Math.abs(entry - sl)
  if (slDist === 0) return null

  const slPips      = slDist / pipSize
  const riskAmount  = balance * (riskPct / 100)       // target risk $
  const maxRisk     = balance * 0.02                  // hard ceiling at 2%

  // Raw lots from formula
  const rawLots = riskAmount / (slPips * pipValue)

  // Round down to nearest 0.01, floor at 0.01
  const lots = Math.max(0.01, Math.floor(rawLots * 100) / 100)

  // Actual dollar risk with these lots
  const actualRisk = lots * slPips * pipValue

  // Determine if 2% ceiling was breached
  let cappedLots = lots
  let capped     = false
  let warning    = null

  if (actualRisk > maxRisk) {
    // Calculate max safe lots that keep risk ≤ 2%
    const safeLots = Math.floor((maxRisk / (slPips * pipValue)) * 100) / 100
    if (safeLots >= 0.01) {
      cappedLots = safeLots
      capped     = true
      warning    = `Capped at ${cappedLots} lots — calc would risk $${actualRisk.toFixed(2)} (>${(riskPct).toFixed(1)}% of balance). Max 2% = $${maxRisk.toFixed(2)}.`
    } else {
      // Can't go below 0.01 lots — warn but leave at minimum
      cappedLots = 0.01
      capped     = true
      warning    = `Min lot 0.01 risks $${(0.01 * slPips * pipValue).toFixed(2)} on this trade — larger than your ${riskPct}% target with $${balance} balance. Consider a tighter SL.`
    }
  }

  const finalRisk = cappedLots * slPips * pipValue

  return {
    lots:       cappedLots,
    riskUSD:    parseFloat(finalRisk.toFixed(2)),
    slPips:     parseFloat(slPips.toFixed(1)),
    pipValue:   pipValue,
    // Profit estimates use actual R:R based on pip distance to TPs
    // (caller can override with signal.rr1/rr2/rr3 if available)
    profitTP1:  parseFloat((finalRisk * 1.0).toFixed(2)),
    profitTP2:  parseFloat((finalRisk * 2.0).toFixed(2)),
    profitTP3:  parseFloat((finalRisk * 3.0).toFixed(2)),
    capped,
    warning,
  }
}

// ── React hook ────────────────────────────────────────────────────────────────
export function useAccount() {
  const [balance, setBalanceState] = useState(() => {
    const v = localStorage.getItem(BALANCE_KEY)
    return v ? parseFloat(v) : null
  })
  const [riskPct, setRiskPctState] = useState(() => {
    return parseFloat(localStorage.getItem(RISK_KEY) || '1')
  })

  const setBalance = useCallback((val) => {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 10) {
      localStorage.setItem(BALANCE_KEY, String(n))
      setBalanceState(n)
    }
  }, [])

  const setRiskPct = useCallback((val) => {
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0 && n <= 10) {
      localStorage.setItem(RISK_KEY, String(n))
      setRiskPctState(n)
    }
  }, [])

  const calcLots = useCallback((entry, sl, pair) => {
    return calcPositionSize(balance, riskPct, entry, sl, pair)
  }, [balance, riskPct])

  return {
    balance,
    setBalance,
    riskPct,
    setRiskPct,
    calcLots,
    hasBalance: balance !== null && balance >= 10,
  }
}
