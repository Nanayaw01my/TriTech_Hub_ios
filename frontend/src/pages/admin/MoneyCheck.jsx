import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const money = (n) => `GH₵${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const ymd = (d) => format(d, 'yyyy-MM-dd')
const METHOD = { manual_cash: 'Cash', manual_momo: 'MoMo', manual_bank: 'Bank' }

/** Cash-up (staff hand-ins) and the Paystack check, in one page. */
export default function MoneyCheck() {
  const [tab, setTab] = useState('cash')
  const [from, setFrom] = useState(ymd(new Date()))
  const [to, setTo] = useState(ymd(new Date()))
  return (
    <div className="px-4 pt-4 pb-24 lg:pb-8 max-w-5xl mx-auto">
      <h1 className="text-xl font-black text-gray-900">Money check</h1>
      <p className="text-sm text-gray-500">Make sure every cedi is accounted for.</p>
      <div className="flex gap-2 mt-4">
        {[['cash', 'Cash-up (staff)'], ['paystack', 'Paystack check']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === k ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 mt-3">
        <label className="text-xs text-gray-500">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" /></label>
        <label className="text-xs text-gray-500">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" /></label>
      </div>
      {tab === 'cash' ? <CashUp from={from} to={to} /> : <PaystackCheck from={from} to={to} />}
    </div>
  )
}

function CashUp({ from, to }) {
  const [data, setData] = useState(null)
  const load = () => {
    setData(null)
    api.get(`/admin/cash-up?from=${from}&to=${to}`).then((r) => setData(r.data?.data)).catch((e) => { toast.error(e?.response?.data?.message || 'Could not load.'); setData({ people: [] }) })
  }
  useEffect(load, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps
  const mark = async (ids, undo = false) => {
    try {
      const r = await api.post('/admin/cash-up/receive', { payment_ids: ids, undo })
      toast.success(r.data?.message || 'Saved.')
      load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not save.') }
  }
  if (!data) return <p className="text-sm text-gray-400 mt-6">Loading…</p>
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl shadow-card p-3"><p className="text-xs text-gray-500">Collected by hand</p><p className="text-xl font-black">{money(data.total)}</p></div>
        <div className="bg-white rounded-2xl shadow-card p-3"><p className="text-xs text-gray-500">Not yet handed in</p><p className={`text-xl font-black ${data.pending > 0 ? 'text-red-600' : 'text-green-700'}`}>{money(data.pending)}</p></div>
      </div>
      <p className="text-xs text-gray-500 mt-2">Payments recorded as cash, MoMo to your number, or bank transfer. When the person gives you the money, mark it handed in.</p>
      {data.people.length === 0 && <p className="text-sm text-gray-400 mt-4">No hand-recorded payments in these dates.</p>}
      {data.people.map((p) => {
        const pendingIds = p.payments.filter((x) => !x.received_at).map((x) => x._id)
        return (
          <div key={p.key} className="bg-white rounded-2xl shadow-card p-4 mt-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-bold text-gray-900">{p.name} <span className="text-xs font-normal text-gray-500">{p.role}</span></p>
                <p className="text-xs text-gray-500">Total {money(p.total)} · handed in {money(p.handed_in)} · <span className={p.pending > 0 ? 'text-red-600 font-semibold' : ''}>pending {money(p.pending)}</span></p>
              </div>
              {pendingIds.length > 0 && (
                <button type="button" onClick={() => mark(pendingIds)} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold">
                  Mark all {money(p.pending)} handed in
                </button>
              )}
            </div>
            <div className="mt-2 divide-y divide-gray-50">
              {p.payments.map((x) => (
                <div key={x._id} className="py-2 flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{money(x.amount)} · {x.customer}</p>
                    <p className="text-[11px] text-gray-400">{METHOD[x.method] || x.method} · {format(new Date(x.at), 'dd MMM, HH:mm')}{x.received_at ? ` · handed in ${format(new Date(x.received_at), 'dd MMM HH:mm')}${x.received_by ? ` (${x.received_by})` : ''}` : ''}</p>
                  </div>
                  {x.received_at
                    ? <button type="button" onClick={() => mark([x._id], true)} className="text-[11px] text-gray-500">Undo</button>
                    : <button type="button" onClick={() => mark([x._id])} className="text-xs font-bold text-green-700">Handed in</button>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PaystackCheck({ from, to }) {
  const [data, setData] = useState(null)
  const [busyRef, setBusyRef] = useState(null)
  const load = () => {
    setData(null)
    api.get(`/admin/paystack-check?from=${from}&to=${to}`).then((r) => setData(r.data?.data)).catch((e) => { toast.error(e?.response?.data?.message || 'Could not load.'); setData({ missing: [], not_in_paystack: [], cancelled_in_system: [], settlements: [] }) })
  }
  useEffect(load, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps
  const record = async (ref) => {
    setBusyRef(ref)
    try {
      const r = await api.post('/admin/paystack-check/record', { reference: ref })
      toast.success(r.data?.message || 'Recorded.', { duration: 7000 })
      load()
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not record it.', { duration: 8000 }) } finally { setBusyRef(null) }
  }
  if (!data) return <p className="text-sm text-gray-400 mt-6">Checking with Paystack…</p>
  return (
    <div className="mt-4 space-y-3">
      {data.error && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">Couldn't read Paystack: {data.error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[['Paid on Paystack', `${data.paystack_count || 0} · ${money(data.paystack_total)}`], ['Paystack fees', money(data.fees)], ['After fees', money(data.net)], ['Paid into your bank', money(data.settled_total)]].map(([l, v]) => (
          <div key={l} className="bg-white rounded-2xl shadow-card p-3"><p className="text-xs text-gray-500">{l}</p><p className="text-base font-black">{v}</p></div>
        ))}
      </div>
      <div className={`rounded-2xl p-4 ${data.missing?.length ? 'bg-red-50' : 'bg-green-50'}`}>
        <p className={`font-bold ${data.missing?.length ? 'text-red-800' : 'text-green-800'}`}>
          {data.missing?.length ? `⚠️ ${data.missing.length} Paystack payment(s) NOT in the system` : `✓ All ${data.matched || 0} Paystack payments are recorded`}
        </p>
        {data.missing?.map((m) => (
          <div key={m.reference} className="mt-2 flex items-center gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{money(m.amount)} · {m.customer || m.email} <span className="text-xs text-gray-500">({m.type})</span></p>
              <p className="text-[11px] text-gray-500 font-mono truncate">{m.reference} · {m.paid_at ? format(new Date(m.paid_at), 'dd MMM, HH:mm') : ''}</p>
            </div>
            <button type="button" disabled={busyRef === m.reference} onClick={() => record(m.reference)}
              className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-60">{busyRef === m.reference ? '…' : 'Record it'}</button>
          </div>
        ))}
        {data.missing?.length > 0 && <p className="text-[11px] text-red-700 mt-2">"Record it" checks the payment with Paystack, then credits the customer exactly like a normal payment.</p>}
      </div>
      {data.cancelled_in_system?.length > 0 && (
        <div className="rounded-2xl p-4 bg-amber-50">
          <p className="font-bold text-amber-900">Paid on Paystack but cancelled in the system ({data.cancelled_in_system.length})</p>
          {data.cancelled_in_system.map((m) => <p key={m.reference} className="text-sm mt-1">{money(m.amount)} · {m.customer} — {m.reason} <span className="text-[11px] text-gray-500">(refund it in Paystack if the money must go back)</span></p>)}
        </div>
      )}
      {data.not_in_paystack?.length > 0 && (
        <div className="rounded-2xl p-4 bg-amber-50">
          <p className="font-bold text-amber-900">Recorded as Paystack, but not found on Paystack in these dates ({data.not_in_paystack.length})</p>
          {data.not_in_paystack.map((m) => <p key={m.reference} className="text-sm mt-1">{money(m.amount)} · {m.customer} · <span className="font-mono text-[11px]">{m.reference}</span></p>)}
          <p className="text-[11px] text-amber-800 mt-1">Usually a date difference — widen the dates. If still missing, check the reference in your Paystack dashboard.</p>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-card p-4">
        <p className="font-bold text-gray-900">Paystack payouts to your bank</p>
        {data.settlements?.length ? data.settlements.map((s) => (
          <p key={s.id} className="text-sm mt-1">{s.date ? format(new Date(s.date), 'dd MMM yyyy') : ''} · {money(s.amount)} · <span className="text-gray-500">{s.status}</span></p>
        )) : <p className="text-sm text-gray-400 mt-1">No payouts in these dates.</p>}
      </div>
    </div>
  )
}
