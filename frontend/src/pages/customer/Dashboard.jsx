import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ProgressBar from '../../components/ProgressBar'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_your_key_here'

export default function CustomerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showBalance, setShowBalance] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/customer/dashboard')
      setData(res.data?.data || res.data)
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const plan = data?.plan
  const device = data?.device
  const recentPayments = data?.recentPayments || data?.recent_payments || []
  const isLocked = device?.is_locked || device?.lock_status === 'locked'
  const isOverdue = plan?.status === 'overdue' || plan?.status === 'defaulted'
  const isCompleted = plan?.status === 'completed'

  const paidAmount = (plan?.down_payment || 0) + ((plan?.payments_made || 0) * (plan?.installment_amount || 0))
  const remaining = Number(plan?.remaining_balance || 0)

  const firstName = (user?.full_name || user?.name || 'Customer').split(' ')[0]
  const initial = firstName.charAt(0).toUpperCase()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  const money = (n) => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

  // ── Payment (Paystack) ──────────────────────────────────────────────────────
  const openPayment = () => {
    if (!plan || isCompleted) { toast('No payment due right now.'); return }
    if (!user?.email) { toast.error('Email is required for payment'); return }
    const amount = plan.installment_amount || 0
    if (!amount || amount <= 0) { toast.error('Invalid payment amount'); return }
    if (!window.PaystackPop) { toast.error('Payment system not loaded. Please refresh and try again.'); return }
    try {
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: Math.round(amount * 100),
        currency: 'GHS',
        channels: ['mobile_money', 'card'],
        metadata: { plan_id: plan.id || plan._id },
        callback: () => {
          toast.success('Payment successful! Device will unlock shortly.')
          fetchDashboard()
        },
        onClose: () => {},
      })
      handler.openIframe()
    } catch (err) {
      toast.error('Payment initialization failed. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  // ── Quick actions ───────────────────────────────────────────────────────────
  const quickActions = [
    {
      label: 'Pay', onClick: openPayment,
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
    },
    {
      label: 'History', onClick: () => navigate('/customer/payments'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    },
    {
      label: 'Schedule', onClick: () => navigate('/customer/payments'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
    },
    {
      label: 'Profile', onClick: () => navigate('/customer/profile'),
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    },
  ]

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pt-4 lg:pt-2 space-y-4">

        {/* ── Hero card ── */}
        <div className="rounded-3xl p-5 sm:p-6 shadow-lg text-white relative overflow-hidden
                        bg-gradient-to-br from-green-900 via-green-800 to-green-900">
          {/* subtle sheen */}
          <div className="absolute -top-16 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

          {/* Top row */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-black text-lg">
                {initial}
              </div>
              <div>
                <p className="text-white/80 text-xs">{greeting}!</p>
                <p className="font-bold leading-tight">{user?.full_name || user?.name || 'Customer'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/customer/payments')}
              aria-label="Notifications"
              className="w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center active:scale-95 transition"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1" />
              </svg>
            </button>
          </div>

          {/* Balance */}
          <div className="relative mt-6">
            <div className="flex items-center gap-2">
              <p className="text-white/80 text-sm">Remaining Balance</p>
              <button onClick={() => setShowBalance(s => !s)} aria-label="Toggle balance" className="text-white/70 hover:text-white">
                {showBalance ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 4.6A9.8 9.8 0 0112 4.5c6.5 0 10 7 10 7a17 17 0 01-3 3.8M6.2 6.2A17 17 0 002 11.5s3.5 7 10 7a9.7 9.7 0 004.3-1" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">
              {showBalance ? money(remaining) : 'GHS ••••••'}
            </p>
            {user?.account_number && (
              <p className="text-white/70 text-sm mt-1">Account no: {user.account_number}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="relative grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={openPayment}
              disabled={isCompleted}
              className="py-3.5 rounded-2xl bg-white text-emerald-700 font-bold flex items-center justify-center gap-2
                         active:scale-95 transition disabled:opacity-60"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Make Payment
            </button>
            <button
              onClick={() => navigate('/customer/payments')}
              className="py-3.5 rounded-2xl bg-white/15 border border-white/30 text-white font-bold flex items-center justify-center gap-2
                         active:scale-95 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </button>
          </div>
        </div>

        {/* ── Status banner ── */}
        {plan && (
          isLocked ? (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-red-700">Device Locked</p>
                <p className="text-sm text-red-600">Make a payment to unlock your iPhone automatically.</p>
              </div>
            </div>
          ) : isOverdue ? (
            <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-orange-700">Payment Overdue</p>
                <p className="text-sm text-orange-600">
                  {plan.next_due_date ? `Was due ${format(new Date(plan.next_due_date), 'dd MMM yyyy')}. ` : ''}Pay now to avoid a lock.
                </p>
              </div>
            </div>
          ) : isCompleted ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🎉</span>
              </div>
              <div>
                <p className="font-bold text-emerald-700">Fully Paid!</p>
                <p className="text-sm text-emerald-600">Your {device?.model || 'iPhone'} is completely yours.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-800">Next Installment</p>
                  <p className="text-sm text-gray-500">
                    {plan.next_due_date ? `Due ${format(new Date(plan.next_due_date), 'dd MMM yyyy')}` : 'No due date set'}
                  </p>
                </div>
              </div>
              <p className="font-black text-emerald-700 text-right">{money(plan.installment_amount)}</p>
            </div>
          )
        )}

        {/* ── Quick Actions ── */}
        <div>
          <h3 className="text-base font-bold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="bg-emerald-50 rounded-2xl py-4 flex flex-col items-center gap-2 active:scale-95 transition
                           border border-emerald-100 hover:bg-emerald-100"
              >
                <svg className="w-6 h-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {a.icon}
                </svg>
                <span className="text-xs font-semibold text-emerald-800">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Device / Plan card ── */}
        {device && plan ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isLocked ? 'bg-red-100' : 'bg-emerald-100'}`}>
                <svg className={`w-6 h-6 ${isLocked ? 'text-red-600' : 'text-emerald-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-gray-900">{device.model || device.device_model}</h2>
                  <StatusBadge status={isLocked ? 'locked' : isCompleted ? 'completed' : plan.status || 'active'} size="sm" />
                </div>
                {device.serial_number && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">SN: {device.serial_number}</p>
                )}
              </div>
            </div>

            <ProgressBar current={plan.payments_made || 0} total={plan.total_payments || 1} height="lg" />

            <div className="grid grid-cols-3 gap-1.5 mt-4">
              <div className="bg-emerald-500 rounded-2xl p-3 text-center">
                <p className="text-xs text-white/90 mb-0.5">Paid</p>
                <p className="text-xs font-bold text-white">GHS {paidAmount.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-500 rounded-2xl p-3 text-center">
                <p className="text-xs text-white/90 mb-0.5">Remaining</p>
                <p className="text-xs font-bold text-white">GHS {remaining.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-500 rounded-2xl p-3 text-center">
                <p className="text-xs text-white/90 mb-0.5">Next Due</p>
                <p className="text-xs font-bold text-white">
                  {plan.next_due_date ? format(new Date(plan.next_due_date), 'dd MMM') : isCompleted ? 'Done!' : 'N/A'}
                </p>
              </div>
            </div>

            {!isCompleted && (
              <button
                onClick={openPayment}
                className="w-full mt-4 py-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black
                           flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Pay {money(plan.installment_amount)}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold">No active installment plan</p>
            <p className="text-sm text-gray-400 mt-1">Contact Tritech Hub iOS to get started</p>
          </div>
        )}

        {/* ── Recent Transactions ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-gray-900">Recent Transactions</h3>
            <button
              onClick={() => navigate('/customer/payments')}
              className="text-sm text-emerald-700 font-semibold hover:text-emerald-900"
            >
              View All →
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentPayments.slice(0, 6).map((p) => (
                <div key={p.id || p._id} className="flex items-center gap-3 py-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-10 10m0 0h7m-7 0V10" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">Installment Payment</p>
                    <p className="text-xs text-gray-400">
                      {(p.created_at || p.payment_date || p.createdAt)
                        ? format(new Date(p.created_at || p.payment_date || p.createdAt), 'EEE dd, h:mm a')
                        : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-emerald-600">+ GHS {Number(p.amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">
                      {p.payment_method === 'paystack' ? 'MoMo / Card' : p.payment_method || 'Mobile Money'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Payment Schedule ── */}
        {plan?.schedule && plan.schedule.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-base font-bold text-gray-900 mb-3">Payment Schedule</h3>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {plan.schedule.map((item, idx) => {
                const isPast = new Date(item.due_date) < new Date()
                return (
                  <div key={item._id || idx}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl text-sm
                      ${item.paid ? 'bg-emerald-50' : isPast ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                        ${item.paid ? 'bg-emerald-500' : isPast ? 'bg-red-400' : 'bg-gray-300'}`}>
                        {item.paid ? (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-white text-[9px] font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${item.paid ? 'text-emerald-700' : isPast ? 'text-red-600' : 'text-gray-600'}`}>
                        {format(new Date(item.due_date), 'dd MMM yyyy')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${item.paid ? 'text-emerald-700' : isPast ? 'text-red-600' : 'text-gray-700'}`}>
                        GHS {Number(item.amount).toLocaleString()}
                      </span>
                      <p className={`text-[10px] ${item.paid ? 'text-green-500' : isPast ? 'text-red-400' : 'text-gray-400'}`}>
                        {item.paid ? 'Paid' : isPast ? 'Overdue' : 'Upcoming'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
