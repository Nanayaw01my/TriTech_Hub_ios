import React, { useRef, useEffect, useState, useCallback } from 'react'

export default function SignaturePad({ onSign, onClear, required = false, label = 'Customer Signature' }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const lastPos   = useRef(null)
  const [signed, setSigned] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  const startDraw = useCallback((e) => {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    lastPos.current = getPos(e, canvas)
  }, [])

  const draw = useCallback((e) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)

    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#166534'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    lastPos.current = pos
    setIsEmpty(false)
    setSigned(false)
  }, [])

  const endDraw = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false
    lastPos.current = null
  }, [])

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    setSigned(false)
    if (onClear) onClear()
    if (onSign) onSign(null)
  }

  const handleConfirm = () => {
    if (isEmpty) return
    const canvas = canvasRef.current
    // Composite onto white bg before exporting
    const offscreen = document.createElement('canvas')
    offscreen.width  = canvas.width
    offscreen.height = canvas.height
    const ctx = offscreen.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, offscreen.width, offscreen.height)
    ctx.drawImage(canvas, 0, 0)
    const dataUrl = offscreen.toDataURL('image/png')
    setSigned(true)
    if (onSign) onSign(dataUrl)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.addEventListener('touchstart',  startDraw, { passive: false })
    canvas.addEventListener('touchmove',   draw,      { passive: false })
    canvas.addEventListener('touchend',    endDraw,   { passive: false })
    canvas.addEventListener('mousedown',   startDraw)
    canvas.addEventListener('mousemove',   draw)
    canvas.addEventListener('mouseup',     endDraw)
    canvas.addEventListener('mouseleave',  endDraw)
    return () => {
      canvas.removeEventListener('touchstart',  startDraw)
      canvas.removeEventListener('touchmove',   draw)
      canvas.removeEventListener('touchend',    endDraw)
      canvas.removeEventListener('mousedown',   startDraw)
      canvas.removeEventListener('mousemove',   draw)
      canvas.removeEventListener('mouseup',     endDraw)
      canvas.removeEventListener('mouseleave',  endDraw)
    }
  }, [startDraw, draw, endDraw])

  return (
    <div className="flex flex-col gap-2">
      <label className="block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative border-2 border-dashed border-gray-300 rounded-2xl overflow-hidden bg-white"
           style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full block cursor-crosshair"
          style={{ height: '140px' }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm font-medium select-none">Sign here</p>
          </div>
        )}
        {/* baseline */}
        <div className="absolute bottom-8 left-8 right-8 border-b border-gray-200 pointer-events-none" />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty}
          className="px-4 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-xl
                     hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isEmpty || signed}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-green-700 rounded-xl
                     hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {signed ? '✓ Confirmed' : 'Confirm Signature'}
        </button>
      </div>

      {signed && (
        <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
          Signature captured
        </p>
      )}
    </div>
  )
}
