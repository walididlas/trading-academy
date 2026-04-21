import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProgress } from '../../hooks/useProgress'
import { CURRICULUM } from '../../data/curriculum'

const NAV = [
  { path: '/',          icon: '⚡', label: 'Dashboard' },
  { path: '/academy',   icon: '📚', label: 'Academy' },
  { path: '/signals',   icon: '📡', label: 'Live Signals', badge: 'LIVE' },
  { path: '/assistant', icon: '🤖', label: 'AI Assistant' },
  { path: '/journal',   icon: '📓', label: 'Trade Journal' },
  { path: '/backtest',  icon: '📊', label: 'Backtesting' },
  { path: '/corrector', icon: '🎯', label: 'Trade Corrector' },
  { path: '/tools',     icon: '🛠️', label: 'Tools' },
]

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { getTotalProgress } = useProgress()
  const { done, total, pct } = getTotalProgress(CURRICULUM)

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      {/* Close button — mobile only */}
      <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
        ✕
      </button>

      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">📈</span>
        <div className="sidebar-logo-title">Trading Academy</div>
        <div className="sidebar-logo-sub">ICC Kill Zone Method</div>
      </div>

      {/* Progress */}
      <div className="sidebar-progress">
        <div className="sidebar-progress-row">
          <span className="sidebar-progress-label">Your Progress</span>
          <span className="sidebar-progress-pct">{pct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 5 }}>
          {done}/{total} lessons complete
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Navigation</div>
        {NAV.map(item => (
          <button
            key={item.path}
            className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => { navigate(item.path); onClose?.() }}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && (
              <span className={`sidebar-badge ${item.badge === 'LIVE' ? 'live' : ''}`}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-status">
          <span className="dot green" />
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>TradingView</span>
          <span style={{ color: 'var(--text-3)' }}>connected</span>
        </div>
        <div style={{ marginTop: 6, color: 'var(--text-4)', fontSize: '0.68rem' }}>
          ICC Kill Zone Scanner active
        </div>
      </div>
    </aside>
  )
}
