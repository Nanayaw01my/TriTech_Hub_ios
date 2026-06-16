import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const navigate = useNavigate()
  const { isAuthenticated, userRole } = useAuth()

  const handleGoHome = () => {
    if (!isAuthenticated) { navigate('/login'); return }
    if (userRole === 'admin') navigate('/admin/dashboard')
    else if (userRole === 'staff') navigate('/staff/dashboard')
    else navigate('/customer/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-xs w-full">
        <div style={{
          fontSize: '6rem', fontWeight: '900', lineHeight: 1,
          color: '#E8F5E9', marginBottom: '0.5rem',
          textShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          404
        </div>
        <div className="w-16 h-1 bg-green-700 rounded-full mx-auto mb-6" />
        <h1 className="text-2xl font-black text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          This page doesn't exist or you don't have permission to view it.
        </p>
        <button
          onClick={handleGoHome}
          className="w-full py-3.5 bg-green-800 text-white font-bold rounded-2xl
                     hover:bg-green-900 active:scale-95 transition-all"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}
