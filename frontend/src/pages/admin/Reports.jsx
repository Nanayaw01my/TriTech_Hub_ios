import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

const PERIODS = ['daily', 'weekly', 'monthly']

export default function AdminReports() {
  const [period, setPeriod] = useState('monthly')
  const [chartData, setChartData] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [forecast, setForecast] = useState([])
  const [totalProjected, setTotalProjected] = useState(0)
  const [forecastLoading, setForecastLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/reports?period=${period}`)
      const d = res.data?.data || res.data
      setChartData(Array.isArray(d.revenueData) ? d.revenueData : [])
      setSummary(d.summary || null)
    } catch (err) {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchReports() }, [fetchReports])

  useEffect(() => {
    const loadForecast = async () => {
      setForecastLoading(true)
      try {
        const res = await api.get('/admin/revenue-forecast')
        const d = res.data?.data || res.data
        setForecast(Array.isArray(d.forecast) ? d.forecast : [])
        setTotalProjected(d.total_projected || 0)
      } catch {
        // silently fail
      } finally {
        setForecastLoading(false)
      }
    }
    loadForecast()
  }, [])

  const statCards = [
    {
      label: 'Total Revenue',
      value: `GHS ${Number(summary?.totalRevenue || 0).toLocaleString()}`,
      icon: '💰',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
    },
    {
      label: 'Transactions',
      value: summary?.totalTransactions ?? 0,
      icon: '💳',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
    },
    {
      label: 'Avg Transaction',
      value: `GHS ${Number(summary?.avgTransactionValue || 0).toLocaleString()}`,
      icon: '📈',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    {
      label: 'Period',
      value: period.charAt(0).toUpperCase() + period.slice(1),
      icon: '📅',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
  ]

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">

      {/* Mobile Hero */}
      <div className="lg:hidden px-5 pt-6 pb-12 bg-gradient-to-br from-gray-50 to-emerald-50">
        <p className="text-emerald-600 text-xs font-semibold uppercase tracking-widest">Admin Portal</p>
        <h1 className="text-gray-900 text-2xl font-black mt-1">Reports</h1>
        {summary?.totalRevenue > 0 && (
          <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5 inline-block">
            <p className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Total Revenue</p>
            <p className="text-emerald-900 text-xl font-black">GHS {Number(summary.totalRevenue).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-5 lg:mt-0 lg:pt-4">

      {/* Desktop Header */}
      <div className="hidden lg:block mb-5">
        <h1 className="text-2xl font-black text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Revenue and performance analytics</p>
      </div>

      {/* Period selector */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold capitalize transition-all duration-200
              ${period === p ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {statCards.map((card) => (
              <div key={card.label} className={`${card.bg} rounded-2xl p-4`}>
                <p className="text-2xl mb-1">{card.icon}</p>
                <p className={`text-xl font-black ${card.text}`}>{card.value}</p>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          {chartData.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-card p-4 mb-5">
              <h3 className="text-base font-bold text-gray-800 mb-4 capitalize">
                {period.charAt(0).toUpperCase() + period.slice(1)} Revenue (GHS)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => [`GHS ${Number(value).toLocaleString()}`, 'Revenue']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="total_revenue" fill="#2E7D32" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-card p-12 text-center mb-5">
              <p className="text-gray-400 text-sm">No revenue data available for this period</p>
            </div>
          )}

          {/* Revenue Forecast */}
          <div className="bg-white rounded-2xl shadow-card p-4 mb-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-gray-800">6-Month Revenue Forecast</h3>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                Projected
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Expected income from active installment schedules
            </p>
            {forecastLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
            ) : forecast.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No active plans to forecast</p>
            ) : (
              <>
                <div className="bg-blue-50 rounded-2xl p-3 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Total Projected (6 months)</p>
                    <p className="text-xl font-black text-blue-700">
                      GHS {Number(totalProjected).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className="text-3xl">📊</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={forecast} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => [`GHS ${Number(value).toLocaleString()}`, 'Projected']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="projected_revenue" fill="#1565C0" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

        </>
      )}
      </div>{/* end max-w-5xl */}
    </div>
  )
}
