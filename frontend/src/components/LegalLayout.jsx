import React from 'react'
import { Link } from 'react-router-dom'
import useLogo from '../hooks/useLogo'
import PublicFooter from './PublicFooter'

/**
 * Shared wrapper for public legal pages (Terms, Privacy, Refunds, Cookies,
 * Data deletion). Ends with the company details footer.
 */
export default function LegalLayout({ title, lastUpdated, children }) {
  const logo = useLogo()
  return (
    <div className="min-h-screen bg-orange-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-lg overflow-hidden">
            <img src={logo} alt="Dan & Dor Solar" className="w-full h-full object-cover"
                 onError={(e) => { e.currentTarget.style.display = 'none' }} />
          </div>
          <h1 className="text-2xl font-black text-gray-900">{title}</h1>
          {lastUpdated && <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated}</p>}
        </div>

        {/* Content card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5 text-sm leading-relaxed text-gray-700">
          {children}
        </div>

        <div className="text-center mt-6 text-sm">
          <Link to="/login" className="text-orange-700 font-semibold hover:text-orange-600">← Back to login</Link>
        </div>

        <PublicFooter />
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
