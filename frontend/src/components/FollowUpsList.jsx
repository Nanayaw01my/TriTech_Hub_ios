import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import { format } from 'date-fns'

const money = (n) => `GHS ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const BUCKET_STYLE = { '1-7': 'bg-amber-50 text-amber-800', '8-30': 'bg-orange-50 text-orange-800', '31-60': 'bg-red-50 text-red-700', '60+': 'bg-red-100 text-red-800' }

/**
 * "To call today": overdue customers and promises / call-backs due, plus how
 * long customers have been overdue (age groups). base = '/admin' | '/staff'.
 */
export default function FollowUpsList({ base = '/admin', onOpen }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    api.get(`${base}/follow-ups`).then((r) => setData(r.data?.data || { items: [], aging: {} })).catch(() => setData({ items: [], aging: {} }))
  }, [base])
  if (!data) return <div className="bg-white rounded-2xl shadow-card p-4 mb-4 text-sm text-gray-400">Loading calls…</div>
  const aging = data.aging || {}
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
      <h3 className="text-sm font-bold text-gray-800">How late are overdue customers?</h3>
      <div className="grid grid-cols-4 gap-2 mt-2">
        {['1-7', '8-30', '31-60', '60+'].map((b) => (
          <div key={b} className={`rounded-xl p-2 text-center ${BUCKET_STYLE[b]}`}>
            <p className="text-lg font-black">{aging[b]?.count || 0}</p>
            <p className="text-[10px] font-semibold">{b} days</p>
            <p className="text-[10px]">{money(aging[b]?.amount)}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-bold text-gray-800 mt-5">To call today ({data.items.length})</h3>
      {data.items.length === 0 ? (
        <p className="text-sm text-gray-400 mt-2">Nobody to call today. 🎉</p>
      ) : (
        <div className="mt-2 divide-y divide-gray-50">
          {data.items.map((it) => (
            <button key={it.customer_id} type="button" onClick={() => onOpen && onOpen(it.customer_id)}
              className="w-full text-left py-3 flex gap-3 items-start hover:bg-gray-50 rounded-xl px-1">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {it.name} {it.locked && <span className="text-red-600">🔒</span>}
                </p>
                <p className="text-xs text-gray-500">
                  <a href={`tel:${it.phone}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-orange-700">{it.phone}</a>
                  {it.dsr ? ` · DSR ${it.dsr}` : ''}{it.device_model ? ` · ${it.device_model}` : ''}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {it.days_overdue > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">{it.days_overdue} day(s) late · {money(it.amount_due)}</span>}
                  {it.reasons.includes('promise') && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">promise due</span>}
                  {it.reasons.includes('follow_up') && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">call-back due</span>}
                </div>
                {it.last_note && (
                  <p className="text-[11px] text-gray-500 mt-1 truncate">Last note ({format(new Date(it.last_note.at), 'dd MMM')}): {it.last_note.text}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
