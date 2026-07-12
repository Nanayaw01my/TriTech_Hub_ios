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
        <div className="bg-white rounded-2xl shadow-sm px-4 sm:px-5 divide-y divide-gray-100">
          {accounts.map((acct) => {
            const isLocked = acct.lock_status === 'locked'
            const daysOver = acct.days_overdue ?? 0
            const urgencyText = daysOver >= 7 ? 'text-red-600' : daysOver >= 3 ? 'text-orange-500' : 'text-yellow-600'

            return (
              <div key={acct.plan_id} className="flex items-center gap-4 py-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold flex-shrink-0">
                  {acct.customer_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigate(`/admin/customers/${acct.customer_id}`)}
                      className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors truncate"
                    >
                      {acct.customer_name}
                    </button>
                    {isLocked && <span className="text-xs text-gray-400">Locked</span>}
                    {daysOver > 0 && <span className={`text-xs font-medium ${urgencyText}`}>· {daysOver}d overdue</span>}
                  </div>
                  <p className="text-sm text-gray-400 truncate mt-0.5">
                    {[acct.device_model, acct.next_due_date && `Due ${format(new Date(acct.next_due_date), 'dd MMM')}`].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-sm mt-0.5">
                    <span className="font-bold text-gray-900">GHS {Number(acct.installment_amount || 0).toLocaleString()}</span>
                    <span className="text-gray-400"> · Bal GHS {Number(acct.remaining_balance || 0).toLocaleString()}</span>
                  </p>
                </div>

                {/* Action — understated text button */}
                {isLocked ? (
                  <button
                    onClick={() => setLockModal({ customerId: acct.customer_id, customerName: acct.customer_name, action: 'unlock' })}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors flex-shrink-0"
                  >
                    Unlock
                  </button>
                ) : (
                  <button
                    onClick={() => setLockModal({ customerId: acct.customer_id, customerName: acct.customer_name, action: 'lock' })}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    Lock
                  </button>
                )}
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
