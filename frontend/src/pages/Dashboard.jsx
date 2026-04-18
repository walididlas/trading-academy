import React, { useState, useEffect, useMemo } from 'react'
import { API_BASE } from '../config'
import { useNavigate } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'
import { CURRICULUM, getTotalLessons } from '../data/curriculum'
import { useAlerts } from '../contexts/AlertContext'
import { useCalendar } from '../hooks/useCalendar'
import NewsTicker from '../components/NewsTicker'

function isInKillZone() {
  const t = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  return (t >= 9 * 60 && t < 12 * 60) || (t >= 14 * 60 + 30 && t < 17 * 60 + 30)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { progress, getTotalProgress, getModuleProgress } = useProgress()
  const { done, total, pct } = getTotalProgress(CURRICULUM)
  const { signals: ctxSignals, news } = useAlerts()
  const { nextHighEvent } = useCalendar()
  const [tvStatus, setTvStatus] = useState(null)
  const [localSignals, setLocalSignals] = useState([])

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(r => r.json()).then(setTvStatus).catch(() => {})
    fetch(`${API_BASE}/api/signals`)
      .then(r => r.json()).then(d => setLocalSignals(d.signals || [])).catch(() => {})
  }, [])

  const signals = ctxSignals.length ? ctxSignals : localSignals
  const activeSignals = signals.filter(s => s.type !== 'waiting')
  const nextModule = CURRICULUM.find(m => getModuleProgress(m).pct < 100)

  const inKZ = isInKillZone()
  const recentHighNews = useMemo(() =>
    news.filter(n => n.impact === 'HIGH' && (Date.now() - new Date(n.timestamp).getTime()) < 30 * 60 * 1000),
  [news])
  const showConfluence = inKZ && recentHighNews.length > 0

  return (
    <div className="page fade-in">
      {/* Live news ticker — pinned above page header */}
      {(news.length > 0 || nextHighEvent) && <NewsTicker news={news} nextHighEvent={nextHighEvent} />}

      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back. Your trading education at a glance.</p>
      </div>

      {/* HIGH CONFLUENCE banner */}
      {showConfluence && (
        <div className="confluence-banner">
          <div className="confluence-banner-icon">⚡</div>
          <div className="confluence-banner-text">
            <strong>HIGH CONFLUENCE — Trade with extra caution</strong>
            <span>Kill Zone active + {recentHighNews.length} high-impact news event{recentHighNews.length > 1 ? 's' : ''} in last 30min</span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Course Progress</div>
          <div className="stat-value gold">{pct}%</div>
          <div style={{ marginTop: 8 }}>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="stat-sub">{done}/{total} lessons complete</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total XP</div>
          <div className="stat-value gold">{progress.totalXP.toLocaleString()}</div>
          <div className="stat-sub">Keep studying to earn more</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Study Streak</div>
          <div className="stat-value" style={{ color: progress.streak > 0 ? 'var(--green)' : 'var(--text-3)' }}>
            {progress.streak}🔥
          </div>
          <div className="stat-sub">{progress.streak > 0 ? 'days in a row' : 'Start studying today'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Live Signals</div>
          <div className={`stat-value ${activeSignals.length > 0 ? 'green' : ''}`} style={{ color: activeSignals.length === 0 ? 'var(--text-3)' : undefined }}>
            {activeSignals.length}
          </div>
          <div className="stat-sub">
            {tvStatus?.connected ? <span style={{ color: 'var(--green)' }}>● TradingView connected</span> : <span style={{ color: 'var(--red)' }}>● TradingView offline</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Continue learning */}
        {nextModule && (
          <div className="card-gold" style={{ cursor: 'pointer' }} onClick={() => navigate(`/academy/module/${nextModule.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: '2rem' }}>{nextModule.icon}</span>
              <span className="tag tag-gold">Continue</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Module {CURRICULUM.indexOf(nextModule) + 1}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>{nextModule.title}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 14 }}>{nextModule.description}</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${getModuleProgress(nextModule).pct}%` }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 6 }}>
              {getModuleProgress(nextModule).done}/{getModuleProgress(nextModule).total} lessons
            </div>
          </div>
        )}

        {/* Live signal preview */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700 }}>Live Signal Status</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/signals')}>View all →</button>
          </div>
          {signals.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="empty-state-icon">📡</div>
              <div className="empty-state-title">Scanning markets...</div>
              <div className="empty-state-text">Backend connecting to TradingView</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {signals.slice(0, 3).map(s => (
                <div key={s.pair} className={`signal-card ${s.type}`} style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="signal-pair">{s.pair}</span>
                    <span className={`signal-direction ${s.type}`}>{s.type === 'waiting' ? 'WATCHING' : s.type.toUpperCase()}</span>
                  </div>
                  {s.type !== 'waiting' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: 4 }}>{s.reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modules overview */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 16 }}>All Modules</div>
        <div className="grid-3">
          {CURRICULUM.map((mod, i) => {
            const mp = getModuleProgress(mod)
            return (
              <div
                key={mod.id}
                className={`module-card ${mp.pct === 100 ? 'completed' : ''}`}
                onClick={() => navigate(`/academy/module/${mod.id}`)}
              >
                <div className="module-card-accent" style={{ background: mod.color }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: '1.5rem' }}>{mod.icon}</span>
                  {mp.pct === 100 ? <span className="tag tag-green">✓ Done</span> : mp.pct > 0 ? <span className="tag tag-gold">{mp.pct}%</span> : <span className="tag tag-gray">{mp.total} lessons</span>}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 2 }}>Module {i + 1}</div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4 }}>{mod.title}</div>
                {mp.pct > 0 && mp.pct < 100 && (
                  <div className="progress-track" style={{ marginTop: 10 }}>
                    <div className="progress-fill" style={{ width: `${mp.pct}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
