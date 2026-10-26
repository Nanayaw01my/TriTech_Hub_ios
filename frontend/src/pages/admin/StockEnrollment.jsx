import React, { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Skeleton from '../../components/Skeleton'
import { formatDistanceToNow } from 'date-fns'

// Bulk enrollment: scan ONE QR on every factory-reset phone to fill your
// enrolled-stock pool, then DSRs pick phones from stock at the point of sale.
export default function StockEnrollment() {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState(null)
  const [devices, setDevices] = useState([])
  const [tab, setTab] = useState('available') // available | all

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, d] = await Promise.all([
        api.get('/admin/stock-enrollment'),
        api.get('/admin/enrolled-devices'),
      ])
      setInfo(s.data?.data || s.data)
      setDevices((d.data?.data || d.data)?.devices || [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not load stock enrollment')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const shown = devices.filter((x) => (tab === 'available' ? !x.assigned : true))

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">Admin</p>
        <h1 className="text-2xl font-black text-gray-900 mb-4">Enroll Stock</h1>

        {loading ? (
          <Skeleton className="h-96 w-full" rounded="rounded-2xl" />
        ) : (
          <>
            {/* Counts */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-orange-600 rounded-2xl p-4 text-center">
                <p className="text-white text-3xl font-black">{info?.available_count ?? 0}</p>
                <p className="text-white/90 text-xs font-semibold mt-0.5">Available in stock</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
                <p className="text-gray-900 text-3xl font-black">{info?.enrolled_total ?? 0}</p>
                <p className="text-gray-500 text-xs font-semibold mt-0.5">Total enrolled</p>
              </div>
            </div>

            {/* QR card */}
            <div className="bg-white rounded-2xl shadow-card p-6 mb-4 text-center">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Stock Enrollment QR</h2>
              <p className="text-sm text-gray-500 mb-4">
                Scan this <span className="font-semibold">same QR</span> on every phone to add it to your stock.
              </p>
              {!info?.ready && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 mb-4 text-left">
                  The agent app isn’t published yet. Run <span className="font-semibold">Actions → “Build Lock Agent APK”</span>, then redeploy.
                </div>
              )}
              {info?.qr ? (
                <img src={info.qr} alt="Stock enrollment QR" className="w-64 h-64 mx-auto rounded-2xl border border-gray-100" />
              ) : (
                <div className="w-64 h-64 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">QR unavailable</div>
              )}
              {info?.checksum && (
                <p className="mt-2 text-center text-[10px] text-gray-300 font-mono break-all">
                  build: {info.checksum.slice(0, 10)}…{info.checksum.slice(-6)}
                </p>
              )}
              <ol className="mt-5 space-y-2 text-sm text-gray-600 list-decimal list-inside text-left max-w-md mx-auto">
                <li><span className="font-semibold text-gray-800">Factory reset</span> each new phone.</li>
                <li>On the welcome screen, <span className="font-semibold text-gray-800">tap the screen 6 times</span>.</li>
                <li><span className="font-semibold text-gray-800">Scan this QR</span> → it installs &amp; locks the phone.</li>
                <li>The phone appears below in <span className="font-semibold text-gray-800">Available stock</span>. Repeat for all phones.</li>
              </ol>
              <button onClick={load} className="mt-4 text-sm font-semibold text-orange-600 hover:text-orange-700">Refresh</button>
            </div>

            {/* Inventory */}
            <div className="flex gap-2 mb-3">
              {['available', 'all'].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                  {t === 'available' ? 'Available' : 'All enrolled'}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-card">
                <p className="text-gray-500 font-medium">No phones here yet</p>
                <p className="text-sm text-gray-400 mt-1">Scan the QR on a reset phone to add it.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shown.map((d) => (
                  <div key={d._id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{d.model}</p>
                      <p className="text-xs text-gray-400 font-mono truncate">{d.imei ? `IMEI ${d.imei}` : (d.serial_number ? `SN ${d.serial_number}` : '—')}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {d.assigned
                        ? <span className="text-[11px] font-semibold text-gray-500">Sold · {d.customer_name}</span>
                        : <span className="text-[11px] font-semibold text-orange-600">In stock</span>}
                      <p className={`text-[10px] font-semibold ${d.online ? 'text-green-600' : 'text-gray-400'}`}>
                        {d.online ? 'Online' : (d.last_seen ? formatDistanceToNow(new Date(d.last_seen), { addSuffix: true }) : 'Offline')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
