import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'

export default function AdminSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  const search = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await api.get(`/admin/search?q=${encodeURIComponent(q.trim())}`)
      setResults(res.data?.data || { customers: [], devices: [], payments: [] })
    } catch {
      setResults({ customers: [], devices: [], payments: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 400)
  }

  const total = results ? (results.customers?.length + results.devices?.length + results.payments?.length) : 0

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 lg:pb-6">
      <h1 className="text-xl font-black text-gray-900 mb-4">Search Everything</h1>

      {/* Search Input */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search by name, phone, email, IMEI, serial, reference…"
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:border-green-500 focus:outline-none text-sm font-medium bg-white shadow-sm"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Empty state */}
      {!results && !loading && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm font-medium">Type at least 2 characters to search</p>
          <p className="text-xs mt-1">Searches customers, devices, and payment references</p>
        </div>
      )}

      {/* No results */}
      {results && total === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm font-medium">No results for "<span className="text-gray-600">{query}</span>"</p>
        </div>
      )}

      {/* Results */}
      {results && total > 0 && (
        <div className="space-y-5">

          {/* Customers */}
          {results.customers?.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Customers ({results.customers.length})
              </p>
              <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-gray-100">
                {results.customers.map(c => (
                  <button
                    key={c._id}
                    onClick={() => navigate(`/admin/customers/${c._id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-800 font-black text-sm">
                        {(c.full_name || 'C').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{c.full_name}</p>
                      <p className="text-xs text-gray-500">{c.phone} {c.email ? `· ${c.email}` : ''}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Devices */}
          {results.devices?.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Devices ({results.devices.length})
              </p>
              <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-gray-100">
                {results.devices.map(d => (
                  <div key={d._id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{d.model}</p>
                      <p className="text-xs text-gray-500">
                        {d.serial_number ? `S/N: ${d.serial_number}` : ''}
                        {d.imei ? ` · IMEI: ${d.imei}` : ''}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${d.lock_status === 'locked' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {d.lock_status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Payments */}
          {results.payments?.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Payments ({results.payments.length})
              </p>
              <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-gray-100">
                {results.payments.map(p => (
                  <div key={p._id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900">GHS {Number(p.amount).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{p.paystack_reference}</p>
                      {p.customer_id?.full_name && (
                        <p className="text-xs text-gray-400">{p.customer_id.full_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
