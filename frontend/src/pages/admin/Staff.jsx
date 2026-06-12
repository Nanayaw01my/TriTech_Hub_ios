import React, { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmModal from '../../components/ConfirmModal'
import toast from 'react-hot-toast'

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

export default function AdminStaff() {
  const [tab, setTab] = useState('team')
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [errors, setErrors] = useState({})

  // Commission tab state
  const [period, setPeriod] = useState('month')
  const [salesData, setSalesData] = useState([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [rateModal, setRateModal] = useState(null) // { _id, name, commission_per_sale }
  const [rateValue, setRateValue] = useState('')
  const [rateLoading, setRateLoading] = useState(false)

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/staff')
      const d = res.data?.data || res.data
      setStaff(Array.isArray(d.staff) ? d.staff : [])
    } catch {
      toast.error('Failed to load staff')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSales = useCallback(async () => {
    setSalesLoading(true)
    try {
      const res = await api.get(`/admin/staff-sales?period=${period}`)
      const d = res.data?.data || res.data
      setSalesData(Array.isArray(d.salesData) ? d.salesData : [])
    } catch {
      toast.error('Failed to load sales data')
    } finally {
      setSalesLoading(false)
    }
  }, [period])

  useEffect(() => { fetchStaff() }, [fetchStaff])
  useEffect(() => { if (tab === 'commission') fetchSales() }, [tab, fetchSales])

  const validateForm = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAddStaff = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setAddLoading(true)
    try {
      await api.post('/admin/staff', form)
      toast.success('Staff member added successfully!')
      setShowAddModal(false)
      setForm({ name: '', email: '', phone: '', password: '' })
      setErrors({})
      fetchStaff()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add staff member')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await api.delete(`/admin/staff/${deleteModal._id || deleteModal.id}`)
      toast.success('Staff member removed')
      setDeleteModal(null)
      fetchStaff()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to remove staff')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSaveRate = async () => {
    const val = Number(rateValue)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid amount'); return }
    setRateLoading(true)
    try {
      await api.patch(`/admin/staff/${rateModal._id}/commission`, { commission_per_sale: val })
      toast.success('Commission rate updated')
      setRateModal(null)
      fetchSales()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update rate')
    } finally {
      setRateLoading(false)
    }
  }

  const totalCommission = salesData.reduce((s, d) => s + (d.commission_owed || 0), 0)
  const totalSales = salesData.reduce((s, d) => s + (d.period_sales || 0), 0)

  return (
    <div className="max-w-3xl mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">{staff.length} team members</p>
        </div>
        {tab === 'team' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-800 text-white font-semibold text-sm rounded-2xl
                       hover:bg-green-900 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Staff
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-5">
        {[{ id: 'team', label: 'Team' }, { id: 'commission', label: 'Sales & Commission' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all
              ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TEAM TAB ── */}
      {tab === 'team' && (
        <>
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
          ) : staff.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-card">
              <svg className="w-14 h-14 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-gray-500 font-medium">No staff members yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-card divide-y divide-gray-50">
              {staff.map((s) => (
                <div key={s._id || s.id} className="flex items-center gap-3 px-4 py-4">
                  <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-bold">
                      {(s.full_name || s.name || 'S').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{s.full_name || s.name}</p>
                    <p className="text-xs text-gray-500 truncate">{s.email}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {s.staff_id && (
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{s.staff_id}</span>
                      )}
                      {s.customers_count !== undefined && (
                        <span className="text-xs text-gray-400">{s.customers_count} customers</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.phone && <p className="text-xs text-gray-400 hidden sm:block">{s.phone}</p>}
                    <button
                      onClick={() => setDeleteModal(s)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Remove staff"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── COMMISSION TAB ── */}
      {tab === 'commission' && (
        <>
          {/* Period filter */}
          <div className="flex gap-2 mb-4">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${period === p.value
                    ? 'bg-green-800 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-green-400'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          {!salesLoading && salesData.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-4 shadow-card">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Sales</p>
                <p className="text-3xl font-black text-gray-900 mt-1">{totalSales}</p>
                <p className="text-xs text-gray-400 mt-0.5">iPhones sold</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-card">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Commission Due</p>
                <p className="text-3xl font-black text-green-700 mt-1">GHS {totalCommission.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">Total owed to staff</p>
              </div>
            </div>
          )}

          {salesLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
          ) : salesData.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-card">
              <p className="text-gray-500 font-medium">No staff data found</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Staff Sales — {PERIODS.find(p => p.value === period)?.label}
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {salesData.map((s) => (
                  <div key={s._id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 font-bold text-sm">
                            {(s.name || 'S').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                          {s.staff_id && (
                            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{s.staff_id}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setRateModal(s); setRateValue(String(s.commission_per_sale || 0)) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700
                                   bg-green-50 hover:bg-green-100 rounded-xl transition-colors flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Set Rate
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                        <p className="text-xl font-black text-gray-900">{s.period_sales}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">Sales</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                        <p className="text-sm font-bold text-gray-700">GHS {(s.commission_per_sale || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">Per Sale</p>
                      </div>
                      <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                        <p className="text-sm font-black text-green-700">GHS {(s.commission_owed || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-green-500 font-medium uppercase mt-0.5">Owed</p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-2">{s.total_sales} total customers registered (all time)</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Add Staff Member</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">A Staff ID will be auto-generated.</p>

            <form onSubmit={handleAddStaff} className="space-y-4" noValidate>
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Enter full name' },
                { key: 'email', label: 'Email Address', type: 'email', placeholder: 'staff@example.com' },
                { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '0244000000' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600
                      ${errors[key] ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
                </div>
              ))}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password <span className="text-gray-400 font-normal text-xs">(min 6 characters)</span>
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value.slice(0, 20) }))}
                  placeholder="Set password"
                  className={`w-full px-4 py-3 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600
                    ${errors.password ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-2xl text-gray-700 font-semibold text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={addLoading}
                  className="flex-1 py-3 bg-green-800 text-white font-semibold text-sm rounded-2xl
                             hover:bg-green-900 disabled:opacity-60 flex items-center justify-center gap-2">
                  {addLoading && <LoadingSpinner size="sm" color="white" />}
                  Add Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Commission Rate Modal */}
      {rateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setRateModal(null)} />
          <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Commission Rate</h2>
              <button onClick={() => setRateModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Set how much <span className="font-semibold text-gray-700">{rateModal.name}</span> earns per iPhone sold (in GHS).
            </p>

            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">GHS</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                className="w-full pl-14 pr-4 py-3.5 border-2 border-gray-200 rounded-2xl text-sm
                           focus:outline-none focus:border-green-600 font-semibold"
                placeholder="0.00"
                autoFocus
              />
            </div>

            {Number(rateValue) > 0 && (
              <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2 mb-4">
                At {rateModal.period_sales} sales this period → <strong>GHS {(rateModal.period_sales * Number(rateValue)).toLocaleString()}</strong> commission owed
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setRateModal(null)}
                className="flex-1 py-3 border-2 border-gray-200 rounded-2xl text-gray-700 font-semibold text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSaveRate} disabled={rateLoading}
                className="flex-1 py-3 bg-green-800 text-white font-semibold text-sm rounded-2xl
                           hover:bg-green-900 disabled:opacity-60 flex items-center justify-center gap-2">
                {rateLoading && <LoadingSpinner size="sm" color="white" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        title="Remove Staff Member"
        message={`Are you sure you want to remove ${deleteModal?.full_name || deleteModal?.name}? This action cannot be undone.`}
        confirmText="Remove"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  )
}
