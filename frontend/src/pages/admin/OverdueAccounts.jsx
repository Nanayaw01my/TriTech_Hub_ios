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
    <div className="max-w-5xl mx-auto px-4 pb-24 lg:pb-6 pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-gray-900">Overdue Accounts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {accounts.length} customer{accounts.length !== 1 ? 's' : ''} with overdue or defaulted payments
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

            return (
              <div
                key={acct.plan_id}
                className={`bg-white rounded-2xl shadow-sm border-l-4 p-4
                  ${urgency === 'high' ? 'border-red-500' : urgency === 'medium' ? 'border-orange-400' : 'border-yellow-400'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg
                    ${urgency === 'high' ? 'bg-red-100 text-red-700' : urgency === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {acct.customer_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/admin/customers/${acct.customer_id}`)}
                        className="text-base font-bold text-gray-900 hover:text-green-700 transition-colors"
                      >
                        {acct.customer_name}
                      </button>
                      <StatusBadge status={isLocked ? 'locked' : acct.plan_status} size="sm" />
                      {daysOver > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                          ${urgency === 'high' ? 'bg-red-100 text-red-700' : urgency === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {daysOver}d overdue
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-500">
                      <span>{acct.device_model}</span>
                      {acct.customer_phone && <span>{acct.customer_phone}</span>}
                      {acct.next_due_date && (
                        <span>Due: {format(new Date(acct.next_due_date), 'dd MMM yyyy')}</span>
                      )}
                    </div>
                  </div>

                  {/* Amount + Action */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-black text-red-600">
                      GHS {Number(acct.installment_amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mb-2">
                      Balance: GHS {Number(acct.remaining_balance || 0).toLocaleString()}
                    </p>
                    {isLocked ? (
                      <button
                        onClick={() => setLockModal({ customerId: acct.customer_id, customerName: acct.customer_name, action: 'unlock' })}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-200 transition-colors"
                      >
                        Unlock
                      </button>
                    ) : (
                      <button
                        onClick={() => setLockModal({ customerId: acct.customer_id, customerName: acct.customer_name, action: 'lock' })}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200 transition-colors"
                      >
                        Lock Device
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
    </div>
  )
}
