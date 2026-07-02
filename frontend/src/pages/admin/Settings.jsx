import React, { useState, useEffect } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import Button from '../../components/Modern/Button'
import Card from '../../components/Modern/Card'
import Input from '../../components/Modern/Input'

export default function AdminSettings() {
  const { user, updateUser } = useAuth()

  const [settings, setSettings] = useState({
    business_name: 'Tritech Hub iOS',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    whatsapp_number: '',
    maintenance_mode: false,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)

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
    if (!profileForm.current_password) {
      toast.error('Enter your current password')
      return
    }
    setProfileLoading(true)
    try {
      const res = await api.put('/auth/profile', {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        current_password: profileForm.current_password,
      })
      updateUser(res.data.data.user)
      setProfileForm(f => ({ ...f, current_password: '' }))
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSettingsSaving(true)
    try {
      await api.put('/admin/settings', settings)
      toast.success('Settings saved!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!passwordForm.current_password) errors.current_password = 'Current password required'
    if (!passwordForm.new_password || passwordForm.new_password.length < 6) errors.new_password = 'Min 6 characters'
    if (passwordForm.new_password !== passwordForm.confirm_password) errors.confirm_password = 'Passwords do not match'

    if (Object.keys(errors).length > 0) {
      setPwErrors(errors)
      return
    }

    setPwLoading(true)
    try {
      await api.post('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      toast.success('Password changed!')
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setPwErrors({})
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password')
    } finally {
      setPwLoading(false)
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
    <div className="pb-24 lg:pb-6 bg-gradient-to-br from-gray-50 via-white to-emerald-50 min-h-screen">
      {/* Header */}
      <div className="lg:hidden px-6 pt-6 pb-8 bg-gradient-to-br from-gray-50 to-emerald-50">
        <h1 className="text-gray-900 text-3xl font-black">Settings</h1>
        <p className="text-gray-600 text-sm mt-2">Manage your account & app</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 lg:px-6 -mt-4 lg:mt-6">
        {/* Desktop Header */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-4xl font-black text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Configure your account and application</p>
        </div>

        {/* My Account Section */}
        <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <span className="text-white text-xl font-black">
                {(user?.name || 'A').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-gray-900 text-lg font-bold">My Account</h2>
              <p className="text-gray-600 text-sm">Update your profile information</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <Input
              label="Full Name"
              value={profileForm.name}
              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
            />
            <Input
              label="Email Address"
              type="email"
              value={profileForm.email}
              onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
              placeholder="admin@example.com"
            />
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Current Password <span className="text-gray-600 font-normal">(to confirm changes)</span>
              </label>
              <div className="relative">
                <input
                  type={showProfilePw ? 'text' : 'password'}
                  value={profileForm.current_password}
                  onChange={e => setProfileForm(f => ({ ...f, current_password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                           text-gray-900 placeholder-gray-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowProfilePw(!showProfilePw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showProfilePw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={profileLoading} loading={profileLoading} className="w-full">
              Save Changes
            </Button>
          </form>
        </Card>

        {/* Business Settings */}
        <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
          <h2 className="text-gray-900 text-lg font-bold mb-6">Business Information</h2>
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <Input
              label="Business Name"
              value={settings.business_name}
              onChange={(e) => setSettings(s => ({ ...s, business_name: e.target.value }))}
            />
            <Input
              label="Contact Email"
              type="email"
              value={settings.contact_email}
              onChange={(e) => setSettings(s => ({ ...s, contact_email: e.target.value }))}
              placeholder="info@business.com"
            />
            <Input
              label="Contact Phone"
              value={settings.contact_phone}
              onChange={(e) => setSettings(s => ({ ...s, contact_phone: e.target.value }))}
              placeholder="+233244000000"
            />
            <Input
              label="WhatsApp Number"
              value={settings.whatsapp_number}
              onChange={(e) => setSettings(s => ({ ...s, whatsapp_number: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Address</label>
              <textarea
                value={settings.contact_address}
                onChange={(e) => setSettings(s => ({ ...s, contact_address: e.target.value }))}
                placeholder="Physical address"
                rows={3}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900
                         placeholder-gray-500 transition-all resize-none"
              />
            </div>
            <Button type="submit" disabled={settingsSaving} loading={settingsSaving} className="w-full">
              Save Settings
            </Button>
          </form>
        </Card>

        {/* Maintenance Mode */}
        <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </div>
              <div>
                <h3 className="text-gray-900 font-bold">Maintenance Mode</h3>
                <p className="text-gray-600 text-sm">Block staff & customer access</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const newValue = !settings.maintenance_mode
                try {
                  await api.put('/admin/settings', { ...settings, maintenance_mode: newValue })
                  setSettings(s => ({ ...s, maintenance_mode: newValue }))
                  toast.success(newValue ? 'Maintenance mode ON' : 'Maintenance mode OFF')
                } catch (err) {
                  toast.error('Failed to update')
                }
              }}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                          transition-colors ${settings.maintenance_mode ? 'bg-orange-500' : 'bg-gray-600'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow
                             ${settings.maintenance_mode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </Card>

        {/* Change Password */}
        <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
          <h2 className="text-gray-900 text-lg font-bold mb-6">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm(f => ({ ...f, current_password: e.target.value }))}
                  className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2
                            focus:ring-emerald-500 text-gray-900 transition-all
                            ${pwErrors.current_password ? 'border-red-400' : 'border-gray-200'}`}
                />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  {showCurrentPw ? '🙈' : '👁'}
                </button>
              </div>
              {pwErrors.current_password && <p className="text-red-600 text-xs mt-1">{pwErrors.current_password}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                  className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2
                            focus:ring-emerald-500 text-gray-900 transition-all
                            ${pwErrors.new_password ? 'border-red-400' : 'border-gray-200'}`}
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  {showNewPw ? '🙈' : '👁'}
                </button>
              </div>
              {pwErrors.new_password && <p className="text-red-600 text-xs mt-1">{pwErrors.new_password}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))}
                className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none focus:ring-2
                          focus:ring-emerald-500 text-gray-900 transition-all
                          ${pwErrors.confirm_password ? 'border-red-400' : 'border-gray-200'}`}
              />
              {pwErrors.confirm_password && <p className="text-red-600 text-xs mt-1">{pwErrors.confirm_password}</p>}
            </div>

            <Button type="submit" variant="secondary" disabled={pwLoading} loading={pwLoading} className="w-full">
              Update Password
            </Button>
          </form>
        </Card>

        {/* Danger Zone */}
        <Card padding="p-6 sm:p-8" className="border border-red-200 bg-red-50 mb-6 shadow-lg">
          <h2 className="text-red-700 text-lg font-bold mb-3">Danger Zone</h2>
          <p className="text-red-600 text-sm mb-4">
            Permanently delete all customers, devices, and transactions.
          </p>
          <Button variant="danger" onClick={() => { setShowClearModal(true); setClearConfirmText('') }}>
            Clear All Data
          </Button>
        </Card>
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card padding="p-8" className="w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-gray-900 text-lg font-bold text-center mb-2">Clear All Data?</h3>
            <p className="text-gray-600 text-sm text-center mb-6">
              This will permanently delete all customers, devices, and transactions. This cannot be undone.
            </p>
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Type <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-900">DELETE ALL DATA</span> to confirm:
            </p>
            <input
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder="DELETE ALL DATA"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl
                       focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900
                       placeholder-gray-500 transition-all mb-4 font-mono"
            />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowClearModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={clearConfirmText !== 'DELETE ALL DATA' || clearLoading}
                loading={clearLoading}
                onClick={async () => {
                  setClearLoading(true)
                  try {
                    await api.delete('/admin/clear-all-data')
                    toast.success('All data cleared!')
                    setShowClearModal(false)
                    setClearConfirmText('')
                  } catch (err) {
                    toast.error('Failed to clear data')
                  } finally {
                    setClearLoading(false)
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
