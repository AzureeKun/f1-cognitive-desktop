import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import RecordsPage from './pages/RecordsPage'

// Protected route - redirects to login if no user
function ProtectedRoute({ children }) {
  const { user, loading } = useApp()
  const params = new URLSearchParams(window.location.search)
  const isLoginCallback = params.get('login_success') === 'true'

  // Still loading from localStorage
  if (loading) return null

  // Allow if user exists OR if this is a Steam callback
  if (!user && !isLoginCallback) return <Navigate to="/" replace />
  return children
}

// Public route - redirects to home if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useApp()

  if (loading) return null
  if (user) return <Navigate to="/home" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/records" element={<ProtectedRoute><RecordsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}

export default App
