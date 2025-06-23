import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LoginPage } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ChatInterface } from './pages/ChatInterface'
// import { ChatInterfaceTest } from './pages/ChatInterface.test' // REMOVED: file deleted
import { UserSettings } from './pages/UserSettings'
import AdminSettings from './pages/AdminSettings'
import ManagerDashboard from './pages/ManagerDashboard'
// import StreamingTestPage from './pages/StreamingTestPage' // 🌊 NEW: Streaming test interface (REMOVED)
import AssistantDiagnosticPage from './pages/AssistantDiagnosticPage' // 🔧 NEW: Diagnostic tool

import { ProtectedRoute } from './components/ProtectedRoute'

// 🚀 Main App Component - Now using React Router!
// This is the root of our application with proper routing

function App() {
  return (
    // 🔐 AuthProvider provides global authentication state to entire app
    // All components can now access auth state without props drilling
    <AuthProvider>
      {/* 🧭 BrowserRouter enables client-side routing */}
      {/* It manages URL changes and browser history */}
      <BrowserRouter>
      <Routes>
        {/* 🏠 Root Route: Redirect to dashboard */}
        <Route 
          path="/" 
          element={<Navigate to="/dashboard" replace />} 
        />
        
        {/* 🔐 Login Route: Public route for authentication */}
        <Route 
          path="/login" 
          element={<LoginPage />} 
        />
        
        {/* 🛡️ Dashboard Route: Protected route for authenticated users */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* 💬 Chat Route: Protected route for AI chat interface */}
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <ChatInterface />
            </ProtectedRoute>
          } 
        />
        
        {/* 🌊 Streaming Test Route: Protected route for testing streaming functionality */}
        // (REMOVED)
        
        {/* 🔧 Diagnostic Route: Test backend connection and save button issues */}
        <Route 
          path="/diagnostic" 
          element={<AssistantDiagnosticPage />} 
        />
        

        
        {/* ⚙️ User Settings Route: Protected route for user profile management */}
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <UserSettings />
            </ProtectedRoute>
          } 
        />
        
        {/* 🏢 Manager Route: Protected route for department managers */}
        <Route 
          path="/manager" 
          element={
            <ProtectedRoute>
              <ManagerDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* 👤 Admin Route: Protected route for admin users */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminSettings />
            </ProtectedRoute>
          } 
        />
        
        {/* 🚫 Catch-all Route: Redirect unknown URLs to dashboard */}
        <Route 
          path="*" 
          element={<Navigate to="/dashboard" replace />} 
        />
      </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

// 🎯 How this routing works:
//
// 1. BrowserRouter wraps everything and manages URL state
// 2. Routes container holds all our route definitions
// 3. Route components map URL paths to React components
//
// Route Flow:
// • User visits "/" → redirects to "/dashboard"
// • User visits "/dashboard" → ProtectedRoute checks authentication:
//   - If authenticated → shows Dashboard component
//   - If not authenticated → redirects to "/login"
// • User visits "/admin" → ProtectedRoute checks authentication:
//   - If authenticated AND admin → shows AdminSettings component
//   - If not authenticated → redirects to "/login"
//   - If authenticated but not admin → shows access denied
// • User visits "/login" → shows LoginPage component
// • User visits unknown URL → redirects to "/dashboard"
//
// Security Features:
// • ProtectedRoute wrapper automatically checks authentication
// • Unauthenticated users can't access dashboard
// • Authenticated users are redirected away from login
// • All routes handle authentication state properly
//
// 💡 Benefits of this approach:
// • Clean separation of concerns (auth logic in hook, route protection in component)
// • Reusable ProtectedRoute for future protected pages
// • Proper browser history management
// • Deep linking support (can bookmark /dashboard)
// • Back/forward buttons work correctly
