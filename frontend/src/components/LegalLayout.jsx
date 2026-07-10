import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Shared wrapper for public legal pages (Terms, Privacy).
 * Green & white theme to match the login screen.
 */
export default function LegalLayout({ title, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-emerald-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg overflow-hidden">
            <img src="/logo.png" alt="TriTech Hub" className="w-full h-full object-cover"
                 onError={(e) => { e.currentTarget.style.display = 'none' }} />
          </div>
          <h1 className="text-2xl font-black text-gray-900">{title}</h1>
          {lastUpdated && <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated}</p>}
        </div>

        {/* Content card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5 text-sm leading-relaxed text-gray-700">
          {children}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-center gap-4 mt-6 text-sm">
          <Link to="/login" className="text-emerald-700 font-semibold hover:text-emerald-800">← Back to login</Link>
          <span className="text-gray-300">•</span>
          <Link to="/terms" className="text-gray-500 hover:text-gray-700">Terms</Link>
          <span className="text-gray-300">•</span>
          <Link to="/privacy" className="text-gray-500 hover:text-gray-700">Privacy</Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} TriTech Hub iOS. All rights reserved.
        </p>
      </div>
    </div>
  )
}

// Small helpers for consistent section styling
export function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-2">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
