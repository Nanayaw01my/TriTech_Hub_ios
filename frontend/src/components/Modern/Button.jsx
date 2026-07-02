import React from 'react'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) {
  const baseStyles = 'font-semibold rounded-full transition-all duration-200 active:scale-95 flex items-center justify-center gap-2'

  const variants = {
    primary: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed',
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  )
}
