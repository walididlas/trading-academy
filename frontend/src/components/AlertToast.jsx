import React from 'react'
import { useAlerts } from '../contexts/AlertContext'

export default function AlertToast() {
  const { toasts, dismiss } = useAlerts()
  if (!toasts.length) return null

  return (
    <div className="alert-toast-stack" aria-live="assertive" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`alert-toast alert-toast-${t.type}`}>
          <div className="alert-toast-icon">
            {t.type === 'killzone'    ? '⏰'
            : t.type === 'confluence' ? '⚡'
            : t.type === 'warning'    ? '⚠️'
            : t.signal?.type === 'long' ? '▲' : '▼'}
          </div>
          <div className="alert-toast-body">
            <div className="alert-toast-title">{t.title}</div>
            <div className="alert-toast-sub">{t.body}</div>
          </div>
          <button
            className="alert-toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
