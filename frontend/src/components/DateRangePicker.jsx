import React from 'react'
import { FiCalendar } from 'react-icons/fi'
import { format } from 'date-fns'

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, className = '' }) {
  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <div className="relative flex items-center">
        <FiCalendar size={14} className="absolute left-2.5 text-gray-400 pointer-events-none" />
        <input
          type="date"
          value={startDate || ''}
          onChange={e => onStartChange(e.target.value)}
          max={endDate || today}
          className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>
      <span className="text-gray-400 text-sm">to</span>
      <div className="relative flex items-center">
        <FiCalendar size={14} className="absolute left-2.5 text-gray-400 pointer-events-none" />
        <input
          type="date"
          value={endDate || ''}
          onChange={e => onEndChange(e.target.value)}
          min={startDate || undefined}
          max={today}
          className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>
    </div>
  )
}
