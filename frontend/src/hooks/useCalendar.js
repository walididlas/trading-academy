import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../config'

export function useCalendar() {
  const [calendar, setCalendar] = useState(null)

  useEffect(() => {
    function fetchCalendar() {
      fetch(`${API_BASE}/api/calendar`)
        .then(r => r.json())
        .then(setCalendar)
        .catch(() => {})
    }
    fetchCalendar()
    const t = setInterval(fetchCalendar, 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const getNewsRiskForPair = useCallback((pair) => {
    if (!calendar) return { level: 'NONE', events: [], next_event: null }
    return calendar.risk_by_pair?.[pair?.toUpperCase()] ?? { level: 'NONE', events: [], next_event: null }
  }, [calendar])

  return {
    calendar,
    getNewsRiskForPair,
    nextHighEvent: calendar?.next_high ?? null,
  }
}
