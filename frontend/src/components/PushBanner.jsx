import React from 'react'
import { useAlerts } from '../contexts/AlertContext'

/**
 * Sticky banner shown at the top of every page when the user hasn't subscribed
 * to push notifications with the current VAPID key.
 *
 * Three states:
 *  - permission 'default'  → "Enable Push Notifications" button
 *  - permission 'denied'   → instructions to unblock in browser settings
 *  - permission 'granted' but pushSubscribed false → "Reactivate" button
 *    (this resolves automatically as _subscribeToPush runs on mount)
 */
export default function PushBanner() {
  const { permission, pushSubscribed, requestPermission } = useAlerts()

  // Nothing to show: already subscribed, or browser doesn't support it
  if (pushSubscribed) return null
  if (permission === 'unsupported') return null

  const denied = permission === 'denied'

  return (
    <div style={{
      position:       'sticky',
      top:            0,
      zIndex:         1000,
      background:     denied ? 'var(--color-warning, #b45309)' : 'var(--color-accent, #2563eb)',
      color:          '#fff',
      display:        'flex',
      alignItems:     'center',
      gap:            '0.75rem',
      padding:        '0.6rem 1.1rem',
      fontSize:       '0.85rem',
      fontWeight:     500,
      lineHeight:     1.4,
      boxShadow:      '0 2px 6px rgba(0,0,0,0.25)',
    }}>
      <span style={{ fontSize: '1.1rem' }}>{denied ? '🔕' : '🔔'}</span>

      <span style={{ flex: 1 }}>
        {denied
          ? 'Push notifications are blocked. To receive trade alerts, open your browser settings and allow notifications for this site.'
          : 'Enable push notifications to receive trade signals, TP/SL alerts, and kill-zone warnings — even when the app is closed.'
        }
      </span>

      {!denied && (
        <button
          onClick={requestPermission}
          style={{
            flexShrink:     0,
            background:     'rgba(255,255,255,0.2)',
            border:         '1px solid rgba(255,255,255,0.5)',
            color:          '#fff',
            borderRadius:   '6px',
            padding:        '0.35rem 0.9rem',
            cursor:         'pointer',
            fontWeight:     600,
            fontSize:       '0.82rem',
            whiteSpace:     'nowrap',
            transition:     'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.32)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        >
          Enable Now
        </button>
      )}
    </div>
  )
}
