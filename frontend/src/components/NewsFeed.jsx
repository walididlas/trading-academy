import React, { useState, useMemo } from 'react'

const CURRENCIES = ['ALL', 'USD', 'EUR', 'GBP', 'XAU', 'JPY', 'NZD']

const IMPACT_CONFIG = {
  HIGH:   { label: 'HIGH',   color: 'var(--red)',  bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  MEDIUM: { label: 'MED',    color: 'var(--gold)', bg: 'var(--gold-pale)',        border: 'var(--gold-ring)' },
  LOW:    { label: '',       color: 'var(--text-4)', bg: 'transparent',           border: 'transparent' },
}

function timeAgo(isoString) {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000
  if (diff < 60)   return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function toMoroccoTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString('fr-MA', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Africa/Casablanca',
    })
  } catch {
    return '??:??'
  }
}

function CurrencyTag({ code }) {
  const colors = {
    USD: 'var(--blue)',  EUR: '#60a5fa',  GBP: '#a78bfa',
    XAU: 'var(--gold)', JPY: '#f472b6',  NZD: 'var(--green)',
    AUD: '#34d399',     CAD: '#fbbf24',  CHF: '#e2e8f0',
    GENERAL: 'var(--text-4)',
  }
  const color = colors[code] || 'var(--text-3)'
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px',
      borderRadius: 4, background: `${color}18`, color, border: `1px solid ${color}30`,
      letterSpacing: '0.04em',
    }}>
      {code}
    </span>
  )
}

function NewsItem({ item }) {
  const impact = IMPACT_CONFIG[item.impact] || IMPACT_CONFIG.LOW
  const isHigh = item.impact === 'HIGH'
  const isMed  = item.impact === 'MEDIUM'

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 0',
      borderBottom: '1px solid var(--border)',
      background: isHigh ? 'rgba(248,113,113,0.04)' : 'transparent',
    }}>
      {/* Time */}
      <div style={{
        flexShrink: 0, width: 36, textAlign: 'right',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
        color: 'var(--text-3)', paddingTop: 2, lineHeight: 1.2,
      }}>
        {toMoroccoTime(item.timestamp)}
      </div>

      {/* Impact dot */}
      <div style={{ flexShrink: 0, paddingTop: 5 }}>
        {isHigh && <span style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 6px var(--red)' }} />}
        {isMed  && <span style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)' }} />}
        {!isHigh && !isMed && <span style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: 'var(--border-mid)' }} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.85rem', lineHeight: 1.4, marginBottom: 4,
          color: isHigh ? 'var(--text)' : 'var(--text-2)',
          fontWeight: isHigh ? 600 : 400,
        }}>
          {item.link ? (
            <a href={item.link} target="_blank" rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
              onMouseOver={e => e.target.style.textDecoration = 'underline'}
              onMouseOut={e => e.target.style.textDecoration = 'none'}
            >
              {item.title}
            </a>
          ) : item.title}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {isHigh && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4,
              background: impact.bg, color: impact.color, border: `1px solid ${impact.border}`,
              letterSpacing: '0.06em',
            }}>
              ⚡ HIGH
            </span>
          )}
          {isMed && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              background: impact.bg, color: impact.color, border: `1px solid ${impact.border}`,
            }}>
              MED
            </span>
          )}
          {item.currencies.filter(c => c !== 'GENERAL').map(c => (
            <CurrencyTag key={c} code={c} />
          ))}
          <span style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>
            {item.source} · {timeAgo(item.timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function NewsFeed({ news = [], inKillZone = false }) {
  const [filter, setFilter] = useState('ALL')

  const filtered = useMemo(() => {
    if (filter === 'ALL') return news
    return news.filter(n => n.currencies.includes(filter))
  }, [news, filter])

  const highCount = news.filter(n => n.impact === 'HIGH').length

  return (
    <div className="card" style={{ marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700 }}>Market News</span>
          {highCount > 0 && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(248,113,113,0.15)', color: 'var(--red)',
              border: '1px solid rgba(248,113,113,0.3)',
            }}>
              {highCount} HIGH
            </span>
          )}
          <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>ForexLive · FXStreet</span>
        </div>

        {/* Currency filter pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CURRENCIES.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s',
                background: filter === c ? 'var(--gold)' : 'var(--surface-3)',
                color: filter === c ? 'var(--bg)' : 'var(--text-3)',
                minHeight: 28,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* KZ + high news confluence warning */}
      {inKillZone && highCount > 0 && (
        <div style={{
          background: 'rgba(245,166,35,0.1)', border: '1px solid var(--gold-ring)',
          borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <div style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600 }}>
            HIGH CONFLUENCE — Kill Zone + {highCount} high-impact news event{highCount > 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* News list */}
      {filtered.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-4)', fontSize: '0.85rem' }}>
          {news.length === 0 ? 'Fetching news...' : `No ${filter} news right now`}
        </div>
      ) : (
        <div style={{ maxHeight: 480, overflowY: 'auto', WebkitOverflowScrolling: 'touch', marginRight: -4, paddingRight: 4 }}>
          {filtered.map(item => (
            <NewsItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
