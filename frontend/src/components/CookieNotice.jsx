import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const KEY = 'dd_cookie_notice_ok'
const seen = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

/**
 * Cookie notice. We only use essential storage (login session, settings), so
 * this informs rather than asks — there is nothing optional to switch off.
 */
export default function CookieNotice() {
  const [show, setShow] = useState(!seen())
  if (!show) return null
  const ok = () => {
    try { localStorage.setItem(KEY, '1') } catch { /* private mode: just hide */ }
    setShow(false)
  }
  return (
    <div role="region" aria-label="Cookie notice"
      className="fixed bottom-3 left-3 right-3 z-[60] sm:left-auto sm:right-4 sm:max-w-sm bg-gray-900 text-white rounded-2xl shadow-2xl p-4 text-sm">
      <p>
        We only use <strong>essential storage</strong> to keep you logged in — no ads or tracking.{' '}
        <Link to="/cookies" className="underline font-semibold text-orange-300 hover:text-white">Cookie Policy</Link>
      </p>
      <button onClick={ok} className="mt-3 w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 font-bold">
        OK
      </button>
    </div>
  )
}
