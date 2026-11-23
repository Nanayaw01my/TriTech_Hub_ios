import React, { useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

/**
 * "Payment link": the customer's own Pay-now page (amount due, MoMo/card via
 * Paystack). Copy it or send it on WhatsApp. base = '/admin' | '/staff'.
 */
export default function PayLinkButton({ customerId, customerName, customerPhone, base = '/admin', className = '' }) {
  const [link, setLink] = useState(null) // { url, amount_due }
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    try {
      const r = await api.get(`${base}/customers/${customerId}/pay-link`)
      setLink(r.data?.data || null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not get the payment link.')
    } finally {
      setBusy(false)
    }
  }
  const first = String(customerName || '').trim().split(/\s+/)[0] || ''
  const message = link
    ? `Hi ${first}, here is your Dan & Dor Solar payment link. Pay by Mobile Money or card: ${link.url}`
    : ''
  const waNumber = (() => {
    const d = String(customerPhone || '').replace(/\D/g, '')
    if (d.startsWith('233')) return d
    if (d.startsWith('0') && d.length === 10) return '233' + d.slice(1)
    return d
  })()
  const copy = async () => {
    try { await navigator.clipboard.writeText(link.url); toast.success('Link copied.') } catch { toast('Press and hold the link to copy it.') }
  }
  return (
    <>
      <button type="button" onClick={open} disabled={busy}
        className={className || 'w-full py-3 px-4 rounded-xl border-2 border-green-300 text-green-800 font-semibold text-sm hover:bg-green-50 transition-colors flex items-center gap-2 disabled:opacity-60'}>
        🔗 {busy ? 'Getting link…' : 'Payment link (copy / WhatsApp)'}
      </button>
      {link && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={() => setLink(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-black text-gray-900">Payment link</p>
            <p className="text-sm text-gray-500 mt-1">
              {customerName}'s own payment page. It shows what they owe now
              {link.amount_due ? <> (<strong>GHS {Number(link.amount_due).toLocaleString()}</strong>)</> : ''} and they pay by MoMo or card.
              The payment is recorded and the phone unlocks by itself.
            </p>
            <p className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200 font-mono text-sm break-all select-all">{link.url}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={copy} className="py-3 rounded-xl bg-gray-900 text-white font-bold text-sm">Copy link</button>
              <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
                className="py-3 rounded-xl bg-green-600 text-white font-bold text-sm text-center">Send on WhatsApp</a>
            </div>
            <button type="button" onClick={() => setLink(null)} className="mt-2 w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm">Close</button>
          </div>
        </div>
      )}
    </>
  )
}
