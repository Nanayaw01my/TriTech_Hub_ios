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

  const CARD_BG = '#0c1f18' // dark green-black card colour (also used to notch the labels)

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-emerald-800 to-emerald-950 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Soft depth accents */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-950/50 rounded-full blur-3xl" />

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

      {/* Main Content */}
      <div className="w-full max-w-sm relative z-10">
        {/* Dark Card */}
        <div className="rounded-3xl p-7 sm:p-8 shadow-2xl border border-white/10" style={{ backgroundColor: CARD_BG }}>

          {/* Brand */}
          <div className="flex items-center gap-2 justify-center mb-8">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-emerald-600 flex items-center justify-center flex-shrink-0">
              {logoError ? (
                <span className="text-white text-sm font-black">T</span>
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
            <span className="text-white font-bold text-sm tracking-wide">TriTech Hub</span>
          </div>

          {/* Heading */}
          <h1 className="text-white text-3xl font-black leading-tight mb-8">
            Hello,<br />Welcome Back!
          </h1>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/15 border border-red-500/30">
              <p className="text-red-300 text-sm font-medium">{error}</p>
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
                className="peer w-full px-4 py-3.5 bg-transparent border border-white/25 rounded-lg
                         text-white placeholder-white/30 focus:outline-none focus:border-emerald-400 transition-colors"
              />
              <label
                htmlFor="login-email"
                className="absolute left-3 -top-2 px-1.5 text-xs text-white/60 peer-focus:text-emerald-400 transition-colors"
                style={{ backgroundColor: CARD_BG }}
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
                  className="peer w-full px-4 py-3.5 pr-11 bg-transparent border border-white/25 rounded-lg
                           text-white placeholder-white/30 focus:outline-none focus:border-emerald-400 transition-colors"
                />
                <label
                  htmlFor="login-password"
                  className="absolute left-3 -top-2 px-1.5 text-xs text-white/60 peer-focus:text-emerald-400 transition-colors"
                  style={{ backgroundColor: CARD_BG }}
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
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Login — swipe */}
            <div className="pt-2">
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
          <div className="text-center mt-6">
            <p className="text-xs text-white/50">
              <Link to="/terms" className="text-emerald-400 font-medium hover:text-emerald-300">Terms</Link>
              <span className="text-white/30 mx-2">•</span>
              <Link to="/privacy" className="text-emerald-400 font-medium hover:text-emerald-300">Privacy Policy</Link>
            </p>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-white/60 mt-6">
          © {new Date().getFullYear()} TriTech Hub iOS. All rights reserved.
        </p>
      </div>
    </div>
  )
}
