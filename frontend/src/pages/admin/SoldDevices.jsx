import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import Skeleton from '../../components/Skeleton'
import { format } from 'date-fns'

// Devices staff have sold to customers — lock / unlock each one from here.
export default function SoldDevices() {
  const navigate = useNavigate()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [lockModal, setLockModal] = useState(null) // { sale, action }
  const [lockLoading, setLockLoading] = useState(false)
  const PER = 25

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page,
        limit: PER,
        ...(search && { search }),
        ...(status && { status }),
      })
      const res = await api.get(`/admin/device-sales?${params}`)
      const d = res.data?.data || res.data
      setSales(Array.isArray(d.sales) ? d.sales : [])
      setTotalPages(d.totalPages || 1)
    } catch {
      toast.error('Failed to load sold devices')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { fetchSales() }, [fetchSales])

  const handleLockToggle = async () => {
    if (!lockModal) return
    const { sale, action } = lockModal
    setLockLoading(true)
    try {
      const res = await api.post(`/admin/customers/${sale.customer_id}/${action}`)
      toast.success(res.data?.message || `Device ${action === 'lock' ? 'locked' : 'unlocked'}.`, { duration: 6000 })
      setLockModal(null)
      fetchSales()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed', { duration: 8000 })
    } finally {
      setLockLoading(false)
    }
  }

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Admin</p>
        <h1 className="text-2xl font-black text-gray-900 mb-4">Devices Sold</h1>

        {/* Search + filter */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by customer, device…"
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-emerald-600 bg-white"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-emerald-600 bg-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="defaulted">Defaulted</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} rounded="rounded-2xl" className="h-40" />)}
          </div>
        ) : sales.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-card">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No sold devices yet</p>
            <p className="text-sm text-gray-400 mt-1">Devices appear here when staff register customers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((s) => {
              const isLocked = s.lock_status === 'locked'
              return (
                <div key={s._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  {/* Customer + device */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 font-black text-emerald-800 text-lg">
                      {(s.customer_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{s.customer_name}</p>
                        <StatusBadge status={s.status === 'completed' ? 'completed' : s.status === 'defaulted' ? 'overdue' : 'active'} size="sm" />
                        {isLocked && <StatusBadge status="locked" size="sm" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{s.customer_phone} · sold by {s.staff_name}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/admin/customers/${s.customer_id}`)}
                      className="text-xs text-emerald-700 font-semibold hover:text-emerald-900 flex-shrink-0"
                    >
                      View →
                    </button>
                  </div>

                  {/* Device */}
                  <div className="bg-gray-50 rounded-xl px-3 py-2 mt-3 flex items-center gap-2 flex-wrap">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-bold text-gray-800">{s.device_model}</span>
                    {s.device_storage && <span className="text-xs bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-lg">{s.device_storage}</span>}
                    {s.device_serial && <span className="text-xs font-mono text-gray-400 ml-auto truncate">SN: {s.device_serial}</span>}
                  </div>

                  {/* Payment + actions */}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="text-sm">
                      <span className="text-gray-400 text-xs">Balance </span>
                      <span className={`font-black ${s.remaining_balance > 0 ? 'text-orange-600' : 'text-emerald-700'}`}>
                        GHS {Number(s.remaining_balance || 0).toLocaleString()}
                      </span>
                      <span className="text-gray-400 text-xs"> of {Number(s.total_price || 0).toLocaleString()}</span>
                    </div>
                    {!s.has_udid ? (
                      <span className="text-[11px] text-gray-400">Add UDID to lock</span>
                    ) : (
                      <button
                        onClick={() => setLockModal({ sale: s, action: isLocked ? 'unlock' : 'lock' })}
                        className={`text-sm px-4 py-2 rounded-xl font-bold transition-colors flex-shrink-0
                          ${isLocked
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                      >
                        {isLocked ? 'Unlock' : 'Lock'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40">Prev</button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!lockModal}
        onClose={() => setLockModal(null)}
        onConfirm={handleLockToggle}
        title={lockModal?.action === 'lock' ? 'Lock Device' : 'Unlock Device'}
        message={
          lockModal?.action === 'lock'
            ? `Lock ${lockModal?.sale?.customer_name}'s ${lockModal?.sale?.device_model}? They'll be notified and the phone locks until they pay.`
            : `Unlock ${lockModal?.sale?.customer_name}'s ${lockModal?.sale?.device_model}?`
        }
        confirmText={lockModal?.action === 'lock' ? 'Lock' : 'Unlock'}
        confirmVariant={lockModal?.action === 'lock' ? 'danger' : 'primary'}
        loading={lockLoading}
      />
    </div>
  )
}
