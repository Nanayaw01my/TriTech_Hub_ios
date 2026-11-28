import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const clean = (m) => {
  const w = String(m || '').trim().split(/\s+/).filter(Boolean)
  if (w.length > 1 && w[0].toLowerCase() === w[1].toLowerCase()) w.splice(1, 1)
  if (w[0] && /^[a-zA-Z]+$/.test(w[0])) w[0] = w[0][0].toUpperCase() + w[0].slice(1).toLowerCase()
  return w.join(' ') || 'Phone'
}

/**
 * Move this customer's sale onto the phone they actually have (picked from the
 * enrolled stock). The old phone goes back to stock.
 */
export default function ChangePhoneModal({ customerId, current, onClose, onDone }) {
  const [phones, setPhones] = useState(null)
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/admin/enrolled-devices?available=1')
      .then((r) => setPhones((r.data?.data || r.data)?.devices || []))
      .catch(() => { setPhones([]); toast.error('Could not load the phones in stock.') })
  }, [])

  const term = q.replace(/\s+/g, '').toLowerCase()
  const sameModel = (d) => clean(d.model).toLowerCase() === clean(current?.model).toLowerCase()
  const list = (phones || [])
    .filter((d) => String(d._id) !== String(current?._id))
    .filter((d) => !term || String(d.imei || '').includes(term) || clean(d.model).toLowerCase().replace(/\s+/g, '').includes(term) || String(d.device_code || '').toLowerCase().includes(term))
    .sort((a, b) => (sameModel(b) - sameModel(a)) || ((b.online ? 1 : 0) - (a.online ? 1 : 0)) ||
      (new Date(b.last_seen || 0) - new Date(a.last_seen || 0)))

  const save = async () => {
    if (!pick) return
    setBusy(true)
    try {
      const r = await api.post(`/admin/customers/${customerId}/change-phone`, { device_id: pick._id })
      toast.success(r.data?.message || 'Done.', { duration: 10000 })
      onDone && onDone()
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not change the phone.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-gray-900">Change phone on this sale</h3>
        <p className="text-sm text-gray-600 mt-1">
          Use this when the customer has a <strong>different phone</strong> from the one linked here
          ({clean(current?.model)}{current?.imei ? `, IMEI …${String(current.imei).slice(-6)}` : ''}).
          Pick the phone they really have; check the IMEI on its box or sticker.
        </p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search last digits of IMEI or model"
          inputMode="search" className="mt-3 w-full px-4 py-3 border-[1.5px] border-gray-200 rounded-2xl text-sm" />
        <div className="mt-3 overflow-y-auto flex-1 space-y-2 min-h-[120px]">
          {phones === null && <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>}
          {phones !== null && list.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">No phones in stock match.</p>}
          {list.map((d) => (
            <button key={d._id} type="button" onClick={() => setPick(d)}
              className={`w-full text-left rounded-2xl border-[1.5px] p-3 ${pick?._id === d._id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-sm text-gray-900">{clean(d.model)}</span>
                <span className={`text-[11px] font-semibold ${d.online ? 'text-green-600' : 'text-gray-400'}`}>
                  {d.online ? '● Online now' : d.last_seen ? `seen ${formatDistanceToNow(new Date(d.last_seen), { addSuffix: true })}` : 'never seen'}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-600 mt-0.5 break-all">{d.imei ? `IMEI ${d.imei}` : d.device_code ? `ID …${d.device_code}` : '—'}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {d.awaiting_activation ? 'Showing Awaiting Activation · ' : ''}{d.held_by ? `With ${d.held_by.name}` : 'At office'}
              </p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button type="button" onClick={onClose} disabled={busy} className="py-3 rounded-2xl border border-gray-300 text-gray-700 font-semibold text-sm">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !pick}
            className="py-3 rounded-2xl bg-orange-600 text-white font-bold text-sm disabled:opacity-50">
            {busy ? 'Moving…' : pick ? `Use ${clean(pick.model)}` : 'Pick a phone'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">The phone you pick takes this sale (unlocks if paid up). The old phone goes back to stock on Awaiting Activation.</p>
      </div>
    </div>
  )
}
