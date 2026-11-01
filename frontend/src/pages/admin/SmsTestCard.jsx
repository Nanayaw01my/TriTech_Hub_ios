import React, { useState } from 'react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import Card from '../../components/Modern/Card'

/** Send one test SMS and show exactly what the SMS providers answered. */
export default function SmsTestCard() {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const send = async () => {
    if (!phone.trim()) { toast.error('Enter a phone number.'); return }
    setBusy(true)
    setResult(null)
    try {
      const res = await api.post('/admin/sms/test', { phone })
      setResult(res.data?.data || null)
      if (res.data?.data?.ok) toast.success(res.data.message)
      else toast.error(res.data?.message || 'SMS was not sent.')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not run the SMS test.')
    } finally {
      setBusy(false)
    }
  }

  const providerRow = (name, p) => (
    <div className="p-3 rounded-xl border border-gray-200 text-xs space-y-1">
      <p className="font-bold text-gray-900 text-sm">
        {name}{' '}
        {!p.configured ? <span className="text-gray-400 font-semibold">· not set up</span>
          : p.ok ? <span className="text-green-600">· sent ✓</span>
          : (p.response || p.error) ? <span className="text-red-600">· failed</span>
          : <span className="text-gray-400 font-semibold">· not tried</span>}
      </p>
      <p className="text-gray-500">Sender name: <span className="font-mono">{p.sender_id}</span></p>
      {(p.response || p.error) && (
        <pre className="bg-gray-50 rounded-lg p-2 whitespace-pre-wrap break-all text-[11px] text-gray-700">
          {p.http_status ? `HTTP ${p.http_status}\n` : ''}{JSON.stringify(p.response || p.error, null, 1)}
        </pre>
      )}
    </div>
  )

  return (
    <Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
      <h2 className="text-gray-900 text-lg font-bold mb-1">SMS check</h2>
      <p className="text-sm text-gray-500 mb-4">Send one test text and see exactly what the SMS provider answered.</p>
      <div className="flex gap-2">
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244000000"
          className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-500 outline-none" />
        <button type="button" onClick={send} disabled={busy}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60">
          {busy ? 'Sending…' : 'Send test SMS'}
        </button>
      </div>
      {result && (
        <div className="mt-4 space-y-2">
          <p className={`text-sm font-bold ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
            {result.ok ? `Sent via ${result.provider} to ${result.phone}. Check the phone.` : (result.error || 'Not sent — see below.')}
          </p>
          {result.nkomo && providerRow('NkomoSMS (main)', result.nkomo)}
          {result.arkesel && providerRow('Arkesel (backup)', result.arkesel)}
        </div>
      )}
    </Card>
  )
}
