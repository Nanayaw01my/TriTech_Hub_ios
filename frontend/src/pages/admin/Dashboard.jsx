import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { format } from 'date-fns'

const NAV_CARDS = [
  {
    label: 'Customers', to: '/admin/customers',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
    iconColor: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
  },
  {
    label: 'Staff', to: '/admin/staff',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    iconColor: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
  },
  {
    label: 'Devices', to: '/admin/devices',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />,
    iconColor: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200',
  },
  {
    label: 'Transactions', to: '/admin/transactions',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
    iconColor: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200',
  },
  {
    label: 'Reports', to: '/admin/reports',
    icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></>,
    iconColor: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200',
  },
  {
    label: 'Settings', to: '/admin/settings',
    icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
    iconColor: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200',
  },
]

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [revenueData, setRevenueData] = useState([])
  const [planStats, setPlanStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, txRes, revenueRes] = await Promise.allSettled([
          api.get('/admin/dashboard'),
          api.get('/admin/transactions?limit=5'),
          api.get('/admin/reports?period=monthly'),
        ])
        if (statsRes.status === 'fulfilled') {
          const d = statsRes.value.data?.data || statsRes.value.data
          setStats(d?.stats || d || {})
          const s = d?.stats || d || {}
          if (s.activeInstallmentPlans !== undefined) {
            setPlanStats([
              { name: 'Active', value: s.activeInstallmentPlans ?? 0, color: '#16a34a' },
              { name: 'Overdue', value: s.overduePayments ?? 0, color: '#ef4444' },
            ])
          }
          const txList = d?.recentTransactions
          if (Array.isArray(txList)) setRecentTransactions(txList)
        }
        if (txRes.status === 'fulfilled') {
          const d = txRes.value.data?.data || txRes.value.data
          const list = Array.isArray(d?.transactions) ? d.transactions : []
          if (list.length > 0) setRecentTransactions(list)
        }
        if (revenueRes.status === 'fulfilled') {
          const d = revenueRes.value.data?.data || revenueRes.value.data
          setRevenueData(Array.isArray(d?.revenueData) ? d.revenueData : [])
        }
      } catch (err) {
        console.error('Dashboard error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const summaryCards = [
    { label: 'Total Staff',     value: stats?.totalStaff ?? 0,               icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,                                                                                                                                                                                                                                                                                          bg: 'bg-blue-50',    text: 'text-blue-700',    icon_c: 'text-blue-600'    },
    { label: 'Total Customers', value: stats?.totalCustomers ?? 0,            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,                                                                                                                                            bg: 'bg-emerald-50',   text: 'text-emerald-700',   icon_c: 'text-emerald-600'   },
    { label: 'Total Devices',   value: stats?.totalDevices ?? 0,              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />,                                                                                                                                                                                                                                                                               bg: 'bg-purple-50',  text: 'text-purple-700',  icon_c: 'text-purple-600'  },
    { label: 'Overdue',         value: stats?.overduePayments ?? 0,           icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,                                                                                                                                                                                                                                                                                                                bg: 'bg-orange-50',  text: 'text-orange-700',  icon_c: 'text-orange-600'  },
    { label: 'Locked Phones',   value: stats?.lockedPhones ?? 0,              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,                                                                                                                                                                                                                                                    bg: 'bg-red-50',     text: 'text-red-700',     icon_c: 'text-red-600'     },
    { label: 'Active Plans',    value: stats?.activeInstallmentPlans ?? 0,    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,                                                                                                                                                                                                                                                                                                              bg: 'bg-emerald-50', text: 'text-emerald-700', icon_c: 'text-emerald-600' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">

      {/* ── Mobile Hero (hidden on desktop) ── */}
      <div className="lg:hidden px-5 pt-6 pb-12 bg-gradient-to-br from-gray-50 to-emerald-50">
        <p className="text-emerald-600 text-xs font-semibold uppercase tracking-widest">Admin Portal</p>
        <h1 className="text-gray-900 text-2xl font-black mt-1 leading-tight">
          {(user?.full_name || user?.name || 'Admin').split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-xs mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>

        {/* Hero stat pills */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
            <p className="text-emerald-700 text-xl font-black leading-none">{stats?.totalCustomers ?? 0}</p>
            <p className="text-emerald-600 text-[10px] font-semibold mt-0.5">Customers</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
            <p className="text-blue-700 text-xl font-black leading-none">{stats?.activeInstallmentPlans ?? 0}</p>
            <p className="text-blue-600 text-[10px] font-semibold mt-0.5">Active Plans</p>
          </div>
          <div className={`rounded-2xl p-3 text-center border ${(stats?.overduePayments ?? 0) > 0 ? 'bg-red-50 border-red-100' : 'bg-yellow-50 border-yellow-100'}`}>
            <p className={`text-xl font-black leading-none ${(stats?.overduePayments ?? 0) > 0 ? 'text-red-700' : 'text-yellow-700'}`}>{stats?.overduePayments ?? 0}</p>
            <p className={`text-[10px] font-semibold mt-0.5 ${(stats?.overduePayments ?? 0) > 0 ? 'text-red-600' : 'text-yellow-600'}`}>Overdue</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-5 lg:mt-0 lg:pt-4">

        {/* ── Desktop Header (hidden on mobile) ── */}
        <div className="hidden lg:block mb-5">
          <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, {user?.full_name || user?.name} • {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>

        {/* Summary Cards — scrollable strip on mobile, grid on desktop */}
        <div className="flex lg:grid lg:grid-cols-6 gap-3 mb-6 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 scrollbar-hide">
          {summaryCards.map((card) => (
            <div key={card.label} className={`${card.bg} rounded-2xl p-4 border border-opacity-50 flex-shrink-0 w-36 lg:w-auto`}>
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm mb-2">
                <svg className={`w-5 h-5 ${card.icon_c}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{card.icon}</svg>
              </div>
              <p className={`text-2xl font-black ${card.text}`}>{card.value.toLocaleString()}</p>
              <p className="text-xs font-semibold text-gray-600 mt-0.5 leading-tight">{card.label}</p>
            </div>
          ))}
        </div>

        {/* 2-col on desktop, stacked on mobile */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">

          {/* Left column */}
          <div className="space-y-4">

            {/* Quick Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Access</p>
              <div className="grid grid-cols-3 gap-2">
                {NAV_CARDS.map((card) => (
                  <button
                    key={card.label}
                    onClick={() => navigate(card.to)}
                    className={`${card.bg} border ${card.border} rounded-2xl p-3 text-center
                               active:scale-95 transition-all duration-150 hover:shadow-sm`}
                  >
                    <div className={`w-8 h-8 bg-white rounded-xl flex items-center justify-center mx-auto mb-1.5 shadow-sm`}>
                      <svg className={`w-4 h-4 ${card.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{card.icon}</svg>
                    </div>
                    <p className="text-[10px] font-bold text-gray-700 leading-tight">{card.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Revenue Chart */}
            {revenueData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Monthly Revenue (GHS)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={revenueData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => [`GHS ${Number(value).toLocaleString()}`, 'Revenue']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="total_revenue" fill="#2E7D32" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Plan Status Chart */}
            {planStats.some(s => s.value > 0) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Plan Status</p>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={planStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {planStats.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Right column — Recent Transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Transactions</p>
              <button onClick={() => navigate('/admin/transactions')} className="text-xs text-emerald-700 font-semibold">
                View All →
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="text-center py-10 text-gray-300">
                <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p className="text-sm text-gray-400">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((tx, idx) => (
                  <div key={tx.id || idx} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-800 font-bold text-sm">
                        {(tx.customer_name || tx.customer?.full_name || 'C').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {tx.customer_name || tx.customer?.full_name || 'Customer'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.created_at ? format(new Date(tx.created_at), 'dd MMM, HH:mm') : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-emerald-800">GHS {Number(tx.amount || 0).toLocaleString()}</p>
                      <StatusBadge status={tx.status || 'paid'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
