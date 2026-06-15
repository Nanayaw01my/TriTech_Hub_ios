import React, { useState, useEffect } from 'react'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    business_name: 'Tritech Hub iOS',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    whatsapp_number: '',
    currency: 'GHS',
    payment_reminder_days: 1,
    auto_lock_days: 3,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwErrors, setPwErrors] = useState({})

  const [showClearModal, setShowClearModal] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearLoading, setClearLoading] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/admin/settings')
        setSettings(prev => ({ ...prev, ...(res.data?.data || res.data) }))
      } catch {
        // Use defaults
      } finally {
        setSettingsLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      await api.put('/admin/settings', settings)
      toast.success('Settings saved successfully!')
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to save settings')
    } finally {
      setSettingsSaving(false)
    }
  }

  const validatePassword = () => {
    const e = {}
    if (!passwordForm.current_password) e.current_password = 'Current password required'
    if (!passwordForm.new_password || passwordForm.new_password.length < 6) e.new_password = 'Min 6 characters'
    if (passwordForm.new_password !== passwordForm.confirm_password) e.confirm_password = 'Passwords do not match'
    setPwErrors(e)
    return Object.keys(e).length === 0
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!validatePassword()) return
    setPwLoading(true)
    try {
      await api.post('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      toast.success('Password changed successfully!')
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setPwErrors({})
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to change password')
    } finally {
      setPwLoading(false)
    }
  }

  const handleClearAllData = async () => {
    if (clearConfirmText !== 'DELETE ALL DATA') return
    setClearLoading(true)
    try {
      const res = await api.delete('/admin/clear-all-data')
      const d = res.data?.data
      toast.success(`All data cleared! Removed: ${d?.deleted?.customers ?? 0} customers, ${d?.deleted?.devices ?? 0} devices, ${d?.deleted?.payments ?? 0} payments.`)
      setShowClearModal(false)
      setClearConfirmText('')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to clear data')
    } finally {
      setClearLoading(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-6">

      {/* Mobile Hero */}
      <div className="lg:hidden px-5 pt-6 pb-12 bg-gradient-to-br from-gray-900 via-gray-800 to-green-900">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Admin Portal</p>
        <h1 className="text-white text-2xl font-black mt-1">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Configure your app</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-5 lg:mt-0 lg:pt-4">

      {/* Desktop Header */}
      <div className="hidden lg:block mb-5">
        <h1 className="text-2xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure app settings</p>
      </div>

      {/* Business Settings */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <h2 className="text-base font-bold text-gray-800 mb-4">Business Information</h2>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business Name</label>
            <input
              type="text"
              value={settings.business_name}
              onChange={(e) => setSettings(s => ({ ...s, business_name: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Email</label>
            <input
              type="email"
              value={settings.contact_email}
              onChange={(e) => setSettings(s => ({ ...s, contact_email: e.target.value }))}
              placeholder="info@tritechhub.com"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Phone</label>
            <input
              type="tel"
              value={settings.contact_phone}
              onChange={(e) => setSettings(s => ({ ...s, contact_phone: e.target.value }))}
              placeholder="0244000000"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">WhatsApp Number</label>
            <input
              type="tel"
              value={settings.whatsapp_number}
              onChange={(e) => setSettings(s => ({ ...s, whatsapp_number: e.target.value }))}
              placeholder="+233244000000"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business Address</label>
            <textarea
              value={settings.contact_address}
              onChange={(e) => setSettings(s => ({ ...s, contact_address: e.target.value }))}
              placeholder="Physical address"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Payment Reminder <span className="text-gray-400 font-normal">(days before)</span>
              </label>
              <input
                type="number"
                min="1" max="7"
                value={settings.payment_reminder_days}
                onChange={(e) => setSettings(s => ({ ...s, payment_reminder_days: Number(e.target.value) }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Auto-lock After <span className="text-gray-400 font-normal">(days overdue)</span>
              </label>
              <input
                type="number"
                min="1" max="30"
                value={settings.auto_lock_days}
                onChange={(e) => setSettings(s => ({ ...s, auto_lock_days: Number(e.target.value) }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={settingsSaving}
            className="w-full py-3.5 bg-green-800 text-white font-bold rounded-2xl
                       hover:bg-green-900 disabled:opacity-60 flex items-center justify-center gap-2
                       active:scale-95 transition-all"
          >
            {settingsSaving && <LoadingSpinner size="sm" color="white" />}
            Save Settings
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <h2 className="text-base font-bold text-gray-800 mb-4">Change Admin Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm(f => ({ ...f, current_password: e.target.value }))}
                placeholder="Enter current password"
                className={`w-full px-4 py-3 pr-12 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600
                  ${pwErrors.current_password ? 'border-red-400' : 'border-gray-200'}`}
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400">
                {showCurrentPw ? '🙈' : '👁'}
              </button>
            </div>
            {pwErrors.current_password && <p className="text-xs text-red-500 mt-1">{pwErrors.current_password}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                placeholder="Min 6 characters"
                className={`w-full px-4 py-3 pr-12 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600
                  ${pwErrors.new_password ? 'border-red-400' : 'border-gray-200'}`}
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400">
                {showNewPw ? '🙈' : '👁'}
              </button>
            </div>
            {pwErrors.new_password && <p className="text-xs text-red-500 mt-1">{pwErrors.new_password}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))}
              placeholder="Confirm new password"
              className={`w-full px-4 py-3 border-2 rounded-2xl text-sm focus:outline-none focus:border-green-600
                ${pwErrors.confirm_password ? 'border-red-400' : 'border-gray-200'}`}
            />
            {pwErrors.confirm_password && <p className="text-xs text-red-500 mt-1">{pwErrors.confirm_password}</p>}
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full py-3.5 bg-gray-800 text-white font-bold rounded-2xl
                       hover:bg-gray-900 disabled:opacity-60 flex items-center justify-center gap-2
                       active:scale-95 transition-all"
          >
            {pwLoading && <LoadingSpinner size="sm" color="white" />}
            Change Password
          </button>
        </form>
      </div>
      {/* Danger Zone */}
      <div className="bg-white rounded-2xl shadow-card p-5 border-2 border-red-100">
        <h2 className="text-base font-bold text-red-700 mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Permanently delete all customers, devices, transactions, and plans. Admin and staff accounts are kept.
        </p>
        <button
          onClick={() => { setShowClearModal(true); setClearConfirmText('') }}
          className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-2xl text-sm
                     hover:bg-red-700 active:scale-95 transition-all"
        >
          Clear All Data
        </button>
      </div>

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center mb-1">Clear All Data?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              This will permanently delete <strong>all customers, devices, transactions, installment plans, and audit logs</strong>.
              Admin and staff accounts will be kept. This cannot be undone.
            </p>
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-red-600">DELETE ALL DATA</span> to confirm:
            </p>
            <input
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder="DELETE ALL DATA"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm
                         focus:outline-none focus:border-red-500 mb-4 font-mono"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowClearModal(false); setClearConfirmText('') }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={clearConfirmText !== 'DELETE ALL DATA' || clearLoading}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl text-sm
                           hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2
                           active:scale-95 transition-all"
              >
                {clearLoading && <LoadingSpinner size="sm" color="white" />}
                {clearLoading ? 'Clearing...' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end max-w-3xl */}
    </div>
  )
}
