import React, { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [phase, setPhase]           = useState(0)
  const [progress, setProgress]     = useState(0)
  const [pct, setPct]               = useState(0)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [logoError, setLogoError]   = useState(false)

  useEffect(() => {
    const TOTAL = 3400
    const startTime = Date.now()

    const interval = setInterval(() => {
      const p = Math.min(((Date.now() - startTime) / TOTAL) * 100, 100)
      setProgress(p)
      setPct(Math.floor(p))
    }, 50)

    const fadeTimer = setTimeout(() => setPhase(1), 3400)
    const doneTimer = setTimeout(() => onDone(), 4000)

    return () => {
      clearInterval(interval)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#0a0f0d]"
      style={{
        opacity: phase === 1 ? 0 : 1,
        transition: 'opacity 0.6s ease-in-out',
        pointerEvents: phase === 1 ? 'none' : 'all',
      }}
    >
      <style>{`
        @keyframes sp-rise {
          0%   { opacity: 0; transform: translateY(24px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes sp-logoIn {
          0%   { opacity: 0; transform: scale(0.7); filter: blur(12px); }
          60%  { opacity: 1; filter: blur(0); }
          80%  { transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes sp-breathe {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes sp-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes sp-shimmerText {
          0%, 100% { background-position: 0% center; }
          50%      { background-position: 100% center; }
        }
        @keyframes sp-orbPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.08); }
        }
        @keyframes sp-dotPing {
          0%   { transform: scale(1);   opacity: 0.8; }
          80%, 100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      {/* Ambient gradient orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-green-600/25 rounded-full blur-[120px]"
           style={{ animation: 'sp-orbPulse 7s ease-in-out infinite' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/15 rounded-full blur-[140px]"
           style={{ animation: 'sp-orbPulse 7s 2.5s ease-in-out infinite' }} />
      <div className="absolute top-[45%] left-[55%] w-[300px] h-[300px] bg-teal-400/10 rounded-full blur-[100px]"
           style={{ animation: 'sp-orbPulse 9s 1.2s ease-in-out infinite' }} />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* ── Logo ── */}
      <div className="relative mb-10" style={{ animation: 'sp-breathe 5s 1.4s ease-in-out infinite' }}>

        {/* Rotating conic arc around the logo */}
        <div
          className="absolute -inset-6 rounded-[2.5rem] pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(76,175,80,0.5) 12%, transparent 25%)',
            animation: 'sp-spin 3.5s linear infinite',
            maskImage: 'radial-gradient(closest-side, transparent 88%, black 92%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 88%, black 92%)',
          }}
        />

        {/* Soft glow halo */}
        <div className="absolute -inset-10 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(ellipse, rgba(76,175,80,0.22) 0%, transparent 65%)', filter: 'blur(14px)' }} />

        {/* Glass logo card */}
        <div
          className="relative w-[240px] h-[112px] rounded-[1.75rem] overflow-hidden
                     backdrop-blur-2xl bg-white/[0.05] border border-white/10"
          style={{
            animation: 'sp-logoIn 1.1s cubic-bezier(0.22,1,0.36,1) both',
            boxShadow: '0 40px 90px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 60px rgba(76,175,80,0.15)',
          }}
        >
          {logoError ? (
            <div className="flex flex-col items-center justify-center h-full gap-0.5">
              <span className="text-green-400 text-4xl font-black tracking-tight leading-none">TH</span>
              <span className="text-green-400/50 text-[9px] font-bold tracking-[0.2em]">iOS</span>
            </div>
          ) : (
            <img
              src="/logo.png"
              alt="TriTech Hub"
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoError(true)}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: logoLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
            />
          )}
          {!logoLoaded && !logoError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-green-400 text-4xl font-black tracking-tight leading-none">TH</span>
              <span className="text-green-400/50 text-[9px] font-bold tracking-[0.2em]">iOS</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Name ── */}
      <div className="text-center px-6" style={{ animation: 'sp-rise 0.9s 0.45s cubic-bezier(0.22,1,0.36,1) both' }}>
        <h1 className="font-black tracking-tight leading-none">
          <span className="block text-white text-[clamp(1.7rem,7vw,2.6rem)]"
                style={{ textShadow: '0 2px 30px rgba(0,0,0,0.6)' }}>
            TriTech Hub
          </span>
          <span
            className="block text-[clamp(1.9rem,8vw,3rem)] mt-1"
            style={{
              background: 'linear-gradient(135deg, #34d399 0%, #a7f3d0 45%, #10b981 70%, #059669 100%)',
              backgroundSize: '250% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'sp-shimmerText 4s 1.6s ease-in-out infinite',
              filter: 'drop-shadow(0 0 24px rgba(52,211,153,0.4))',
            }}
          >
            iOS
          </span>
        </h1>
        <p className="mt-3 text-white/30 text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
          iPhone Installment Management
        </p>
      </div>

      {/* ── Badge ── */}
      <div
        className="mt-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                   backdrop-blur-xl bg-white/[0.05] border border-white/10"
        style={{ animation: 'sp-rise 0.8s 0.9s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400"
                style={{ animation: 'sp-dotPing 1.8s ease-out infinite' }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
        </span>
        <span className="text-green-300/80 text-[11px] font-bold tracking-wide">
          Powered by Ittek Solutions
        </span>
      </div>

      {/* ── Progress ── */}
      <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3 px-10"
           style={{ animation: 'sp-rise 0.8s 1.1s ease-out both' }}>
        <div className="w-full max-w-[220px] h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #059669, #34d399, #a7f3d0)',
              transition: 'width 0.05s linear',
              boxShadow: '0 0 12px rgba(52,211,153,0.8)',
            }}
          />
        </div>
        <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-green-400/60 select-none">
          LOADING {String(pct).padStart(3, '0')}%
        </span>
      </div>
    </div>
  )
}
