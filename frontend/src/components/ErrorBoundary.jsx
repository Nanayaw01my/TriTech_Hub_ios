import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#f9fafb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '20rem', width: '100%' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#FEF2F2', margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg style={{ width: '32px', height: '32px', color: '#EF4444' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 style={{ fontWeight: '800', fontSize: '1.25rem', color: '#111827', marginBottom: '0.5rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              An unexpected error occurred. Refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '0.875rem',
                background: '#1B5E20', color: 'white',
                fontWeight: '700', borderRadius: '1rem',
                border: 'none', cursor: 'pointer', fontSize: '0.9rem',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
