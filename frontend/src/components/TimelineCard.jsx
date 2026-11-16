import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import { format } from 'date-fns'

const ICON = { payment: '💵', sms: '✉️', note: '📝', event: '•' }

/** Everything that happened to this customer, newest first. base = '/admin' | '/staff'. */
export default function TimelineCard({ customerId, base = '/admin' }) {
  const [events, setEvents] = useState(null)
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)

  useEffect(() => {
    if (!open || events) return
    api.get(`${base}/customers/${customerId}/timeline`)
      .then((r) => setEvents(r.data?.data?.events || []))
      .catch(() => setEvents([]))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = events ? (all ? events : events.slice(0, 25)) : []
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">History (payments, texts, locks, notes)</h3>
        <span className="text-xs font-semibold text-orange-600">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-3">
          {!events ? <p className="text-sm text-gray-400">Loading…</p>
            : events.length === 0 ? <p className="text-sm text-gray-400">Nothing yet.</p>
              : (
                <ol className="space-y-2">
                  {shown.map((e, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-6 text-center flex-shrink-0">{ICON[e.type] || '•'}</span>
                      <div className="min-w-0 flex-1 border-b border-gray-50 pb-2">
                        <p className="font-semibold text-gray-800 break-words">{e.title}</p>
                        {e.detail && <p className="text-xs text-gray-500 break-words">{e.detail}</p>}
                        <p className="text-[11px] text-gray-400">{e.at ? format(new Date(e.at), 'dd MMM yyyy, HH:mm') : ''}{e.by ? ` · ${e.by}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
          {events && events.length > 25 && !all && (
            <button type="button" onClick={() => setAll(true)} className="mt-2 text-xs font-semibold text-orange-600">Show all {events.length}</button>
          )}
        </div>
      )}
    </div>
  )
}
