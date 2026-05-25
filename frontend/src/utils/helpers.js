import { format, parseISO, isValid } from 'date-fns'

export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0
  return `GH₵ ${num.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const formatDate = (date) => {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date)
    if (!isValid(d)) return '—'
    return format(d, 'dd/MM/yyyy')
  } catch {
    return '—'
  }
}

export const formatDateTime = (date) => {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date)
    if (!isValid(d)) return '—'
    return format(d, 'dd/MM/yyyy HH:mm')
  } catch {
    return '—'
  }
}

export const formatTime = (date) => {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date)
    if (!isValid(d)) return '—'
    return format(d, 'HH:mm')
  } catch {
    return '—'
  }
}

export const formatNumber = (num) => {
  return (parseFloat(num) || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const getRoleBadgeColor = (role) => {
  const colors = {
    super_admin: 'bg-purple-100 text-purple-800',
    ceo: 'bg-blue-100 text-blue-800',
    manager: 'bg-green-100 text-green-800',
    sales: 'bg-orange-100 text-orange-700',
  }
  return colors[role] || 'bg-gray-100 text-gray-700'
}

export const getRoleLabel = (role) => {
  const labels = {
    super_admin: 'Super Admin',
    ceo: 'CEO',
    manager: 'Manager',
    sales: 'Sales',
  }
  return labels[role] || role
}

export const getRoleLevel = (role) => {
  const levels = { sales: 1, manager: 2, ceo: 3, super_admin: 4 }
  return levels[role] || 0
}

export const truncate = (str, length = 30) => {
  if (!str) return ''
  return str.length > length ? str.slice(0, length) + '...' : str
}

export const debounce = (fn, ms = 300) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export const downloadFile = (url, filename) => {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
