import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { format } from 'date-fns'

export default function StaffDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recentCustomers, setRecentCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, custRes] = await Promise.allSettled([
          api.get('/staff/stats'),
          api.get('/staff/customers?limit=5'),
        ])
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data?.data || statsRes.value.data)
        }
        if (custRes.status === 'fulfilled') {
          const d = custRes.value.data?.data || custRes.value.data
          setRecentCustomers(Array.isArray(d.customers) ? d.customers : [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const summaryCards = [
    {
      label: 'My Customers',
      value: stats?.my_customers ?? 0,
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      bg: 'bg-green-50',
      border: 'border-green-100',
    },
    {
      label: 'Payments Today',
      value: stats?.payments_today ?? 0,
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      label: 'Overdue',
      value: stats?.overdue ?? 0,
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-6 lg:px-0">

      {/* ── Mobile Hero (hidden on desktop) ── */}
      <div className="lg:hidden px-5 pt-6 pb-12 bg-gradient-to-br from-green-900 via-green-800 to-green-900">
        <p className="text-green-300 text-xs font-semibold uppercase tracking-widest">Staff Portal</p>
        <h1 className="text-white text-2xl font-black mt-1 leading-tight">
          {user?.full_name?.split(' ')[0] || 'Staff'}
        </h1>
        {user?.staff_id && (
          <span className="inline-block bg-white/15 text-green-200 text-xs font-semibold px-3 py-1 rounded-full mt-2">
            ID: {user.staff_id}
          </span>
        )}

        {/* Hero stat pills */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-white text-xl font-black leading-none">{stats?.my_customers ?? 0}</p>
            <p className="text-green-300 text-[10px] font-semibold mt-0.5">Customers</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-white text-xl font-black leading-none">{stats?.payments_today ?? 0}</p>
            <p className="text-green-300 text-[10px] font-semibold mt-0.5">Paid Today</p>
          </div>
          <div className={`rounded-2xl p-3 text-center ${(stats?.overdue ?? 0) > 0 ? 'bg-red-500/40' : 'bg-white/10'}`}>
            <p className="text-white text-xl font-black leading-none">{stats?.overdue ?? 0}</p>
            <p className={`text-[10px] font-semibold mt-0.5 ${(stats?.overdue ?? 0) > 0 ? 'text-red-200' : 'text-green-300'}`}>Overdue</p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-0 -mt-5 lg:mt-0 lg:pt-4">

        {/* ── Desktop Header (hidden on mobile) ── */}
        <div className="hidden lg:block mb-6">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Staff Portal</p>
          <h1 className="text-2xl font-black text-gray-900 leading-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Staff'}!
          </h1>
          {user?.staff_id && <p className="text-sm font-bold text-green-700 mt-0.5">ID: {user.staff_id}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>

      {/* Desktop two-column layout */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

        {/* ── Left column: Stats + CTA ── */}
        <div className="lg:col-span-1 space-y-3 mb-5 lg:mb-0">

          {/* Stat cards — hidden on mobile (shown in hero), visible on desktop */}
          <div className="hidden lg:block space-y-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`${card.bg} border ${card.border} rounded-2xl p-4 flex items-center gap-4`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {card.icon}
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900 leading-none">{card.value}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Register CTA */}
          <button
            onClick={() => navigate('/staff/customers/add')}
            className="w-full py-4 bg-green-800 text-white font-black text-base rounded-2xl
                       flex items-center justify-center gap-3 shadow-lg
                       active:scale-95 transition-all duration-150 hover:bg-green-900"
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            Register New Customer
          </button>
        </div>

        {/* ── Right column: Recent Customers ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800">Recent Customers</h3>
              <button
                onClick={() => navigate('/staff/customers')}
                className="text-sm text-green-700 font-semibold hover:text-green-900"
              >
                View All →
              </button>
            </div>

            {recentCustomers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-400">No customers yet</p>
                <p className="text-xs text-gray-400 mt-1">Register your first customer using the button on the left</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentCustomers.slice(0, 5).map((c) => (
                  <div
                    key={c._id || c.id}
                    onClick={() => navigate(`/staff/customers/${c._id || c.id}`)}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-xl transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className="text-green-800 font-bold text-sm">
                          {(c.full_name || c.name || 'C').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.full_name || c.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {c.account_number} · {c.device_model}
                      </p>
                    </div>
                    <StatusBadge status={c.plan_status || c.status || 'active'} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      </div>{/* end px-4 wrapper */}
    </div>
  )
}
