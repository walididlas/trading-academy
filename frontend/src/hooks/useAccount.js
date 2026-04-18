import { useState, useCallback } from 'react'

const BALANCE_KEY = 'ta_account_balance'
const RISK_KEY    = 'ta_account_risk_pct'

// Pip value per STANDARD lot (100,000 units) in USD
const PIP_VALUE_USD = {
  EURUSD: 10,
  GBPUSD: 10,
  XAUUSD: 100,   // gold: 1 pip (0.10) = $100/lot (100 oz × $1/oz)
  NZDJPY: 6.67,  // approx at USDJPY ~150
  GBPJPY: 6.67,
  USDJPY: 6.67,
  DEFAULT: 10,
}

export function calcPipValuePerLot(pair) {
  return PIP_VALUE_USD[pair] ?? PIP_VALUE_USD.DEFAULT
}

export function calcPositionSize(balance, riskPct, entry, sl, pair) {
  if (!balance || !entry || !sl) return null
  const pipSize       = pair === 'XAUUSD' ? 0.1 : pair?.includes('JPY') ? 0.01 : 0.0001
  const riskAmount    = balance * (riskPct / 100)
  const pipRisk       = Math.abs(entry - sl) / pipSize
  const pipVal        = calcPipValuePerLot(pair)
  const lots          = riskAmount / (pipRisk * pipVal)

  if (!isFinite(lots) || lots <= 0) return null

  return {
    lots:      parseFloat(Math.max(0.01, lots).toFixed(2)),
    riskUSD:   parseFloat(riskAmount.toFixed(2)),
    profitTP1: parseFloat((riskAmount * 1).toFixed(2)),
    profitTP2: parseFloat((riskAmount * 2).toFixed(2)),
    profitTP3: parseFloat((riskAmount * 3).toFixed(2)),
  }
}

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
    if (!isNaN(n) && n > 0) {
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
    hasBalance: balance !== null && balance > 0,
  }
}
