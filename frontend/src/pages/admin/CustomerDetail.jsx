import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ProgressBar from '../../components/ProgressBar'
import ConfirmModal from '../../components/ConfirmModal'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function AdminCustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [plan, setPlan] = useState(null)
  const [settings, setSettings] = useState({ business_name: 'Tritech Hub iOS', contact_phone: '' })
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [lockModal, setLockModal] = useState(false)
  const [lockAction, setLockAction] = useState('')
  const [lockLoading, setLockLoading] = useState(false)
  const [resetModal, setResetModal] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [reminderLoading, setReminderLoading] = useState(false)
  const [imageModal, setImageModal] = useState(null)
  const [repossessModal, setRepossessModal] = useState(false)
  const [repossessLoading, setRepossessLoading] = useState(false)

  const fetchCustomer = async () => {
    try {
      const res = await api.get(`/admin/customers/${id}`)
      const d = res.data?.data || res.data
      setCustomer(d?.customer || d)
      setPlan(d?.plan || null)
      setTransactions(Array.isArray(d?.payments) ? d.payments : [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load customer details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomer()
    api.get('/admin/settings').then(r => {
      const s = r.data?.data || r.data
      if (s?.business_name || s?.contact_phone) {
        setSettings({ business_name: s.business_name || 'Tritech Hub iOS', contact_phone: s.contact_phone || '' })
      }
    }).catch(() => {})
  }, [id])

  const handleLockToggle = async () => {
    setLockLoading(true)
    try {
      const endpoint = lockAction === 'lock'
        ? `/admin/customers/${id}/lock`
        : `/admin/customers/${id}/unlock`
      await api.post(endpoint)
      toast.success(`Device ${lockAction === 'lock' ? 'locked' : 'unlocked'} successfully!`)
      setLockModal(false)
      fetchCustomer()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Action failed')
    } finally {
      setLockLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setResetLoading(true)
    try {
      await api.post(`/admin/reset-customer-password/${id}`)
      toast.success('Password reset sent to customer!')
      setResetModal(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to reset password')
    } finally {
      setResetLoading(false)
    }
  }

  const handleRepossess = async () => {
    setRepossessLoading(true)
    try {
      await api.post(`/admin/customers/${id}/repossess`)
      toast.success('Device repossessed and returned to inventory.')
      setRepossessModal(false)
      navigate('/admin/customers')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Repossession failed')
    } finally {
      setRepossessLoading(false)
    }
  }

  const handleSendReminder = async () => {
    setReminderLoading(true)
    try {
      await api.post(`/admin/customers/${id}/remind`)
      toast.success('Payment reminder sent to customer!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send reminder')
    } finally {
      setReminderLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <p className="text-gray-500 text-lg">Customer not found</p>
        <button onClick={() => navigate(-1)} className="text-green-700 font-semibold">Go Back</button>
      </div>
    )
  }

  const device = plan?.device_id || customer.device
  const loc = customer.location || {}
  const guarantor = customer.guarantor || {}
  const income = customer.income || {}
  const createdBy = customer.created_by

  const photoUrl = (p) => {
    if (!p) return null
    if (p.startsWith('data:') || p.startsWith('http')) return p
    return `/uploads/${p.replace(/\\/g, '/').split('/').pop()}`
  }

  const photos = customer.photos || {}
  const cardFront = photoUrl(photos.ghana_card_front)
  const cardBack  = photoUrl(photos.ghana_card_back)
  const custPhoto = photoUrl(photos.customer_photo)
  const guarPhoto = photoUrl(photos.guarantor_photo)
  const signature = photoUrl(photos.signature)

  const locationParts = [loc.town, loc.district, loc.region].filter(Boolean)

  return (
    <div className="max-w-3xl mx-auto px-4 pb-24 lg:pb-6 pt-4">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-green-700 font-semibold text-sm mb-4 hover:text-green-900"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Customers
      </button>

      {/* ── HEADER CARD ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-green-100 overflow-hidden flex-shrink-0 cursor-pointer"
               onClick={() => custPhoto && setImageModal(custPhoto)}>
            {custPhoto ? (
              <img src={custPhoto} alt={customer.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-green-800 font-black text-3xl">
                  {(customer.full_name || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-gray-900">{customer.full_name}</h1>
            <p className="text-sm font-bold text-green-700 mt-0.5">{customer.account_number}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <StatusBadge status={plan?.status || customer.plan_status || 'active'} />
              {device?.is_locked && <StatusBadge status="locked" />}
            </div>
          </div>
        </div>

        {/* Registration meta */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {customer.createdAt && (
            <span>Registered: <span className="font-semibold text-gray-700">{format(new Date(customer.createdAt), 'dd MMM yyyy')}</span></span>
          )}
          {createdBy?.name && (
            <span>By: <span className="font-semibold text-gray-700">{createdBy.name}</span>{createdBy.staff_id ? ` (${createdBy.staff_id})` : ''}</span>
          )}
        </div>
      </div>

      {/* ── PERSONAL DETAILS ─────────────────────────────────── */}
      <Section title="Personal Details">
        <Row label="Email" value={customer.email} />
        <Row label="Phone" value={customer.phone} />
        {customer.ghana_card_id && <Row label="Ghana Card ID" value={customer.ghana_card_id} mono />}
        {customer.occupation && <Row label="Occupation" value={customer.occupation} />}
        {(income.amount > 0 || income.source) && (
          <Row
            label="Income"
            value={[
              income.amount > 0 ? `GHS ${Number(income.amount).toLocaleString()}` : null,
              income.source,
            ].filter(Boolean).join(' — ')}
          />
        )}
      </Section>

      {/* ── LOCATION ─────────────────────────────────────────── */}
      {(locationParts.length > 0 || loc.landmark || loc.gps_address) && (
        <Section title="Location">
          {locationParts.length > 0 && (
            <Row label="Area" value={locationParts.join(', ')} />
          )}
          {loc.landmark && <Row label="Landmark" value={loc.landmark} />}
          {loc.gps_address && <Row label="GPS Address" value={loc.gps_address} mono />}
        </Section>
      )}

      {/* ── GUARANTOR ────────────────────────────────────────── */}
      {(guarantor.full_name || guarantor.phone) && (
        <Section title="Guarantor">
          {guarantor.full_name && <Row label="Name" value={guarantor.full_name} />}
          {guarantor.phone && <Row label="Phone" value={guarantor.phone} />}
          {guarantor.ghana_card_id && <Row label="Ghana Card ID" value={guarantor.ghana_card_id} mono />}
          {guarantor.relationship && <Row label="Relationship" value={guarantor.relationship} />}
        </Section>
      )}

      {/* ── PHOTOS ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Photos & Documents</h3>
        <div className="grid grid-cols-2 gap-3">
          {cardFront
            ? <PhotoThumb label="Ghana Card — Front" src={cardFront} onView={() => setImageModal(cardFront)} />
            : <PhotoEmpty label="Ghana Card — Front" />}
          {cardBack
            ? <PhotoThumb label="Ghana Card — Back" src={cardBack} onView={() => setImageModal(cardBack)} />
            : <PhotoEmpty label="Ghana Card — Back" />}
          {custPhoto
            ? <PhotoThumb label="Customer Photo" src={custPhoto} onView={() => setImageModal(custPhoto)} />
            : <PhotoEmpty label="Customer Photo" />}
          {guarPhoto
            ? <PhotoThumb label="Guarantor Photo" src={guarPhoto} onView={() => setImageModal(guarPhoto)} />
            : <PhotoEmpty label="Guarantor Photo" />}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Customer Signature</p>
          {signature ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white inline-block cursor-pointer"
                 onClick={() => setImageModal(signature)}>
              <img src={signature} alt="Signature" className="h-20 w-auto object-contain block" />
            </div>
          ) : (
            <div className="h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center">
              <p className="text-xs text-gray-400">No signature on file</p>
            </div>
          )}
        </div>
      </div>

      {/* ── DEVICE ───────────────────────────────────────────── */}
      {device && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Device</h3>
            {device.is_locked ? (
              <button
                onClick={() => { setLockAction('unlock'); setLockModal(true) }}
                className="px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-200 transition-colors"
              >Unlock Device</button>
            ) : (
              <button
                onClick={() => { setLockAction('lock'); setLockModal(true) }}
                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200 transition-colors"
              >Lock Device</button>
            )}
          </div>
          <div className="space-y-1.5 text-sm">
            <Row label="Model" value={device.model || device.device_model} />
            {device.serial_number && <Row label="Serial Number" value={device.serial_number} mono />}
            {device.imei && <Row label="IMEI" value={device.imei} mono />}
            {device.udid && <Row label="UDID" value={device.udid} mono truncate />}
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-gray-500">Lock Status</span>
              <StatusBadge status={device.is_locked ? 'locked' : 'unlocked'} />
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT PLAN ─────────────────────────────────────── */}
      {plan && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Payment Plan</h3>
            <StatusBadge status={plan.status || 'active'} />
          </div>
          <ProgressBar current={plan.payments_made || 0} total={plan.total_payments || 1} height="lg" />
          <p className="text-xs text-gray-500 mt-1 text-right">
            {plan.payments_made || 0} of {plan.total_payments || 0} payments made
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 text-sm">
            <InfoCell label="Device Price" value={`GHS ${Number(plan.total_price || plan.device_price || 0).toLocaleString()}`} />
            <InfoCell label="Down Payment" value={`GHS ${Number(plan.down_payment || 0).toLocaleString()}`} />
            <InfoCell label="Installment" value={`GHS ${Number(plan.installment_amount || 0).toLocaleString()}`} />
            <InfoCell label="Frequency" value={<span className="capitalize">{plan.payment_frequency || plan.frequency || 'N/A'}</span>} />
            <InfoCell label="Amount Paid" value={`GHS ${Number(plan.amount_paid || 0).toLocaleString()}`} />
            <InfoCell label="Remaining" value={`GHS ${Number(plan.remaining_balance || 0).toLocaleString()}`} valueClass="text-red-600" />
            {plan.start_date && (
              <InfoCell label="Start Date" value={format(new Date(plan.start_date), 'dd MMM yyyy')} />
            )}
            {plan.next_due_date && (
              <InfoCell label="Next Due" value={format(new Date(plan.next_due_date), 'dd MMM yyyy')} />
            )}
          </div>
        </div>
      )}

      {/* ── ADMIN ACTIONS ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Admin Actions</h3>
        <div className="space-y-2">
          <button
            onClick={() => setResetModal(true)}
            className="w-full py-3 px-4 rounded-xl border-2 border-orange-200 text-orange-700 font-semibold text-sm
                       hover:bg-orange-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Reset Customer Password
          </button>
          {plan && plan.status !== 'completed' && (
            <button
              onClick={handleSendReminder}
              disabled={reminderLoading}
              className="w-full py-3 px-4 rounded-xl border-2 border-blue-200 text-blue-700 font-semibold text-sm
                         hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {reminderLoading ? 'Sending…' : 'Send Payment Reminder'}
            </button>
          )}
          {plan?.status === 'defaulted' && (
            <button
              onClick={() => setRepossessModal(true)}
              className="w-full py-3 px-4 rounded-xl border-2 border-red-200 text-red-700 font-semibold text-sm
                         hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Repossess Device
            </button>
          )}
          <a
            href={`/api/admin/customers/${id}/receipt`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl border-2 border-green-200 text-green-700 font-semibold text-sm
                       hover:bg-green-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF Receipt
          </a>
        </div>
      </div>

      {/* ── PAYMENT HISTORY ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-card p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">
          Payment History
          {transactions.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({transactions.length} records)</span>
          )}
        </h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No payments yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx._id || tx.id} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-gray-900">
                    GHS {Number(tx.amount).toLocaleString()}
                  </p>
                  <StatusBadge status={tx.status || 'paid'} />
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>
                    {tx.payment_date || tx.created_at
                      ? format(new Date(tx.payment_date || tx.created_at), 'dd MMM yyyy, HH:mm')
                      : ''}
                    {' · '}
                    <span className="capitalize">{(tx.payment_method || tx.method || '').replace('_', ' ')}</span>
                  </p>
                  {tx.paystack_reference && (
                    <p className="font-mono">Ref: {tx.paystack_reference}</p>
                  )}
                  {tx.paid_by?.name && (
                    <p>Collected by: <span className="font-semibold text-gray-700">{tx.paid_by.name}</span></p>
                  )}
                  {tx.notes && <p className="italic">"{tx.notes}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lock/Unlock Modal */}
      <LockDeviceModal
        isOpen={lockModal}
        onClose={() => setLockModal(false)}
        onConfirm={handleLockToggle}
        action={lockAction}
        customer={customer}
        device={device}
        settings={settings}
        loading={lockLoading}
      />

      {/* Reset Password Modal */}
      <ConfirmModal
        isOpen={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={handleResetPassword}
        title="Reset Password"
        message={`Reset password for ${customer.full_name}? They will receive an SMS with a reset code.`}
        confirmText="Reset Password"
        confirmVariant="primary"
        loading={resetLoading}
      />

      {/* Repossess Device Modal */}
      <ConfirmModal
        isOpen={repossessModal}
        onClose={() => setRepossessModal(false)}
        onConfirm={handleRepossess}
        title="Repossess Device"
        message={`Return ${device?.model || 'the device'} to inventory? This marks the plan as closed and makes the device available for resale.`}
        confirmText="Repossess"
        confirmVariant="danger"
        loading={repossessLoading}
      />

      {/* Image Viewer */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setImageModal(null)}
        >
          <img
            src={imageModal}
            alt="Full view"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setImageModal(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white hover:bg-opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
      <h3 className="text-sm font-bold text-gray-800 mb-3">{title}</h3>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  )
}

function Row({ label, value, mono, truncate }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className={`font-semibold text-gray-800 text-right ${mono ? 'font-mono text-xs' : ''} ${truncate ? 'truncate max-w-[180px]' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function InfoCell({ label, value, valueClass = 'text-gray-800' }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

function PhotoEmpty({ label }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-50 aspect-[4/3] w-full border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1">
      <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-gray-400 text-xs font-medium text-center px-2 leading-tight">{label}</p>
      <p className="text-gray-300 text-[10px]">Not captured</p>
    </div>
  )
}

function LockDeviceModal({ isOpen, onClose, onConfirm, action, customer, device, settings, loading }) {
  const [copied, setCopied] = useState(false)
  if (!isOpen) return null

  const isLocking = action === 'lock'
  const businessName = settings?.business_name || 'Tritech Hub iOS'
  const phone = settings?.contact_phone || ''

  const lostModeMessage = `This iPhone belongs to ${businessName}.${phone ? ` Call ${phone} to unlock.` : ''} Make your payment at tritechhub.online to restore access.`

  const copyMessage = () => {
    navigator.clipboard.writeText(lostModeMessage).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = lostModeMessage
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 pt-6 pb-4 ${isLocking ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${isLocking ? 'bg-red-100' : 'bg-green-100'}`}>
            <svg className={`w-6 h-6 ${isLocking ? 'text-red-600' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isLocking
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              }
            </svg>
          </div>
          <h2 className="text-lg font-black text-gray-900">{isLocking ? 'Lock Device' : 'Unlock Device'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isLocking
              ? `Mark ${customer?.full_name}'s ${device?.model || 'iPhone'} as locked. The customer will be notified by SMS, WhatsApp and email.`
              : `Restore access to ${customer?.full_name}'s ${device?.model || 'iPhone'}.`
            }
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Lost Mode instructions — only when locking */}
          {isLocking && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">iCloud Lost Mode — copy this message</p>
              <p className="text-sm text-blue-900 leading-relaxed mb-3 font-medium">{lostModeMessage}</p>
              <button
                type="button"
                onClick={copyMessage}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                  ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Message
                  </>
                )}
              </button>

              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-bold text-blue-700">Steps on iCloud:</p>
                {[
                  'Go to icloud.com/find on any browser',
                  'Sign in with your Apple ID',
                  `Find "${device?.model || 'the device'}" in the list`,
                  'Click the device → Lost Mode → Turn On',
                  'Paste the message above + enter your phone number',
                  'Click Activate — the message shows on the lock screen',
                ].map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-blue-800">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3.5 border-2 border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 py-3.5 font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2
                ${isLocking ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-700 hover:bg-green-800 text-white'}`}
            >
              {loading ? <LoadingSpinner size="sm" color="white" /> : null}
              {isLocking ? 'Lock Device' : 'Unlock Device'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhotoThumb({ label, src, onView }) {
  return (
    <button
      onClick={onView}
      className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3] w-full group"
    >
      <img
        src={src}
        alt={label}
        className="w-full h-full object-cover"
        onError={(e) => { e.target.style.display = 'none' }}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
        <p className="text-white text-xs font-semibold leading-tight">{label}</p>
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
        <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      </div>
    </button>
  )
}
