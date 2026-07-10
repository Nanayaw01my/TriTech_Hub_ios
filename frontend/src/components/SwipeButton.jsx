import React, { useRef, useState, useEffect, useCallback } from 'react'

/**
 * Slide-to-confirm button. Drag the knob to the right edge to trigger onComplete.
 * Works with both touch and mouse. Remount (change the `key` prop) to reset it.
 */
export default function SwipeButton({
  onComplete,
  loading = false,
  disabled = false,
  dark = false,
  label = 'Swipe to Sign In',
  loadingLabel = 'Signing in…',
}) {
  const KNOB = 52
  const PAD = 4

  const trackRef = useRef(null)
  const xRef = useRef(0)
  const draggingRef = useRef(false)
  const startRef = useRef(0)
  const maxRef = useRef(0)
  const completedRef = useRef(false)

  const [x, setXState] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [completed, setCompleted] = useState(false)

  const setX = (v) => { xRef.current = v; setXState(v) }
  const getMax = () => {
    const t = trackRef.current
    return t ? t.offsetWidth - KNOB - PAD * 2 : 0
  }

  const begin = (clientX) => {
    if (disabled || loading || completedRef.current) return
    draggingRef.current = true
    setDragging(true)
    maxRef.current = getMax()
    startRef.current = clientX - xRef.current
  }

  const move = useCallback((clientX) => {
    if (!draggingRef.current) return
    let v = clientX - startRef.current
    v = Math.max(0, Math.min(v, maxRef.current))
    setX(v)
  }, [])

  const end = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    if (xRef.current >= maxRef.current - 6) {
      completedRef.current = true
      setCompleted(true)
      setX(maxRef.current)
      onComplete?.()
    } else {
      setX(0) // snap back
    }
  }, [onComplete])

  useEffect(() => {
    const mm = (e) => move(e.clientX)
    const tm = (e) => {
      if (draggingRef.current && e.cancelable) e.preventDefault()
      if (e.touches && e.touches[0]) move(e.touches[0].clientX)
    }
    const up = () => end()
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', tm, { passive: false })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', tm)
      window.removeEventListener('touchend', up)
    }
  }, [move, end])

  const max = maxRef.current || getMax()
  const progress = max ? Math.min(1, x / max) : 0
  const isBusy = loading || completed

  return (
    <div
      ref={trackRef}
      className={`relative w-full h-14 rounded-full overflow-hidden select-none
                  border transition-colors
                  ${dark
                    ? (disabled ? 'bg-white/5 border-white/10' : 'bg-white/10 border-white/20')
                    : (disabled ? 'bg-gray-100 border-gray-200' : 'bg-emerald-50 border-emerald-200')}`}
      style={{ padding: PAD }}
    >
      {/* Progress fill */}
      <div
        className={dark ? 'absolute inset-y-0 left-0 bg-emerald-500/40' : 'absolute inset-y-0 left-0 bg-emerald-500/25'}
        style={{ width: x + KNOB + PAD, transition: dragging ? 'none' : 'width 0.25s ease' }}
      />

      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: isBusy ? 1 : 1 - progress * 1.4, transition: dragging ? 'none' : 'opacity 0.2s ease' }}
      >
        <span className={`${dark ? 'text-white' : 'text-emerald-700'} font-bold text-sm tracking-wide flex items-center gap-2`}>
          {isBusy ? loadingLabel : (
            <>
              {label}
              <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </>
          )}
        </span>
      </div>

      {/* Knob */}
      <div
        onMouseDown={(e) => begin(e.clientX)}
        onTouchStart={(e) => e.touches[0] && begin(e.touches[0].clientX)}
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full shadow-md
                    ${disabled
                      ? (dark ? 'bg-white/20 cursor-not-allowed' : 'bg-gray-300 cursor-not-allowed')
                      : 'bg-emerald-500 cursor-grab active:cursor-grabbing'}`}
        style={{
          width: KNOB,
          height: KNOB,
          left: PAD,
          transform: `translateX(${x}px) translateY(-50%)`,
          transition: dragging ? 'none' : 'transform 0.25s ease',
          touchAction: 'none',
        }}
      >
        {isBusy ? (
          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </div>
  )
}
