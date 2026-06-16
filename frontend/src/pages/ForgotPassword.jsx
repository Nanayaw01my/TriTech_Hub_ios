import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ForgotPassword() {
  const [tab, setTab] = useState('sms') // 'email' | 'sms'

  // Email tab state
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  // SMS tab state
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [smsError, setSmsError] = useState('')
  const [resetDone, setResetDone] = useState(false)

  // ── Email flow ──────────────────────────────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setEmailError('')
    if (!email.trim()) { setEmailError('Please enter your email address'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Please enter a valid email address'); return }
    setEmailLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setEmailSent(true)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to send reset email. Please try again.'
      setEmailError(msg)
    } finally {
      setEmailLoading(false)
    }
  }

  // ── SMS flow ─────────────────────────────────────────────────────────────────
  const handleSendOTP = async (e) => {
    e.preventDefault()
    setSmsError('')
    if (!phone.trim()) { setSmsError('Please enter your phone number'); return }
    setSmsLoading(true)
    try {
      await api.post('/auth/forgot-password-sms', { phone: phone.trim() })
      setOtpSent(true)
      toast.success('Code sent! Check your phone.')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to send code. Please try again.'
      setSmsError(msg)
      toast.error(msg)
    } finally {
      setSmsLoading(false)
    }
  }

  const handleResetOTP = async (e) => {
    e.preventDefault()
    setSmsError('')
    if (!otp.trim() || otp.length !== 6) { setSmsError('Enter the 6-digit code from your SMS'); return }
    if (!newPassword) { setSmsError('Please enter a new password'); return }
    if (newPassword !== confirmPassword) { setSmsError('Passwords do not match'); return }
    setResetLoading(true)
    try {
      await api.post('/auth/reset-password-otp', { phone: phone.trim(), otp: otp.trim(), password: newPassword })
      setResetDone(true)
      toast.success('Password reset successfully!')
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid or expired code.'
      setSmsError(msg)
      toast.error(msg)
    } finally {
      setResetLoading(false)
    }
  }

  // ── Success screens ──────────────────────────────────────────────────────────
  if (resetDone) {
    return (
      <div className="min-h-screen bg-green-800 flex flex-col">
        <div className="flex-1 bg-white rounded-t-3xl mt-24 px-6 pt-12 pb-safe flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h2>
          <p className="text-gray-500 text-sm mb-6">Your password has been updated. You can now log in.</p>
          <Link to="/login"
            className="w-full max-w-xs py-3.5 bg-green-800 text-white font-bold rounded-2xl text-center block hover:bg-green-900">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-green-800 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-14 pb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
          <svg className="w-9 h-9 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-white">Reset Password</h1>
        <p className="text-green-200 text-sm mt-1">TriTech Hub iOS</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-7 pb-safe">

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button
            onClick={() => setTab('sms')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab === 'sms' ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            SMS Code
          </button>
          <button
            onClick={() => setTab('email')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              tab === 'email' ? 'bg-white text-green-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            Email Link
          </button>
        </div>

        {/* ── SMS tab ── */}
        {tab === 'sms' && (
          <>
            {!otpSent ? (
              /* Step 1: Enter phone */
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Reset via SMS</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Enter your phone number and we'll send a 6-digit code.
                </p>
                <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
                  {smsError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                      {smsError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => { setPhone(e.target.value); setSmsError('') }}
                      placeholder="0XX XXX XXXX"
                      inputMode="tel"
                      autoComplete="tel"
                      className="w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-2xl
                                 focus:outline-none focus:border-green-600 bg-white placeholder-gray-400
                                 transition-colors min-h-[52px]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={smsLoading}
                    className="w-full py-4 bg-green-800 text-white font-bold text-base rounded-2xl
                               min-h-[52px] flex items-center justify-center gap-2
                               active:scale-95 transition-all disabled:opacity-60 hover:bg-green-900"
                  >
                    {smsLoading ? <><LoadingSpinner size="sm" color="white" /> Sending…</> : 'Send Code'}
                  </button>
                </form>
              </>
            ) : (
              /* Step 2: Enter OTP + new password */
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Enter Your Code</h2>
                <p className="text-gray-500 text-sm mb-6">
                  A 6-digit code was sent to <span className="font-semibold text-gray-700">{phone}</span>.{' '}
                  <button onClick={() => { setOtpSent(false); setSmsError('') }}
                    className="text-green-700 font-semibold hover:underline">
                    Change number
                  </button>
                </p>
                <form onSubmit={handleResetOTP} className="space-y-4" noValidate>
                  {smsError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                      {smsError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">6-Digit Code</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setSmsError('') }}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="w-full px-4 py-3.5 text-2xl font-black text-center tracking-[0.4em] border-2 border-gray-200 rounded-2xl
                                 focus:outline-none focus:border-green-600 bg-white placeholder-gray-300
                                 transition-colors min-h-[52px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setSmsError('') }}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        className="w-full px-4 py-3.5 pr-12 text-base border-2 border-gray-200 rounded-2xl
                                   focus:outline-none focus:border-green-600 bg-white placeholder-gray-400
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
                      onChange={e => { setConfirmPassword(e.target.value); setSmsError('') }}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      className={`w-full px-4 py-3.5 text-base border-2 rounded-2xl focus:outline-none bg-white
                                 placeholder-gray-400 transition-colors min-h-[52px]
                                 ${confirmPassword && confirmPassword !== newPassword
                                   ? 'border-red-400 focus:border-red-500'
                                   : confirmPassword && confirmPassword === newPassword
                                   ? 'border-green-400 focus:border-green-500'
                                   : 'border-gray-200 focus:border-green-600'}`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading || otp.length !== 6 || !newPassword || !confirmPassword}
                    className="w-full py-4 bg-green-800 text-white font-bold text-base rounded-2xl
                               min-h-[52px] flex items-center justify-center gap-2
                               active:scale-95 transition-all disabled:opacity-60 hover:bg-green-900 mt-2"
                  >
                    {resetLoading ? <><LoadingSpinner size="sm" color="white" /> Resetting…</> : 'Reset Password'}
                  </button>

                  <p className="text-center text-xs text-gray-400">
                    Didn't receive the code?{' '}
                    <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setSmsError('') }}
                      className="text-green-700 font-semibold hover:underline">
                      Resend
                    </button>
                  </p>
                </form>
              </>
            )}
          </>
        )}

        {/* ── Email tab ── */}
        {tab === 'email' && (
          <>
            {emailSent ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">We sent a reset link to:</p>
                <p className="text-green-700 font-semibold text-sm mb-6">{email}</p>
                <p className="text-gray-400 text-xs mb-8">Check your spam folder. The link expires in 1 hour.</p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Reset via Email</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Enter your email and we'll send a reset link.
                </p>
                <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                  {emailError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                      {emailError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError('') }}
                      placeholder="your@email.com"
                      inputMode="email"
                      autoComplete="email"
                      className="w-full px-4 py-3.5 text-base border-2 border-gray-200 rounded-2xl
                                 focus:outline-none focus:border-green-600 bg-white placeholder-gray-400
                                 transition-colors min-h-[52px]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="w-full py-4 bg-green-800 text-white font-bold text-base rounded-2xl
                               min-h-[52px] flex items-center justify-center gap-2
                               active:scale-95 transition-all disabled:opacity-60 hover:bg-green-900"
                  >
                    {emailLoading ? <><LoadingSpinner size="sm" color="white" /> Sending…</> : 'Send Reset Link'}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        <div className="text-center mt-6">
          <Link to="/login"
            className="inline-flex items-center gap-1.5 text-green-700 font-semibold text-sm hover:text-green-900">
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
