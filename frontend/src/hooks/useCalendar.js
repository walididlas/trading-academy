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

  const getNextEventForPair = useCallback((pair) => {
    if (!calendar) return null
    return calendar.next_event_by_pair?.[pair?.toUpperCase()] ?? null
  }, [calendar])

  return {
    calendar,
    getNewsRiskForPair,
    getNextEventForPair,
    nextHighEvent:    calendar?.next_high          ?? null,
    upcoming24h:      calendar?.upcoming_24h        ?? [],
    nextEventByPair:  calendar?.next_event_by_pair  ?? {},
    riskByPair:       calendar?.risk_by_pair         ?? {},
  }
}
