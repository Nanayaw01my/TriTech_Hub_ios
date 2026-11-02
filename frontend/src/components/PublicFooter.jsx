import React from 'react'
import { Link } from 'react-router-dom'
import useBusinessInfo from '../hooks/useBusinessInfo'

/** Company details + legal links, shown on public pages (login, legal, pay). */
export default function PublicFooter({ dark = false }) {
  const b = useBusinessInfo()
  const muted = dark ? 'text-white/70' : 'text-gray-500'
  const link = dark ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'
  return (
    <footer className={`mt-8 text-center text-xs ${muted} space-y-2`}>
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link to="/terms" className={link}>Terms</Link>
        <Link to="/privacy" className={link}>Privacy</Link>
        <Link to="/refunds" className={link}>Refunds</Link>
        <Link to="/cookies" className={link}>Cookies</Link>
        <Link to="/data-deletion" className={link}>Delete my data</Link>
      </nav>
      <p className="font-semibold">{b.business_name || 'Dan & Dor Solar Company Ltd.'}</p>
      <p>
        {[b.contact_address, b.contact_phone, b.contact_email].filter(Boolean).join(' · ')}
      </p>
      <p>© {new Date().getFullYear()} {b.business_name || 'Dan & Dor Solar Company Ltd.'} All rights reserved.</p>
    </footer>
  )
}
