import React, { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../api/axios'
import toast from 'react-hot-toast'
import Skeleton from './Skeleton'
import { formatDistanceToNow } from 'date-fns'

/** Shows a phone's last-known location + recent trail on a map. */
export default function LocationModal({ deviceId, deviceLabel, isOpen, onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const mapRef = useRef(null)
  const mapObj = useRef(null)

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    try {
      const res = await api.get(`/admin/devices/${deviceId}/locations`)
      setData(res.data?.data || res.data)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not load location')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => { if (isOpen) load() }, [isOpen, load])

  // Build the map once we have data and the container is on screen.
  useEffect(() => {
    if (!isOpen || loading) return
    const cur = data?.current
    if (!cur || cur.lat == null) return
    if (!mapRef.current) return

    if (mapObj.current) { mapObj.current.remove(); mapObj.current = null }
    const map = L.map(mapRef.current, { attributionControl: true }).setView([cur.lat, cur.lng], 15)
    mapObj.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    // Trail (oldest → newest)
    const hist = Array.isArray(data.history) ? [...data.history].reverse() : []
    if (hist.length > 1) {
      L.polyline(hist.map(h => [h.lat, h.lng]), { color: '#EA580C', weight: 3, opacity: 0.6 }).addTo(map)
    }
    // Current position
    L.circleMarker([cur.lat, cur.lng], {
      radius: 9, color: '#fff', weight: 3, fillColor: '#EA580C', fillOpacity: 1,
    }).addTo(map)
    if (cur.accuracy) {
      L.circle([cur.lat, cur.lng], { radius: cur.accuracy, color: '#EA580C', weight: 1, fillOpacity: 0.08 }).addTo(map)
    }
    setTimeout(() => map.invalidateSize(), 150)

    return () => { if (mapObj.current) { mapObj.current.remove(); mapObj.current = null } }
  }, [isOpen, loading, data])

  if (!isOpen) return null

  const cur = data?.current
  const gmaps = cur ? `https://www.google.com/maps?q=${cur.lat},${cur.lng}` : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 bg-gradient-to-r from-orange-500 to-orange-400" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-gray-900">Track Phone</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {deviceLabel && <p className="text-sm text-gray-500 mb-4">{deviceLabel}</p>}

          {loading ? (
            <Skeleton className="h-72 w-full" rounded="rounded-2xl" />
          ) : !cur || cur.lat == null ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="font-bold text-gray-900">No location yet</p>
              <p className="text-sm text-gray-500 mt-1">The phone reports its location when it checks in. Make sure it's enrolled and online.</p>
            </div>
          ) : (
            <>
              <div ref={mapRef} className="h-72 w-full rounded-2xl overflow-hidden border border-gray-100 z-0" />
              <div className="mt-3 flex items-center justify-between text-sm">
                <div>
                  <span className={`inline-flex items-center gap-1 font-semibold ${data.online ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${data.online ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {data.online ? 'Online' : 'Offline'}
                  </span>
                  {cur.at && <span className="text-gray-400"> · updated {formatDistanceToNow(new Date(cur.at), { addSuffix: true })}</span>}
                </div>
                <a href={gmaps} target="_blank" rel="noreferrer" className="text-orange-600 font-semibold hover:text-orange-700">
                  Open in Maps →
                </a>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                {cur.lat.toFixed(5)}, {cur.lng.toFixed(5)}{cur.accuracy ? ` · ±${Math.round(cur.accuracy)}m` : ''}
              </p>
              <button onClick={load} className="mt-4 w-full py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Refresh
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
