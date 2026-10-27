import React, { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Skeleton from '../../components/Skeleton'
import ConfirmModal from '../../components/ConfirmModal'
import { formatDistanceToNow } from 'date-fns'

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString()}`

// Admin reviews DSR sales and activates them. Activation starts the installment
// schedule and arms the phone's offline self-lock — nothing counts until then.
export default function Activations() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [confirm, setConfirm] = useState(null) // the plan being activated
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/activations')
      setItems((res.data?.data || res.data)?.activations || [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not load activations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activate = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      await api.post(`/admin/plans/${confirm.plan_id}/activate`)
      toast.success(`${confirm.customer_name}'s plan is now active.`)
      setItems((prev) => prev.filter((x) => x.plan_id !== confirm.plan_id))
      setConfirm(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not activate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">Admin</p>
        <h1 className="text-2xl font-black text-gray-900 mb-1">Activations</h1>
        <p className="text-sm text-gray-500 mb-4">
          Review each sale your DSRs registered, then activate it to start the installment plan.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-56 w-full" rounded="rounded-2xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-card">
            <p className="text-gray-500 font-medium">Nothing waiting for activation</p>
            <p className="text-sm text-gray-400 mt-1">New sales from your DSRs will appear here for review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.plan_id} className="bg-white rounded-2xl shadow-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {it.photos?.customer_photo ? (
                      <img src={it.photos.customer_photo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 text-orange-600 font-black">
                        {it.customer_name?.[0] || '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{it.customer_name}</p>
                      <p className="text-xs text-gray-500 truncate">{it.phone} · {it.email}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 flex-shrink-0">
                    Pending
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
                  <Detail label="Phone sold" value={it.device_model} />
                  <Detail label="IMEI / SN" value={it.imei || it.serial_number || '—'} mono />
                  <Detail label="Enrolled" value={it.agent_enrolled ? '✅ Yes' : '⚠️ No'} />
                  <Detail label="Device price" value={GHS(it.device_price)} />
                  <Detail label="Down payment" value={GHS(it.down_payment)} />
                  <Detail label="Balance" value={GHS(it.remaining_balance)} />
                  <Detail label="Installment" value={`${GHS(it.installment_amount)} / ${it.frequency}`} />
                  <Detail label="Payments" value={`${it.total_payments}`} />
                  <Detail label="Ghana Card" value={it.ghana_card_id || '—'} mono />
                </div>

                {it.guarantor && (
                  <div className="mt-4 bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Guarantor</p>
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{it.guarantor.full_name || '—'}</span>
                      {it.guarantor.relationship ? ` · ${it.guarantor.relationship}` : ''}
                      {it.guarantor.phone ? ` · ${it.guarantor.phone}` : ''}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <p className="text-[11px] text-gray-400">
                    By {it.created_by || 'DSR'} · {it.created_at ? formatDistanceToNow(new Date(it.created_at), { addSuffix: true }) : ''}
                  </p>
                  <button
                    onClick={() => setConfirm(it)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-orange-600 text-white hover:bg-orange-500"
                  >
                    Activate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        title="Activate this plan?"
        message={confirm
          ? `Start ${confirm.customer_name}'s ${confirm.frequency} installments of ${GHS(confirm.installment_amount)}. The phone's "Awaiting Activation" page is lifted, the schedule begins today and lock protection goes live.`
          : ''}
        confirmText={busy ? 'Activating…' : 'Activate'}
        loading={busy}
        onConfirm={activate}
        onClose={() => !busy && setConfirm(null)}
      />
    </div>
  )
}

function Detail({ label, value, mono }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-gray-900 font-semibold ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</p>
    </div>
  )
}
