import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ForgotPassword() {
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetDone, setResetDone] = useState(false)

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setError('')
    if (!phone.trim()) { setError('Please enter your phone number'); return }
    setSmsLoading(true)
    try {
      await api.post('/auth/forgot-password-sms', { phone: phone.trim() })
      setOtpSent(true)
      toast.success('Code sent! Check your phone.')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to send code. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSmsLoading(false)
    }
  }

  const handleResetOTP = async (e) => {
    e.preventDefault()
    setError('')
    if (!otp.trim() || otp.length !== 6) { setError('Enter the 6-digit code from your SMS'); return }
    if (!newPassword) { setError('Please enter a new password'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setResetLoading(true)
    try {
      await api.post('/auth/reset-password-otp', { phone: phone.trim(), otp: otp.trim(), password: newPassword })
      setResetDone(true)
      toast.success('Password reset successfully!')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid or expired code.'
      setError(msg)
      toast.error(msg)
    } finally {
      setResetLoading(false)
    }
  }

  if (resetDone) {
    return (
      <div className="min-h-screen bg-emerald-700 flex flex-col">
        <div className="flex-1 bg-white rounded-t-3xl mt-24 px-6 pt-12 pb-safe flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h2>
          <p className="text-gray-500 text-sm mb-6">Your password has been updated. You can now log in.</p>
          <Link to="/login"
            className="w-full max-w-xs py-3.5 bg-emerald-700 text-white font-bold rounded-2xl text-center block hover:bg-green-900">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-emerald-700 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-14 pb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
          <svg className="w-9 h-9 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-white">Forgot Password</h1>
        <p className="text-green-200 text-sm mt-1">TriTech Hub iOS</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-safe">
        {!otpSent ? (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h2>
            <p className="text-gray-500 text-sm mb-6">
              Enter your phone number and we'll send you a 6-digit code.
            </p>
            <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError('') }}
                  placeholder="0XX XXX XXXX"
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-2xl
                             focus:outline-none focus:border-emerald-600 bg-white placeholder-gray-400
                             transition-colors min-h-[52px]"
                />
              </div>
              <button
                type="submit"
                disabled={smsLoading}
                className="w-full py-4 bg-emerald-700 text-white font-bold text-base rounded-2xl
                           min-h-[52px] flex items-center justify-center gap-2
                           active:scale-95 transition-all disabled:opacity-60 hover:bg-green-900"
              >
                {smsLoading ? <><LoadingSpinner size="sm" color="white" /> Sending…</> : 'Send Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Enter Your Code</h2>
            <p className="text-gray-500 text-sm mb-6">
              A 6-digit code was sent to <span className="font-semibold text-gray-700">{phone}</span>.{' '}
              <button onClick={() => { setOtpSent(false); setOtp(''); setError('') }}
                className="text-emerald-700 font-semibold hover:underline">
                Change number
              </button>
            </p>
            <form onSubmit={handleResetOTP} className="space-y-4" noValidate>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">6-Digit Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-full px-4 py-3.5 text-2xl font-black text-center tracking-[0.4em]
                             border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-emerald-600
                             bg-white placeholder-gray-300 transition-colors min-h-[52px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError('') }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 pr-12 text-base border-2 border-gray-200 rounded-2xl
                               focus:outline-none focus:border-emerald-600 bg-white placeholder-gray-400
                               transition-colors min-h-[52px]"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {showPassword
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Customers: max 5 characters · Staff/Admin: min 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className={`w-full px-4 py-3.5 text-base border-2 rounded-2xl focus:outline-none
                             bg-white placeholder-gray-400 transition-colors min-h-[52px]
                             ${confirmPassword && confirmPassword !== newPassword
                               ? 'border-red-400 focus:border-red-500'
                               : confirmPassword && confirmPassword === newPassword
                               ? 'border-green-400 focus:border-green-500'
                               : 'border-gray-200 focus:border-emerald-600'}`}
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading || otp.length !== 6 || !newPassword || !confirmPassword}
                className="w-full py-4 bg-emerald-700 text-white font-bold text-base rounded-2xl
                           min-h-[52px] flex items-center justify-center gap-2
                           active:scale-95 transition-all disabled:opacity-60 hover:bg-green-900 mt-2"
              >
                {resetLoading ? <><LoadingSpinner size="sm" color="white" /> Resetting…</> : 'Reset Password'}
              </button>

              <p className="text-center text-xs text-gray-400">
                Didn't receive the code?{' '}
                <button type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); setError('') }}
                  className="text-emerald-700 font-semibold hover:underline">
                  Resend
                </button>
              </p>
            </form>
          </>
        )}

        <div className="text-center mt-6">
          <Link to="/login"
            className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-sm hover:text-emerald-900">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
