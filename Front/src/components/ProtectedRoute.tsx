import React from 'react'
import { Navigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// 🛡️ ProtectedRoute Component
// This is a "Higher-Order Component" (HOC) that wraps other components
// It checks authentication before allowing access to protected pages

interface ProtectedRouteProps {
  children: React.ReactNode  // The component/page we want to protect
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // 🔍 Use our custom authentication hook
  const { isAuthenticated, isLoading } = useAuth()

  // ⏳ Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Checking authentication...</p>
          <p className="text-sm text-gray-500 mt-2">🔐 Route protection active</p>
        </div>
      </div>
    )
  }

  // 🚫 Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('🚫 Access denied - redirecting to login')
    return <Navigate to="/login" replace />
  }

  // ✅ User is authenticated - show the protected content
  console.log('✅ Access granted - showing protected content')
  return <>{children}</>
}

// 💡 How this works:
// 1. Component checks authentication status
// 2. If loading → show loading screen
// 3. If not authenticated → redirect to /login
// 4. If authenticated → show the protected component

// 🎯 Usage example:
// <ProtectedRoute>
//   <Dashboard />
// </ProtectedRoute>
