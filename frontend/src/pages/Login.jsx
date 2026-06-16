import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoError, setLogoError] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!identifier.trim()) { setError('Please enter your email'); return }
    if (!password) { setError('Please enter your password'); return }
    setLoading(true)
    try {
      const userData = await login({ identifier: identifier.trim(), password })
      toast.success(`Welcome back, ${userData.full_name || userData.name}!`)
      if (userData.role === 'admin') navigate('/admin/dashboard')
      else if (userData.role === 'staff') navigate('/staff/dashboard')
      else navigate('/customer/dashboard')
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Invalid credentials. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden"
      style={{ background: '#0b1410' }}
    >
      {/* Background glow blobs */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(46,125,50,0.20) 0%, transparent 70%)' }} />
      <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(27,94,32,0.16) 0%, transparent 70%)' }} />
      <div className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(76,175,80,0.07) 0%, transparent 70%)' }} />

      {/* Logo + branding */}
      <div className="text-center mb-8">
        <div
          className="mx-auto mb-5 overflow-hidden"
          style={{
            width: '200px', height: '93px',
            borderRadius: '16px',
            border: '1px solid rgba(76,175,80,0.25)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          {!logoError ? (
            <img
              src="/logo.png"
              alt="TriTech Hub"
              onError={() => setLogoError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-0.5"
              style={{ background: 'linear-gradient(150deg, #182a1c, #1e3323)' }}
            >
              <span style={{ color: '#4CAF50', fontSize: '26px', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>TH</span>
              <span style={{ color: 'rgba(76,175,80,0.5)', fontSize: '8px', fontWeight: 700, letterSpacing: '2px' }}>iOS</span>
            </div>
          )}
        </div>

        <h1 className="text-white font-black tracking-tight" style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
          TriTech Hub <span style={{
            background: 'linear-gradient(135deg, #4CAF50, #81C784)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>iOS</span>
        </h1>
        <p className="text-xs font-semibold tracking-widest uppercase mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          iPhone Installment Management
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Top accent bar */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #1B5E20, #2E7D32, #4CAF50, #81C784)' }} />

        <div className="px-7 pt-7 pb-8">
          <h2 className="text-xl font-black text-white">Welcome back</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Sign in to your account</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>

            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl text-sm"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Identifier */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(255,255,255,0.45)' }}>
                Email
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError('') }}
                  placeholder="Enter your email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full pl-11 pr-4 py-3.5 text-sm rounded-2xl outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    color: 'white',
                  }}
                  onFocus={e => e.target.style.borderColor = '#4CAF50'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Password
                </label>
                <Link to="/forgot-password"
                  className="text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ color: '#81C784' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-12 py-3.5 text-sm rounded-2xl outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    color: 'white',
                  }}
                  onFocus={e => e.target.style.borderColor = '#4CAF50'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 font-black text-sm rounded-2xl flex items-center justify-center gap-2
                         active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-2"
              style={{
                background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
                color: 'white',
                boxShadow: '0 8px 24px rgba(46,125,50,0.4)',
              }}
            >
              {loading ? (
                <><LoadingSpinner size="sm" color="white" /> Signing in…</>
              ) : (
                <>
                  Sign In
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs mt-8 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
        © {new Date().getFullYear()} Tritech Hub iOS · Powered by Ittek Solutions
      </p>
    </div>
  )
}
