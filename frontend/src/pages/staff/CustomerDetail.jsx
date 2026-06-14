import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ProgressBar from '../../components/ProgressBar'
import PaystackPop from '@paystack/inline-js'
import { format } from 'date-fns'

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ customer, plan, defaultAmount, onClose, onSuccess }) {
  const [amount, setAmount] = useState(String(defaultAmount ?? plan?.installment_amount ?? ''))
  const [processing, setProcessing] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const installmentAmt = plan?.installment_amount || 0
  const remaining = plan?.remaining_balance || 0

  const handlePay = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > remaining) { toast.error(`Amount exceeds remaining balance (GHS ${remaining.toLocaleString()})`); return }
    if (!PAYSTACK_PUBLIC_KEY) { toast.error('Paystack public key not configured'); return }

    setProcessing(true)
    try {
      const paystack = new PaystackPop()
      paystack.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: customer.email,
        amount: Math.round(amt * 100), // GHS → pesewas
        currency: 'GHS',
        channels: ['mobile_money', 'card'],
        label: customer.full_name,
        metadata: {
          customer_id: customer._id,
          plan_id: plan._id || plan.id,
          is_staff_initiated: true,
        },
        onSuccess: async (transaction) => {
          setProcessing(false)
          setVerifying(true)
          try {
            const res = await api.get(`/payment/verify/${transaction.reference}`)
            if (res.data.success) {
              toast.success('Payment recorded successfully!')
              onSuccess()
              onClose()
            } else {
              toast.error(res.data.message || 'Payment verification failed')
            }
          } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not verify payment')
          } finally {
            setVerifying(false)
          }
        },
        onCancel: () => {
          setProcessing(false)
        },
      })
    } catch (err) {
      setProcessing(false)
      toast.error(err?.message || 'Failed to open payment window')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 px-4 pb-4 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl">
        {verifying ? (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="mt-4 font-semibold text-gray-700">Verifying payment…</p>
            <p className="text-sm text-gray-400 mt-1">Please wait</p>
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
            <div className="bg-green-50 rounded-2xl p-3 mb-4">
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
              <div className="flex-1 bg-green-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-gray-500">Installment</p>
                <p className="text-sm font-bold text-green-800">GHS {Number(installmentAmt).toLocaleString()}</p>
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
                      ? 'bg-green-800 text-white border-green-800'
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
              className="w-full py-4 bg-green-800 text-white font-black text-base rounded-2xl
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
      navigate(-1)
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

  return (
    <div className="max-w-3xl mx-auto px-4 pb-24 lg:pb-6 pt-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-green-700 font-semibold text-sm mb-4 hover:text-green-900"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      {/* Customer Profile */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-green-100 overflow-hidden flex-shrink-0">
            {customer.photos?.customer_photo ? (
              <img src={customer.photos.customer_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-green-800 font-black text-2xl">
                  {(customer.full_name || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-gray-900">{customer.full_name}</h2>
            <p className="text-sm font-bold text-green-700">
              {customer.account_number || customer.user_id?.account_number}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>
            <p className="text-xs text-gray-400 truncate">{customer.email}</p>
          </div>
        </div>
      </div>

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

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-green-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Remaining</p>
              <p className="text-sm font-bold text-green-800">
                GHS {Number(plan.remaining_balance || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-0.5">Installment</p>
              <p className="text-sm font-bold text-gray-800">
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
              className={`w-full py-4 bg-green-800 text-white font-black text-base rounded-2xl
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
            <div className="mt-4 py-3 bg-green-50 rounded-xl text-center">
              <p className="text-sm font-bold text-green-800">✓ Plan fully paid</p>
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
