import React, { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 14400)
    const doneTimer = setTimeout(() => onDone(), 15000)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(145deg, #1b5e20 0%, #2e7d32 50%, #1a6b26 100%)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.6s ease-in-out',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      {/* Logo */}
      <div
        className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center mb-8"
        style={{
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          animation: 'splashPop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <img
          src="/logo.png"
          alt="TriTech Hub"
          className="w-20 h-20 object-contain"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
        {/* Fallback monogram if no logo.png */}
        <div
          className="w-20 h-20 rounded-2xl bg-green-800 hidden items-center justify-center"
        >
          <span className="text-white text-3xl font-black">TH</span>
        </div>
      </div>

      {/* App name */}
      <h1
        className="text-white text-4xl font-black tracking-tight mb-2"
        style={{ animation: 'splashSlideUp 0.6s 0.25s ease-out both' }}
      >
        TriTech Hub
      </h1>
      <p
        className="text-white/60 text-sm font-medium tracking-wide"
        style={{ animation: 'splashSlideUp 0.6s 0.35s ease-out both' }}
      >
        iPhone Installment Management
      </p>

      {/* Loading dots */}
      <div
        className="flex gap-2.5 mt-14"
        style={{ animation: 'splashSlideUp 0.6s 0.45s ease-out both' }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-white/50"
            style={{ animation: `splashDot 1.3s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashPop {
          0%   { transform: scale(0.4); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes splashSlideUp {
          0%   { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(0.55); opacity: 0.3; }
          40%            { transform: scale(1);    opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
