import React from 'react'
import { useAlerts } from '../contexts/AlertContext'

/**
 * Bottom-sheet modal that auto-appears on first load (when permission is 'default'
 * and the user hasn't been asked yet). Clicking "Enable" calls requestPermission()
 * which satisfies iOS Safari's user-gesture requirement.
 */
export default function PushPermissionModal() {
  const { pushModalOpen, requestPermission, dismissPushModal } = useAlerts()

  if (!pushModalOpen) return null

  return (
    <>
      {/* Backdrop — visual only, not dismissible on click */}
      <div
        style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(0,0,0,0.5)',
          zIndex:         9000,
          pointerEvents:  'none',
        }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-modal-title"
        style={{
          position:     'fixed',
          bottom:       0,
          left:         0,
          right:        0,
          zIndex:       9001,
          background:   'var(--color-surface, #1e2130)',
          borderRadius: '20px 20px 0 0',
          padding:      '2rem 1.5rem 2.5rem',
          boxShadow:    '0 -8px 32px rgba(0,0,0,0.4)',
          textAlign:    'center',
          maxWidth:     480,
          margin:       '0 auto',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔔</div>

        <h2
          id="push-modal-title"
          style={{
            margin:     '0 0 0.5rem',
            fontSize:   '1.25rem',
            fontWeight: 700,
            color:      'var(--color-text, #f0f0f0)',
          }}
        >
          Trade Alerts — Stay Notified
        </h2>

        <p style={{
          margin:     '0 0 1.75rem',
          fontSize:   '0.9rem',
          color:      'var(--color-text-muted, #9ca3af)',
          lineHeight: 1.55,
        }}>
          Get instant push notifications for STRONG signals, Kill Zone opens,
          and high-impact news — even when the app is closed.
          <br /><br />
          <strong style={{ color: 'var(--color-text, #f0f0f0)' }}>A test notification will fire immediately</strong> so you can confirm it works.
        </p>

        <button
          onClick={requestPermission}
          style={{
            display:      'block',
            width:        '100%',
            padding:      '0.85rem',
            background:   'var(--color-accent, #2563eb)',
            color:        '#fff',
            border:       'none',
            borderRadius: '10px',
            fontSize:     '1rem',
            fontWeight:   700,
            cursor:       'pointer',
            marginBottom: '0.75rem',
          }}
        >
          Enable &amp; Send Test Notification
        </button>

        <button
          onClick={dismissPushModal}
          style={{
            display:    'block',
            width:      '100%',
            padding:    '0.65rem',
            background: 'transparent',
            color:      'var(--color-text-muted, #9ca3af)',
            border:     'none',
            fontSize:   '0.875rem',
            cursor:     'pointer',
          }}
        >
          Not now
        </button>
      </div>
    </>
  )
}
