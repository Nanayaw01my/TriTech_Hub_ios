import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const SECTIONS = [
  {
    title: 'About TriTech Hub iOS',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-emerald-600', bg: 'bg-emerald-50',
    points: [
      'A hire-purchase (installment) management system for selling iPhones.',
      'Customers pay a down payment, then installments over time.',
      'Each phone is supervised and can be locked remotely if payments stop.',
      'Payments run through Paystack (Mobile Money & card); alerts go by SMS.',
    ],
  },
  {
    title: 'For Admins',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    color: 'text-blue-600', bg: 'bg-blue-50',
    points: [
      'Dashboard: see totals — customers, revenue, overdue and locked phones.',
      'Customers: view any customer, their plan, photos and payment history.',
      'Lock / Unlock a device from the customer page or the Overdue page.',
      'Overdue: track behind accounts and lock them; Repossess if needed.',
      'Devices: manage the iPhone catalogue and record sales.',
      'Reports: revenue and performance; export data as needed.',
      'Reset a customer’s password and download their PDF receipt.',
    ],
  },
  {
    title: 'For Staff',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    color: 'text-orange-600', bg: 'bg-orange-50',
    points: [
      'Register a new customer: capture details, Ghana Card & guarantor, photos and signature.',
      'Collect the down payment at registration (Mobile Money / card).',
      'My Customers: see only the customers you registered.',
      'Collect installment payments from a customer’s page.',
      'Note: Ghana Card ID images are visible to admins only, not staff.',
    ],
  },
  {
    title: 'For Customers',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    color: 'text-purple-600', bg: 'bg-purple-50',
    points: [
      'Log in at tritechhub.online with the email/ID and password given at registration.',
      'Dashboard: see your device, balance and next due date.',
      'Pay installments anytime via Mobile Money or card.',
      'If a payment is missed the phone may be locked — pay to unlock it.',
      'Forgot password: reset it with a code sent to your phone.',
    ],
  },
  {
    title: 'Good to know',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-gray-600', bg: 'bg-gray-100',
    points: [
      'Sensitive data (phone numbers, Ghana Card IDs) is encrypted.',
      'Phones must be supervised (Apple Configurator) before handing to a customer.',
      'A phone can only be locked/located when it is online.',
      'Keep the SMS and MDM subscriptions funded so alerts and locks keep working.',
    ],
  },
]

export default function AdminGuide() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">
      {/* Mobile hero */}
      <div className="lg:hidden px-5 pt-8 pb-12 bg-gradient-to-br from-gray-50 to-emerald-50">
        <p className="text-emerald-600 text-xs font-semibold uppercase tracking-widest">Super Admin</p>
        <h1 className="text-gray-900 text-2xl font-black mt-1">
          Welcome, {(user?.full_name || user?.name)?.split(' ')[0] || 'Admin'}
        </h1>
        <p className="text-gray-600 text-sm mt-1">How to use TriTech Hub iOS</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-5 lg:mt-0 lg:pt-4">
        {/* Desktop header */}
        <div className="hidden lg:block mb-5">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Super Admin</p>
          <h1 className="text-2xl font-black text-gray-900">How to use TriTech Hub iOS</h1>
          <p className="text-sm text-gray-500 mt-0.5">A quick guide to the app and each user role.</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Dashboard', to: '/admin/dashboard' },
            { label: 'Customers', to: '/admin/customers' },
            { label: 'Overdue', to: '/admin/overdue-accounts' },
            { label: 'Settings', to: '/admin/settings' },
          ].map((a) => (
            <button
              key={a.to}
              onClick={() => navigate(a.to)}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm py-3 px-2 text-sm font-semibold text-gray-800 hover:border-emerald-200 hover:text-emerald-700 active:scale-95 transition-all"
            >
              {a.label} →
            </button>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <svg className={`w-5 h-5 ${s.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-gray-900">{s.title}</h2>
              </div>
              <ul className="space-y-2">
                {s.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.color.replace('text-', 'bg-')}`} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} TriTech Hub iOS · Powered by Ittek Solutions
        </p>
      </div>
    </div>
  )
}
