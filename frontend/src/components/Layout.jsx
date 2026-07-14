import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from './ConfirmModal'
import api from '../api/axios'

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  customers: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
  staff: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  devices: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />,
  payments: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
  reports: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></>,
  audit: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  settings: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
  addCustomer: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
  profile: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  menu: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />,
  close: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />,
}

const NavIcon = ({ path, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">{path}</svg>
)

// ─── Nav definitions ──────────────────────────────────────────────────────────
const Icon_info = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

const Icon_search = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />

const ADMIN_NAV = [
  { to: '/admin/guide', label: 'Guide', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
  { to: '/admin/dashboard', label: 'Dashboard', icon: Icon.home },
  { to: '/admin/customers', label: 'Customers', icon: Icon.customers },
  { to: '/admin/search', label: 'Search', icon: Icon_search },
  { to: '/admin/overdue-accounts', label: 'Overdue', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { to: '/admin/staff', label: 'Staff', icon: Icon.staff },
  { to: '/admin/devices', label: 'Devices', icon: Icon.devices },
  { to: '/admin/transactions', label: 'Transactions', icon: Icon.payments },
  { to: '/admin/reports', label: 'Reports', icon: Icon.reports },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: Icon.audit },
  { to: '/admin/settings', label: 'Settings', icon: Icon.settings },
  { to: '/admin/about', label: 'About', icon: Icon_info },
]

const STAFF_NAV = [
  { to: '/staff/dashboard', label: 'Dashboard', short: 'Home', icon: Icon.home },
  { to: '/staff/customers', label: 'My Customers', short: 'Customers', icon: Icon.customers },
  { to: '/staff/customers/add', label: 'Add Customer', short: 'Add', icon: Icon.addCustomer },
  { to: '/staff/about', label: 'About', short: 'About', icon: Icon_info },
]

const CUSTOMER_NAV = [
  { to: '/customer/dashboard', label: 'Dashboard', short: 'Home', icon: Icon.home },
  { to: '/customer/payments', label: 'Payments', short: 'Payments', icon: Icon.payments },
  { to: '/customer/profile', label: 'My Profile', short: 'Profile', icon: Icon.profile },
  { to: '/customer/about', label: 'Help', short: 'Help', icon: Icon_info },
]

// Bottom nav items (mobile only — fewer items)
const ADMIN_BOTTOM = [
  { to: '/admin/dashboard',         label: 'Home',      icon: Icon.home },
  { to: '/admin/customers',         label: 'Customers', icon: Icon.customers },
  { to: '/admin/overdue-accounts',  label: 'Overdue',   icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { to: '/admin/transactions',      label: 'Payments',  icon: Icon.payments },
  { to: '/admin/settings',          label: 'Settings',  icon: Icon.settings },
]

const PAGE_TITLES = {
  '/admin/dashboard':        'Dashboard',
  '/admin/customers':        'Customers',
  '/admin/search':           'Search',
  '/admin/overdue-accounts': 'Overdue',
  '/admin/staff':            'Staff',
  '/admin/devices':          'Devices',
  '/admin/transactions':     'Transactions',
  '/admin/reports':          'Reports',
  '/admin/audit-logs':       'Audit Logs',
  '/admin/settings':         'Settings',
  '/admin/about':            'About',
  '/staff/dashboard':        'Dashboard',
  '/staff/customers':        'My Customers',
  '/staff/customers/add':    'Add Customer',
  '/staff/about':            'About',
  '/customer/dashboard':     'Dashboard',
  '/customer/payments':      'Payments',
  '/customer/profile':       'My Profile',
  '/customer/about':         'Help & Info',
}

function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Detail pages
  if (/\/customers\/[^/]+$/.test(pathname)) return 'Customer Detail'
  return 'Tritech Hub iOS'
}

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(() => localStorage.getItem('notif_last_seen') || null)
  const ref = useRef(null)

  const fetchNotifs = useCallback(async () => {
    try {
      const since = lastSeen || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const res = await api.get(`/admin/notifications?since=${since}`)
      if (res.data.success) {
        setCount(res.data.data.unreadCount)
        setItems(res.data.data.items)
      }
    } catch {}
  }, [lastSeen])

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 30000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
  }

  const markRead = () => {
    const now = new Date().toISOString()
    localStorage.setItem('notif_last_seen', now)
    setLastSeen(now)
    setCount(0)
    setOpen(false)
  }

  const timeAgo = (date) => {
    const diff = (Date.now() - new Date(date)) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-bold text-gray-900 text-sm">New Registrations</p>
            {count > 0 && (
              <button onClick={markRead} className="text-xs text-green-700 font-semibold hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No new registrations</p>
            ) : (
              items.map((n, i) => (
                <div key={n.id || i} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{n.staffName}</span> registered a new customer
                        {n.deviceModel && <span className="text-gray-500"> · {n.deviceModel}</span>}
                      </p>
                      {n.accountNumber && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{n.accountNumber}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {items.length > 0 && (
            <div className="px-4 py-2.5 bg-gray-50 text-center">
              <NavLink to="/admin/audit-logs" onClick={() => { markRead(); setOpen(false) }}
                className="text-xs text-green-700 font-semibold hover:underline">
                View all in Audit Logs →
              </NavLink>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar link component ───────────────────────────────────────────────────
function SideNavLink({ item, role, onClick }) {
  const location = useLocation()
  const dashboardPath = `/${role}/dashboard`
  const isActive =
    location.pathname === item.to ||
    (item.to !== dashboardPath &&
      item.to !== `/${role}/customers/add` &&
      location.pathname.startsWith(item.to))

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={`group flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all duration-150
        ${isActive
          ? 'bg-white/15 text-white'
          : 'text-green-100/70 hover:bg-white/10 hover:text-white'
        }`}
    >
      <NavIcon path={item.icon} className="w-5 h-5 flex-shrink-0" />
      <span>{item.label}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
    </NavLink>
  )
}

// ─── Sidebar component ────────────────────────────────────────────────────────
function Sidebar({ role, navItems, user, onLinkClick, onLogout }) {
  const roleLabel = role === 'admin' ? 'Admin Portal' : role === 'staff' ? 'Staff Portal' : 'My Account'

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-green-900 to-green-950">
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5 pb-5 border-b border-white/10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
      >
        <img
          src="/logo.png"
          alt="Tritech Hub iOS"
          className="w-9 h-9 rounded-xl object-cover flex-shrink-0 shadow-sm"
        />
        <div>
          <p className="text-white font-bold text-sm leading-tight">Tritech Hub iOS</p>
          <p className="text-green-300 text-xs">{roleLabel}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-0.5">
        {navItems.map(item => (
          <SideNavLink key={item.to} item={item} role={role} onClick={onLinkClick} />
        ))}
      </nav>

      {/* User + Logout */}
      <div
        className="border-t border-white/10 p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">
              {(user?.full_name || user?.name || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              {user?.full_name || user?.name || 'User'}
            </p>
            <p className="text-green-300 text-xs truncate">
              {user?.staff_id || user?.account_number || user?.email || ''}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all"
        >
          <NavIcon path={Icon.logout} className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function Layout({ role }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutModal, setLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    const title = getPageTitle(location.pathname)
    document.title = title === 'Tritech Hub iOS' ? 'TriTech Hub iOS' : `${title} · TriTech Hub iOS`
  }, [location.pathname])

  // Hide the bottom tab bar while typing (keyboard open) so it doesn't float
  // over the keyboard and cover the fields being edited.
  useEffect(() => {
    const isTextInput = (el) => {
      if (!el) return false
      const tag = el.tagName
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (tag === 'INPUT') {
        const nonText = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color']
        return !nonText.includes((el.type || 'text').toLowerCase())
      }
      return el.isContentEditable === true
    }
    let blurTimer
    const open = () => { clearTimeout(blurTimer); setKeyboardOpen(true); document.body.classList.add('keyboard-open') }
    const close = () => { setKeyboardOpen(false); document.body.classList.remove('keyboard-open') }
    const onFocusIn = (e) => { if (isTextInput(e.target)) open() }
    // Debounce so moving between fields doesn't flash the nav back in
    const onFocusOut = () => { clearTimeout(blurTimer); blurTimer = setTimeout(close, 120) }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      clearTimeout(blurTimer)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.body.classList.remove('keyboard-open')
    }
  }, [])

  const navItems = role === 'admin' ? ADMIN_NAV : role === 'staff' ? STAFF_NAV : CUSTOMER_NAV
  const bottomItems = role === 'admin' ? ADMIN_BOTTOM : navItems

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Desktop Sidebar (all roles) ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <Sidebar
          role={role}
          navItems={navItems}
          user={user}
          onLinkClick={() => {}}
          onLogout={() => setLogoutModal(true)}
        />
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 flex-shrink-0">
            <Sidebar
              role={role}
              navItems={navItems}
              user={user}
              onLinkClick={() => setSidebarOpen(false)}
              onLogout={() => { setSidebarOpen(false); setLogoutModal(true) }}
            />
          </div>
        </div>
      )}

      {/* ── Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">

        {/* Mobile top bar */}
        <header className="lg:hidden bg-green-900 text-white sticky top-0 z-40" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.18)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center justify-between px-3 h-14">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
            >
              <NavIcon path={Icon.menu} className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-2.5 min-w-0 px-2">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-black flex-shrink-0 shadow-sm">
                <img src="/logo.png" alt="Tritech Hub iOS" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">
                  {getPageTitle(location.pathname)}
                </p>
                <p className="text-green-300/70 text-[10px] font-medium leading-tight">Tritech Hub iOS</p>
              </div>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              {role === 'admin' && <NotificationBell />}
              <button
                onClick={() => setLogoutModal(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors"
                title="Sign out"
              >
                <NavIcon path={Icon.logout} className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Desktop top bar — user info only (page titles live inside each page) */}
        <div className="hidden lg:flex items-center justify-end px-8 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            {role === 'admin' && <NotificationBell />}
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {user?.full_name || user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-400 capitalize">{role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-800 font-bold text-sm">
                {(user?.full_name || user?.name || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="lg:px-8 lg:py-2">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav (hidden while typing) ── */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden ${keyboardOpen ? 'hidden' : ''}`}
           style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid rgba(0,0,0,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-16">
          {bottomItems.map((item) => {
            const dashboardPath = `/${role}/dashboard`
            const isActive =
              location.pathname === item.to ||
              (item.to !== dashboardPath &&
                item.to !== `/${role}/customers/add` &&
                location.pathname.startsWith(item.to))
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors"
              >
                <div className={`w-10 h-7 flex items-center justify-center rounded-xl transition-all duration-200
                  ${isActive ? 'bg-green-100' : ''}`}>
                  <NavIcon path={item.icon} className={`w-5 h-5 transition-colors ${isActive ? 'text-green-800' : 'text-gray-400'}`} />
                </div>
                <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-green-800' : 'text-gray-400'}`}>
                  {item.short || item.label.split(' ')[0]}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      <ConfirmModal
        isOpen={logoutModal}
        onClose={() => setLogoutModal(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of Tritech Hub iOS?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmVariant="danger"
        loading={loggingOut}
      />
    </div>
  )
}
