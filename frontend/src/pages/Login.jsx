import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import Button from '../components/Modern/Button'
import Card from '../components/Modern/Card'
import Input from '../components/Modern/Input'
import SwipeButton from '../components/SwipeButton'

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
  const [swipeKey, setSwipeKey] = useState(0)

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
    e?.preventDefault()
    setError('')
    if (!identifier.trim()) {
      setError('Please enter your email')
      setSwipeKey(k => k + 1) // reset the swipe knob
      return
    }
    if (!password) {
      setError('Please enter your password')
      setSwipeKey(k => k + 1)
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
      setSwipeKey(k => k + 1) // reset the swipe knob so they can retry
    } finally {
      setLoading(false)
    }
  }

  const BASE = '#0a1a12' // dark green-black base (also used to notch the input labels)

  return (
    <div
      className="min-h-screen flex flex-col justify-center px-6 py-10 relative overflow-hidden"
      style={{
        backgroundColor: BASE,
        backgroundImage: `
          radial-gradient(circle at 18% 12%, rgba(16,185,129,0.16), transparent 42%),
          radial-gradient(circle at 85% 25%, rgba(6,95,70,0.35), transparent 45%),
          radial-gradient(circle at 70% 78%, rgba(16,185,129,0.12), transparent 42%),
          radial-gradient(circle at 10% 92%, rgba(4,47,34,0.5), transparent 45%)
        `,
      }}
    >
      {/* Install Banner */}
      {showInstallBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl
                        bg-white border border-gray-200">
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

      {/* Brand — big logo */}
      <div className="flex justify-center mb-8 relative z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div
          className="w-44 h-44 rounded-3xl overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl"
          style={{ backgroundColor: '#000000' }}
        >
          {logoError ? (
            <span className="text-white text-6xl font-black">T</span>
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
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-sm mx-auto relative z-10">
        {/* Heading */}
        <h1 className="text-white text-4xl font-black leading-tight text-center mb-10">
          Hello,<br />Welcome Back!
        </h1>

        {/* Error Message */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/15 border border-red-500/30">
            <p className="text-red-300 text-sm font-medium text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email — outlined floating label */}
          <div className="relative">
            <input
              id="login-email"
              type="text"
              placeholder="example@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              className="peer w-full px-4 py-4 bg-transparent border border-white/25 rounded-2xl
                       text-white placeholder-white/30 focus:outline-none focus:border-emerald-400 transition-colors"
            />
            <label
              htmlFor="login-email"
              className="absolute left-4 -top-2 px-1.5 text-xs text-white/60 peer-focus:text-emerald-400 transition-colors"
              style={{ backgroundColor: BASE }}
            >
              E-mail or ID
            </label>
          </div>

          {/* Password — outlined floating label with toggle */}
          <div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="peer w-full px-4 py-4 pr-11 bg-transparent border border-white/25 rounded-2xl
                         text-white placeholder-white/30 focus:outline-none focus:border-emerald-400 transition-colors"
              />
              <label
                htmlFor="login-password"
                className="absolute left-4 -top-2 px-1.5 text-xs text-white/60 peer-focus:text-emerald-400 transition-colors"
                style={{ backgroundColor: BASE }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <div className="text-right mt-2">
              <Link to="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Forget password?
              </Link>
            </div>
          </div>

          {/* Login — swipe */}
          <div className="pt-1">
            <SwipeButton
              key={swipeKey}
              onComplete={handleSubmit}
              loading={loading}
              dark
              label="Swipe to login"
              loadingLabel="Logging in…"
            />
          </div>
        </form>

        {/* Footer links */}
        <p className="text-center text-xs text-white/50 mt-8">
          <Link to="/terms" className="text-emerald-400 font-medium hover:text-emerald-300">Terms</Link>
          <span className="text-white/30 mx-2">•</span>
          <Link to="/privacy" className="text-emerald-400 font-medium hover:text-emerald-300">Privacy Policy</Link>
        </p>
        <p className="text-center text-[11px] text-white/40 mt-3">
          © {new Date().getFullYear()} TriTech Hub iOS. All rights reserved.
        </p>
      </div>
    </div>
  )
}
