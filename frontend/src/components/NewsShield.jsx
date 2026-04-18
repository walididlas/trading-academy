import React from 'react'

export default function NewsShield({ risk }) {
  if (!risk || risk.level === 'NONE') {
    return (
      <span className="news-shield news-shield-safe" title="No high-impact news nearby">
        🛡 Clear
      </span>
    )
  }

  const { level, next_event } = risk
  const mins = next_event?.minutes_until
  const countdown = mins != null
    ? (mins >= 0 ? `in ${Math.round(mins)}m` : `${Math.round(Math.abs(mins))}m ago`)
    : ''
  const eventName = next_event?.title ?? ''

  if (level === 'HIGH') {
    return (
      <span className="news-shield news-shield-danger" title={eventName}>
        ⚠ HIGH {countdown}
      </span>
    )
  }

  return (
    <span className="news-shield news-shield-warn" title={eventName}>
      ● MED {countdown}
    </span>
  )
}
