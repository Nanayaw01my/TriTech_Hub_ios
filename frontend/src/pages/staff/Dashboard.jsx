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
    { label: 'Customers',  value: stats?.my_customers ?? 0,   color: 'text-emerald-400' },
    { label: 'Paid Today', value: stats?.payments_today ?? 0, color: 'text-sky-400' },
    { label: 'Overdue',    value: stats?.overdue ?? 0,        color: (stats?.overdue ?? 0) > 0 ? 'text-red-400' : 'text-gray-400' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-black relative overflow-hidden">
      {/* Subtle emerald glow */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-600 rounded-full blur-3xl opacity-10 pointer-events-none" />
      <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-emerald-700 rounded-full blur-3xl opacity-10 pointer-events-none" />

      <div className="relative z-10 px-5 pt-6 lg:max-w-5xl lg:mx-auto lg:px-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Staff Portal</p>
            <h1 className="text-white text-3xl font-black mt-1 leading-tight truncate">
              Hi, {(user?.full_name || user?.name)?.split(' ')[0] || 'Staff'} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
          </div>
          {user?.staff_id && (
            <span className="bg-gray-900 border border-gray-800 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ml-3">
              {user.staff_id}
            </span>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
              <p className={`text-3xl font-black leading-none ${card.color}`}>{card.value}</p>
              <p className="text-gray-500 text-[11px] font-semibold mt-2 uppercase tracking-wide">{card.label}</p>
            </div>
          ))}
        </div>

        {/* ── Register CTA ── */}
        <button
          onClick={() => navigate('/staff/customers/add')}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600
                     text-white font-black text-base flex items-center justify-center gap-3
                     shadow-lg shadow-emerald-500/20 active:scale-95 transition-all duration-150
                     hover:from-emerald-600 hover:to-emerald-700"
        >
          <span className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </span>
          Register New Customer
        </button>

        {/* ── Recent Customers ── */}
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">Recent Customers</h3>
            <button
              onClick={() => navigate('/staff/customers')}
              className="text-sm text-emerald-400 font-semibold hover:text-emerald-300"
            >
              View All →
            </button>
          </div>

          {recentCustomers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-400">No customers yet</p>
              <p className="text-xs text-gray-600 mt-1">Register your first customer with the button above</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {recentCustomers.slice(0, 5).map((c) => (
                <div
                  key={c._id || c.id}
                  onClick={() => navigate(`/staff/customers/${c._id || c.id}`)}
                  className="flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-800/50 -mx-1 px-2 rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-emerald-400 font-bold text-sm">
                        {(c.full_name || c.name || 'C').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.full_name || c.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.account_number}{c.device_model ? ` · ${c.device_model}` : ''}
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
  )
}
