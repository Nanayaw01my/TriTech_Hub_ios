import { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    let backTimer
    const goOnline = () => {
      setIsOnline(true)
      setShowBack(true)
      backTimer = setTimeout(() => setShowBack(false), 3000)
    }
    const goOffline = () => {
      setIsOnline(false)
      setShowBack(false)
      clearTimeout(backTimer)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearTimeout(backTimer)
    }
  }, [])

  if (isOnline && !showBack) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10001,
      padding: '10px 16px',
      background: isOnline ? '#166534' : '#7F1D1D',
      color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      fontSize: '13px', fontWeight: '600',
      transition: 'background 0.3s ease',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      {isOnline ? (
        <>
          <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Back online
        </>
      ) : (
        <>
          <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M4.929 4.929l14.142 14.142M8.464 8.464A5 5 0 008 12" />
          </svg>
          No internet connection — check your network
        </>
      )}
    </div>
  )
}
