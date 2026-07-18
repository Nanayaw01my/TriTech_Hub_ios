import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

// OTA live updates (Capgo). Confirm this bundle booted OK so the updater keeps
// it; if a bad update ever fails to boot, the plugin auto-rolls back to the
// last good bundle. No-op on the web (plugin isn't implemented there).
import { CapacitorUpdater } from '@capgo/capacitor-updater'
CapacitorUpdater.notifyAppReady().catch(() => {})

// Register service worker for PWA (offline support + auto-updates)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // When a new SW version is waiting, reload all clients to activate it
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready — reload so users get the update automatically
            window.location.reload();
          }
        });
      });
    }).catch(() => {});
  });
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff1f0', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00' }}>App Error — please report this</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#333', fontSize: 13 }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerStyle={{ top: 60 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#1a1a1a',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          maxWidth: '340px',
        },
        success: { iconTheme: { primary: '#2E7D32', secondary: '#fff' } },
        error: { iconTheme: { primary: '#D32F2F', secondary: '#fff' } },
      }}
    />
  </ErrorBoundary>,
)
