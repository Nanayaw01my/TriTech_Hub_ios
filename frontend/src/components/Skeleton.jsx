import React from 'react'

// A single shimmering placeholder block. Compose these to mirror a page's
// layout while its data loads (skeleton loading, instead of a spinner).
export default function Skeleton({ className = '', dark = false, rounded = 'rounded-xl' }) {
  return <div className={`skeleton ${dark ? 'skeleton-dark' : ''} ${rounded} ${className}`} />
}
