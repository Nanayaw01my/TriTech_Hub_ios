const MIME_BY_EXT = { pdf: 'application/pdf', csv: 'text/csv' }

/** True when running inside the Dan & Dor Solar Android app (Capacitor). */
export const isNativeApp = () => !!window.Capacitor?.isNativePlatform?.()

/**
 * Save a Blob as a file. In the Android app the WebView can't follow blob:
 * download links, so the bytes go to the native DDDownload plugin (saves to
 * Downloads and opens it). In a browser, a normal download link is used.
 */
export async function saveBlob(blob, filename) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const type = blob.type || MIME_BY_EXT[ext] || 'application/octet-stream'
  const plugin = isNativeApp() && window.Capacitor?.Plugins?.DDDownload

  if (plugin) {
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] || '')
      r.onerror = reject
      r.readAsDataURL(blob)
    })
    await plugin.saveFile({ filename, mimeType: type, data })
    return
  }

  const url = window.URL.createObjectURL(blob.type ? blob : new Blob([blob], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
