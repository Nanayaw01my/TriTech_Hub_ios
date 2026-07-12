import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import toast from 'react-hot-toast'
import { format, differenceInDays } from 'date-fns'

export default function OverdueAccounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [lockModal, setLockModal] = useState(null) // { customerId, customerName, action }
  const [lockLoading, setLockLoading] = useState(false)

  const fetchOverdue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/overdue-accounts')
      const d = res.data?.data || res.data
      setAccounts(Array.isArray(d.accounts) ? d.accounts : [])
    } catch {
      toast.error('Failed to load overdue accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOverdue() }, [fetchOverdue])

  const handleLock = async () => {
    if (!lockModal) return
    setLockLoading(true)
    try {
      const url = lockModal.action === 'lock'
        ? `/admin/customers/${lockModal.customerId}/lock`
        : `/admin/customers/${lockModal.customerId}/unlock`
      await api.post(url)
      toast.success(`Device ${lockModal.action === 'lock' ? 'locked' : 'unlocked'} successfully!`)
      setLockModal(null)
      fetchOverdue()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed')
    } finally {
      setLockLoading(false)
    }
  }

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50">

      {/* Mobile Hero */}
      <div className="lg:hidden px-5 pt-8 pb-12 bg-gradient-to-br from-red-50 to-orange-50">
        <p className="text-red-500 text-xs font-semibold uppercase tracking-widest">Admin Portal</p>
        <h1 className="text-gray-900 text-2xl font-black mt-1">Overdue</h1>
        <div className="flex items-center gap-2 mt-2">
          {accounts.length > 0 ? (
            <span className="inline-block bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} overdue
            </span>
          ) : (
            <span className="inline-block bg-emerald-100 text-emerald-700 text-sm font-semibold px-3 py-1 rounded-full">
              All accounts current
            </span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-5 lg:mt-0 lg:pt-4">

      {/* Desktop Header */}
      <div className="hidden lg:block mb-5">
        <h1 className="text-2xl font-black text-gray-900">Overdue Accounts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {accounts.length} customer{accounts.length !== 1 ? 's' : ''} with overdue or defaulted payments
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold">All accounts are up to date!</p>
          <p className="text-sm text-gray-400 mt-1">No overdue or defaulted payments found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acct) => {
            const isLocked = acct.lock_status === 'locked'
            const daysOver = acct.days_overdue ?? 0
            const urgency = daysOver >= 7 ? 'high' : daysOver >= 3 ? 'medium' : 'low'

            const accent = urgency === 'high'
              ? { bar: 'bg-red-500', avatar: 'bg-red-100 text-red-700', pill: 'bg-red-100 text-red-700' }
              : urgency === 'medium'
                ? { bar: 'bg-orange-400', avatar: 'bg-orange-100 text-orange-700', pill: 'bg-orange-100 text-orange-700' }
                : { bar: 'bg-yellow-400', avatar: 'bg-yellow-100 text-yellow-700', pill: 'bg-yellow-100 text-yellow-700' }

            return (
              <div
                key={acct.plan_id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex"
              >
                {/* Urgency accent bar */}
                <div className={`w-1.5 flex-shrink-0 ${accent.bar}`} />

                <div className="flex-1 min-w-0 p-4">
                  {/* Top: identity */}
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg ${accent.avatar}`}>
                      {acct.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/admin/customers/${acct.customer_id}`)}
                          className="text-base font-bold text-gray-900 hover:text-emerald-700 transition-colors truncate"
                        >
                          {acct.customer_name}
                        </button>
                        <StatusBadge status={isLocked ? 'locked' : acct.plan_status} size="sm" />
                        {daysOver > 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${accent.pill}`}>
                            {daysOver}d overdue
                          </span>
                        )}
                      </div>

                      {/* Meta with icons */}
                      <div className="mt-1.5 space-y-1 text-sm text-gray-500">
                        <p className="flex items-center gap-1.5 truncate">
                          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          {acct.device_model}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {acct.customer_phone && (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              {acct.customer_phone}
                            </span>
                          )}
                          {acct.next_due_date && (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              Due {format(new Date(acct.next_due_date), 'dd MMM yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer: amount + action */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-none">Installment due</p>
                      <p className="text-xl font-black text-red-600 leading-tight mt-0.5">
                        GHS {Number(acct.installment_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        Balance: GHS {Number(acct.remaining_balance || 0).toLocaleString()}
                      </p>
                    </div>
                    {isLocked ? (
                      <button
                        onClick={() => setLockModal({ customerId: acct.customer_id, customerName: acct.customer_name, action: 'unlock' })}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all flex-shrink-0 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                        Unlock
                      </button>
                    ) : (
                      <button
                        onClick={() => setLockModal({ customerId: acct.customer_id, customerName: acct.customer_name, action: 'lock' })}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 active:scale-95 transition-all flex-shrink-0 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Lock
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={!!lockModal}
        onClose={() => setLockModal(null)}
        onConfirm={handleLock}
        title={lockModal?.action === 'lock' ? 'Lock Device' : 'Unlock Device'}
        message={
          lockModal?.action === 'lock'
            ? `Lock ${lockModal?.customerName}'s device? They won't be able to use it until unlocked.`
            : `Unlock ${lockModal?.customerName}'s device?`
        }
        confirmText={lockModal?.action === 'lock' ? 'Lock Device' : 'Unlock Device'}
        confirmVariant={lockModal?.action === 'lock' ? 'danger' : 'primary'}
        loading={lockLoading}
      />
      </div>{/* end max-w-5xl */}
    </div>
  )
}
