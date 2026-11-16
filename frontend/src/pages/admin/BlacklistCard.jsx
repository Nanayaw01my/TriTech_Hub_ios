import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Card from '../../components/Modern/Card'

/** The do-not-sell list (added from a customer's page). */
export default function BlacklistCard() {
  const [list, setList] = useState([])
  const load = () => api.get('/admin/blacklist').then((r) => setList(r.data?.data?.list || [])).catch(() => {})
  useEffect(() => { load() }, [])
  const remove = async (b) => {
    if (!window.confirm(`Remove ${b.name || 'this person'} from the do-not-sell list?`)) return
    try {
      const r = await api.delete(`/admin/blacklist/${b._id}`)
      toast.success(r.data?.message || 'Removed.')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not remove.')
    }
  }
  return (
    <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
      <h2 className="text-gray-900 text-lg font-bold mb-1">Do-not-sell list ({list.length})</h2>
      <p className="text-sm text-gray-500 mb-4">
        People who must not get another phone. A DSR can't register a sale to a Ghana Card on this list, and a guarantor on it is
        flagged. Add someone from their customer page ("Add to do-not-sell list").
      </p>
      {list.length === 0 ? <p className="text-sm text-gray-400">Nobody on the list.</p> : (
        <div className="space-y-2">
          {list.map((b) => (
            <div key={b._id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{b.name || '—'} <span className="text-[11px] font-semibold text-gray-500">· {b.role}</span></p>
                {b.reason && <p className="text-xs text-gray-600">{b.reason}</p>}
                <p className="text-[11px] text-gray-400">Added {new Date(b.createdAt).toLocaleDateString()}{b.added_by?.name ? ` by ${b.added_by.name}` : ''}</p>
              </div>
              <button type="button" onClick={() => remove(b)} className="text-sm font-semibold text-red-600">Remove</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
