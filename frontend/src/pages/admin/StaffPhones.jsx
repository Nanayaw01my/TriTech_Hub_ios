import React, { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import { saveBlob } from '../../utils/download'
import toast from 'react-hot-toast'
import Skeleton from '../../components/Skeleton'
import LocationModal from '../../components/LocationModal'
import ConfirmModal from '../../components/ConfirmModal'
import { formatDistanceToNow } from 'date-fns'

const ago = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : 'never')
const NET = { wifi: 'Wi-Fi', mobile: 'Mobile data', none: 'No internet', other: 'Online' }

// Company phones used by staff (not for sale): their own QR / .bat, tracked,
// logo wallpaper, SIM alerts, remote lock and wipe.
export default function StaffPhones() {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [locate, setLocate] = useState(null)
  const [unenroll, setUnenroll] = useState(null)
  const [wipe, setWipe] = useState(null)
  const [wipeText, setWipeText] = useState('')
  const [scriptBusy, setScriptBusy] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/staff-phones')
      setInfo(r.data?.data || null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not load staff phones')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/admin/staff?limit=200')
      .then((res) => setStaffList((res.data?.data || res.data)?.staff || []))
      .catch(() => {})
  }, [])

  const downloadScript = async () => {
    setScriptBusy(true)
    try {
      const res = await api.get('/admin/staff-phones/computer-script', { responseType: 'blob' })
      await saveBlob(res.data, 'enroll-staff-phone.bat')
      toast.success('Downloaded enroll-staff-phone.bat — keep it private.')
    } catch {
      toast.error('Could not download the file')
    } finally {
      setScriptBusy(false)
    }
  }

  const act = async (phone, fn, ok) => {
    setBusyId(phone._id)
    try {
      const r = await fn()
      toast.success(r?.data?.message || ok, { duration: 7000 })
      await load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong.')
    } finally {
      setBusyId(null)
    }
  }
  const setUser = (p, userId) => act(p, () => api.put(`/admin/staff-phones/${p._id}`, { user_id: userId || null }), 'Saved.')
  const lock = (p) => act(p, () => api.post(`/admin/devices/${p._id}/lock`, { reason: 'Staff phone locked by admin' }), 'Lock sent.')
  const unlock = (p) => act(p, () => api.post(`/admin/devices/${p._id}/unlock`, { reason: 'Staff phone unlocked by admin' }), 'Unlock sent.')
  const cancelWipe = (p) => act(p, () => api.post(`/admin/staff-phones/${p._id}/cancel-wipe`), 'Wipe cancelled.')
  const doWipe = async () => {
    const p = wipe
    if (wipeText.trim().toUpperCase() !== 'WIPE') { toast.error('Type WIPE to confirm.'); return }
    setWipe(null)
    await act(p, () => api.post(`/admin/staff-phones/${p._id}/wipe`, { confirm: 'WIPE' }), 'Wipe sent.')
  }
  const doUnenroll = async () => {
    const p = unenroll
    setUnenroll(null)
    await act(p, () => api.post(`/admin/devices/${p._id}/unenroll`), 'Phone unenrolled.')
  }

  const phones = info?.phones || []
  return (
    <div className="pb-24 lg:pb-6 min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">Admin</p>
        <h1 className="text-2xl font-black text-gray-900 mb-1">Staff Phones</h1>
        <p className="text-sm text-gray-500 mb-4">
          Company phones your staff use. They are <strong>not for sale</strong>: they never show in stock, sales or the DSR phone list.
        </p>

        {loading ? <Skeleton className="h-96 w-full" rounded="rounded-2xl" /> : (
          <>
            <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Add a staff phone</h2>
                  <p className="text-xs text-gray-500">Use these, <strong>not</strong> the Enroll Stock QR. The phone gets your logo as a locked wallpaper, location tracking, SIM alerts and remote lock / wipe.</p>
                </div>
                <button onClick={() => setShowSetup((v) => !v)} className="text-sm font-semibold text-orange-600 flex-shrink-0">
                  {showSetup ? 'Hide' : 'Show'}
                </button>
              </div>
              {showSetup && (
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900 mb-2">Staff phone QR</p>
                    {!info?.ready && (
                      <p className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-2 mb-2 text-left">The lock app isn't published yet. Run the "Build Lock Agent APK" action, then redeploy.</p>
                    )}
                    {info?.qr
                      ? <img src={info.qr} alt="Staff phone enrollment QR" className="w-56 h-56 mx-auto rounded-2xl border-4 border-blue-600" />
                      : <div className="w-56 h-56 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">QR unavailable</div>}
                    <p className="text-[11px] font-bold text-blue-700 mt-1">STAFF PHONES ONLY</p>
                    <ol className="mt-3 space-y-1 text-xs text-gray-600 list-decimal list-inside text-left">
                      <li><strong>Factory reset</strong> the phone.</li>
                      <li>On the welcome screen, <strong>tap 6 times</strong>.</li>
                      <li><strong>Scan this QR</strong>. The phone appears below.</li>
                      <li>Choose which staff member uses it.</li>
                    </ol>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-2">Or with a computer</p>
                    <p className="text-xs text-gray-600">For phones where the QR says "App blocked to protect your device". Same steps as <em>Enroll Stock → Enroll with computer</em>, but use this file:</p>
                    <button onClick={downloadScript} disabled={scriptBusy}
                      className="mt-3 w-full py-2.5 rounded-xl bg-blue-700 text-white text-sm font-bold disabled:opacity-50">
                      {scriptBusy ? 'Preparing…' : 'Download enroll-staff-phone.bat'}
                    </button>
                    <p className="mt-2 text-[11px] text-gray-400">Keep it private. Phones set up with it become staff phones, not stock.</p>
                    <p className="mt-3 text-[11px] text-amber-800 bg-amber-50 rounded-xl p-2">
                      Tell your staff in writing that company phones are tracked all the time and can be locked or wiped, and get them to sign it.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {phones.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-card">
                <p className="text-gray-500 font-medium">No staff phones yet</p>
                <p className="text-sm text-gray-400 mt-1">Scan the Staff phone QR on a factory-reset phone.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {phones.map((p) => {
                  const st = p.status
                  const busy = busyId === p._id
                  const wipePending = p.desired === 'wipe'
                  const locked = p.lock_status === 'locked' || p.desired === 'locked'
                  return (
                    <div key={p._id} className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 text-lg">📱</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{p.model}</p>
                          <p className="text-xs text-gray-400 font-mono truncate">{p.imei ? `IMEI ${p.imei}` : p.device_code ? `ID …${p.device_code}` : '—'}</p>
                          <p className={`text-[11px] font-semibold mt-0.5 ${locked ? 'text-red-600' : p.online ? 'text-green-600' : 'text-gray-500'}`}>
                            {wipePending ? '⚠️ Wipe waiting for the phone' : locked ? '🔒 Locked' : p.online ? 'Online' : `Last seen ${ago(p.last_seen)}`}
                            {p.app_version ? <span className="font-normal text-gray-400"> · App {p.app_version}</span> : null}
                          </p>
                        </div>
                        <select value={p.used_by?._id || ''} disabled={busy} onChange={(e) => setUser(p, e.target.value)}
                          className="max-w-[45%] px-2 py-1.5 border border-gray-200 rounded-xl text-xs">
                          <option value="">Not given out (office)</option>
                          {staffList.map((s) => <option key={s._id} value={s._id}>{s.name}{s.staff_id ? ` (${s.staff_id})` : ''}</option>)}
                        </select>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-gray-50 p-2">
                          <p className="text-[10px] text-gray-500">Battery</p>
                          <p className="text-sm font-bold text-gray-900">{st?.battery != null ? `${st.battery}%${st.charging ? ' ⚡' : ''}` : '—'}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-2">
                          <p className="text-[10px] text-gray-500">Network</p>
                          <p className="text-sm font-bold text-gray-900">{st?.network ? NET[st.network] || st.network : '—'}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-2">
                          <p className="text-[10px] text-gray-500">SIM</p>
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {st ? (st.sims?.length ? st.sims.map((s) => `${s.carrier || 'SIM'}${s.number ? ` ${s.number}` : ''}`).join(' · ') : 'No SIM') : '—'}
                          </p>
                        </div>
                      </div>
                      {!st && p.enrolled && (
                        <p className="text-[11px] text-gray-400 mt-1">Battery and SIM show once the phone has the new app (1.141+). It updates itself.</p>
                      )}
                      {p.sim_changed_at && (
                        <p className="mt-2 text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
                          SIM changed {ago(p.sim_changed_at)}{p.sim_history?.[0]?.sims ? `: now ${p.sim_history[0].sims}` : ''}.
                        </p>
                      )}
                      {p.location && (
                        <p className="mt-1 text-[11px] text-gray-500">Location updated {ago(p.location.at)}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => setLocate({ id: p._id, label: `${p.model}${p.used_by ? ` · ${p.used_by.name}` : ''}` })}
                          className="flex-1 min-w-[90px] py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700">📍 Locate</button>
                        {locked && !wipePending ? (
                          <button onClick={() => unlock(p)} disabled={busy} className="flex-1 min-w-[90px] py-2 rounded-xl text-sm font-semibold bg-green-600 text-white disabled:opacity-50">{busy ? '…' : 'Unlock'}</button>
                        ) : !wipePending ? (
                          <button onClick={() => lock(p)} disabled={busy} className="flex-1 min-w-[90px] py-2 rounded-xl text-sm font-semibold bg-orange-600 text-white disabled:opacity-50">{busy ? '…' : '🔒 Lock'}</button>
                        ) : null}
                        {wipePending ? (
                          <button onClick={() => cancelWipe(p)} disabled={busy} className="flex-1 min-w-[90px] py-2 rounded-xl text-sm font-semibold border-2 border-red-300 text-red-700 disabled:opacity-50">Cancel wipe</button>
                        ) : (
                          <button onClick={() => { setWipeText(''); setWipe(p) }} disabled={busy || !p.can_wipe}
                            title={p.can_wipe ? '' : 'Needs app 1.141 or newer on the phone'}
                            className="flex-1 min-w-[90px] py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 disabled:opacity-40">Wipe</button>
                        )}
                        <button onClick={() => setUnenroll(p)} disabled={busy} className="py-2 px-3 rounded-xl text-xs font-semibold text-gray-500">Unenroll</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {(info?.wiped || []).length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-bold text-gray-700 mb-2">Wiped phones</p>
                {info.wiped.map((p) => (
                  <p key={p._id} className="text-xs text-gray-500">{p.model} {p.imei ? `(IMEI ${p.imei})` : ''}{p.used_by ? ` · ${p.used_by.name}` : ''}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <LocationModal deviceId={locate?.id} deviceLabel={locate?.label} isOpen={!!locate} onClose={() => setLocate(null)} />

      <ConfirmModal
        isOpen={!!unenroll}
        title="Unenroll this staff phone?"
        message={unenroll ? `${unenroll.model} stops being managed the next time it's online: no tracking, no locked wallpaper, it can be reset. Do this only when the company no longer needs to control it.` : ''}
        confirmText="Unenroll"
        confirmVariant="danger"
        onConfirm={doUnenroll}
        onClose={() => setUnenroll(null)}
      />

      {wipe && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setWipe(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-red-700">Wipe {wipe.model}?</h3>
            <p className="text-sm text-gray-700 mt-2">
              This <strong>erases everything</strong> on the phone (factory reset) the next time it is online. Use it for a lost or stolen phone.
              After the wipe you can't track or lock it any more, and only your company Google account (Factory Reset Protection) can set it up again.
            </p>
            <p className="text-sm text-gray-700 mt-2">If you just want it back, use <strong>Lock</strong> instead.</p>
            <label className="block text-sm font-bold text-gray-800 mt-4 mb-1">Type WIPE to confirm</label>
            <input value={wipeText} onChange={(e) => setWipeText(e.target.value)} autoCapitalize="characters"
              className="w-full px-3 py-3 border border-gray-300 rounded-xl text-sm" />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => setWipe(null)} className="py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm">Cancel</button>
              <button onClick={doWipe} className="py-3 rounded-xl bg-red-600 text-white font-bold text-sm">Wipe phone</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
