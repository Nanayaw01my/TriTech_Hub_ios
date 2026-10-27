import { useEffect, useState } from 'react'
import api from '../api/axios'

// Company logo uploaded in Admin → Settings; falls back to the built-in one.
// Loaded once per page load and remembered for the next visit so the old logo
// doesn't flash first.
const DEFAULT_LOGO = '/logo.png'
const STORE_KEY = 'dd_logo_url'

const readStored = () => {
  try { return localStorage.getItem(STORE_KEY) || null } catch { return null }
}
const store = (url) => {
  try {
    if (url && url !== DEFAULT_LOGO) localStorage.setItem(STORE_KEY, url)
    else localStorage.removeItem(STORE_KEY)
  } catch { /* storage unavailable */ }
}

let current = readStored() || DEFAULT_LOGO
let loading = null
const listeners = new Set()
const publish = (url) => {
  current = url || DEFAULT_LOGO
  store(current)
  listeners.forEach((fn) => fn(current))
}

const load = () => {
  if (!loading) {
    loading = api.get('/customer/business-info')
      .then((res) => publish((res.data?.data || res.data)?.logo_url || DEFAULT_LOGO))
      .catch(() => { /* keep whatever we have */ })
  }
  return loading
}

/** Call after uploading/removing the logo so every screen updates at once. */
export const setLogo = (url) => { loading = Promise.resolve(); publish(url) }

export default function useLogo() {
  const [logo, setState] = useState(current)
  useEffect(() => {
    listeners.add(setState)
    load()
    return () => listeners.delete(setState)
  }, [])
  return logo
}
