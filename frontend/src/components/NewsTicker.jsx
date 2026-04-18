import React, { useRef, useEffect, useState } from 'react'

const IMPACT_COLOR = {
  HIGH:   'var(--red)',
  MEDIUM: 'var(--gold)',
  LOW:    'var(--text-3)',
}

function isInKillZone() {
  const t = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  return (t >= 9 * 60 && t < 12 * 60) || (t >= 14 * 60 + 30 && t < 17 * 60 + 30)
}

// Format minutes_until into a human string
function fmtCountdown(minsUntil) {
  if (minsUntil == null) return ''
  if (minsUntil <= 0) return 'now'
  const h = Math.floor(minsUntil / 60)
  const m = Math.round(minsUntil % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function NewsTicker({ news = [], nextHighEvent = null }) {
  const top5 = news.slice(0, 5)
  const [inKZ, setInKZ] = useState(isInKillZone)
  const [flashRed, setFlashRed] = useState(false)
  const [countdown, setCountdown] = useState('')
  const prevHighIdsRef = useRef(new Set())

  // Update KZ status every 30s
  useEffect(() => {
    const t = setInterval(() => setInKZ(isInKillZone()), 30000)
    return () => clearInterval(t)
  }, [])

  // Countdown timer for next HIGH event
  useEffect(() => {
    if (!nextHighEvent) { setCountdown(''); return }
    const update = () => {
      const now = Date.now() / 1000
      const minsLeft = (nextHighEvent.utc_ts - now) / 60
      setCountdown(minsLeft > 0 ? fmtCountdown(minsLeft) : '')
    }
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [nextHighEvent])

  // Detect new HIGH news → red flash
  useEffect(() => {
    const currentHighIds = new Set(news.filter(n => n.impact === 'HIGH').map(n => n.id))
    const isNew = [...currentHighIds].some(id => !prevHighIdsRef.current.has(id))
    prevHighIdsRef.current = currentHighIds
    if (isNew && currentHighIds.size > 0) {
      setFlashRed(true)
      const t = setTimeout(() => setFlashRed(false), 3000)
      return () => clearTimeout(t)
    }
  }, [news])

  const hasHighNews = news.some(n => n.impact === 'HIGH')
  const pulseGold   = inKZ && hasHighNews
  const tickerClass = ['news-ticker',
    pulseGold  ? 'news-ticker-pulse-gold' : '',
    flashRed   ? 'news-ticker-flash-red'  : '',
  ].filter(Boolean).join(' ')

  if (!top5.length && !nextHighEvent) return null

  const items = [...top5, ...top5]  // duplicate for seamless loop

  return (
    <div className={tickerClass}>
      <div className="news-ticker-label">
        <span className="news-ticker-live-dot" />
        NEWS
      </div>

      {/* Countdown pinned before the scroll track */}
      {nextHighEvent && countdown && (
        <div className="news-ticker-countdown" title={nextHighEvent.title}>
          ⚡ {nextHighEvent.title?.split(' ').slice(0, 3).join(' ')} in {countdown}
        </div>
      )}

      <div className="news-ticker-track-wrap">
        <div className="news-ticker-track">
          {items.map((item, i) => (
            <span key={`${item.id}-${i}`} className="news-ticker-item">
              <span style={{
                color: IMPACT_COLOR[item.impact] || 'var(--text-3)',
                marginRight: 6,
                fontSize: '0.65rem',
                fontWeight: 800,
              }}>
                {item.impact === 'HIGH' ? '⚡' : item.impact === 'MEDIUM' ? '●' : '·'}
              </span>
              <span style={{ color: item.impact === 'HIGH' ? 'var(--text)' : 'var(--text-2)' }}>
                {item.title}
              </span>
              <span className="news-ticker-sep">·····</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
