import React from 'react'

export default function Card({
  children,
  className = '',
  padding = 'p-6',
  ...props
}) {
  return (
    <div
      className={`
        rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md
        transition-shadow duration-200
        ${padding} ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
