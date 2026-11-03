import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Card from '../../components/Modern/Card'

/** Admin accounts: the main admin adds admins, switches them off/on and resets passwords. */
export default function AdminsCard() {
  const [admins, setAdmins] = useState([])
  const [canManage, setCanManage] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = () =>
    api.get('/admin/admins')
      .then((res) => { setAdmins(res.data?.data?.admins || []); setCanManage(!!res.data?.data?.can_manage) })
      .catch(() => {})
  useEffect(() => { load() }, [])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const add = async () => {
    setAdding(true)
    try {
      const res = await api.post('/admin/admins', form)
      toast.success(res.data?.message || 'Admin added.', { duration: 6000 })
      setForm({ name: '', email: '', phone: '', password: '' })
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not add the admin.')
    } finally {
      setAdding(false)
    }
  }

  const update = async (a, body, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusyId(a._id)
    try {
      const res = await api.put(`/admin/admins/${a._id}`, body)
      toast.success(res.data?.message || 'Saved.')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save.')
    } finally {
      setBusyId(null)
    }
  }

  const resetPassword = (a) => {
    const pw = window.prompt(`New password for ${a.name} (at least 8 characters):`)
    if (pw === null) return
    update(a, { password: pw })
  }

  const input = 'w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-500 outline-none'

  return (
    <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
      <h2 className="text-gray-900 text-lg font-bold mb-1">Admins</h2>
      <p className="text-sm text-gray-500 mb-4">
        People who can log in to this admin portal. Admins have full access; every action is logged with their name.
        {!canManage && ' Only the main admin can add or change admins.'}
      </p>

      <div className="space-y-2 mb-5">
        {admins.map((a) => (
          <div key={a._id} className="p-3 rounded-xl border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {a.name}
                  {a.is_main && <span className="ml-1 text-[11px] font-semibold text-orange-600">· main</span>}
                  {a.is_you && <span className="ml-1 text-[11px] font-semibold text-gray-500">· you</span>}
                </p>
                <p className="text-xs text-gray-500 truncate">{a.email}{a.phone ? ` · ${a.phone}` : ''}</p>
                {!a.is_active && <p className="text-xs font-semibold text-red-600 mt-0.5">Switched off — can't log in</p>}
              </div>
            </div>
            {canManage && !a.is_you && (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => resetPassword(a)} disabled={busyId === a._id}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-50">
                  Reset password
                </button>
                {!a.is_main && (
                  a.is_active ? (
                    <button type="button" disabled={busyId === a._id}
                      onClick={() => update(a, { is_active: false }, `Switch off ${a.name}? They will be logged out and can't log in.`)}
                      className="flex-1 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 disabled:opacity-50">
                      Switch off
                    </button>
                  ) : (
                    <button type="button" disabled={busyId === a._id} onClick={() => update(a, { is_active: true })}
                      className="flex-1 py-2 rounded-xl border border-green-200 text-sm font-semibold text-green-700 disabled:opacity-50">
                      Switch on
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-gray-800">Add an admin</p>
          <input className={input} placeholder="Full name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <input className={input} type="email" placeholder="Email (they log in with this)" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <input className={input} type="tel" placeholder="Phone (for password reset by SMS)" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <input className={input} type="text" placeholder="Password (at least 8 characters)" value={form.password} onChange={(e) => set('password', e.target.value)} />
          <button type="button" onClick={add} disabled={adding}
            className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60">
            {adding ? 'Adding…' : 'Add admin'}
          </button>
          <p className="text-xs text-gray-500">Give them the email and password in person. They can change the password later with “Forgot password”.</p>
        </div>
      )}
    </Card>
  )
}
