import React, { useState, useEffect, useRef } from 'react'
import { useAlerts } from '../contexts/AlertContext'

/**
 * Bottom-sheet modal for push permission.
 *
 * Design decisions to survive mobile browsers (especially iOS Safari):
 *
 * 1. SELF-CONTAINED STATE — `open` lives locally, not in context.
 *    Nothing outside this component can flip it closed.
 *
 * 2. EFFECT-BASED OPEN — we open via useEffect, not during render,
 *    so the first paint completes before we show the sheet.
 *    This stops React's render-cycle side-effects from racing with state.
 *
 * 3. 700ms CLOSE GUARD — `canDismiss` ref starts false and flips true
 *    700ms after mount. Any dismiss call before that is ignored.
 *    Kills ghost-click / synthetic touch events that fire during page load.
 *
 * 4. NO BACKDROP INTERACTION — backdrop has pointer-events:none so it
 *    can never intercept touches and accidentally close the sheet.
 *
 * 5. iOS SAFARI GUARD — if Notification API is absent (iOS < 16.4) or
 *    permission already resolved, we never open.
 */
export default function PushPermissionModal() {
  const { requestPermission } = useAlerts()
  const [open, setOpen]       = useState(false)
  const canDismiss             = useRef(false)

  useEffect(() => {
    // Don't show if: browser doesn't support Notifications,
    // permission already resolved, or user already saw this modal.
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem('ta_push_modal_shown') === '1') return

    // Open after a single rAF so the initial paint lands first.
    const raf = requestAnimationFrame(() => setOpen(true))

    // Start the close-guard timer — no dismiss accepted for 700ms.
    const guard = setTimeout(() => { canDismiss.current = true }, 700)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(guard)
    }
  }, []) // intentionally run once on mount only

  function dismiss() {
    if (!canDismiss.current) return   // guard: ignore early close attempts
    localStorage.setItem('ta_push_modal_shown', '1')
    setOpen(false)
  }

  async function handleEnable() {
    localStorage.setItem('ta_push_modal_shown', '1')
    setOpen(false)
    await requestPermission()
  }

  if (!open) return null

  return (
    <>
      {/* Dim backdrop — purely visual, no pointer events */}
      <div
        aria-hidden="true"
        style={{
          position:      'fixed',
          inset:         0,
          background:    'rgba(0,0,0,0.55)',
          zIndex:        9000,
          pointerEvents: 'none',
        }}
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
          padding:      '2rem 1.5rem calc(2.5rem + env(safe-area-inset-bottom))',
          boxShadow:    '0 -8px 32px rgba(0,0,0,0.45)',
          textAlign:    'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔔</div>

        <h2
          id="push-modal-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700,
                   color: 'var(--color-text, #f0f0f0)' }}
        >
          Trade Alerts — Stay Notified
        </h2>

        <p style={{ margin: '0 0 1.75rem', fontSize: '0.9rem',
                    color: 'var(--color-text-muted, #9ca3af)', lineHeight: 1.55 }}>
          Get instant push notifications for STRONG signals, Kill Zone opens,
          and high-impact news — even when the app is closed.
          <br /><br />
          <strong style={{ color: 'var(--color-text, #f0f0f0)' }}>
            A test push fires immediately
          </strong>{' '}so you can confirm it works.
        </p>

        <button
          onClick={handleEnable}
          style={{
            display: 'block', width: '100%', padding: '0.9rem',
            background: 'var(--color-accent, #2563eb)', color: '#fff',
            border: 'none', borderRadius: '10px',
            fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
            marginBottom: '0.75rem',
            /* Prevents double-tap zoom on iOS */
            touchAction: 'manipulation',
          }}
        >
          Enable &amp; Send Test Notification
        </button>

        <button
          onClick={dismiss}
          style={{
            display: 'block', width: '100%', padding: '0.65rem',
            background: 'transparent',
            color: 'var(--color-text-muted, #9ca3af)',
            border: 'none', fontSize: '0.875rem', cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          Not now
        </button>
      </div>
    </>
  )
}
