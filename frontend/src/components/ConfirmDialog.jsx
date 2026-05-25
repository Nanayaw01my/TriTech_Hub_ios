import React from 'react'
import { FiAlertTriangle, FiX } from 'react-icons/fi'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  loading = false,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn">
        <div className="p-6">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4
            ${danger ? 'bg-red-100' : 'bg-orange-100'}`}>
            <FiAlertTriangle size={24} className={danger ? 'text-red-500' : 'text-orange-500'} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{title}</h3>
          <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50
                ${danger
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-orange-500 hover:bg-orange-600'
                }`}
            >
              {loading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
