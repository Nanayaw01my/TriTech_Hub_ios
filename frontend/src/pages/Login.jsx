import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import Button from '../components/Modern/Button'
import Card from '../components/Modern/Card'
import Input from '../components/Modern/Input'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
      toast.success('App installed! Find it on your home screen.')
    }
    setInstallPrompt(null)
  }

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!identifier.trim()) {
      setError('Please enter your email')
      return
    }
    if (!password) {
      setError('Please enter your password')
      return
    }
    setLoading(true)
    try {
      const userData = await login({ identifier: identifier.trim(), password })
      toast.success(`Welcome back, ${userData.full_name || userData.name}!`)
      if (userData.role === 'admin') navigate('/admin/dashboard')
      else if (userData.role === 'staff') navigate('/staff/dashboard')
      else navigate('/customer/dashboard')
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Invalid credentials.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-50 rounded-full blur-3xl opacity-30" />

      {/* Install Banner */}
      {showInstallBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg
                        bg-white border border-emerald-200">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18a6 6 0 100-12 6 6 0 000 12z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-gray-900 text-sm font-bold">Install TriTech Hub</p>
            <p className="text-xs text-gray-600">Quick access from your home screen</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
            >
              Later
            </button>
            <Button size="sm" onClick={handleInstall}>
              Install
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg overflow-hidden">
            {logoError ? (
              <span className="text-white text-4xl font-black">T</span>
            ) : (
              <img
                src="/logo.png"
                alt="TriTech Hub"
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover"
                style={{ opacity: logoLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
              />
            )}
            {!logoLoaded && !logoError && (
              <span className="text-white text-4xl font-black">T</span>
            )}
          </div>

          <h1 className="text-3xl font-black text-gray-900 mb-1">TriTech Hub</h1>
          <p className="text-gray-600 text-sm">iPhone Installment Management</p>
        </div>

        {/* Login Card */}
        <Card padding="p-8 sm:p-10" className="mb-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Email Input */}
            <Input
              label="Email or ID"
              type="text"
              placeholder="admin@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
            />

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-800">Password</label>
                <Link to="/forgot-password" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                           text-gray-900 placeholder-gray-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="w-full"
              size="md"
            >
              Sign In
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs font-bold text-blue-900 mb-2">Demo Credentials</p>
            <div className="space-y-1 text-xs text-blue-800 font-mono">
              <p>Admin: admin@tritech.com / admin123</p>
              <p>Staff: staff@tritech.com / staff123</p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} TriTech Hub iOS. All rights reserved.
        </p>
      </div>
    </div>
  )
}
