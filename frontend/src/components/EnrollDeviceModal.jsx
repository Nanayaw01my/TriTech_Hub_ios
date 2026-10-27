import React, { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Skeleton from './Skeleton'

/**
 * Shows the Device Owner enrollment QR for a sold phone. Staff scan this on a
 * freshly factory-reset Android phone (tap the welcome screen 6 times) to install
 * the Dan & Dor Solar lock agent and pair it to this sale.
 */
export default function EnrollDeviceModal({ deviceId, deviceLabel, isOpen, onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    try {
      const res = await api.get(`/admin/devices/${deviceId}/provision`)
      setData(res.data?.data || res.data)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not load the enrollment QR')
      onClose?.()
    } finally {
      setLoading(false)
    }
  }, [deviceId, onClose])

  useEffect(() => { if (isOpen) load() }, [isOpen, load])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-orange-500 to-orange-400" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-gray-900">Enroll Phone</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {deviceLabel && <p className="text-sm text-gray-500 mb-4">{deviceLabel}</p>}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-64 w-64 mx-auto" rounded="rounded-2xl" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
            </div>
          ) : data?.enrolled ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-bold text-gray-900">This phone is already enrolled</p>
              <p className="text-sm text-gray-500 mt-1">You can lock or unlock it from the device list.</p>
            </div>
          ) : (
            <>
              {!data?.ready && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 mb-4">
                  The agent APK isn’t published yet. Run <span className="font-semibold">Actions → “Build Lock
                  Agent APK”</span> (it commits the APK to the server), then redeploy the backend to make this
                  QR installable.
                </div>
              )}

              {data?.qr ? (
                <img src={data.qr} alt="Enrollment QR" className="w-64 h-64 mx-auto rounded-2xl border border-gray-100" />
              ) : (
                <div className="w-64 h-64 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                  QR unavailable
                </div>
              )}

              {data?.apk_url && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  App download:{' '}
                  <a href={data.apk_url} target="_blank" rel="noreferrer" className="text-orange-600 font-semibold break-all">
                    test link
                  </a>{' '}
                  (should download the .apk)
                </p>
              )}

              {data?.checksum && (
                <p className="mt-2 text-center text-[10px] text-gray-300 font-mono break-all">
                  build: {data.checksum.slice(0, 10)}…{data.checksum.slice(-6)}
                </p>
              )}

              <ol className="mt-5 space-y-2 text-sm text-gray-600 list-decimal list-inside">
                <li><span className="font-semibold text-gray-800">Factory reset</span> the phone (back up photos first).</li>
                <li>On the “Hi there” welcome screen, <span className="font-semibold text-gray-800">tap the screen 6 times</span>.</li>
                <li>When the camera opens, <span className="font-semibold text-gray-800">scan this QR code</span>.</li>
                <li>Let it install &amp; finish setup — the phone pairs to this sale automatically.</li>
              </ol>

              <div className="mt-4 flex items-center gap-2">
                <button onClick={load} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  New code
                </button>
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700">
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
