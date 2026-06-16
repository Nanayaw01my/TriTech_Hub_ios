import React, { useEffect, useState } from 'react'

const PARTICLES = [
  { id: 0, x: 12,  y: 18,  s: 2.5, delay: 0,   dur: 6   },
  { id: 1, x: 82,  y: 12,  s: 1.5, delay: 1.2, dur: 5   },
  { id: 2, x: 72,  y: 78,  s: 3,   delay: 0.5, dur: 7   },
  { id: 3, x: 22,  y: 82,  s: 2,   delay: 2,   dur: 5.5 },
  { id: 4, x: 92,  y: 48,  s: 1.5, delay: 0.8, dur: 6.5 },
  { id: 5, x: 8,   y: 58,  s: 2,   delay: 1.5, dur: 5   },
  { id: 6, x: 50,  y: 8,   s: 1,   delay: 2.5, dur: 7   },
  { id: 7, x: 62,  y: 92,  s: 2.5, delay: 0.3, dur: 6   },
  { id: 8, x: 38,  y: 42,  s: 1,   delay: 1.8, dur: 8   },
  { id: 9, x: 88,  y: 28,  s: 2,   delay: 0.6, dur: 5.5 },
  { id: 10, x: 30, y: 65,  s: 1.5, delay: 3,   dur: 6   },
  { id: 11, x: 55, y: 5,   s: 1,   delay: 1,   dur: 7.5 },
]

const WARP_STREAKS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  angle: i * 18,
  delay: (i * 0.07).toFixed(2),
  dur: (1.6 + (i % 5) * 0.2).toFixed(1),
  len: 55 + (i % 7) * 18,
  opacity: 0.08 + (i % 3) * 0.06,
}))

export default function SplashScreen({ onDone }) {
  const [phase, setPhase]           = useState(0)
  const [progress, setProgress]     = useState(0)
  const [pct, setPct]               = useState(0)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [logoError, setLogoError]   = useState(false)

  useEffect(() => {
    const TOTAL = 4400
    const startTime = Date.now()

    const interval  = setInterval(() => {
      const p = Math.min(((Date.now() - startTime) / TOTAL) * 100, 100)
      setProgress(p)
      setPct(Math.floor(p))
    }, 50)

    const fadeTimer = setTimeout(() => setPhase(1), 4400)
    const doneTimer = setTimeout(() => onDone(), 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      background: '#060d09',
      opacity: phase === 1 ? 0 : 1,
      transition: 'opacity 0.6s ease-in-out',
      pointerEvents: phase === 1 ? 'none' : 'all',
      perspective: '1200px',
    }}>
      <style>{`
        @keyframes sp-coinFlip {
          0%   { transform: perspective(1100px) translateZ(-600px) rotateY(-720deg) scale(0.3); opacity: 0; }
          55%  { opacity: 1; }
          75%  { transform: perspective(1100px) translateZ(22px)   rotateY(12deg)  scale(1.04); opacity: 1; }
          90%  { transform: perspective(1100px) translateZ(-6px)   rotateY(-4deg)  scale(0.98); opacity: 1; }
          100% { transform: perspective(1100px) translateZ(0)      rotateY(0deg)   scale(1);    opacity: 1; }
        }
        @keyframes sp-float {
          0%,100% { transform: translateY(0px)  rotateX(0deg)    rotateY(0deg); }
          25%      { transform: translateY(-9px) rotateX(2deg)    rotateY(-2deg); }
          75%      { transform: translateY(-4px) rotateX(-1.5deg) rotateY(2.5deg); }
        }
        @keyframes sp-orbit1 {
          from { transform: rotateX(74deg) rotateZ(0deg); }
          to   { transform: rotateX(74deg) rotateZ(360deg); }
        }
        @keyframes sp-orbit2 {
          from { transform: rotateX(55deg) rotateY(25deg) rotateZ(0deg); }
          to   { transform: rotateX(55deg) rotateY(25deg) rotateZ(-360deg); }
        }
        @keyframes sp-orbit3 {
          from { transform: rotateX(82deg) rotateY(-15deg) rotateZ(0deg); }
          to   { transform: rotateX(82deg) rotateY(-15deg) rotateZ(360deg); }
        }
        @keyframes sp-orbit4 {
          from { transform: rotateX(40deg) rotateY(60deg) rotateZ(0deg); }
          to   { transform: rotateX(40deg) rotateY(60deg) rotateZ(360deg); }
        }
        @keyframes sp-satellite {
          0%,100% { box-shadow: 0 0 6px 2px rgba(76,175,80,0.9); }
          50%      { box-shadow: 0 0 12px 4px rgba(76,175,80,1), 0 0 24px 8px rgba(76,175,80,0.4); }
        }
        @keyframes sp-textIn {
          0%   { transform: perspective(700px) translateZ(-120px) translateY(28px); opacity: 0; }
          100% { transform: perspective(700px) translateZ(0)      translateY(0);    opacity: 1; }
        }
        @keyframes sp-badgeIn {
          0%   { transform: translateY(20px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0)    scale(1);   opacity: 1; }
        }
        @keyframes sp-particle {
          0%,100% { transform: translateY(0)    translateX(0);    opacity: 0.35; }
          33%      { transform: translateY(-20px) translateX(10px); opacity: 0.75; }
          66%      { transform: translateY(-9px)  translateX(-7px); opacity: 0.5;  }
        }
        @keyframes sp-glow {
          0%,100% { opacity: 0.14; transform: scale(1);    }
          50%      { opacity: 0.28; transform: scale(1.1);  }
        }
        @keyframes sp-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes sp-ringPulse {
          0%,100% { opacity: 0.3; }
          50%      { opacity: 0.7; }
        }
        @keyframes sp-iosShimmer {
          0%,100% { background-position: 0% center;    }
          50%      { background-position: 100% center;  }
        }
        @keyframes sp-scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(400%);  }
        }
        @keyframes sp-warpLine {
          0%   { transform: scaleX(0) translateX(0);   opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: scaleX(1) translateX(0);   opacity: 0; }
        }
        @keyframes sp-bracketIn {
          0%   { opacity: 0; transform: scale(1.4); }
          60%  { transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes sp-cornerPulse {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1;   box-shadow: 0 0 8px rgba(76,175,80,0.9); }
        }
        @keyframes sp-gridShift {
          0%   { background-position: 0 0; }
          100% { background-position: 0 40px; }
        }
        @keyframes sp-hudIn {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes sp-hudTick {
          0%,100% { text-shadow: 0 0 8px rgba(76,175,80,0.6); }
          50%      { text-shadow: 0 0 18px rgba(76,175,80,1), 0 0 36px rgba(76,175,80,0.4); }
        }
      `}</style>

      {/* ── Holographic tron floor grid ── */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: '-20%', right: '-20%',
        height: '38%',
        transform: 'perspective(250px) rotateX(65deg)',
        transformOrigin: 'bottom center',
        backgroundImage: [
          'linear-gradient(to right, rgba(76,175,80,0.12) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgba(76,175,80,0.12) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '40px 40px',
        animation: 'sp-gridShift 1.2s linear infinite',
        maskImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 75%)',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 75%)',
        pointerEvents: 'none',
      }} />

      {/* ── Warp streaks (radiate from center) ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {WARP_STREAKS.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: `${s.len}px`,
            height: '1px',
            transformOrigin: 'left center',
            transform: `rotate(${s.angle}deg)`,
          }}>
            <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(to right, rgba(76,175,80,${s.opacity}), rgba(76,175,80,0))`,
              transformOrigin: 'left center',
              animation: `sp-warpLine ${s.dur}s ${s.delay}s ease-out infinite`,
            }} />
          </div>
        ))}
      </div>

      {/* ── Ambient background orbs ── */}
      {[
        { top: '-18%', right: '-18%', w: '68%', color: 'rgba(46,125,50,0.22)', delay: '0s', dur: '7s' },
        { bottom: '-14%', left: '-18%', w: '62%', color: 'rgba(27,94,32,0.18)', delay: '3.5s', dur: '7s' },
        { top: '38%', left: '28%', w: '42%', color: 'rgba(76,175,80,0.08)', delay: '1.5s', dur: '9s' },
      ].map((o, i) => (
        <div key={i} style={{
          position: 'absolute',
          ...o,
          paddingBottom: o.w,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color} 0%, transparent 65%)`,
          animation: `sp-glow ${o.dur} ${o.delay} ease-in-out infinite`,
        }} />
      ))}

      {/* ── Floating particles ── */}
      {PARTICLES.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: `${p.s}px`, height: `${p.s}px`,
          borderRadius: '50%',
          background: 'rgba(76,175,80,0.8)',
          boxShadow: `0 0 ${p.s * 3}px rgba(76,175,80,0.6)`,
          animation: `sp-particle ${p.dur}s ${p.delay}s ease-in-out infinite`,
        }} />
      ))}

      {/* ── 3D logo area ── */}
      <div style={{
        position: 'relative',
        marginBottom: '2.25rem',
        animation: 'sp-float 5.5s 1.5s ease-in-out infinite',
        transformStyle: 'preserve-3d',
      }}>
        {/* Orbital rings with satellites */}
        {[
          { w: 310, anim: 'sp-orbit1 7s linear infinite',          pulse: 'sp-ringPulse 3s ease-in-out infinite',           border: '1.5px solid rgba(76,175,80,0.42)', shadow: '0 0 14px rgba(76,175,80,0.18)',  satDelay: '0s' },
          { w: 260, anim: 'sp-orbit2 11s linear infinite reverse',  pulse: 'sp-ringPulse 3s 1.5s ease-in-out infinite',      border: '1px solid rgba(76,175,80,0.25)',   shadow: 'none',                           satDelay: '0.4s' },
          { w: 360, anim: 'sp-orbit3 16s linear infinite',          pulse: 'sp-ringPulse 4s 0.8s ease-in-out infinite',      border: '0.75px solid rgba(76,175,80,0.14)', shadow: 'none',                           satDelay: '0.8s' },
          { w: 420, anim: 'sp-orbit4 22s linear infinite reverse',  pulse: 'sp-ringPulse 5s 2s ease-in-out infinite',        border: '0.5px solid rgba(76,175,80,0.08)',  shadow: 'none',                           satDelay: '1.2s' },
        ].map((r, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: `${r.w}px`, height: `${r.w}px`,
            marginTop: `-${r.w / 2}px`, marginLeft: `-${r.w / 2}px`,
            border: r.border,
            borderRadius: '50%',
            boxShadow: r.shadow,
            animation: `${r.anim}, ${r.pulse}`,
          }}>
            {/* Satellite dot riding the ring */}
            <div style={{
              position: 'absolute',
              top: '-3px', left: '50%',
              width: '6px', height: '6px',
              marginLeft: '-3px',
              borderRadius: '50%',
              background: '#4CAF50',
              animation: `sp-satellite 2s ${r.satDelay} ease-in-out infinite`,
            }} />
          </div>
        ))}

        {/* Card coin-flip entrance */}
        <div style={{ animation: 'sp-coinFlip 1.6s cubic-bezier(0.22,1,0.36,1) forwards', opacity: 0, position: 'relative' }}>
          {/* Corner scanner brackets */}
          {[
            { top: '-10px', left: '-10px', borderTop: '2px solid #4CAF50', borderLeft: '2px solid #4CAF50',   borderRadius: '4px 0 0 0' },
            { top: '-10px', right: '-10px', borderTop: '2px solid #4CAF50', borderRight: '2px solid #4CAF50',  borderRadius: '0 4px 0 0' },
            { bottom: '-10px', left: '-10px', borderBottom: '2px solid #4CAF50', borderLeft: '2px solid #4CAF50', borderRadius: '0 0 0 4px' },
            { bottom: '-10px', right: '-10px', borderBottom: '2px solid #4CAF50', borderRight: '2px solid #4CAF50', borderRadius: '0 0 4px 0' },
          ].map((c, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: '16px', height: '16px',
              ...c,
              zIndex: 10,
              animation: `sp-bracketIn 0.8s ${0.9 + i * 0.07}s ease-out both, sp-cornerPulse 2.5s ${1.5 + i * 0.1}s ease-in-out infinite`,
            }} />
          ))}

          {/* Glow halo */}
          <div style={{
            position: 'absolute', top: '-20px', bottom: '-20px', left: '-22px', right: '-22px',
            borderRadius: '34px',
            background: 'radial-gradient(ellipse, rgba(76,175,80,0.22) 0%, transparent 68%)',
            filter: 'blur(10px)',
            pointerEvents: 'none',
          }} />

          {/* The card */}
          <div style={{
            width: '230px', height: '107px',
            borderRadius: '18px',
            border: '1px solid rgba(76,175,80,0.35)',
            overflow: 'hidden',
            position: 'relative',
            background: '#0a1a0d',
            boxShadow: [
              '0 40px 100px rgba(0,0,0,0.75)',
              '0 0 0 1px rgba(255,255,255,0.04)',
              'inset 0 1px 0 rgba(255,255,255,0.07)',
              '0 0 50px rgba(76,175,80,0.18)',
              '0 0 120px rgba(76,175,80,0.08)',
            ].join(', '),
          }}>
            {/* Scan line sweep */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 3, overflow: 'hidden', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', left: 0, right: 0, height: '30%',
                background: 'linear-gradient(180deg, transparent, rgba(76,175,80,0.06), transparent)',
                animation: 'sp-scanline 3s 1.6s ease-in-out infinite',
              }} />
            </div>

            {/* Shimmer overlay */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
              background: 'linear-gradient(105deg, transparent 30%, rgba(76,175,80,0.07) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'sp-shimmer 3.5s 2s ease-in-out infinite',
            }} />

            {logoError ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: '2px', position: 'relative', zIndex: 1,
              }}>
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
                  position: 'absolute', inset: 0, zIndex: 1,
                  width: '100%', height: '100%',
                  objectFit: 'cover', display: 'block',
                  opacity: logoLoaded ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                }}
              />
            )}

            {!logoLoaded && !logoError && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '2px',
              }}>
                <span style={{ color: '#4CAF50', fontSize: '34px', fontWeight: '900', letterSpacing: '-1px', lineHeight: 1 }}>TH</span>
                <span style={{ color: 'rgba(76,175,80,0.5)', fontSize: '9px', fontWeight: '700', letterSpacing: '2px' }}>iOS</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── App name — 3D text reveal ── */}
      <div style={{
        textAlign: 'center',
        padding: '0 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
        animation: 'sp-textIn 0.9s 0.55s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <h1 style={{ margin: 0, fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          <span style={{
            display: 'block',
            fontSize: 'clamp(1.6rem, 7vw, 2.5rem)',
            color: 'white',
            textShadow: '0 2px 30px rgba(0,0,0,0.6), 0 0 60px rgba(76,175,80,0.1)',
          }}>
            TriTech Hub
          </span>
          <span style={{
            display: 'block',
            fontSize: 'clamp(2rem, 9vw, 3.25rem)',
            background: 'linear-gradient(135deg, #388E3C 0%, #4CAF50 35%, #A5D6A7 60%, #4CAF50 80%, #2E7D32 100%)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'sp-iosShimmer 4s 2s ease-in-out infinite',
            filter: [
              'drop-shadow(1px 2px 0 rgba(27,94,32,0.9))',
              'drop-shadow(2px 4px 0 rgba(27,94,32,0.6))',
              'drop-shadow(3px 6px 0 rgba(0,0,0,0.4))',
              'drop-shadow(0 0 30px rgba(76,175,80,0.7))',
            ].join(' '),
          }}>
            iOS
          </span>
        </h1>
        <p style={{
          marginTop: '0.55rem',
          color: 'rgba(255,255,255,0.32)',
          fontSize: '0.68rem',
          fontWeight: '600',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}>
          iPhone Installment Management
        </p>
      </div>

      {/* ── Badge ── */}
      <div style={{
        marginTop: '1.75rem',
        padding: '5px 16px',
        background: 'rgba(76,175,80,0.07)',
        border: '1px solid rgba(76,175,80,0.18)',
        borderRadius: '100px',
        animation: 'sp-badgeIn 0.7s 1.1s ease-out both',
        boxShadow: '0 0 24px rgba(76,175,80,0.07)',
      }}>
        <span style={{ color: '#66BB6A', fontSize: '11px', fontWeight: '700', letterSpacing: '0.07em' }}>
          Powered by Ittek Solutions
        </span>
      </div>

      {/* ── HUD percentage counter ── */}
      <div style={{
        position: 'absolute',
        bottom: '18px',
        right: '16px',
        fontFamily: 'monospace',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.08em',
        color: 'rgba(76,175,80,0.7)',
        animation: 'sp-hudIn 0.6s 1s ease-out both, sp-hudTick 1.2s 1s ease-in-out infinite',
        userSelect: 'none',
      }}>
        {String(pct).padStart(3, '0')}%
      </div>

      {/* ── Progress bar ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
        background: 'rgba(255,255,255,0.04)',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #1B5E20, #2E7D32, #4CAF50, #A5D6A7)',
          transition: 'width 0.05s linear',
          boxShadow: '0 0 14px rgba(76,175,80,0.9), 0 0 32px rgba(76,175,80,0.45)',
        }} />
      </div>
    </div>
  )
}
