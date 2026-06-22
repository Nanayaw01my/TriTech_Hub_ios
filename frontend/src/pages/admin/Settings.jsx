import React, { useState, useEffect } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const { user, updateUser } = useAuth()

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

  // My Account
  const [profileForm, setProfileForm] = useState({ name: '', email: '', current_password: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [showProfilePw, setShowProfilePw] = useState(false)

  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwErrors, setPwErrors] = useState({})

  const [showClearModal, setShowClearModal] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearLoading, setClearLoading] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)

  useEffect(() => {
    if (user) setProfileForm(f => ({ ...f, name: user.name || '', email: user.email || '' }))
  }, [user])

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

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profileForm.current_password) { toast.error('Enter your current password to save changes.'); return }
    if (!profileForm.name.trim() && !profileForm.email.trim()) { toast.error('Provide a name or email to update.'); return }
    setProfileLoading(true)
    try {
      const res = await api.put('/auth/profile', {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        current_password: profileForm.current_password,
      })
      updateUser(res.data.data.user)
      setProfileForm(f => ({ ...f, current_password: '' }))
      toast.success('Account updated successfully!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update account.')
    } finally {
      setProfileLoading(false)
    }
  }

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

  const handleDownloadBackup = async () => {
    setBackupLoading(true)
    try {
      const res = await api.get('/admin/backup')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tritechhub-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Backup downloaded! ${res.data.counts?.customers ?? 0} customers, ${res.data.counts?.payments ?? 0} payments.`)
    } catch {
      toast.error('Failed to download backup')
    } finally {
      setBackupLoading(false)
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

      {/* My Account */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-green-800 font-black text-base">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">My Account</h2>
            <p className="text-xs text-gray-400">Change your login name or email</p>
          </div>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Login Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Current Password <span className="text-gray-400 font-normal">(required to save)</span>
            </label>
            <div className="relative">
              <input
                type={showProfilePw ? 'text' : 'password'}
                value={profileForm.current_password}
                onChange={e => setProfileForm(f => ({ ...f, current_password: e.target.value }))}
                placeholder="Enter your current password"
                className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-green-600"
              />
              <button type="button" onClick={() => setShowProfilePw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400">
                {showProfilePw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={profileLoading}
            className="w-full py-3.5 bg-green-800 text-white font-bold rounded-2xl
                       hover:bg-green-900 disabled:opacity-60 flex items-center justify-center gap-2
                       active:scale-95 transition-all"
          >
            {profileLoading && <LoadingSpinner size="sm" color="white" />}
            Save Account Changes
          </button>
        </form>
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
      {/* Backup */}
      <div className="bg-white rounded-2xl shadow-card p-5 border-2 border-blue-50">
        <h2 className="text-base font-bold text-gray-900 mb-1">Data Backup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Download a full copy of all your data — customers, devices, payments, and plans — as a JSON file you can save on your computer.
        </p>
        <button
          onClick={handleDownloadBackup}
          disabled={backupLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-2xl text-sm
                     hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60"
        >
          {backupLoading ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Preparing…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg> Download Backup</>
          )}
        </button>
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
