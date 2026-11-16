import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

/**
 * Phones trying to check in with an id the system doesn't know (e.g. their
 * record was taken over by another phone during setup). Reconnect them here
 * instead of resetting them.
 */
export default function UnknownPhonesCard({ onChanged }) {
  const [phones, setPhones] = useState([])
  const [busy, setBusy] = useState(null)
  const load = () => api.get('/admin/unknown-phones').then((r) => setPhones(r.data?.data?.phones || [])).catch(() => {})
  useEffect(() => { load() }, [])
  if (!phones.length) return null
  const act = async (p, action) => {
    const what = action === 'release'
      ? 'Release this phone? The activation/lock screen goes away and our app lets go of it (it is no longer managed).'
      : 'Add this phone back to your stock?'
    if (!window.confirm(what)) return
    setBusy(p._id)
    try {
      const r = await api.post(`/admin/unknown-phones/${p._id}/reconnect`, { action })
      toast.success(r.data?.message || 'Done.', { duration: 9000 })
      load()
      onChanged && onChanged()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not reconnect the phone.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <p className="font-bold text-amber-900">Phones the system doesn't know ({phones.length})</p>
      <p className="text-xs text-amber-800 mt-1">
        These phones are online and trying to check in, but have no record here (e.g. their record was taken over by another
        phone with the same IMEI during setup). Release one to remove its activation/lock screen, or add it back to stock.
      </p>
      <div className="mt-3 space-y-2">
        {phones.map((p) => (
          <div key={p._id} className="bg-white rounded-xl p-3 border border-amber-100">
            <p className="text-sm font-bold text-gray-900">{p.imei ? `IMEI ${p.imei}` : 'IMEI not reported'} <span className="font-mono text-xs text-gray-500">· ID …{p.device_code}</span></p>
            <p className="text-[11px] text-gray-500">
              {p.app_version ? `App ${p.app_version} · ` : ''}{p.lock_state === 'pending' ? 'Showing Awaiting Activation · ' : p.lock_state === 'locked' ? 'Locked · ' : ''}
              last tried {formatDistanceToNow(new Date(p.last_at), { addSuffix: true })} · {p.tries} tries
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy === p._id} onClick={() => act(p, 'release')}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 disabled:opacity-60">Release it</button>
              <button type="button" disabled={busy === p._id} onClick={() => act(p, 'stock')}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-gray-300 text-gray-800 disabled:opacity-60">Add to stock</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
