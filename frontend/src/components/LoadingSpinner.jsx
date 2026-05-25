import React from 'react'

export default function LoadingSpinner({ size = 'md', fullPage = false, text = '', fullScreen = false }) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
    xl: 'w-16 h-16 border-4',
  }

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizes[size] || sizes.md} rounded-full border-orange-200 border-t-orange-500 animate-spin`}
      />
      {text && <p className="text-sm text-gray-500 font-medium">{text}</p>}
    </div>
  )

  if (fullPage || fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {spinner}
      </div>
    )
  }

  return spinner
}
