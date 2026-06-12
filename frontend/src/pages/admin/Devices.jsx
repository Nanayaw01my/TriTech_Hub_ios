import React, { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ConfirmModal from '../../components/ConfirmModal'
import toast from 'react-hot-toast'

const IPHONE_MODELS = [
  { model: 'iPhone 12', price: 3500 },
  { model: 'iPhone 12 Pro', price: 4500 },
  { model: 'iPhone 12 Pro Max', price: 5000 },
  { model: 'iPhone 13', price: 5500 },
  { model: 'iPhone 13 Pro', price: 7000 },
  { model: 'iPhone 13 Pro Max', price: 7500 },
  { model: 'iPhone 14', price: 8500 },
  { model: 'iPhone 14 Pro', price: 11000 },
  { model: 'iPhone 14 Pro Max', price: 12500 },
  { model: 'iPhone 15', price: 10500 },
  { model: 'iPhone 15 Pro', price: 14000 },
  { model: 'iPhone 15 Pro Max', price: 16000 },
  { model: 'iPhone 16', price: 18000 },
  { model: 'iPhone 16 Pro', price: 20000 },
  { model: 'iPhone 16 Pro Max', price: 22000 },
]

const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB']

const IPHONE_COLORS = [
  'Black', 'White', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Red',
  'Midnight', 'Starlight', 'Blue Titanium', 'Natural Titanium', 'White Titanium',
  'Black Titanium', 'Desert Titanium', 'Ultramarine', 'Teal',
]

const COLOR_DOTS = {
  Black: '#1c1c1e', White: '#f5f5f0', Blue: '#3b82f6', Green: '#22c55e',
  Yellow: '#eab308', Pink: '#ec4899', Purple: '#a855f7', Red: '#ef4444',
  Midnight: '#1e293b', Starlight: '#f0ebe3', 'Blue Titanium': '#60a5fa',
  'Natural Titanium': '#a8a095', 'White Titanium': '#e8e8e4',
  'Black Titanium': '#2d2d2d', 'Desert Titanium': '#c8a882',
  Ultramarine: '#3730a3', Teal: '#14b8a6',
}

const initForm = { model: '', color: '', storage: '', price: '', serial_number: '', udid: '' }

export default function AdminDevices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [lockFilter, setLockFilter] = useState('')
  const [lockModal, setLockModal] = useState(null)
  const [lockLoading, setLockLoading] = useState(false)
  const [form, setForm] = useState(initForm)
  const [errors, setErrors] = useState({})

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

  useEffect(() => { fetchDevices() }, [fetchDevices])

  const handleModelChange = (model) => {
    const found = IPHONE_MODELS.find(m => m.model === model)
    setForm(f => ({ ...f, model, price: found ? String(found.price) : '' }))
  }

  const validateForm = () => {
    const e = {}
    if (!form.model) e.model = 'Select a model'
    if (!form.serial_number.trim()) e.serial_number = 'Serial number required'
    if (!form.udid.trim()) e.udid = 'UDID/IMEI required'
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
      toast.error(err?.response?.data?.error || 'Failed to add device')
    } finally {
      setAddLoading(false)
    }
  }

  const handleLockToggle = async () => {
    setLockLoading(true)
    try {
      const deviceId = lockModal._id || lockModal.id
      const endpoint = lockModal.lock_status === 'locked'
        ? `/admin/devices/${deviceId}/unlock`
        : `/admin/devices/${deviceId}/lock`
      await api.post(endpoint)
      toast.success(`Device ${lockModal.lock_status === 'locked' ? 'unlocked' : 'locked'}!`)
      setLockModal(null)
      fetchDevices()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Action failed')
    } finally {
      setLockLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-0 pb-24 lg:pb-6 pt-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{devices.length} devices in inventory</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-800 text-white font-semibold text-sm rounded-2xl
                     hover:bg-green-900 active:scale-95 transition-all shadow-lg shadow-green-900/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Device
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 px-3 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600 bg-white"
        >
          <option value="">All Devices</option>
          <option value="available">Available</option>
          <option value="sold">Sold</option>
        </select>
        <select
          value={lockFilter}
          onChange={(e) => setLockFilter(e.target.value)}
          className="flex-1 px-3 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600 bg-white"
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
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">SN: {d.serial_number || '—'}</p>
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
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                  >
                    {isLocked ? 'Unlock' : 'Lock'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header strip */}
            <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400 rounded-t-3xl sm:rounded-t-3xl" />

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
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">iPhone Model *</label>
                  <select
                    value={form.model}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600 bg-gray-50
                      ${errors.model ? 'border-red-400' : 'border-gray-100'}`}
                  >
                    <option value="">Select model</option>
                    {IPHONE_MODELS.map(m => (
                      <option key={m.model} value={m.model}>{m.model}</option>
                    ))}
                  </select>
                  {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
                </div>

                {/* Color + Storage row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Color</label>
                    <select
                      value={form.color}
                      onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-green-600 bg-gray-50"
                    >
                      <option value="">Select color</option>
                      {IPHONE_COLORS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Storage</label>
                    <select
                      value={form.storage}
                      onChange={(e) => setForm(f => ({ ...f, storage: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-green-600 bg-gray-50"
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
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-green-600 bg-gray-50"
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Serial Number *</label>
                  <input
                    type="text"
                    value={form.serial_number}
                    onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))}
                    placeholder="e.g. F2LW2ABCDEF"
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600 font-mono bg-gray-50
                      ${errors.serial_number ? 'border-red-400' : 'border-gray-100'}`}
                  />
                  {errors.serial_number && <p className="text-xs text-red-500 mt-1">{errors.serial_number}</p>}
                </div>

                {/* UDID */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">UDID / IMEI *</label>
                  <input
                    type="text"
                    value={form.udid}
                    onChange={(e) => setForm(f => ({ ...f, udid: e.target.value }))}
                    placeholder="Device UDID or IMEI"
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600 font-mono bg-gray-50
                      ${errors.udid ? 'border-red-400' : 'border-gray-100'}`}
                  />
                  {errors.udid && <p className="text-xs text-red-500 mt-1">{errors.udid}</p>}
                </div>

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
                    className="flex-1 py-3 bg-gradient-to-r from-green-700 to-emerald-600 text-white font-semibold text-sm rounded-2xl
                               hover:from-green-800 hover:to-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2
                               shadow-lg shadow-green-900/20 transition-all"
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
        message={`${lockModal?.lock_status === 'locked' ? 'Unlock' : 'Lock'} ${lockModal?.model}${lockModal?.color ? ` (${lockModal.color})` : ''}? SN: ${lockModal?.serial_number}`}
        confirmText={lockModal?.lock_status === 'locked' ? 'Unlock' : 'Lock'}
        confirmVariant={lockModal?.lock_status === 'locked' ? 'primary' : 'danger'}
        loading={lockLoading}
      />
    </div>
  )
}
