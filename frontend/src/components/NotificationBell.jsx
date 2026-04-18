import React, { useState, useRef } from 'react'
import { useAlerts } from '../contexts/AlertContext'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function typeIcon(type) {
  switch (type) {
    case 'signal':     return '📡'
    case 'killzone':   return '⏰'
    case 'confluence': return '⚡'
    case 'warning':    return '⛔'
    default:           return '🔔'
  }
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ pointerEvents: 'none', display: 'block' }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

export default function NotificationBell() {
  const { permission, requestPermission, alertHistory, unreadCount, markRead } = useAlerts()
  const [sheet, setSheet]         = useState(null) // null | 'history' | 'permission'
  const buttonRef = useRef(null)

  const granted     = permission === 'granted'
  const denied      = permission === 'denied'
  const unsupported = permission === 'unsupported'
  const hasUnread   = unreadCount > 0

  function openHistory() {
    markRead()
    setSheet('history')
  }

  function handleBellClick() {
    if (unsupported) return
    if (granted) { openHistory(); return }
    setSheet('permission')
  }

  async function handleEnableClick() {
    setSheet(null)
    const result = await requestPermission()
    if (result === 'granted') openHistory()
  }

  function closeSheet() { setSheet(null) }

  const recent = alertHistory.slice(0, 5)

  return (
    <>
      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        ref={buttonRef}
        className={`notif-bell ${granted ? 'enabled' : ''}`}
        onClick={handleBellClick}
        aria-label={granted ? 'Notifications' : 'Enable notifications'}
      >
        <BellIcon />

        {granted && !hasUnread && <span className="notif-bell-badge notif-bell-badge--green" />}
        {granted && hasUnread  && <span className="notif-bell-badge notif-bell-badge--red" />}
        {!granted && !unsupported && <span className="notif-bell-dot" />}
      </button>

      {/* ── Bottom sheet overlay — covers full screen, click backdrop to close ── */}
      {sheet !== null && (
        <div className="notif-sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeSheet() }}>

          {/* ── Alert history sheet ── */}
          {sheet === 'history' && (
            <div className="notif-sheet">
              <div className="notif-sheet-handle" />

              <div className="notif-sheet-header">
                <span className="notif-sheet-title">Recent Alerts</span>
                <button className="notif-sheet-close" onClick={closeSheet} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {recent.length === 0 ? (
                <div className="notif-sheet-empty">
                  <span style={{ fontSize: '2rem' }}>🔕</span>
                  <p>No alerts yet this session</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 4 }}>
                    Alerts appear here when signals, Kill Zones, or high-impact news fire
                  </p>
                </div>
              ) : (
                <div className="notif-sheet-list">
                  {recent.map((item) => (
                    <div key={item.id} className={`notif-sheet-item notif-item-${item.type}`}>
                      <span className="notif-item-icon">{typeIcon(item.type)}</span>
                      <div className="notif-item-body">
                        <div className="notif-item-title">{item.title}</div>
                        {item.body && <div className="notif-item-desc">{item.body}</div>}
                      </div>
                      <span className="notif-item-time">{timeAgo(item.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Permission / blocked sheet ── */}
          {sheet === 'permission' && (
            <div className="notif-sheet notif-sheet--center">
              <div className="notif-sheet-handle" />
              <div className="notif-modal-icon">🔔</div>

              {denied ? (
                <>
                  <div className="notif-modal-title">Notifications Blocked</div>
                  <div className="notif-modal-body">
                    You previously blocked notifications. Open your browser's site settings,
                    allow notifications for this site, then reload the page.
                  </div>
                  <button className="notif-modal-btn-primary" onClick={closeSheet}>Got it</button>
                </>
              ) : (
                <>
                  <div className="notif-modal-title">Enable Alerts</div>
                  <div className="notif-modal-body">
                    Get instant push notifications for new signals, Kill Zone opens, and
                    high-impact news events.
                  </div>
                  <button className="notif-modal-btn-primary" onClick={handleEnableClick}>
                    Enable Notifications
                  </button>
                  <button className="notif-modal-btn-secondary" onClick={closeSheet}>
                    Not Now
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      )}
    </>
  )
}
