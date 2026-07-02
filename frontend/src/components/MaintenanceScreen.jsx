import React from 'react'

export default function MaintenanceScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 flex items-center justify-center p-6">
      <div className="text-center max-w-sm w-full">
        <div className="w-20 h-20 bg-green-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <span className="text-white text-3xl font-black">T</span>
        </div>

        <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <h1 className="text-white text-2xl font-black mb-3">Under Maintenance</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          TriTech Hub is temporarily offline for scheduled maintenance. We'll be back shortly. Please try again in a few minutes.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3.5 bg-green-700 text-white font-bold rounded-2xl text-sm
                     hover:bg-green-600 active:scale-95 transition-all shadow-lg"
        >
          Try Again
        </button>

        <p className="text-gray-600 text-xs mt-8">TriTech Hub iOS &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
