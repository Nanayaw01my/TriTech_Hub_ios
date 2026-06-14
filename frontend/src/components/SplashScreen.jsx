import React, { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0) // 0 = visible, 1 = fading
  const [progress, setProgress] = useState(0)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    const TOTAL = 9400
    const startTime = Date.now()

    const interval = setInterval(() => {
      const pct = Math.min(((Date.now() - startTime) / TOTAL) * 100, 100)
      setProgress(pct)
    }, 50)

    const fadeTimer = setTimeout(() => setPhase(1), 9400)
    const doneTimer = setTimeout(() => onDone(), 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#0b1410',
        opacity: phase === 1 ? 0 : 1,
        transition: 'opacity 0.6s ease-in-out',
        pointerEvents: phase === 1 ? 'none' : 'all',
      }}
    >
      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-15%',
        width: '55%', paddingBottom: '55%', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(46,125,50,0.18) 0%, transparent 65%)',
        animation: 'sGlowA 5s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-15%',
        width: '50%', paddingBottom: '50%', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(27,94,32,0.14) 0%, transparent 65%)',
        animation: 'sGlowB 5s 2.5s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '40%', left: '40%',
        width: '30%', paddingBottom: '30%', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(76,175,80,0.06) 0%, transparent 70%)',
        animation: 'sGlowA 7s 1s ease-in-out infinite',
      }} />

      {/* Logo card with ring */}
      <div style={{ position: 'relative', marginBottom: '2rem', animation: 'sPop 0.9s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
        {/* Outer pulse ring */}
        <div style={{
          position: 'absolute', top: '-12px', bottom: '-12px', left: '-14px', right: '-14px',
          borderRadius: '28px',
          border: '1.5px solid rgba(76,175,80,0.35)',
          animation: 'sRing 2.4s ease-in-out infinite',
        }} />
        {/* Second ring */}
        <div style={{
          position: 'absolute', top: '-22px', bottom: '-22px', left: '-24px', right: '-24px',
          borderRadius: '36px',
          border: '1px solid rgba(76,175,80,0.12)',
          animation: 'sRing 2.4s 0.4s ease-in-out infinite',
        }} />

        {/* Logo card — landscape 16:9 to match logo aspect ratio */}
        <div style={{
          width: '220px', height: '123px',
          borderRadius: '18px',
          border: '1px solid rgba(76,175,80,0.22)',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          {logoError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ color: '#4CAF50', fontSize: '34px', fontWeight: '900', letterSpacing: '-1px', lineHeight: 1 }}>TH</span>
              <span style={{ color: 'rgba(76,175,80,0.5)', fontSize: '9px', fontWeight: '700', letterSpacing: '2px' }}>iOS</span>
            </div>
          ) : (
            <img
              src="/logo.png"
              alt="TriTech Hub"
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoError(true)}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                display: 'block',
                opacity: logoLoaded ? 1 : 0,
                transition: 'opacity 0.35s ease',
              }}
            />
          )}
          {!logoLoaded && !logoError && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
            }}>
              <span style={{ color: '#4CAF50', fontSize: '34px', fontWeight: '900', letterSpacing: '-1px', lineHeight: 1 }}>TH</span>
              <span style={{ color: 'rgba(76,175,80,0.5)', fontSize: '9px', fontWeight: '700', letterSpacing: '2px' }}>iOS</span>
            </div>
          )}
        </div>
      </div>

      {/* App name */}
      <div style={{
        textAlign: 'center',
        animation: 'sSlideUp 0.65s 0.3s ease-out both',
        padding: '0 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <h1 style={{
          margin: 0,
          fontWeight: '900',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: 'white',
        }}>
          <span style={{ display: 'block', fontSize: 'clamp(1.6rem, 7vw, 2.5rem)' }}>
            TriTech Hub
          </span>
          <span style={{
            display: 'block',
            fontSize: 'clamp(2rem, 9vw, 3.25rem)',
            background: 'linear-gradient(135deg, #4CAF50 30%, #81C784 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>iOS</span>
        </h1>
        <p style={{
          marginTop: '0.5rem',
          color: 'rgba(255,255,255,0.38)',
          fontSize: '0.7rem',
          fontWeight: '600',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          iPhone Installment Management
        </p>
      </div>

      {/* Pill badge */}
      <div style={{
        marginTop: '1.75rem',
        padding: '5px 14px',
        background: 'rgba(76,175,80,0.1)',
        border: '1px solid rgba(76,175,80,0.22)',
        borderRadius: '100px',
        animation: 'sSlideUp 0.65s 0.48s ease-out both',
      }}>
        <span style={{ color: '#66BB6A', fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em' }}>
          Powered by Ittek Solutions
        </span>
      </div>

      {/* Bottom progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
        background: 'rgba(255,255,255,0.04)',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #1B5E20, #2E7D32, #4CAF50)',
          transition: 'width 0.05s linear',
          boxShadow: '0 0 10px rgba(76,175,80,0.7)',
        }} />
      </div>

      <style>{`
        @keyframes sPop {
          0%   { transform: scale(0.45) rotate(-8deg); opacity: 0; }
          60%  { transform: scale(1.05) rotate(1deg);  opacity: 1; }
          100% { transform: scale(1) rotate(0deg);     opacity: 1; }
        }
        @keyframes sSlideUp {
          0%   { transform: translateY(22px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
        @keyframes sGlowA {
          0%, 100% { transform: scale(1) translate(0,0);     opacity: 0.7; }
          50%       { transform: scale(1.15) translate(2%,2%); opacity: 1; }
        }
        @keyframes sGlowB {
          0%, 100% { transform: scale(1) translate(0,0);       opacity: 0.6; }
          50%       { transform: scale(1.1) translate(-2%,-2%); opacity: 1; }
        }
        @keyframes sRing {
          0%, 100% { transform: scale(1);    opacity: 0.5; }
          50%       { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
