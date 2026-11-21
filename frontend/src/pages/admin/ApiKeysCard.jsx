import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Card from '../../components/Modern/Card'

const SCOPE_LABEL = {
  'sales:read': 'Read sales (and the sales summary for targets)',
  'payments:read': 'Read payments',
  'stock:read': 'Read phones / stock',
  'payments:write': 'Record payments taken at the shop',
}

/** Keys for other systems (e.g. the shop management system) to use the API. */
export default function ApiKeysCard() {
  const [keys, setKeys] = useState([])
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState(['sales:read', 'payments:read', 'stock:read'])
  const [newKey, setNewKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => api.get('/admin/api-keys').then((r) => setKeys(r.data?.data?.keys || [])).catch(() => {})
  useEffect(() => { load() }, [])

  const toggleScope = (s) => setScopes((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]))
  const create = async () => {
    setBusy(true)
    try {
      const r = await api.post('/admin/api-keys', { name, scopes })
      setNewKey(r.data?.data?.key || null)
      setName('')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not create the key.')
    } finally {
      setBusy(false)
    }
  }
  const setActive = async (k, active) => {
    if (!active && !window.confirm(`Switch off "${k.name}"? Anything using it stops working at once.`)) return
    try {
      const r = await api.put(`/admin/api-keys/${k._id}`, { active })
      toast.success(r.data?.message || 'Saved.')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update the key.')
    }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(newKey); toast.success('Copied.') } catch { toast('Select the key and copy it.') }
  }

  return (
    <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
      <h2 className="text-gray-900 text-lg font-bold mb-1">API keys (other systems)</h2>
      <p className="text-sm text-gray-500 mb-4">
        Lets another system — e.g. your shop management system — read sales, payments and stock, and record payments taken at
        the shop. Give each system its own key and only what it needs. Address: <span className="font-mono">https://dandorsolar.site/api/v1</span>
      </p>

      {newKey && (
        <div className="mb-4 p-4 rounded-2xl bg-green-50 border border-green-200">
          <p className="text-sm font-bold text-green-800">Your new key — copy it now, it won't be shown again:</p>
          <p className="mt-2 font-mono text-xs break-all bg-white rounded-xl p-3 border border-green-100 select-all">{newKey}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copy} className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold">Copy</button>
            <button type="button" onClick={() => setNewKey(null)} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold">I've saved it</button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <div className="space-y-2 mb-5">
          {keys.map((k) => (
            <div key={k._id} className={`p-3 rounded-xl border ${k.active ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{k.name} {!k.active && <span className="text-[11px] font-semibold text-red-600">· switched off</span>}</p>
                  <p className="text-xs text-gray-500 font-mono">{k.prefix}…</p>
                  <p className="text-[11px] text-gray-500 mt-1">{(k.scopes || []).map((s) => SCOPE_LABEL[s] || s).join(' · ')}</p>
                  <p className="text-[11px] text-gray-400">
                    Made {new Date(k.createdAt).toLocaleDateString()}{k.created_by?.name ? ` by ${k.created_by.name}` : ''} ·
                    {' '}{k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleString()}` : 'never used'}
                  </p>
                </div>
                <button type="button" onClick={() => setActive(k, !k.active)}
                  className={`text-sm font-semibold ${k.active ? 'text-red-600' : 'text-green-700'}`}>{k.active ? 'Switch off' : 'Switch on'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-bold text-gray-800">Make a key</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Name, e.g. "Shop system"'
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-500 outline-none" />
        <div className="space-y-2">
          {Object.entries(SCOPE_LABEL).map(([s, label]) => (
            <label key={s} className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} className="mt-0.5 w-4 h-4 accent-orange-600" />
              <span>{label}{s === 'payments:write' && <span className="block text-[11px] text-amber-700">Payments recorded this way are credited to the customer (and can unlock their phone). Only allow it for a system you trust.</span>}</span>
            </label>
          ))}
        </div>
        <button type="button" onClick={create} disabled={busy}
          className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60">
          {busy ? 'Making…' : 'Make API key'}
        </button>
      </div>
    </Card>
  )
}
