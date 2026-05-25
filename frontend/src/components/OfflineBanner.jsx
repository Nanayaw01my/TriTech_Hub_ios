import React, { useEffect, useRef, useState, useCallback } from 'react'
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import useOnlineStatus from '../hooks/useOnlineStatus'
import { getPendingQueue, removeSaleFromQueue } from '../utils/offlineQueue'
import { syncOfflineSales } from '../api/sync'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const wasOnlineRef = useRef(isOnline)
  const queryClient = useQueryClient()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshCount = () => setPendingCount(getPendingQueue().length)

  useEffect(() => {
    refreshCount()
    const t = setInterval(refreshCount, 3000)
    return () => clearInterval(t)
  }, [])

  const handleSync = useCallback(async () => {
    const queue = getPendingQueue()
    if (!queue.length || syncing) return
    setSyncing(true)
    let ok = 0
    let fail = 0
    for (const entry of queue) {
      try {
        await syncOfflineSales([{ type: entry.type, payload: entry.payload }])
        removeSaleFromQueue(entry.id)
        ok++
      } catch {
        fail++
      }
    }
    setSyncing(false)
    refreshCount()
    if (ok > 0) {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['recent-sales'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      toast.success(`Synced ${ok} sale${ok > 1 ? 's' : ''} to server`)
    }
    if (fail > 0) {
      toast.error(`${fail} sale${fail > 1 ? 's' : ''} failed to sync — will retry next time`)
    }
  }, [syncing, queryClient])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      handleSync()
    }
    wasOnlineRef.current = isOnline
  }, [isOnline, handleSync])

  if (isOnline && pendingCount === 0) return null

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm font-semibold
      ${!isOnline ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
      <div className="flex items-center gap-2">
        <FiWifiOff size={15} />
        <span>
          {!isOnline
            ? `Offline mode${pendingCount > 0 ? ` — ${pendingCount} sale${pendingCount > 1 ? 's' : ''} queued` : ' — no internet'}`
            : `Back online — ${pendingCount} sale${pendingCount > 1 ? 's' : ''} ready to sync`}
        </span>
      </div>
      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 bg-white text-amber-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-50 transition-colors disabled:opacity-60"
        >
          <FiRefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      )}
    </div>
  )
}
