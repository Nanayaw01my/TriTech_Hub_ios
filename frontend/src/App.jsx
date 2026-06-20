import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useIdleTimeout } from './hooks/useIdleTimeout'
import LoadingSpinner from './components/LoadingSpinner'
import SplashScreen from './components/SplashScreen'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/OfflineBanner'
import NotFound from './pages/NotFound'

// Public pages
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminCustomers from './pages/admin/Customers'
import AdminCustomerDetail from './pages/admin/CustomerDetail'
import AdminOverdueAccounts from './pages/admin/OverdueAccounts'
import AdminStaff from './pages/admin/Staff'
import AdminDevices from './pages/admin/Devices'
import AdminTransactions from './pages/admin/Transactions'
import AdminReports from './pages/admin/Reports'
import AdminAuditLogs from './pages/admin/AuditLogs'
import AdminSettings from './pages/admin/Settings'
import AdminAbout from './pages/admin/About'
import AdminSearch from './pages/admin/Search'

// Staff pages
import StaffDashboard from './pages/staff/Dashboard'
import StaffCustomers from './pages/staff/Customers'
import StaffAddCustomer from './pages/staff/AddCustomer'
import StaffCustomerDetail from './pages/staff/CustomerDetail'
import StaffAbout from './pages/staff/About'

// Customer pages
import CustomerDashboard from './pages/customer/Dashboard'
import CustomerPayments from './pages/customer/Payments'
import CustomerProfile from './pages/customer/Profile'
import CustomerAbout from './pages/customer/About'

// Layout
import Layout from './components/Layout'

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard
    if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (userRole === 'staff') return <Navigate to="/staff/dashboard" replace />
    if (userRole === 'customer') return <Navigate to="/customer/dashboard" replace />
    return <Navigate to="/login" replace />
  }

  return children
}

function RoleRedirect() {
  const { isAuthenticated, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (userRole === 'staff') return <Navigate to="/staff/dashboard" replace />
  if (userRole === 'customer') return <Navigate to="/customer/dashboard" replace />
  return <Navigate to="/login" replace />
}

function IdleWatcher() {
  useIdleTimeout()
  return null
}

function AppRoutes() {
  return (
    <>
      <IdleWatcher />
      <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="customers/:id" element={<AdminCustomerDetail />} />
        <Route path="search" element={<AdminSearch />} />
        <Route path="overdue-accounts" element={<AdminOverdueAccounts />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="devices" element={<AdminDevices />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="about" element={<AdminAbout />} />
      </Route>

      {/* Staff routes */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['staff']}>
            <Layout role="staff" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/staff/dashboard" replace />} />
        <Route path="dashboard" element={<StaffDashboard />} />
        <Route path="customers" element={<StaffCustomers />} />
        <Route path="customers/add" element={<StaffAddCustomer />} />
        <Route path="customers/:id" element={<StaffCustomerDetail />} />
        <Route path="about" element={<StaffAbout />} />
      </Route>

      {/* Customer routes */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <Layout role="customer" />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/customer/dashboard" replace />} />
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="payments" element={<CustomerPayments />} />
        <Route path="profile" element={<CustomerProfile />} />
        <Route path="about" element={<CustomerAbout />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  )
}

export default function App() {
  const [splash, setSplash] = useState(() => !sessionStorage.getItem('splashShown'))

  const handleSplashDone = () => {
    sessionStorage.setItem('splashShown', '1')
    setSplash(false)
  }

  return (
    <ErrorBoundary>
      <OfflineBanner />
      {splash && <SplashScreen onDone={handleSplashDone} />}
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
