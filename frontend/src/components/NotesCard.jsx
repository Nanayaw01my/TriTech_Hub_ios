import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

/**
 * Notes on a customer: calls, promises to pay, follow-ups.
 * base = '/admin' or '/staff'.
 */
export default function NotesCard({ customerId, base = '/admin' }) {
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [more, setMore] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => api.get(`${base}/customers/${customerId}/notes`)
    .then((r) => setNotes(r.data?.data?.notes || [])).catch(() => {})
  useEffect(() => { if (customerId) load() }, [customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (text.trim().length < 2) { toast.error('Write the note first.'); return }
    setSaving(true)
    try {
      await api.post(`${base}/customers/${customerId}/notes`, {
        text, promise_date: promiseDate || undefined, promise_amount: promiseAmount || undefined, follow_up_date: followUp || undefined,
      })
      setText(''); setPromiseDate(''); setPromiseAmount(''); setFollowUp(''); setMore(false)
      toast.success('Note saved.')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save the note.')
    } finally {
      setSaving(false)
    }
  }

  const toggleDone = async (n) => {
    try {
      await api.patch(`${base}/notes/${n._id}`, { done: !n.done })
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update.')
    }
  }

  const d = (v) => (v ? format(new Date(v), 'dd MMM') : '')

  return (
    <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
      <h3 className="text-sm font-bold text-gray-800 mb-3">Notes & follow-ups</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
        placeholder="e.g. Called, says he'll pay on Friday"
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none" />
      {more ? (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="text-xs text-gray-500">Promised to pay by
            <input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)}
              className="mt-1 w-full px-2 py-2 border-2 border-gray-200 rounded-xl text-sm" />
          </label>
          <label className="text-xs text-gray-500">Amount promised (GHS)
            <input type="number" inputMode="decimal" value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)}
              className="mt-1 w-full px-2 py-2 border-2 border-gray-200 rounded-xl text-sm" />
          </label>
          <label className="text-xs text-gray-500 col-span-2">Call again on
            <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)}
              className="mt-1 w-full px-2 py-2 border-2 border-gray-200 rounded-xl text-sm" />
          </label>
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="mt-1 text-xs font-semibold text-orange-600">
          + Add a promise to pay or a call-back date
        </button>
      )}
      <button type="button" onClick={save} disabled={saving}
        className="mt-2 w-full py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold disabled:opacity-60">
        {saving ? 'Saving…' : 'Save note'}
      </button>

      {notes.length > 0 && (
        <div className="mt-4 space-y-2">
          {notes.map((n) => (
            <div key={n._id} className={`p-3 rounded-xl text-sm ${n.done ? 'bg-gray-50 text-gray-400' : 'bg-orange-50/60 text-gray-800'}`}>
              <p className={n.done ? 'line-through' : ''}>{n.text}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                {n.created_by?.name || ''} · {format(new Date(n.createdAt), 'dd MMM yyyy, HH:mm')}
                {n.promise_date && <> · <span className="font-semibold text-green-700">promised {n.promise_amount ? `GHS ${Number(n.promise_amount).toLocaleString()} ` : ''}by {d(n.promise_date)}</span></>}
                {n.follow_up_date && <> · <span className="font-semibold text-blue-700">call again {d(n.follow_up_date)}</span></>}
              </p>
              {(n.promise_date || n.follow_up_date) && (
                <button type="button" onClick={() => toggleDone(n)} className="mt-1 text-[11px] font-semibold text-orange-700">
                  {n.done ? 'Reopen' : 'Mark done'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
