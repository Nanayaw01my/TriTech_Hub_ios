import React, { useEffect, useState } from 'react'
import api from '../api/axios'

const money = (n) => `GH₵${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const PERIODS = [['month', 'This month'], ['last_month', 'Last month'], ['year', 'This year'], ['all', 'All time']]

/** Sales, profit (where cost is known), collections — overall and per branch. */
export default function BusinessReportCard() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  useEffect(() => {
    setData(null)
    api.get(`/admin/business-report?period=${period}`).then((r) => setData(r.data?.data || null)).catch(() => setData({ error: true }))
  }, [period])
  const t = data?.total || {}
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-bold text-gray-800">Sales, profit & branches</h3>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {!data ? <p className="text-sm text-gray-400 mt-4">Loading…</p> : data.error ? <p className="text-sm text-red-600 mt-4">Could not load the report.</p> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              ['Phones sold', t.sales],
              ['Sales value', money(t.revenue)],
              ['Profit (cost known)', money(t.profit)],
              ['Money collected', money(t.collected)],
              ['Still to collect', money(t.outstanding)],
              ['Overdue now', `${t.overdue} · ${money(t.overdue_amount)}`],
              ['Deposits (sales in period)', money(t.deposits)],
              ['Sold without a cost', t.missing_cost],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-gray-50 p-3">
                <p className="text-[11px] text-gray-500">{l}</p>
                <p className="text-base font-black text-gray-900">{v}</p>
              </div>
            ))}
          </div>
          {t.missing_cost > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mt-2">
              {t.missing_cost} phone(s) sold in this period have no cost entered, so profit only counts {t.cost_known}. Enter costs in Enroll Stock (Select phones → Cost) or on the customer's page.
            </p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase">
                  <th className="py-2 pr-2">Branch</th><th className="py-2 px-2">Sold</th><th className="py-2 px-2">Sales value</th>
                  <th className="py-2 px-2">Profit*</th><th className="py-2 px-2">Collected</th><th className="py-2 px-2">To collect</th><th className="py-2 pl-2">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.branches.map((b) => (
                  <tr key={b.branch}>
                    <td className="py-2 pr-2 font-semibold text-gray-800">{b.branch}</td>
                    <td className="py-2 px-2">{b.sales}</td>
                    <td className="py-2 px-2">{money(b.revenue)}</td>
                    <td className="py-2 px-2">{money(b.profit)}</td>
                    <td className="py-2 px-2">{money(b.collected)}</td>
                    <td className="py-2 px-2">{money(b.outstanding)}</td>
                    <td className="py-2 pl-2">{b.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 mt-1">*Profit = sale price − what you paid, for phones with a cost entered. Branch = the DSR's branch.</p>
          </div>
        </>
      )}
    </div>
  )
}
