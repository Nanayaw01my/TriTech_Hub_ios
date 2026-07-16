import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ProgressBar from '../../components/ProgressBar'
import PaystackButton from '../../components/PaystackButton'
import { useAuth } from '../../context/AuthContext'
import { format } from 'date-fns'

export default function CustomerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  const plan = data?.plan
  const device = data?.device
  const recentPayments = data?.recentPayments || data?.recent_payments || []
  const isLocked = device?.is_locked || device?.lock_status === 'locked'
  const isOverdue = plan?.status === 'overdue' || plan?.status === 'defaulted'
  const isCompleted = plan?.status === 'completed'

  const paidAmount = (plan?.down_payment || 0) + ((plan?.payments_made || 0) * (plan?.installment_amount || 0))

  const statusColor = isLocked ? 'bg-red-600' : isOverdue ? 'bg-orange-600' : 'bg-emerald-600'

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">

      {/* ── Mobile Hero Header (hidden on desktop) ── */}
      <div className={`lg:hidden px-5 pt-6 pb-10 ${statusColor}`}>
        <p className="text-white/70 text-sm">Welcome back,</p>
        <h1 className="text-white text-2xl font-black mt-0.5">
          {(user?.full_name || user?.name || 'Customer').split(' ')[0]} 👋
        </h1>
        {user?.account_number && (
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mt-2">
            {user.account_number}
          </span>
        )}
      </div>

      {/* ── Desktop Header (hidden on mobile) ── */}
      <div className="hidden lg:block px-0 pt-2 pb-6">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">My Account</p>
        <h1 className="text-2xl font-black text-gray-900 leading-tight">
          Welcome back, {(user?.full_name || user?.name || 'Customer').split(' ')[0]}!
        </h1>
        {user?.account_number && (
          <p className="text-sm font-bold text-emerald-600 mt-0.5">{user.account_number}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* ── Content ── */}
      <div className="px-4 lg:px-0 -mt-5 lg:mt-0">
        {device && plan ? (
          <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

            {/* ── Left col: Device + Plan ── */}
            <div className="lg:col-span-2">
              <div className={`bg-white rounded-3xl shadow-lg p-5 ${isLocked ? 'ring-2 ring-red-300' : isOverdue ? 'ring-2 ring-orange-300' : ''}`}>

                {/* Device header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0
                    ${isLocked ? 'bg-red-100' : 'bg-emerald-100'}`}>
                    {isLocked ? (
                      <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <svg className="w-7 h-7 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-black text-gray-900">{device.model || device.device_model}</h2>
                      <StatusBadge
                        status={isLocked ? 'locked' : isCompleted ? 'completed' : plan.status || 'active'}
                        size="sm"
                      />
                    </div>
                    {device.serial_number && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">SN: {device.serial_number}</p>
                    )}
                  </div>
                </div>

                {/* Lock alert */}
                {isLocked && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-red-700">Device Locked!</p>
                        <p className="text-xs text-red-600 mt-0.5">Make a payment to unlock your iPhone automatically.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress */}
                <div className="mb-4">
                  <ProgressBar
                    current={plan.payments_made || 0}
                    total={plan.total_payments || 1}
                    height="lg"
                  />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  <div className="bg-emerald-500 rounded-2xl p-3 text-center">
                    <p className="text-xs text-white/90 mb-0.5">Paid</p>
                    <p className="text-xs font-bold text-white">
                      GHS {paidAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-emerald-500 rounded-2xl p-3 text-center">
                    <p className="text-xs text-white/90 mb-0.5">Remaining</p>
                    <p className="text-xs font-bold text-white">
                      GHS {Number(plan.remaining_balance || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-emerald-500 rounded-2xl p-3 text-center">
                    <p className="text-xs text-white/90 mb-0.5">Next Due</p>
                    <p className="text-xs font-bold text-white">
                      {plan.next_due_date
                        ? format(new Date(plan.next_due_date), 'dd MMM')
                        : isCompleted ? 'Done!' : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Next payment banner */}
                {!isCompleted && (
                  <div className={`rounded-2xl p-4 mb-4 ${isOverdue ? 'bg-red-50 border-2 border-red-200' : 'bg-gray-50'}`}>
                    <p className={`text-xs font-semibold mb-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                      {isOverdue ? 'OVERDUE PAYMENT' : 'Next Installment'}
                    </p>
                    <p className={`text-3xl font-black ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      GHS {Number(plan.installment_amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                    </p>
                    {plan.next_due_date && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                        {isOverdue
                          ? `Was due ${format(new Date(plan.next_due_date), 'EEEE, dd MMM yyyy')}`
                          : `Due ${format(new Date(plan.next_due_date), 'EEEE, dd MMM yyyy')}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Completed */}
                {isCompleted && (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 mb-4 text-center">
                    <p className="text-2xl mb-1">🎉</p>
                    <p className="font-bold text-emerald-700">Fully Paid!</p>
                    <p className="text-sm text-emerald-600">Your {device.model} is completely yours!</p>
                  </div>
                )}

                {/* Pay button */}
                {!isCompleted && plan.status !== 'completed' && (
                  <PaystackButton
                    amount={plan.installment_amount || 0}
                    email={user?.email}
                    planId={plan.id || plan._id}
                    label="Make Payment"
                    onSuccess={() => {
                      toast.success('Payment successful! Device will unlock shortly.')
                      fetchDashboard()
                    }}
                    onClose={() => {}}
                  />
                )}
              </div>
            </div>

            {/* ── Right col: Recent Payments ── */}
            <div className="lg:col-span-1 mt-4 lg:mt-0">
              <div className="bg-white rounded-2xl shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-gray-800">Recent Payments</h3>
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
                    <p className="text-sm text-gray-400">No payments yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recentPayments.slice(0, 5).map((p) => (
                      <div key={p.id || p._id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">
                            GHS {Number(p.amount || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {p.payment_method === 'paystack' ? 'MoMo / Card' : p.payment_method || 'Mobile Money'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {(p.created_at || p.payment_date || p.createdAt)
                              ? format(new Date(p.created_at || p.payment_date || p.createdAt), 'dd MMM yyyy')
                              : ''}
                          </p>
                          <span className="text-xs font-semibold text-emerald-600">Paid</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Schedule */}
              {plan?.schedule && plan.schedule.length > 0 && (
                <div className="bg-white rounded-2xl shadow-card p-4 mt-4">
                  <h3 className="text-base font-bold text-gray-800 mb-3">Payment Schedule</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
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
        ) : (
          <div className="bg-white rounded-3xl shadow-card p-8 text-center lg:max-w-md lg:mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold">No active installment plan</p>
            <p className="text-sm text-gray-400 mt-1">Contact Tritech Hub iOS to get started</p>
          </div>
        )}

        {/* Mobile-only recent payments (desktop shows in right col) */}
        {recentPayments.length > 0 && (
          <div className="lg:hidden mt-4 bg-white rounded-2xl shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-800">Recent Payments</h3>
              <button
                onClick={() => navigate('/customer/payments')}
                className="text-sm text-emerald-700 font-semibold hover:text-emerald-900"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentPayments.slice(0, 5).map((p) => (
                <div key={p.id || p._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      GHS {Number(p.amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.payment_method === 'paystack' ? 'Mobile Money / Card' : p.payment_method || 'Mobile Money'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {(p.created_at || p.payment_date || p.createdAt)
                        ? format(new Date(p.created_at || p.payment_date || p.createdAt), 'dd MMM yyyy')
                        : ''}
                    </p>
                    <span className="text-xs font-semibold text-emerald-600">Paid</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
