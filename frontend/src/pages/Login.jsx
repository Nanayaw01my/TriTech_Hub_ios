import PublicFooter from '../components/PublicFooter'
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { isNativeApp } from '../utils/download'
import useLogo from '../hooks/useLogo'

const TAB_KEY = 'dd_login_tab'
const readTab = () => { try { return localStorage.getItem(TAB_KEY) === 'staff' ? 'staff' : 'customer' } catch { return 'customer' } }
const saveTab = (t) => { try { localStorage.setItem(TAB_KEY, t) } catch { /* storage unavailable */ } }
const msgOf = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback

/** Box with a small label on top (the label stays visible while typing). */
function Field({ label, children, focused }) {
  return (
    <label className={`block rounded-2xl border-[1.5px] px-4 pt-2.5 pb-2 transition-all bg-white
      ${focused ? 'border-orange-500 ring-4 ring-orange-500/15' : 'border-gray-200'}`}>
      <span className="block text-[11px] font-semibold text-gray-400">{label}</span>
      {children}
    </label>
  )
}

const inputCls = 'boxed-input w-full bg-transparent text-base text-gray-900 placeholder-gray-300 focus:outline-none py-0.5'
const btnCls = 'w-full py-4 rounded-2xl text-white font-extrabold text-base bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-600/30 hover:from-orange-600 hover:to-orange-700 transition-colors disabled:opacity-60'

export default function Login() {
  const logo = useLogo()
  const { login, loginWithData } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState(readTab)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focus, setFocus] = useState('')

  // Customer: phone → SMS code (or account number + password)
  const [customerMode, setCustomerMode] = useState('code') // code | password
  const [phone, setPhone] = useState('')
  const [codeSentTo, setCodeSentTo] = useState('') // message shown after sending
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const codeRef = useRef(null)

  // Password login (staff, or customers who prefer it)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Pay without logging in
  const [payOpen, setPayOpen] = useState(false)
  const [payAcct, setPayAcct] = useState('')
  const [payPhone, setPayPhone] = useState('')
  const [payBusy, setPayBusy] = useState(false)

  // Install (PWA) prompt
  const [installPrompt, setInstallPrompt] = useState(null)
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const switchTab = (t) => { setTab(t); saveTab(t); setError('') }

  const goHome = (u) => {
    if (u.role === 'superadmin' || u.role === 'admin') navigate('/admin/dashboard')
    else if (u.role === 'collector') navigate('/admin/overdue-accounts')
    else if (u.role === 'staff') navigate('/staff/dashboard')
    else navigate('/customer/dashboard')
  }

  const sendCode = async (e) => {
    e?.preventDefault()
    setError('')
    if (phone.replace(/\D/g, '').length < 9) { setError('Type your phone number, like 024 412 3456.'); return }
    setLoading(true)
    try {
      const r = await api.post('/auth/customer-code', { phone })
      setCodeSentTo(r.data?.message || 'Code sent.')
      setCode('')
      setResendIn(60)
      setTimeout(() => codeRef.current?.focus(), 50)
    } catch (err) {
      setError(msgOf(err, 'Could not send the code. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async (value) => {
    const c = (value ?? code).replace(/\D/g, '')
    if (c.length !== 6) { setError('Type the 6-digit code from the SMS.'); return }
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/customer-code/verify', { phone, code: c })
      const { token, user } = r.data?.data || {}
      if (!token || !user) throw new Error('bad response')
      goHome(loginWithData(token, user))
    } catch (err) {
      setError(msgOf(err, 'That code did not work. Try again.'))
      setCode('')
      setTimeout(() => codeRef.current?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  const passwordLogin = async (e) => {
    e?.preventDefault()
    setError('')
    if (!identifier.trim()) { setError(tab === 'staff' ? 'Type your staff ID or email.' : 'Type your account number.'); return }
    if (!password) { setError('Type your password.'); return }
    setLoading(true)
    try {
      goHome(await login({ identifier: identifier.trim(), password }))
    } catch (err) {
      setError(err?.response?.status === 401 ? 'Wrong ID or password. Check them and try again.' : msgOf(err, 'Could not log in. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  const findPay = async (e) => {
    e?.preventDefault()
    setPayBusy(true)
    try {
      const r = await api.post('/pay/find', { account_number: payAcct, phone: payPhone })
      const token = r.data?.data?.token
      if (!token) throw new Error('no token')
      navigate(`/p/${token}`, { state: { back: '/login', backLabel: 'Back to log in' } })
    } catch (err) {
      toast.error(msgOf(err, 'Could not find your account.'), { duration: 7000 })
    } finally {
      setPayBusy(false)
    }
  }

  const codeStep = !!codeSentTo
  const passwordForm = (
    <form onSubmit={passwordLogin} className="space-y-3">
      <Field label={tab === 'staff' ? 'Staff ID or email' : 'Account number (starts with DBS)'} focused={focus === 'id'}>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={loading}
          onFocus={() => setFocus('id')} onBlur={() => setFocus('')}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
          placeholder={tab === 'staff' ? 'Your staff ID or email' : 'DBS202600001'} className={inputCls} />
      </Field>
      <Field label="Password" focused={focus === 'pw'}>
        <div className="flex items-center gap-2">
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocus('pw')} onBlur={() => setFocus('')} disabled={loading}
            autoComplete="current-password" placeholder="••••••••" className={inputCls} />
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-xs font-bold text-gray-500 px-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </Field>
      <div className="text-right">
        <Link to="/forgot-password" className="text-sm font-bold text-orange-600">Forgot password?</Link>
      </div>
      <button type="submit" disabled={loading} className={btnCls}>{loading ? 'Logging in…' : 'Log in'}</button>
    </form>
  )

  return (
    <div className="min-h-screen bg-gray-100 lg:py-8">
      <div className="max-w-md mx-auto bg-white min-h-screen lg:min-h-0 lg:rounded-[32px] lg:overflow-hidden lg:shadow-2xl relative">
        {/* Solar hero */}
        <div className="relative h-[300px] overflow-hidden"
          style={{ background: 'radial-gradient(circle at 78% 18%, #fdba74 0, #f97316 30%, #9a3412 75%, #431407 100%)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-orange-100/30" aria-hidden="true" />
          <div className="absolute left-0 right-0 bottom-0 h-12 opacity-70" aria-hidden="true"
            style={{ background: 'repeating-linear-gradient(90deg, rgba(15,23,42,.6) 0 38px, rgba(30,58,138,.55) 38px 40px)' }} />
          <div className="absolute left-6 bottom-[72px] right-6 text-white">
            <img src={logo} alt="Dan & Dor Solar Company Limited" className="w-16 h-16 object-contain rounded-2xl bg-white p-1 mb-3 shadow-lg" />
            <h1 className="text-[28px] leading-[1.1] font-black">Power your day.<br />Pay your way.</h1>
            <p className="text-sm text-white/85 mt-1.5">Dan &amp; Dor Solar Company Limited</p>
          </div>
        </div>

        {/* Sheet */}
        <div className="relative -mt-8 bg-white rounded-t-[28px] px-6 pt-7 pb-8">
          {installPrompt && (
            <button type="button" onClick={async () => { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null) }}
              className="mb-4 w-full text-xs font-semibold text-orange-700 bg-orange-50 rounded-xl py-2">
              📲 Install the app on this phone
            </button>
          )}

          <div className="flex bg-gray-100 rounded-2xl p-1 mb-5" role="tablist">
            {[['customer', 'Customer'], ['staff', 'Staff']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === k ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800" role="alert">{error}</div>
          )}

          {tab === 'customer' && customerMode === 'code' && !codeStep && (
            <form onSubmit={sendCode} className="space-y-3">
              <p className="text-sm text-gray-600">Log in with your phone number. We'll text you a code, no password needed.</p>
              <Field label="Your phone number" focused={focus === 'phone'}>
                <div className="flex items-center gap-2">
                  <span className="text-base" aria-hidden="true">🇬🇭</span>
                  <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    onFocus={() => setFocus('phone')} onBlur={() => setFocus('')} disabled={loading}
                    placeholder="024 412 3456" className={inputCls} />
                </div>
              </Field>
              <button type="submit" disabled={loading} className={btnCls}>{loading ? 'Sending…' : 'Send me a code'}</button>
              <button type="button" onClick={() => { setCustomerMode('password'); setError('') }} className="w-full text-sm font-semibold text-gray-500 py-1">
                Use account number &amp; password instead
              </button>
            </form>
          )}

          {tab === 'customer' && customerMode === 'code' && codeStep && (
            <form onSubmit={(e) => { e.preventDefault(); verifyCode() }} className="space-y-3">
              <p className="text-sm text-gray-600">{codeSentTo}</p>
              <div className="relative">
                <div className="flex gap-2" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`flex-1 h-14 rounded-xl border-[1.5px] flex items-center justify-center text-2xl font-extrabold text-gray-900
                      ${i === Math.min(code.length, 5) && focus === 'code' ? 'border-orange-500 ring-4 ring-orange-500/15' : 'border-gray-200'}`}>
                      {code[i] || ''}
                    </div>
                  ))}
                </div>
                <input ref={codeRef} value={code} disabled={loading}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(v)
                    if (v.length === 6) verifyCode(v)
                  }}
                  onFocus={() => setFocus('code')} onBlur={() => setFocus('')}
                  inputMode="numeric" autoComplete="one-time-code" aria-label="6-digit code from the SMS"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-text" />
              </div>
              <button type="submit" disabled={loading || code.length !== 6} className={btnCls}>{loading ? 'Checking…' : 'Log in'}</button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => { setCodeSentTo(''); setCode(''); setError('') }} className="font-semibold text-gray-500">Change number</button>
                {resendIn > 0
                  ? <span className="text-gray-400">Resend in {Math.floor(resendIn / 60)}:{String(resendIn % 60).padStart(2, '0')}</span>
                  : <button type="button" onClick={sendCode} disabled={loading} className="font-bold text-orange-600">Send a new code</button>}
              </div>
            </form>
          )}

          {tab === 'customer' && customerMode === 'password' && (
            <>
              {passwordForm}
              <button type="button" onClick={() => { setCustomerMode('code'); setError('') }} className="mt-3 w-full text-sm font-semibold text-gray-500 py-1">
                Log in with an SMS code instead
              </button>
            </>
          )}

          {tab === 'staff' && passwordForm}

          <p className="text-center text-sm text-gray-500 mt-6">
            Just want to pay?{' '}
            <button type="button" onClick={() => setPayOpen(true)} className="font-bold text-orange-600">Pay without logging in →</button>
          </p>

          {/Android/i.test(navigator.userAgent) && !isNativeApp() && (
            <a href="/downloads/dandorsolar-app.apk"
              className="mt-5 flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-gray-200 text-gray-700 text-sm font-semibold">
              ⬇️ Download the Android app
            </a>
          )}
        </div>

        <div className="bg-gray-900 px-4 pb-6 pt-2">
          <PublicFooter dark />
        </div>
      </div>

      {payOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => !payBusy && setPayOpen(false)}>
          <form onSubmit={findPay} className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-gray-900">Pay your phone</h2>
            <p className="text-sm text-gray-500">No password needed. Pay by Mobile Money or card; your phone unlocks by itself.</p>
            <Field label="Account number (on your receipt, starts with DBS)" focused={focus === 'pa'}>
              <input value={payAcct} onChange={(e) => setPayAcct(e.target.value)} onFocus={() => setFocus('pa')} onBlur={() => setFocus('')}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="DBS202600001" className={inputCls} />
            </Field>
            <Field label="Phone number on the account" focused={focus === 'pp'}>
              <input type="tel" inputMode="tel" value={payPhone} onChange={(e) => setPayPhone(e.target.value)}
                onFocus={() => setFocus('pp')} onBlur={() => setFocus('')} placeholder="024 412 3456" className={inputCls} />
            </Field>
            <button type="submit" disabled={payBusy} className={btnCls}>{payBusy ? 'Finding…' : 'Continue'}</button>
            <button type="button" onClick={() => setPayOpen(false)} className="w-full text-sm font-semibold text-gray-500 py-1">Cancel</button>
          </form>
        </div>
      )}
    </div>
  )
}
