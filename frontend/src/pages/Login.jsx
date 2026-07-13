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
      className="min-h-screen flex items-center justify-center px-5 py-10 relative overflow-hidden"
      style={{ backgroundColor: BASE }}
    >
      {/* Background photo — zoomed in & softly blurred */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: "url('/IMG_6245.jpeg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: 'scale(1.4)',
          transformOrigin: 'center',
          filter: 'blur(4px)',
        }}
      />
      {/* Readability overlay */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'linear-gradient(160deg, rgba(10,26,18,0.55), rgba(5,18,12,0.78))' }}
      />
      {/* Vignette — darkens edges so the card pops */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse 70% 60% at center, transparent 35%, rgba(3,10,7,0.72) 100%)' }}
      />

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

      {/* Glass card */}
      <div className="w-full max-w-sm relative z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div
          className="rounded-3xl border border-white/20 shadow-2xl p-7 sm:p-8"
          style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
        >
          {/* Logo — full, uncropped */}
          <div className="flex justify-center mb-5">
            <div className="w-full max-w-[200px] rounded-2xl overflow-hidden border border-white/15 bg-black shadow-lg">
              {logoError ? (
                <span className="block text-white text-2xl font-black text-center py-7">TriTech Hub</span>
              ) : (
                <img
                  src="/logo.png"
                  alt="TriTech Hub iOS"
                  onLoad={() => setLogoLoaded(true)}
                  onError={() => setLogoError(true)}
                  className="w-full h-auto object-contain"
                  style={{ opacity: logoLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
                />
              )}
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-white text-3xl font-black text-center">Welcome Back</h1>
          <p className="text-white/70 text-sm text-center mt-1.5 mb-6">Sign in to your account</p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/40">
              <p className="text-red-100 text-sm font-medium text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <input
                type="text"
                placeholder="Email or ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                className="w-full pl-4 pr-11 py-3.5 bg-white/10 border border-white/30 rounded-2xl
                         text-white placeholder-white/60 focus:outline-none focus:border-emerald-300 focus:bg-white/[0.14] transition-colors"
              />
              <svg className="w-5 h-5 text-white/60 absolute right-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-4 pr-11 py-3.5 bg-white/10 border border-white/30 rounded-2xl
                         text-white placeholder-white/60 focus:outline-none focus:border-emerald-300 focus:bg-white/[0.14] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Forgot */}
            <div className="text-right -mt-1">
              <Link to="/forgot-password" className="text-xs text-emerald-300 hover:text-white font-semibold transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Swipe */}
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
          <p className="text-center text-xs text-white/70 mt-5">
            <Link to="/terms" className="text-emerald-300 font-semibold underline underline-offset-2 hover:text-white">Terms</Link>
            <span className="text-white/40 mx-2">•</span>
            <Link to="/privacy" className="text-emerald-300 font-semibold underline underline-offset-2 hover:text-white">Privacy Policy</Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/60 mt-5">
          © {new Date().getFullYear()} TriTech Hub iOS. All rights reserved.
        </p>
      </div>
    </div>
  )
}
