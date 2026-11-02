import { useEffect, useState } from 'react'
import api from '../api/axios'

// Company details (name, phone, email, address, late fee) from Settings, for
// public pages. Fetched once per page load and shared.
const FALLBACK = {
  business_name: 'Dan & Dor Solar Company Ltd.',
  contact_email: 'support@dandorsolar.site',
  contact_phone: '',
  contact_address: '',
  whatsapp_number: '',
  late_fee_per_day: 10,
}
let cache = null
let pending = null

export default function useBusinessInfo() {
  const [info, setInfo] = useState(cache || FALLBACK)
  useEffect(() => {
    if (cache) return
    pending = pending || api.get('/customer/business-info')
      .then((res) => { cache = { ...FALLBACK, ...(res.data?.data || {}) }; return cache })
      .catch(() => FALLBACK)
    let alive = true
    pending.then((v) => { if (alive) setInfo(v) })
    return () => { alive = false }
  }, [])
  return info
}
