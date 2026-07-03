import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ProgressBar from '../../components/ProgressBar'
// Paystack loaded via CDN in index.html
import { format } from 'date-fns'

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ customer, plan, defaultAmount, onClose, onSuccess }) {
  const [amount, setAmount] = useState(String(defaultAmount ?? plan?.installment_amount ?? ''))
  const [processing, setProcessing] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const installmentAmt = plan?.installment_amount || 0
  const remaining = plan?.remaining_balance || 0

  const handlePay = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > remaining) { toast.error(`Amount exceeds remaining balance (GHS ${remaining.toLocaleString()})`); return }
    if (!PAYSTACK_PUBLIC_KEY) { toast.error('Paystack public key not configured'); return }

    setProcessing(true)
    try {
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: customer.email,
        amount: Math.round(amt * 100),
        currency: 'GHS',
        channels: ['mobile_money', 'card'],
        label: customer.full_name,
        metadata: {
          customer_id: customer._id,
          plan_id: plan._id || plan.id,
          is_staff_initiated: true,
        },
        // Paystack v1 rejects async callbacks (constructor is AsyncFunction,
        // not Function), so keep the callback a plain function and run the
        // async verification inside it.
        callback: (transaction) => { (async () => {
          setProcessing(false)
          setVerifying(true)
          try {
            const res = await api.get(`/payment/verify/${transaction.reference}`)
            if (res.data.success) {
              if (res.data.payment_pending) {
                toast.success('Payment sent! Approve the prompt on your phone — it will appear in payment history once confirmed.', { duration: 6000 })
                onSuccess()
                onClose()
              } else {
                const paidAmt = parseFloat(amount)
                setReceipt({
                  amount: paidAmt,
                  reference: transaction.reference,
                  date: new Date(),
                  newBalance: Math.max(0, (plan?.remaining_balance || 0) - paidAmt),
                })
                onSuccess()
              }
            } else {
              toast.error(res.data.message || 'Payment verification failed')
            }
          } catch (err) {
            const isTimeout = err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK'
            const serverPending = err?.response?.data?.payment_pending
            if (isTimeout || serverPending) {
              toast.success(
                'Payment sent! It will appear in payment history once your MoMo approval is received.',
                { duration: 6000 }
              )
              onSuccess()
              onClose()
            } else {
              toast.error(err?.response?.data?.message || 'Could not verify payment. Please check payment history.')
            }
          } finally {
            setVerifying(false)
          }
        })() },
        onClose: () => {
          setProcessing(false)
        },
      })
      handler.openIframe()
    } catch (err) {
      setProcessing(false)
      toast.error(err?.message || 'Failed to open payment window')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 px-4 pb-4 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
        {receipt ? (
          /* ── Payment Receipt ── */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-black text-gray-900 mb-1">Payment Successful</p>
            <p className="text-xs text-gray-400 mb-5">TriTech Hub iOS · Payment Receipt</p>

            <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Customer</span>
                <span className="text-xs font-bold text-gray-800">{customer.full_name}</span>
              </div>
              <div className="border-t border-dashed border-gray-200" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Amount Paid</span>
                <span className="text-sm font-black text-emerald-700">GHS {Number(receipt.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Date</span>
                <span className="text-xs font-semibold text-gray-700">
                  {format(receipt.date, 'dd MMM yyyy · h:mm a')}
                </span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs text-gray-500 flex-shrink-0">Reference</span>
                <span className="text-xs font-mono text-gray-500 text-right break-all">
                  {receipt.reference}
                </span>
              </div>
              <div className="border-t border-dashed border-gray-200" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Remaining Balance</span>
                <span className={`text-xs font-bold ${receipt.newBalance === 0 ? 'text-emerald-700' : 'text-orange-600'}`}>
                  {receipt.newBalance === 0 ? 'Fully Paid ✓' : `GHS ${Number(receipt.newBalance).toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, '').replace(/^0/, '233')}?text=${encodeURIComponent(
                    `*Tritech Hub iOS — Payment Receipt*\n\nCustomer: ${customer.full_name}\nAmount Paid: GHS ${Number(receipt.amount).toLocaleString()}\nDate: ${format(receipt.date, 'dd MMM yyyy · h:mm a')}\nRef: ${receipt.reference}\nBalance: ${receipt.newBalance === 0 ? 'Fully Paid ✓' : 'GHS ' + Number(receipt.newBalance).toLocaleString()}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-[#25D366] text-white font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Share Receipt on WhatsApp
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-emerald-700 text-white font-black rounded-2xl active:scale-95 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : verifying ? (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="mt-4 font-semibold text-gray-700">Recording payment…</p>
            <p className="text-sm text-gray-400 mt-1">MoMo confirmations can take up to 30 seconds</p>
            <p className="text-xs text-gray-400 mt-3 max-w-xs mx-auto">
              Do not close or refresh this page
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-gray-900">Make Payment</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Customer info */}
            <div className="bg-emerald-50 rounded-2xl p-3 mb-4">
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-bold text-gray-900">{customer.full_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{customer.email}</p>
            </div>

            {/* Balance summary */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-gray-500">Remaining</p>
                <p className="text-sm font-bold text-gray-800">GHS {Number(remaining).toLocaleString()}</p>
              </div>
              <div className="flex-1 bg-emerald-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-gray-500">Installment</p>
                <p className="text-sm font-bold text-emerald-800">GHS {Number(installmentAmt).toLocaleString()}</p>
              </div>
            </div>

            {/* Amount input */}
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Amount to Pay (GHS)
            </label>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">GHS</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
                max={remaining}
                step="0.01"
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
              />
            </div>

            {/* Quick amount buttons */}
            <div className="flex gap-2 mb-5">
              {[installmentAmt, remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors
                    ${String(amount) === String(v)
                      ? 'bg-emerald-700 text-white border-green-800'
                      : 'border-gray-200 text-gray-600 hover:border-green-400'}`}
                >
                  {v === installmentAmt ? 'Installment' : 'Full Balance'}
                  {'\n'}GHS {Number(v).toLocaleString()}
                </button>
              ))}
            </div>

            {/* Pay button */}
            <button
              onClick={handlePay}
              disabled={processing || !amount}
              className="w-full py-4 bg-emerald-700 text-white font-black text-base rounded-2xl
                         flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
            >
              {processing ? (
                <><LoadingSpinner size="sm" /> Opening payment…</>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Pay via Mobile Money
                </>
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">Powered by Paystack · MoMo & Card accepted</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StaffCustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [plan, setPlan] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPayModal, setShowPayModal] = useState(false)
  const [defaultPayAmount, setDefaultPayAmount] = useState(null)
  const [imageModal, setImageModal] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/staff/customers/${id}`)
      const d = res.data?.data || res.data
      setCustomer(d?.customer || d)
      if (d?.plan) setPlan(d.plan)
      if (Array.isArray(d?.payments)) setPayments(d.payments)
    } catch (err) {
      toast.error('Failed to load customer')
      navigate('/staff/customers')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="xl" />
    </div>
  )

  if (!customer) return null

  const device = plan?.device_id
  const canPay = plan?.status === 'active' && (plan?.remaining_balance || 0) > 0
  const downPaymentDue = plan?.down_payment > 0 && payments.length === 0

  const photoUrl = (p) => {
    if (!p) return null
    if (p.startsWith('data:') || p.startsWith('http')) return p
    return `/uploads/${p.replace(/\\/g, '/').split('/').pop()}`
  }
  const photos = customer.photos || {}
  const cardFront = photoUrl(photos.ghana_card_front)
  const cardBack  = photoUrl(photos.ghana_card_back)
  const custPhoto = photoUrl(photos.customer_photo)
  const guarPhoto = photoUrl(photos.guarantor_photo)
  const sigPhoto  = photoUrl(photos.signature)

  return (
    <div className="max-w-3xl mx-auto px-4 pb-32 lg:pb-6 pt-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-emerald-700 font-semibold text-sm mb-4 hover:text-emerald-900"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      {/* Customer Profile */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 overflow-hidden flex-shrink-0 cursor-pointer"
               onClick={() => custPhoto && setImageModal(custPhoto)}>
            {custPhoto ? (
              <img src={custPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-emerald-800 font-black text-2xl">
                  {(customer.full_name || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-gray-900">{customer.full_name}</h2>
            <p className="text-sm font-bold text-emerald-700">
              {customer.account_number || customer.user_id?.account_number}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>
            <p className="text-xs text-gray-400 truncate">{customer.email}</p>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      {(customer.ghana_card_id || customer.occupation || customer.income?.amount > 0 || customer.location?.region || customer.location?.town) && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Customer Details</h3>
          <div className="space-y-2">
            {customer.ghana_card_id && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Ghana Card ID</span>
                <span className="font-semibold text-gray-800 font-mono text-right break-all">{customer.ghana_card_id}</span>
              </div>
            )}
            {customer.occupation && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Occupation</span>
                <span className="font-semibold text-gray-800 text-right">{customer.occupation}</span>
              </div>
            )}
            {customer.income?.amount > 0 && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Income</span>
                <span className="font-semibold text-gray-800 text-right">
                  GHS {Number(customer.income.amount).toLocaleString()}{customer.income.source ? ` — ${customer.income.source}` : ''}
                </span>
              </div>
            )}
            {(customer.location?.region || customer.location?.town || customer.location?.district || customer.location?.landmark) && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Location</span>
                <span className="font-semibold text-gray-800 text-right">
                  {[customer.location?.town, customer.location?.district, customer.location?.region].filter(Boolean).join(', ')}
                  {customer.location?.landmark ? ` (${customer.location.landmark})` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guarantor */}
      {(customer.guarantor?.full_name || customer.guarantor?.phone) && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Guarantor</h3>
          <div className="space-y-2">
            {customer.guarantor.full_name && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Name</span>
                <span className="font-semibold text-gray-800 text-right">{customer.guarantor.full_name}</span>
              </div>
            )}
            {customer.guarantor.phone && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Phone</span>
                <span className="font-semibold text-gray-800 text-right">{customer.guarantor.phone}</span>
              </div>
            )}
            {customer.guarantor.ghana_card_id && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Ghana Card ID</span>
                <span className="font-semibold text-gray-800 font-mono text-right break-all">{customer.guarantor.ghana_card_id}</span>
              </div>
            )}
            {customer.guarantor.relationship && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500 flex-shrink-0">Relationship</span>
                <span className="font-semibold text-gray-800 text-right">{customer.guarantor.relationship}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos & Documents — Ghana Card ID images are hidden from staff (admin only) */}
      {(custPhoto || guarPhoto || sigPhoto) && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Photos & Documents</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Customer Photo',     src: custPhoto },
              { label: 'Guarantor Photo',    src: guarPhoto },
            ].map(({ label, src }) => src ? (
              <button key={label} onClick={() => setImageModal(src)}
                className="relative rounded-2xl overflow-hidden bg-gray-50 aspect-[4/3] w-full border border-gray-200">
                <img src={src} alt={label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 py-1 px-2">
                  <p className="text-white text-[10px] font-semibold truncate">{label}</p>
                </div>
              </button>
            ) : (
              <div key={label} className="rounded-2xl bg-gray-50 aspect-[4/3] border-2 border-dashed border-gray-200 flex items-center justify-center">
                <p className="text-gray-300 text-xs text-center px-2">{label}</p>
              </div>
            ))}
          </div>
          {sigPhoto && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-semibold mb-2">Signature</p>
              <button onClick={() => setImageModal(sigPhoto)}
                className="border border-gray-200 rounded-xl overflow-hidden inline-block">
                <img src={sigPhoto} alt="Signature" className="h-16 object-contain block" />
              </button>
            </div>
          )}
          <p className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
            🔒 Ghana Card ID images are restricted to admin only.
          </p>
        </div>
      )}

      {/* Device */}
      {(device || plan?.device_id) && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Device</p>
              <p className="font-bold text-gray-800">
                {device?.model || plan?.device_id?.model || plan?.device_model}
              </p>
            </div>
            <StatusBadge status={device?.lock_status === 'locked' ? 'locked' : 'active'} />
          </div>
        </div>
      )}

      {/* Payment Plan */}
      {plan && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Payment Plan</h3>
            <StatusBadge status={plan.status || 'active'} />
          </div>

          <ProgressBar
            current={plan.payments_made || 0}
            total={plan.total_payments || 1}
            height="lg"
          />

          <div className="grid grid-cols-3 gap-1.5 mt-4">
            <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Remaining</p>
              <p className="text-xs font-bold text-emerald-800">
                GHS {Number(plan.remaining_balance || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Installment</p>
              <p className="text-xs font-bold text-gray-800">
                GHS {Number(plan.installment_amount || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Next Due</p>
              <p className="text-xs font-bold text-orange-700">
                {plan.next_due_date ? format(new Date(plan.next_due_date), 'dd MMM') : 'N/A'}
              </p>
            </div>
          </div>

          {/* Down Payment Button — shown first if not yet collected */}
          {downPaymentDue && (
            <button
              onClick={() => { setDefaultPayAmount(plan.down_payment); setShowPayModal(true) }}
              className="w-full mt-4 py-4 bg-amber-600 text-white font-black text-base rounded-2xl
                         flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-amber-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Collect Down Payment — GHS {Number(plan.down_payment).toLocaleString()}
            </button>
          )}

          {/* Regular Installment Payment Button */}
          {canPay && (
            <button
              onClick={() => { setDefaultPayAmount(null); setShowPayModal(true) }}
              className={`w-full py-4 bg-emerald-700 text-white font-black text-base rounded-2xl
                         flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-green-900
                         ${downPaymentDue ? 'mt-2' : 'mt-4'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Collect Installment (MoMo / Card)
            </button>
          )}

          {plan.status === 'completed' && (
            <div className="mt-4 py-3 bg-emerald-50 rounded-xl text-center">
              <p className="text-sm font-bold text-emerald-800">✓ Plan fully paid</p>
            </div>
          )}
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-2xl shadow-card p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">
          Payment History
          {payments.length > 0 && (
            <span className="ml-2 text-xs font-medium text-gray-400">({payments.length})</span>
          )}
        </h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map((tx) => (
              <div key={tx._id || tx.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    GHS {Number(tx.amount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {tx.payment_date || tx.createdAt
                      ? format(new Date(tx.payment_date || tx.createdAt), 'dd MMM yyyy · h:mm a')
                      : ''}
                    {tx.payment_method && ` · ${tx.payment_method}`}
                  </p>
                  {tx.paystack_reference && (
                    <p className="text-xs font-mono text-gray-400 mt-0.5">
                      {tx.paystack_reference.slice(0, 24)}
                    </p>
                  )}
                </div>
                <StatusBadge status={tx.status || tx.paystack_status || 'success'} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Viewer */}
      {imageModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
             onClick={() => setImageModal(null)}>
          <img src={imageModal} alt="Full view" className="max-w-full max-h-full object-contain rounded-xl"
               onClick={e => e.stopPropagation()} />
          <button onClick={() => setImageModal(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && plan && (
        <PaymentModal
          customer={customer}
          plan={plan}
          defaultAmount={defaultPayAmount}
          onClose={() => setShowPayModal(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
