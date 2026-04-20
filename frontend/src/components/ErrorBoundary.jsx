import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#07070d',
          color: '#e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: '2.5rem' }}>⚠️</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Something went wrong</div>
          <div style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            maxWidth: 480,
            lineHeight: 1.6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '12px 16px',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '12px 28px',
              background: '#f5a623',
              color: '#07070d',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
