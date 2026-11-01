import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import useLogo from '../hooks/useLogo'

const ghs = (n) => `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '')

/**
 * "Pay now" page from the customer's text message (dandorsolar.site/p/<token>).
 * No login: shows what's owed, sends them to Paystack (MoMo or card), and on
 * return confirms the payment.
 */
export default function PayNow() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const reference = params.get('reference') || params.get('trxref')
  const logo = useLogo()

  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [other, setOther] = useState(false)
  const [amount, setAmount] = useState('')
  const [starting, setStarting] = useState(false)
  const [result, setResult] = useState(null) // after returning from Paystack
  const [demoPopup, setDemoPopup] = useState(false)

  const load = () =>
    api.get(`/pay/${token}`)
      .then((res) => setInfo(res.data?.data))
      .catch((err) => setError(err?.response?.data?.message || 'This payment link is not valid.'))

  useEffect(() => {
    (async () => {
      if (reference) {
        try {
          const res = await api.get(`/pay/${token}/verify/${reference}`)
          setResult({ ok: true, ...res.data, ...(res.data?.data || {}) })
        } catch (err) {
          setResult({ ok: false, message: err?.response?.data?.message || 'We could not confirm the payment yet.' })
        }
      }
      await load()
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reference])

  // Sample page: open a real GHS 1 Paystack test (to the business's own account).
  const startDemoTest = async () => {
    setStarting(true)
    try {
      const res = await api.post(`/pay/${token}/initialize`, { real_test: true })
      window.location.href = res.data.data.authorization_url
    } catch (err) {
      setDemoPopup(false)
      setError(err?.response?.data?.message || 'Could not open Paystack. Please try again.')
      setStarting(false)
    }
  }

  const pay = async () => {
    setError('')
    if (info?.demo) { setDemoPopup(true); return }
    const body = other ? { amount: Number(amount) } : {}
    if (other && !(Number(amount) >= 1)) { setError('Enter an amount of at least GHS 1.'); return }
    setStarting(true)
    try {
      const res = await api.post(`/pay/${token}/initialize`, body)
      window.location.href = res.data.data.authorization_url
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start the payment. Please try again.')
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <img src={logo} alt="" className="w-12 h-12 rounded-2xl object-contain bg-white shadow" />
          <div>
            <p className="font-black text-gray-900 leading-tight">Dan &amp; Dor Solar</p>
            <p className="text-xs text-gray-500">Company Ltd.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6">
          {loading ? (
            <p className="text-center text-gray-500 py-10">Loading…</p>
          ) : !info ? (
            <p className="text-center text-red-600 py-8 font-semibold">{error || 'This payment link is not valid.'}</p>
          ) : (
            <>
              {result && (
                <div className={`mb-5 p-4 rounded-2xl text-sm ${result.ok && !result.payment_pending ? 'bg-green-50 text-green-800' : result.payment_pending ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
                  {result.ok && !result.payment_pending && result.demo ? (
                    <>
                      <p className="font-bold text-base">Test payment of GHS {Number(result.amount || 1).toFixed(2)} received ✓</p>
                      <p className="mt-1">Paystack works. This test isn't linked to any customer.</p>
                    </>
                  ) : result.ok && !result.payment_pending ? (
                    <>
                      <p className="font-bold text-base">Payment received ✓</p>
                      <p className="mt-1">Thank you! {result.completed ? 'Your phone is fully paid — it is now yours.' : result.unlocked ? 'Your phone is being unlocked now.' : result.caught_up === false ? 'You still have an amount overdue — pay the rest to unlock your phone.' : `Next payment due ${fmtDate(result.next_due_date)}.`}</p>
                    </>
                  ) : (
                    <p className="font-semibold">{result.message}</p>
                  )}
                </div>
              )}

              {info.demo && (
                <p className="mb-4 p-3 rounded-2xl bg-blue-50 text-blue-800 text-xs font-semibold">
                  Sample page — this is how a customer's Pay-now link looks. No money is taken here.
                </p>
              )}
              <p className="text-gray-500 text-sm">Hi {info.first_name},</p>
              <p className="text-gray-900 font-bold text-lg">{info.device_model}</p>

              {info.payable ? (
                <>
                  {info.locked && <p className="mt-3 text-sm font-semibold text-red-600">🔒 Your phone is locked. Pay to unlock it.</p>}
                  {!info.locked && info.overdue && <p className="mt-3 text-sm font-semibold text-red-600">Your payment is overdue.</p>}

                  <div className="mt-5 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Amount due now</p>
                    <p className="text-4xl font-black text-orange-600 mt-1">{ghs(info.amount_due)}</p>
                    {info.late_fees > 0 && <p className="text-xs font-semibold text-red-600 mt-1">Includes {ghs(info.late_fees)} late fees</p>}
                    {!info.overdue && info.next_due_date && <p className="text-xs text-gray-500 mt-1">Due {fmtDate(info.next_due_date)}</p>}
                  </div>

                  {other && (
                    <div className="mt-5">
                      <label className="text-sm font-semibold text-gray-700">Amount to pay (GHS)</label>
                      <input type="number" inputMode="decimal" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder={String(info.amount_due)}
                        className="mt-1 w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-lg focus:border-orange-500 outline-none" />
                      <p className="text-xs text-gray-400 mt-1">Pay ahead to get more days. Full balance: {ghs(info.remaining_balance)}</p>
                    </div>
                  )}

                  {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                  <button onClick={pay} disabled={starting}
                    className="mt-6 w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-lg disabled:opacity-60">
                    {starting ? 'Opening Paystack…' : `Pay ${other && Number(amount) >= 1 ? ghs(amount) : ghs(info.amount_due)}`}
                  </button>
                  <button onClick={() => { setOther((v) => !v); setError('') }}
                    className="mt-3 w-full text-sm font-semibold text-gray-500">
                    {other ? 'Pay the amount due instead' : 'Pay a different amount'}
                  </button>

                  <p className="mt-5 text-xs text-gray-400 text-center">Mobile Money (MTN, Telecel, AirtelTigo) or card — secured by Paystack.</p>
                  <p className="mt-1 text-xs text-gray-400 text-center">Balance left: {ghs(info.remaining_balance)}{info.late_fees > 0 ? ` + ${ghs(info.late_fees)} late fees` : ''}</p>
                </>
              ) : (
                <p className="mt-5 text-center text-green-700 font-semibold">
                  {info.status === 'completed' ? 'This phone is fully paid. Thank you!' : 'There is nothing to pay on this plan right now.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {demoPopup && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={() => !starting && setDemoPopup(false)}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-black text-gray-900">This is a sample page</p>
            <p className="mt-2 text-sm text-gray-600">
              No customer is charged here. For a real customer, this button opens <span className="font-semibold">Paystack</span> to pay by Mobile Money or card.
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Want to see the real Paystack screen? Make a <span className="font-semibold">GHS 1.00 test payment</span> — it goes to your own business account (less Paystack's fee) and isn't linked to any customer.
            </p>
            <button onClick={startDemoTest} disabled={starting}
              className="mt-5 w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold disabled:opacity-60">
              {starting ? 'Opening Paystack…' : 'Open Paystack — GHS 1.00 test'}
            </button>
            <button onClick={() => setDemoPopup(false)} disabled={starting}
              className="mt-2 w-full py-3 rounded-2xl border border-gray-200 text-gray-700 font-semibold">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
