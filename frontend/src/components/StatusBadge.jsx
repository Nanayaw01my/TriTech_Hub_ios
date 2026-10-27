import React from 'react'

const STATUS_CONFIG = {
  active: { label: 'Active', classes: 'bg-orange-100 text-orange-500' },
  overdue: { label: 'Overdue', classes: 'bg-red-100 text-red-800' },
  defaulted: { label: 'Defaulted', classes: 'bg-red-100 text-red-800' },
  locked: { label: 'Locked', classes: 'bg-red-100 text-red-800' },
  completed: { label: 'Completed', classes: 'bg-blue-100 text-blue-800' },
  available: { label: 'Available', classes: 'bg-orange-100 text-orange-500' },
  sold: { label: 'Sold', classes: 'bg-gray-100 text-gray-700' },
  pending: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Awaiting deposit', classes: 'bg-blue-100 text-blue-800' },
  returned: { label: 'Sent back for correction', classes: 'bg-amber-100 text-amber-800' },
  closed: { label: 'Closed – phone released', classes: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-500' },
  suspended: { label: 'Suspended', classes: 'bg-orange-100 text-orange-800' },
  paid: { label: 'Paid', classes: 'bg-orange-100 text-orange-500' },
  failed: { label: 'Failed', classes: 'bg-red-100 text-red-800' },
  unlocked: { label: 'Unlocked', classes: 'bg-orange-100 text-orange-500' },
}

export default function StatusBadge({ status, customLabel, size = 'sm' }) {
  const config = STATUS_CONFIG[status?.toLowerCase()] || {
    label: status || 'Unknown',
    classes: 'bg-gray-100 text-gray-700',
  }

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-0.5 text-xs'
    : 'px-3 py-1 text-sm'

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClasses} ${config.classes}`}>
      {customLabel || config.label}
    </span>
  )
}
