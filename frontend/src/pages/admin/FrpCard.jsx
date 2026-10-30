import React, { useState, useEffect } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Card from '../../components/Modern/Card'

// Google's own API page, pre-filled to show "people/<your account ID>" for
// whichever Google account you sign in with.
const FIND_ID_URL =
  'https://developers.google.com/people/api/rest/v1/people/get?apix=true&apix_params=' +
  encodeURIComponent(JSON.stringify({ resourceName: 'people/me', personFields: 'emailAddresses' }))

/**
 * Factory Reset Protection: the company Google accounts. After a recovery-mode
 * reset, an enrolled phone only sets up again with one of these accounts.
 */
export default function FrpCard() {
  const [data, setData] = useState(null)
  const [email, setEmail] = useState('')
  const [googleId, setGoogleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const load = () =>
    api.get('/admin/frp')
      .then((res) => setData(res.data?.data || null))
      .catch(() => {})

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!googleId.trim()) { toast.error('Paste the Google account ID.'); return }
    setSaving(true)
    try {
      const res = await api.post('/admin/frp', { google_id: googleId, email })
      toast.success(res.data?.message || 'FRP account added.')
      setData(res.data?.data || null)
      setGoogleId(''); setEmail(''); setShowHelp(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not add the account.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (acc) => {
    if (!window.confirm(`Remove ${acc.email || acc.google_id} from FRP?`)) return
    try {
      const res = await api.delete(`/admin/frp/${acc.google_id}`)
      toast.success(res.data?.message || 'Removed.')
      setData(res.data?.data || null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not remove the account.')
    }
  }

  const accounts = data?.accounts || []
  const phones = data?.phones

  return (
    <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
      <h2 className="text-gray-900 text-lg font-bold mb-1">Factory Reset Protection (FRP)</h2>
      <p className="text-sm text-gray-500 mb-4">
        If someone resets a phone from recovery mode, it can only be set up again by signing in with one of these
        company Google accounts. It's switched off automatically when a phone is released.
      </p>

      {phones && accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-green-50 rounded-xl p-2">
            <p className="text-xl font-black text-green-700">{phones.protected}</p>
            <p className="text-[11px] font-semibold text-green-700">Protected</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-2">
            <p className="text-xl font-black text-amber-700">{phones.old_app}</p>
            <p className="text-[11px] font-semibold text-amber-700">Old app</p>
          </div>
          <div className="bg-red-50 rounded-xl p-2">
            <p className="text-xl font-black text-red-700">{phones.failed}</p>
            <p className="text-[11px] font-semibold text-red-700">Not supported</p>
          </div>
        </div>
      )}

      {accounts.length > 0 ? (
        <div className="space-y-2 mb-4">
          {accounts.map((a, i) => (
            <div key={a.google_id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {a.email || 'Google account'} {i === 0 && <span className="text-[11px] font-semibold text-orange-600">· main</span>}
                </p>
                <p className="text-xs text-gray-400 font-mono truncate">ID {a.google_id}</p>
              </div>
              <button type="button" onClick={() => remove(a)} className="text-sm font-semibold text-red-600">Remove</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-4">No FRP account yet — phones are not protected against recovery-mode resets.</p>
      )}

      <div className="space-y-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Account email (e.g. dandorsolar.frp@gmail.com)"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-500 outline-none" />
        <input type="text" value={googleId} onChange={(e) => setGoogleId(e.target.value)}
          placeholder="Google account ID (long number)" inputMode="numeric"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm font-mono focus:border-orange-500 outline-none" />
        <div className="flex gap-2">
          <button type="button" onClick={add} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60">
            {saving ? 'Adding…' : 'Add FRP account'}
          </button>
          <button type="button" onClick={() => setShowHelp((v) => !v)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700">
            Find my ID
          </button>
        </div>
        {showHelp && (
          <ol className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4 space-y-1.5 list-decimal list-inside">
            <li>
              Open{' '}
              <a href={FIND_ID_URL} target="_blank" rel="noopener noreferrer" className="text-orange-600 font-semibold underline">
                this Google page
              </a>.
            </li>
            <li>Tap <span className="font-semibold">Execute</span> (in the "Try this method" panel).</li>
            <li>Choose the FRP Google account and tap <span className="font-semibold">Allow</span>.</li>
            <li>In the result, find <span className="font-mono">"resourceName": "people/<span className="font-bold">1234…</span>"</span>.</li>
            <li>Copy that long number (or the whole <span className="font-mono">people/…</span> text) into the box above.</li>
          </ol>
        )}
      </div>
    </Card>
  )
}
