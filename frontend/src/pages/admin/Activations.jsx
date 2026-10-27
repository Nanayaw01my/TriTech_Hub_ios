import React, { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Skeleton from '../../components/Skeleton'
import ConfirmModal from '../../components/ConfirmModal'
import { format, formatDistanceToNow } from 'date-fns'
import { displayEmail } from '../../utils/customerEmail'

const GHS = (n) => `GH₵${Number(n || 0).toLocaleString()}`

// Stored images are Cloudinary URLs (or legacy local upload paths).
const fileUrl = (p) => {
  if (!p) return null
  if (p.startsWith('data:') || p.startsWith('http')) return p
  return `/uploads/${p.replace(/\\/g, '/').split('/').pop()}`
}
const isPdf = (u) => /\.pdf($|\?)/i.test(u || '') || (u || '').startsWith('data:application/pdf')

const STATUS = {
  pending: { label: 'Needs review', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  resubmitted: { label: 'Corrected — needs review', cls: 'text-purple-700 bg-purple-50 border-purple-200' },
  returned: { label: 'Sent back to DSR', cls: 'text-red-700 bg-red-50 border-red-200' },
  approved: { label: 'Waiting for deposit', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
}
const statusOf = (it) => (it.status === 'pending' && it.review_note ? 'resubmitted' : it.status)

// Admin reviews every detail of each DSR sale, then approves it or sends it
// back for correction. After approval the DSR collects the deposit via
// Paystack, which starts the plan and unlocks the phone automatically.
export default function Activations() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [review, setReview] = useState(null) // sale open in the review sheet
  const [confirm, setConfirm] = useState(null) // sale being approved
  const [sendBack, setSendBack] = useState(null) // sale being sent back
  const [note, setNote] = useState('')
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

  const approve = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      const res = await api.post(`/admin/plans/${confirm.plan_id}/approve`)
      toast.success(res.data?.message || 'Approved.', { duration: 6000 })
      setConfirm(null)
      setReview(null)
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not approve')
    } finally {
      setBusy(false)
    }
  }

  const submitSendBack = async () => {
    if (!sendBack) return
    if (note.trim().length < 3) { toast.error('Tell the DSR what needs fixing.'); return }
    setBusy(true)
    try {
      const res = await api.post(`/admin/plans/${sendBack.plan_id}/return`, { note: note.trim() })
      toast.success(res.data?.message || 'Sent back to the DSR.', { duration: 6000 })
      setSendBack(null)
      setReview(null)
      setNote('')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send it back')
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
          Review everything the customer provided, then approve the sale or send it back to the DSR to correct.
          After approval the DSR collects the deposit via Paystack — that starts the plan and unlocks the phone.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" rounded="rounded-2xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-card">
            <p className="text-gray-500 font-medium">Nothing waiting for review</p>
            <p className="text-sm text-gray-400 mt-1">New sales from your DSRs will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((it) => {
              const st = STATUS[statusOf(it)] || STATUS.pending
              const photo = fileUrl(it.photos?.customer_photo)
              return (
                <div key={it.plan_id} className="bg-white rounded-2xl shadow-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {photo ? (
                        <img src={photo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 text-orange-600 font-black">
                          {it.customer_name?.[0] || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{it.customer_name}</p>
                        <p className="text-xs text-gray-500 truncate">{it.phone}{displayEmail(it.email) ? ` · ${displayEmail(it.email)}` : ''}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-1 flex-shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                    <Detail label="Phone" value={it.device_model} />
                    <Detail label="Price" value={GHS(it.device_price)} />
                    <Detail label="Deposit" value={GHS(it.down_payment)} />
                    <Detail label="Installment" value={`${GHS(it.installment_amount)} / ${it.frequency}`} />
                  </div>

                  {it.review_note && (
                    <div className={`mt-3 rounded-xl p-3 text-sm ${it.status === 'returned' ? 'bg-red-50 text-red-800' : 'bg-purple-50 text-purple-800'}`}>
                      <span className="font-semibold">{it.status === 'returned' ? 'Your note to the DSR: ' : 'Previously sent back: '}</span>{it.review_note}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 gap-3">
                    <p className="text-[11px] text-gray-400">
                      By {it.created_by || 'DSR'} · {it.created_at ? formatDistanceToNow(new Date(it.created_at), { addSuffix: true }) : ''}
                    </p>
                    <button
                      onClick={() => setReview(it)}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold bg-orange-600 text-white hover:bg-orange-500 flex-shrink-0"
                    >
                      Review all details
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {review && (
        <ReviewSheet
          it={review}
          onClose={() => setReview(null)}
          onApprove={() => setConfirm(review)}
          onSendBack={() => { setNote(''); setSendBack(review) }}
        />
      )}

      <ConfirmModal
        isOpen={!!confirm}
        title="Approve this sale?"
        message={confirm
          ? `Approve ${confirm.customer_name}'s purchase of ${confirm.device_model}. The DSR will then collect the ${GHS(confirm.down_payment)} deposit via Paystack — when it's paid, the ${confirm.frequency} installments of ${GHS(confirm.installment_amount)} start and the phone unlocks automatically.`
          : ''}
        confirmText={busy ? 'Approving…' : 'Approve'}
        loading={busy}
        onConfirm={approve}
        onClose={() => !busy && setConfirm(null)}
      />

      {sendBack && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !busy && setSendBack(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Send back to the DSR</h3>
            <p className="text-sm text-gray-500 mt-1">
              Tell {sendBack.created_by || 'the DSR'} what to fix for {sendBack.customer_name}. They get an SMS, correct it and resubmit.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              autoFocus
              placeholder="e.g. Ghana Card photo is blurry — retake it. Guarantor phone number is wrong."
              className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setSendBack(null)} disabled={busy}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-700">Cancel</button>
              <button onClick={submitSendBack} disabled={busy}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold disabled:opacity-60">
                {busy ? 'Sending…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Full-screen review of everything submitted for one sale.
function ReviewSheet({ it, onClose, onApprove, onSendBack }) {
  const [zoom, setZoom] = useState(null)
  const p = it.photos || {}
  const loc = it.location || {}
  const g = it.guarantor || {}
  const docs = [
    ['Ghana Card — front', p.ghana_card_front],
    ['Ghana Card — back', p.ghana_card_back],
    ['Customer photo', p.customer_photo],
    ['Guarantor photo', p.guarantor_photo],
    ['Signature', p.signature],
    ['Proof of income', it.proof_of_income],
  ]
  const canApprove = it.status === 'pending'
  const canSendBack = it.status === 'pending' || it.status === 'approved'

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-gray-50 w-full sm:max-w-3xl sm:rounded-3xl overflow-y-auto max-h-screen sm:max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Review sale</p>
            <h2 className="text-lg font-black text-gray-900 truncate">{it.customer_name}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100" aria-label="Close">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {it.review_note && (
            <div className={`rounded-2xl p-4 text-sm ${it.status === 'returned' ? 'bg-red-50 text-red-800' : 'bg-purple-50 text-purple-800'}`}>
              <p className="font-bold">{it.status === 'returned' ? 'Sent back to the DSR' : 'Corrected and resubmitted'}</p>
              <p className="mt-1">Your earlier note: {it.review_note}</p>
            </div>
          )}

          <Section title="Customer">
            <Detail label="Full name" value={it.customer_name} />
            <Detail label="Phone" value={it.phone || '—'} />
            <Detail label="Email" value={displayEmail(it.email) || '— (none)'} />
            <Detail label="Account no." value={it.account_number || '—'} mono />
            <Detail label="Ghana Card ID" value={it.ghana_card_id || '—'} mono />
            <Detail label="Occupation" value={it.occupation || '—'} />
            <Detail label="Monthly income" value={it.income?.amount ? GHS(it.income.amount) : '—'} />
            <Detail label="Income source" value={it.income?.source || '—'} />
          </Section>

          <Section title="Address">
            <Detail label="Region" value={loc.region || '—'} />
            <Detail label="District" value={loc.district || '—'} />
            <Detail label="Town" value={loc.town || '—'} />
            <Detail label="Landmark" value={loc.landmark || '—'} />
            <Detail label="GPS address" value={loc.gps_address || '—'} mono />
          </Section>

          <Section title="Guarantor">
            <Detail label="Full name" value={g.full_name || '—'} />
            <Detail label="Phone" value={g.phone || '—'} />
            <Detail label="Ghana Card ID" value={g.ghana_card_id || '—'} mono />
            <Detail label="Relationship" value={g.relationship || '—'} />
          </Section>

          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Photos & documents</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {docs.map(([label, src]) => {
                const url = fileUrl(src)
                return (
                  <div key={label}>
                    <p className="text-[11px] font-semibold text-gray-500 mb-1">{label}</p>
                    {!url ? (
                      <div className="h-28 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-xs font-semibold text-red-600">Missing</div>
                    ) : isPdf(url) ? (
                      <a href={url} target="_blank" rel="noreferrer"
                        className="h-28 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-sm font-semibold text-orange-700">
                        Open PDF ↗
                      </a>
                    ) : (
                      <button onClick={() => setZoom(url)} className="block w-full">
                        <img src={url} alt={label} className="h-28 w-full object-cover rounded-xl border border-gray-100" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <Section title="Phone & plan">
            <Detail label="Phone sold" value={it.device_model} />
            <Detail label="IMEI / SN" value={it.imei || it.serial_number || '—'} mono />
            <Detail label="Lock app enrolled" value={it.agent_enrolled ? '✅ Yes' : '⚠️ No'} />
            <Detail label="Device price" value={GHS(it.device_price)} />
            <Detail label="Deposit" value={GHS(it.down_payment)} />
            <Detail label="Balance after deposit" value={GHS(it.remaining_balance)} />
            <Detail label="Installment" value={`${GHS(it.installment_amount)} / ${it.frequency}`} />
            <Detail label="Number of payments" value={`${it.total_payments}`} />
          </Section>

          <p className="text-xs text-gray-400 text-center">
            Registered by {it.created_by || 'DSR'}{it.created_at ? ` on ${format(new Date(it.created_at), 'dd MMM yyyy, HH:mm')}` : ''}
          </p>
        </div>

        {(canApprove || canSendBack) && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-3">
            {canSendBack && (
              <button onClick={onSendBack}
                className="flex-1 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50">
                Send back to DSR
              </button>
            )}
            {canApprove && (
              <button onClick={onApprove}
                className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500">
                Approve
              </button>
            )}
          </div>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setZoom(null) }}>
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">{children}</div>
    </div>
  )
}

function Detail({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-gray-900 font-semibold break-words ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</p>
    </div>
  )
}
