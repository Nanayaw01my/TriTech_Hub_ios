import React, { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function CustomerProfile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [copied, setCopied] = useState(false)
  const [logoutModal, setLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/customer/profile')
      setProfile(res.data?.data || res.data)
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const copyAccountNumber = () => {
    const acct = user?.account_number || profile?.user?.account_number || profile?.account_number
    if (acct) {
      navigator.clipboard?.writeText(acct).then(() => {
        setCopied(true)
        toast.success('Account number copied!')
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {
        toast('Account number: ' + acct)
      })
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="xl" />
      </div>
    )
  }

  const customer = profile?.customer || profile
  const acct = user?.account_number || profile?.user?.account_number || profile?.account_number

  const photoUrl = customer?.photo_url || (customer?.photos?.customer_photo ? `/uploads/${customer.photos.customer_photo}` : null)
  const cardFrontUrl = customer?.ghana_card_front_url || (customer?.photos?.ghana_card_front ? `/uploads/${customer.photos.ghana_card_front}` : null)
  const cardBackUrl = customer?.ghana_card_back_url || (customer?.photos?.ghana_card_back ? `/uploads/${customer.photos.ghana_card_back}` : null)

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-4">
      <h1 className="text-2xl font-black text-gray-900 mb-4">My Profile</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-4">
          <div
            className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-200 cursor-pointer"
            onClick={() => photoUrl && setViewingPhoto(photoUrl)}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-green-100 flex items-center justify-center">
                <span className="text-green-800 font-black text-3xl">
                  {(customer?.full_name || user?.full_name || user?.name || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <h2 className="text-xl font-black text-gray-900 mt-3">
            {customer?.full_name || user?.full_name || user?.name}
          </h2>
          <p className="text-sm text-gray-500">{customer?.email || user?.email}</p>
          <p className="text-sm text-gray-500">{customer?.phone || user?.phone}</p>
        </div>

        {/* Account Number */}
        <div className="bg-green-50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-0.5">Account Number</p>
            <p className="text-xl font-black text-green-800 tracking-wider">{acct || 'N/A'}</p>
          </div>
          <button
            onClick={copyAccountNumber}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
              ${copied ? 'bg-green-600 text-white' : 'bg-green-800 text-white hover:bg-green-900 active:scale-95'}`}
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
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Personal Info */}
      {customer && (
        <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Personal Information</h3>
          <div className="space-y-0 divide-y divide-gray-50 text-sm">
            {customer.ghana_card_id && (
              <InfoRow label="Ghana Card ID" value={customer.ghana_card_id} mono />
            )}
            {customer.occupation && (
              <InfoRow label="Occupation" value={customer.occupation} />
            )}
            {(customer.region || customer.location?.region) && (
              <InfoRow label="Region" value={customer.region || customer.location?.region} />
            )}
            {(customer.district || customer.location?.district) && (
              <InfoRow label="District" value={customer.district || customer.location?.district} />
            )}
            {(customer.location || customer.location?.town) && typeof customer.location === 'string' && (
              <InfoRow label="Town" value={customer.location} />
            )}
            {customer.location?.town && (
              <InfoRow label="Town" value={customer.location.town} />
            )}
            {customer.gps_address && (
              <InfoRow label="GPS Address" value={customer.gps_address} mono />
            )}
            {customer.income_source && (
              <InfoRow label="Income Source" value={customer.income_source} />
            )}
          </div>
        </div>
      )}

      {/* Ghana Card Photos */}
      {(cardFrontUrl || cardBackUrl) && (
        <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Ghana Card</h3>
          <div className="grid grid-cols-2 gap-3">
            {cardFrontUrl && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Front</p>
                <img
                  src={cardFrontUrl}
                  alt="Ghana Card Front"
                  className="w-full h-28 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity border border-gray-100"
                  onClick={() => setViewingPhoto(cardFrontUrl)}
                />
              </div>
            )}
            {cardBackUrl && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Back</p>
                <img
                  src={cardBackUrl}
                  alt="Ghana Card Back"
                  className="w-full h-28 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity border border-gray-100"
                  onClick={() => setViewingPhoto(cardBackUrl)}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Tap photos to view full size</p>
        </div>
      )}

      {/* Support */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Contact Support</h3>
        <a
          href="tel:+233000000000"
          className="flex items-center gap-4 py-3 px-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">Call Tritech Hub iOS</p>
            <p className="text-xs text-gray-500">Mon – Sat, 8am – 6pm</p>
          </div>
          <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>

        <a
          href="https://wa.me/233000000000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 py-3 px-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors mt-2"
        >
          <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-700" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">WhatsApp Support</p>
            <p className="text-xs text-gray-500">Quick response guaranteed</p>
          </div>
          <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Sign Out */}
      <button
        onClick={() => setLogoutModal(true)}
        className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl
                   hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign Out
      </button>

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <img
            src={viewingPhoto}
            alt="Full view"
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setViewingPhoto(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-white hover:bg-opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Logout Confirm */}
      <ConfirmModal
        isOpen={logoutModal}
        onClose={() => setLogoutModal(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmVariant="danger"
        loading={loggingOut}
      />
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`font-semibold text-gray-800 text-sm ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
