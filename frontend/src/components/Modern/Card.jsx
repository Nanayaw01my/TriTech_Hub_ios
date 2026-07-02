import React from 'react'

export default function Card({
  children,
  className = '',
  glass = true,
  padding = 'p-6',
  ...props
}) {
  return (
    <div
      className={`
        rounded-2xl transition-all duration-300
        ${glass
          ? 'bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 hover:border-white/30'
          : 'bg-white shadow-lg border border-gray-200'
        }
        ${padding} ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
