import React from 'react'

export default function PageHeader({ title, subtitle, action, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {(action || children) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {action}
          {children}
        </div>
      )}
    </div>
  )
}
