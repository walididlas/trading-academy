import React from 'react'
import { useLocation } from 'react-router-dom'
import NotificationBell from '../NotificationBell'

const PAGE_TITLES = {
  '/':          'Dashboard',
  '/academy':   'Academy',
  '/signals':   'Live Signals',
  '/journal':   'Trade Journal',
  '/corrector': 'Trade Corrector',
  '/tools':     'Tools',
  '/assistant': 'AI Assistant',
}

function getTitle(pathname) {
  if (pathname.startsWith('/academy/module')) return 'Academy'
  return PAGE_TITLES[pathname] || 'Trading Academy'
}

export default function MobileHeader({ onMenuOpen }) {
  const location = useLocation()
  const title = getTitle(location.pathname)
  const isSignals = location.pathname === '/signals'

  return (
    <header className="mobile-header">
      <button className="mobile-header-menu" onClick={onMenuOpen} aria-label="Open menu">
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>

      <div className="mobile-header-title">
        {title}
        {isSignals && <span className="live-dot" />}
      </div>

      {/* Right slot — bell + TV status dot */}
      <div className="mobile-header-right">
        <NotificationBell />
        <div className="tv-status-dot" title="TradingView connected" />
      </div>
    </header>
  )
}
