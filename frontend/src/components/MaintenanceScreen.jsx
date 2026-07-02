import React from 'react'

export default function MaintenanceScreen() {
  return (
    <div className="relative min-h-screen bg-[#0a0f0d] flex items-center justify-center p-6 overflow-hidden">

      {/* Animated gradient orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-green-600/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[140px] animate-pulse"
           style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-[40%] left-[55%] w-[300px] h-[300px] bg-teal-400/10 rounded-full blur-[100px] animate-pulse"
           style={{ animationDelay: '0.7s' }} />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glass card */}
      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-2xl bg-white/[0.06] border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-black/40 text-center">

          {/* Logo */}
          <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700
                          flex items-center justify-center shadow-lg shadow-green-900/50">
            <span className="text-white text-2xl font-black tracking-tight">T</span>
          </div>

          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            <span className="text-amber-300 text-xs font-semibold tracking-wide uppercase">Scheduled Maintenance</span>
          </div>

          <h1 className="text-white text-3xl sm:text-4xl font-black tracking-tight mb-4">
            We&rsquo;ll be right back
          </h1>
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8">
            TriTech Hub is getting a quick tune-up. We&rsquo;re working behind the scenes
            and will be back online shortly.
          </p>

          {/* Animated progress bar */}
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mb-8">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-green-400 to-transparent rounded-full"
                 style={{ animation: 'mx-slide 1.8s ease-in-out infinite' }} />
          </div>

          <button
            onClick={() => window.location.reload()}
            className="group w-full py-4 rounded-2xl bg-white text-gray-900 font-bold text-sm
                       hover:bg-green-50 active:scale-[0.98] transition-all duration-150
                       flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Check Again
          </button>
        </div>

        <p className="text-gray-600 text-xs text-center mt-6 tracking-wide">
          TriTech Hub iOS &copy; {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes mx-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
