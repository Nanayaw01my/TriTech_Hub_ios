import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const IDLE_MS = 30 * 60 * 1000 // 30 minutes

const EVENTS = ['mousedown', 'mousemove', 'keypress', 'touchstart', 'scroll', 'click']

export function useIdleTimeout() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const timer = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const reset = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        await logout()
        toast('Logged out due to inactivity. Please sign in again.')
        navigate('/login', { replace: true })
      }, IDLE_MS)
    }

    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(timer.current)
    }
  }, [isAuthenticated, logout, navigate])
}
