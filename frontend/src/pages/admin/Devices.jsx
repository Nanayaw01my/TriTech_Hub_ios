import React, { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const ANDROID_MODELS = [
  // itel
  { model: 'itel A70', price: 850 },
  { model: 'itel S23', price: 1400 },
  // Tecno
  { model: 'Tecno Spark Go 2024', price: 900 },
  { model: 'Tecno Spark 20', price: 1300 },
  { model: 'Tecno Spark 20 Pro', price: 1800 },
  { model: 'Tecno Camon 20', price: 2200 },
  { model: 'Tecno Camon 30', price: 3200 },
  { model: 'Tecno Pova 6', price: 3000 },
  { model: 'Tecno Phantom V Flip', price: 7000 },
  // Infinix
  { model: 'Infinix Smart 8', price: 900 },
  { model: 'Infinix Hot 40i', price: 1300 },
  { model: 'Infinix Hot 40 Pro', price: 1900 },
  { model: 'Infinix Note 40', price: 2600 },
  { model: 'Infinix Note 40 Pro', price: 3400 },
  { model: 'Infinix Zero 30', price: 4200 },
  // Redmi / Xiaomi
  { model: 'Redmi 13C', price: 1300 },
  { model: 'Xiaomi Redmi A3', price: 1100 },
  { model: 'Redmi Note 13', price: 2200 },
  { model: 'Redmi Note 13 Pro', price: 3200 },
  // Samsung
  { model: 'Samsung Galaxy A05', price: 1200 },
  { model: 'Samsung Galaxy A15', price: 1900 },
  { model: 'Samsung Galaxy A25 5G', price: 2800 },
  { model: 'Samsung Galaxy A35 5G', price: 4200 },
  { model: 'Samsung Galaxy A55 5G', price: 5500 },
  { model: 'Samsung Galaxy S23', price: 9000 },
  { model: 'Samsung Galaxy S24', price: 12000 },
  { model: 'Samsung Galaxy S24 Ultra', price: 18000 },
  // Oppo
  { model: 'Oppo A58', price: 2000 },
  { model: 'Oppo Reno 11', price: 4500 },
]

const STORAGE_OPTIONS = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB']

const ANDROID_COLORS = [
  'Black', 'White', 'Blue', 'Light Blue', 'Dark Blue', 'Green', 'Gray',
  'Gold', 'Silver', 'Purple', 'Red', 'Pink', 'Cyan', 'Titanium Gray', 'Titanium Black',
]

const COLOR_DOTS = {
  Black: '#1c1c1e', White: '#f5f5f0', Blue: '#3b82f6', 'Light Blue': '#7dd3fc',
  'Dark Blue': '#1e3a8a', Green: '#22c55e', Gray: '#6b7280', Gold: '#d4af37',
  Silver: '#cbd5e1', Purple: '#a855f7', Red: '#ef4444', Pink: '#ec4899',
  Cyan: '#06b6d4', 'Titanium Gray': '#a8a095', 'Titanium Black': '#2d2d2d',
}

const initForm = { model: '', color: '', storage: '', price: '' }

export default function AdminDevices() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('catalog')

  // Catalog tab state
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [lockFilter, setLockFilter] = useState('')
  const [lockModal, setLockModal] = useState(null)
  const [lockLoading, setLockLoading] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form, setForm] = useState(initForm)
  const [errors, setErrors] = useState({})

  // Sales tab state
  const [sales, setSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesSearch, setSalesSearch] = useState('')
  const [salesStatus, setSalesStatus] = useState('')
  const [salesPage, setSalesPage] = useState(1)
  const [salesTotalPages, setSalesTotalPages] = useState(1)
  const [salesTotal, setSalesTotal] = useState(0)

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(statusFilter && { status: statusFilter }),
        ...(lockFilter && { is_locked: lockFilter }),
      })
      const res = await api.get(`/admin/devices?${params}`)
      const d = res.data?.data || res.data
      setDevices(Array.isArray(d.devices) ? d.devices : [])
    } catch {
      toast.error('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, lockFilter])

  const fetchSales = useCallback(async () => {
    setSalesLoading(true)
    try {
      const params = new URLSearchParams({
        page: salesPage,
        limit: 25,
        ...(salesSearch && { search: salesSearch }),
        ...(salesStatus && { status: salesStatus }),
      })
      const res = await api.get(`/admin/device-sales?${params}`)
      const d = res.data?.data || res.data
      setSales(Array.isArray(d.sales) ? d.sales : [])
      setSalesTotal(d.total || 0)
      setSalesTotalPages(d.totalPages || 1)
    } catch {
      toast.error('Failed to load sales')
    } finally {
      setSalesLoading(false)
    }
  }, [salesPage, salesSearch, salesStatus])

  useEffect(() => { fetchDevices() }, [fetchDevices])
  useEffect(() => { if (tab === 'sales') fetchSales() }, [tab, fetchSales])

  const handleModelChange = (model) => {
    const found = ANDROID_MODELS.find(m => m.model === model)
    setForm(f => ({ ...f, model, price: found ? String(found.price) : '' }))
  }

  const validateForm = () => {
    const e = {}
    if (!form.model.trim()) e.model = 'Model name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAddDevice = async (ev) => {
    ev.preventDefault()
    if (!validateForm()) return
    setAddLoading(true)
    try {
      await api.post('/admin/devices', form)
      toast.success('Device added!')
      setShowAddModal(false)
      setForm(initForm)
      setErrors({})
      fetchDevices()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to add device')
    } finally {
      setAddLoading(false)
    }
  }

  const handleLockToggle = async () => {
    setLockLoading(true)
    const isLocking = lockModal.lock_status !== 'locked'
    try {
      const deviceId = lockModal._id || lockModal.id
      const endpoint = isLocking
        ? `/admin/devices/${deviceId}/lock`
        : `/admin/devices/${deviceId}/unlock`
      await api.post(endpoint)
      if (isLocking) {
        toast.success('Device marked as locked. Go to icloud.com to restrict iCloud access.', { duration: 5000 })
      } else {
        toast.success('Device marked as unlocked. Go to icloud.com to restore iCloud access.', { duration: 5000 })
      }
      setLockModal(null)
      fetchDevices()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Action failed')
    } finally {
      setLockLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleteLoading(true)
    try {
      const deviceId = deleteModal._id || deleteModal.id
      await api.delete(`/admin/devices/${deviceId}`)
      toast.success('Device deleted.')
      setDeleteModal(null)
      fetchDevices()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Could not delete device.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">

      {/* Mobile Hero */}
      <div className="lg:hidden px-5 pt-6 pb-12 bg-gradient-to-br from-gray-50 to-orange-50">
        <p className="text-orange-500 text-xs font-semibold uppercase tracking-widest">Admin Portal</p>
        <div className="flex items-start justify-between mt-1">
          <div>
            <h1 className="text-gray-900 text-2xl font-black">Devices</h1>
            <p className="text-gray-600 text-sm mt-1">
              {tab === 'catalog' ? `${devices.length} in catalog` : `${salesTotal} sales`}
            </p>
          </div>
          {tab === 'catalog' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold rounded-xl active:scale-95 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-5 lg:mt-0 lg:pt-4">

      {/* Desktop Header */}
      <div className="hidden lg:flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tab === 'catalog' ? `${devices.length} in catalog` : `${salesTotal} total sales`}
          </p>
        </div>
        {tab === 'catalog' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white font-semibold text-sm rounded-xl
                       hover:bg-orange-500 active:scale-95 transition-all shadow-lg shadow-orange-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Device
          </button>
        )}
      </div>

      {/* Catalog — phones the admin adds for staff to sell. Sold devices now
          live on the dedicated "Devices Sold" page. */}
      {tab === 'catalog' && (<>
      {/* Filter — lock status only (all catalog items are unassigned) */}
      <div className="flex gap-2 mb-4">
        <select
          value={lockFilter}
          onChange={(e) => setLockFilter(e.target.value)}
          className="flex-1 px-3 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-orange-500 bg-white"
        >
          <option value="">All Lock Status</option>
          <option value="false">Unlocked</option>
          <option value="true">Locked</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-card">
          <svg className="w-14 h-14 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 font-medium">No devices found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card divide-y divide-gray-50">
          {devices.map((d) => {
            const isLocked = d.lock_status === 'locked' || d.is_locked
            const dotColor = COLOR_DOTS[d.color] || '#9ca3af'
            return (
              <div key={d._id || d.id} className="flex items-center gap-3 px-4 py-4">
                {/* Color dot + icon */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {d.color && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-tight">
                    {d.model || d.device_model}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {d.color && (
                      <span className="text-xs text-gray-500 font-medium">{d.color}</span>
                    )}
                    {d.color && d.storage && <span className="text-gray-300 text-xs">·</span>}
                    {d.storage && (
                      <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-lg">{d.storage}</span>
                    )}
                  </div>
                  {d.serial_number && <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">SN: {d.serial_number}</p>}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <StatusBadge status={d.sold_status || d.status || 'available'} />
                    {isLocked && <StatusBadge status="locked" />}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">GHS {Number(d.price || 0).toLocaleString()}</p>
                  <button
                    onClick={() => setLockModal(d)}
                    className={`mt-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors
                      ${isLocked
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                  >
                    {isLocked ? 'Unlock' : 'Lock'}
                  </button>
                  <button
                    onClick={() => setDeleteModal(d)}
                    className="mt-1.5 ml-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>)} {/* end catalog tab */}

      {/* ── SALES TAB ── */}
      {tab === 'sales' && (
        <>
          {/* Search + filter */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={salesSearch}
                onChange={(e) => { setSalesSearch(e.target.value); setSalesPage(1) }}
                placeholder="Search by customer, device..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-orange-500 bg-white"
              />
            </div>
            <select
              value={salesStatus}
              onChange={(e) => { setSalesStatus(e.target.value); setSalesPage(1) }}
              className="px-3 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-orange-500 bg-white"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="defaulted">Defaulted</option>
            </select>
          </div>

          {salesLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
          ) : sales.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-card">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No sales yet</p>
              <p className="text-sm text-gray-400 mt-1">Sales appear here when staff register customers</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {sales.map((s) => {
                  const pct = s.total_price > 0 ? Math.round((s.amount_paid / s.total_price) * 100) : 0
                  const isCompleted = s.status === 'completed'
                  const isDefaulted = s.status === 'defaulted'

                  return (
                    <div
                      key={s._id}
                      onClick={() => s.customer_id && navigate(`/admin/customers/${s.customer_id}`)}
                      className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                    >
                      {/* Customer + Device row */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 font-black text-orange-500 text-lg">
                          {s.customer_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-sm">{s.customer_name}</p>
                            <StatusBadge status={isCompleted ? 'completed' : isDefaulted ? 'overdue' : 'active'} size="sm" />
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{s.customer_phone}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">{s.start_date ? format(new Date(s.start_date), 'dd MMM yyyy') : ''}</p>
                          <p className="text-xs text-orange-500 font-semibold mt-0.5">{s.staff_name}</p>
                        </div>
                      </div>

                      {/* Device details */}
                      <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 flex items-center gap-2 flex-wrap">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-bold text-gray-800">{s.device_model}</span>
                        {s.device_color && <span className="text-xs text-gray-500">{s.device_color}</span>}
                        {s.device_storage && (
                          <span className="text-xs bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-lg">{s.device_storage}</span>
                        )}
                        {s.device_serial && (
                          <span className="text-xs font-mono text-gray-400 ml-auto truncate">SN: {s.device_serial}</span>
                        )}
                      </div>

                      {/* Payment stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Total Price</p>
                          <p className="text-sm font-black text-gray-900">GHS {Number(s.total_price).toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Paid</p>
                          <p className="text-sm font-black text-orange-600">GHS {Number(s.amount_paid).toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-0.5">Balance</p>
                          <p className={`text-sm font-black ${s.remaining_balance > 0 ? 'text-orange-600' : 'text-orange-600'}`}>
                            GHS {Number(s.remaining_balance).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-400">{s.payments_made}/{s.total_payments} payments</span>
                          <span className="text-[10px] font-bold text-orange-600">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isCompleted ? 'bg-orange-500' : isDefaulted ? 'bg-red-400' : 'bg-orange-500'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {salesTotalPages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                    disabled={salesPage === 1}
                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 font-medium">Page {salesPage} of {salesTotalPages}</span>
                  <button
                    onClick={() => setSalesPage(p => Math.min(salesTotalPages, p + 1))}
                    disabled={salesPage === salesTotalPages}
                    className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header strip */}
            <div className="h-1 bg-gradient-to-r from-orange-500 to-orange-400 rounded-t-3xl sm:rounded-t-3xl" />

            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900">Add Device</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddDevice} className="space-y-4" noValidate>

                {/* Model */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Android Model *</label>
                  <ModelPickerInput
                    value={form.model}
                    onChange={(v) => handleModelChange(v)}
                    error={errors.model}
                  />
                  {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
                </div>

                {/* Color + Storage row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Color</label>
                    <select
                      value={form.color}
                      onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-orange-500 bg-gray-50"
                    >
                      <option value="">Select color</option>
                      {ANDROID_COLORS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Storage</label>
                    <select
                      value={form.storage}
                      onChange={(e) => setForm(f => ({ ...f, storage: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-orange-500 bg-gray-50"
                    >
                      <option value="">Select storage</option>
                      {STORAGE_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Color preview */}
                {form.color && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 rounded-2xl border border-gray-100">
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white shadow flex-shrink-0"
                      style={{ backgroundColor: COLOR_DOTS[form.color] || '#9ca3af' }}
                    />
                    <span className="text-sm font-medium text-gray-700">{form.color}</span>
                    {form.storage && <span className="text-gray-400">·</span>}
                    {form.storage && <span className="text-sm font-semibold text-gray-600 bg-gray-200 px-2 py-0.5 rounded-lg">{form.storage}</span>}
                  </div>
                )}

                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Price (GHS)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Auto-filled from model"
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-orange-500 bg-gray-50"
                  />
                </div>

                {/* Serial number & UDID are entered by staff per phone at customer registration, not here. */}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 border-2 border-gray-200 rounded-2xl text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold text-sm rounded-2xl
                               hover:from-orange-500 hover:to-orange-600 disabled:opacity-60 flex items-center justify-center gap-2
                               shadow-lg shadow-orange-600/20 transition-all"
                  >
                    {addLoading && <LoadingSpinner size="sm" color="white" />}
                    Add Device
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!lockModal}
        onClose={() => setLockModal(null)}
        onConfirm={handleLockToggle}
        title={lockModal?.lock_status === 'locked' ? 'Unlock Device' : 'Lock Device'}
        message={
          lockModal?.lock_status === 'locked'
            ? `Mark ${lockModal?.model}${lockModal?.color ? ` (${lockModal.color})` : ''} as unlocked in the system. You will also need to restore iCloud access on icloud.com manually.`
            : `Mark ${lockModal?.model}${lockModal?.color ? ` (${lockModal.color})` : ''} as locked in the system. You will also need to remove iCloud access on icloud.com manually to restrict the device.`
        }
        confirmText={lockModal?.lock_status === 'locked' ? 'Mark Unlocked' : 'Mark Locked'}
        confirmVariant={lockModal?.lock_status === 'locked' ? 'primary' : 'danger'}
        loading={lockLoading}
      />

      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDelete}
        title="Delete Device"
        message={`Permanently delete ${deleteModal?.model || 'this device'}${deleteModal?.color ? ` (${deleteModal.color})` : ''} from the catalog? This cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
      />
      </div>{/* end max-w-5xl */}
    </div>
  )
}

function ModelPickerInput({ value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value || '')
  const containerRef = useRef(null)

  useEffect(() => { setSearch(value || '') }, [value])

  useEffect(() => {
    const close = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [])

  const filtered = ANDROID_MODELS.filter(m =>
    m.model.toLowerCase().includes(search.toLowerCase())
  )

  const handleInput = (e) => {
    const v = e.target.value
    setSearch(v)
    onChange(v)
    setOpen(true)
  }

  const select = (model) => {
    setSearch(model)
    onChange(model)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={search}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Samsung Galaxy A55 5G"
        autoComplete="off"
        className={`w-full px-4 py-3 border-2 rounded-2xl text-sm focus:outline-none focus:border-orange-500 bg-gray-50
          ${error ? 'border-red-400' : 'border-gray-100'}`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map(m => (
            <button
              key={m.model}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(m.model) }}
              onTouchEnd={(e) => { e.preventDefault(); select(m.model) }}
              className="w-full text-left px-4 py-3 text-sm hover:bg-orange-50 active:bg-orange-100 border-b border-gray-50 last:border-0 flex justify-between items-center gap-2"
            >
              <span className="font-medium text-gray-800">{m.model}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">GHS {m.price.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
