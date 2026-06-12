import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!identifier.trim()) { setError('Please enter your email, account number, or Staff ID'); return }
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
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">

      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-green-600 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 bg-emerald-600 rounded-full blur-3xl opacity-15 pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-teal-500 rounded-full blur-3xl opacity-10 pointer-events-none" />

      {/* Branding */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
          <svg className="w-11 h-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Tritech Hub iOS</h1>
        <p className="text-green-300 text-sm mt-1 font-medium">iPhone Installment Management</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Card header strip */}
        <div className="h-1.5 bg-gradient-to-r from-green-500 via-emerald-400 to-teal-400" />

        <div className="px-7 pt-7 pb-8">
          <h2 className="text-2xl font-black text-gray-900">Welcome back 👋</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-sm flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Identifier */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Email / Account No. / Staff ID
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError('') }}
                  placeholder="Enter your identifier"
                  className="w-full pl-11 pr-4 py-3.5 text-sm border-2 border-gray-100 rounded-2xl
                             bg-gray-50 focus:bg-white focus:outline-none focus:border-green-500
                             transition-all placeholder-gray-300"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-12 py-3.5 text-sm border-2 border-gray-100 rounded-2xl
                             bg-gray-50 focus:bg-white focus:outline-none focus:border-green-500
                             transition-all placeholder-gray-300"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-gray-500 transition-colors"
                  tabIndex={-1}
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

            {/* Forgot password */}
            <div className="flex justify-end -mt-1">
              <Link to="/forgot-password" className="text-xs font-semibold text-green-600 hover:text-green-800 transition-colors">
                Forgot Password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-green-700 to-emerald-600 text-white font-bold text-sm
                         rounded-2xl shadow-lg shadow-green-900/30 flex items-center justify-center gap-2
                         active:scale-95 hover:from-green-800 hover:to-emerald-700
                         disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 mt-1"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  Signing in...
                </>
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

      <p className="text-green-500/60 text-xs mt-8 text-center">
        © {new Date().getFullYear()} Tritech Hub iOS · All rights reserved
      </p>
    </div>
  )
}
