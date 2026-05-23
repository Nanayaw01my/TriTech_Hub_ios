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

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className={`px-5 pt-6 pb-10 ${isLocked ? 'bg-red-700' : isOverdue ? 'bg-orange-700' : 'bg-green-800'}`}>
        <p className="text-white text-opacity-75 text-sm">Welcome back,</p>
        <h1 className="text-white text-2xl font-black mt-0.5">
          {(user?.full_name || user?.name || 'Customer').split(' ')[0]} 👋
        </h1>
        {user?.account_number && (
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-white bg-opacity-20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {user.account_number}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 -mt-5 space-y-4">
        {/* Device Card */}
        {device && plan ? (
          <div className="bg-white rounded-3xl shadow-lg p-5">
            {/* Device Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0
                ${isLocked ? 'bg-red-100' : 'bg-green-100'}`}>
                {isLocked ? (
                  <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
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

            {/* Lock Alert */}
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

            {/* Progress Bar */}
            <div className="mb-4">
              <ProgressBar
                current={plan.payments_made || 0}
                total={plan.total_payments || 1}
                height="lg"
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">Paid</p>
                <p className="text-sm font-bold text-green-700">
                  GHS {paidAmount.toLocaleString()}
                </p>
              </div>
              <div className="bg-orange-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-0.5">Remaining</p>
                <p className="text-sm font-bold text-orange-600">
                  GHS {Number(plan.remaining_balance || 0).toLocaleString()}
                </p>
              </div>
              <div className={`rounded-2xl p-3 text-center ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
                <p className="text-xs text-gray-500 mb-0.5">Next Due</p>
                <p className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                  {plan.next_due_date
                    ? format(new Date(plan.next_due_date), 'dd MMM')
                    : isCompleted ? 'Done!' : 'N/A'}
                </p>
              </div>
            </div>

            {/* Next Payment Banner */}
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
                      : `Due ${format(new Date(plan.next_due_date), 'EEEE, dd MMM yyyy')}`
                    }
                  </p>
                )}
              </div>
            )}

            {/* Completed */}
            {isCompleted && (
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 mb-4 text-center">
                <p className="text-2xl mb-1">🎉</p>
                <p className="font-bold text-green-700">Fully Paid!</p>
                <p className="text-sm text-green-600">Your {device.model} is completely yours!</p>
              </div>
            )}

            {/* Pay Button */}
            {!isCompleted && plan.status !== 'completed' && (
              <PaystackButton
                amount={plan.installment_amount || 0}
                email={user?.email}
                planId={plan.id || plan._id}
                label="Make Payment"
                onSuccess={(res) => {
                  toast.success('Payment successful! Device will unlock shortly.')
                  fetchDashboard()
                }}
                onClose={() => {}}
              />
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-card p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600 font-semibold">No active installment plan</p>
            <p className="text-sm text-gray-400 mt-1">Contact Tritech Hub iOS to get started</p>
          </div>
        )}

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-800">Recent Payments</h3>
              <button
                onClick={() => navigate('/customer/payments')}
                className="text-sm text-green-700 font-semibold hover:text-green-900"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentPayments.slice(0, 5).map((p) => (
                <div key={p.id || p._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-green-700">
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
                    <span className="text-xs font-semibold text-green-600">Paid</span>
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
