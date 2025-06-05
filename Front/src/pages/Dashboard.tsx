import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Bot, Users, BarChart3, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'

// 🏠 Dashboard Component - Main page for authenticated users
export const Dashboard: React.FC = () => {
  // 🧭 React Router navigation hook
  const navigate = useNavigate()
  
  // 🔐 Use our custom authentication hook
  const { logout } = useAuth()
  
  // 👤 Track current user data
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  
  // 👤 Load current user data on component mount
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser()
        setCurrentUser(user)
      } catch (error) {
        console.error('Failed to load current user:', error)
        // If we can't load user data, they might need to re-login
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadCurrentUser()
  }, [])

  // 🚪 Handle logout function
  const handleLogout = () => {
    console.log('👋 Logging out and redirecting to login...')
    
    // Call logout from our hook (clears token and updates state)
    logout()
    
    // Navigate to login page
    navigate('/login', { replace: true })
  }

  // 🛡️ Handle admin panel navigation
  const handleAdminPanel = () => {
    navigate('/admin')
  }

  // 💬 Handle chat interface navigation
  const handleChatInterface = () => {
    navigate('/chat')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header Section with Logout */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">AI Dock</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {currentUser && !isLoadingUser ? (
                  `Welcome, ${currentUser.full_name || currentUser.username}`
                ) : (
                  'Secure Internal LLM Gateway'
                )}
              </span>
              
              {/* 🛡️ Admin Panel Button - Only show for admin users */}
              {currentUser?.is_admin && (
                <button
                  onClick={handleAdminPanel}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span>Admin Panel</span>
                </button>
              )}
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Message */}
        <div className="card mb-8 bg-gradient-to-r from-green-500 to-green-600 text-white border-none">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
            <div>
              <h2 className="text-xl font-semibold mb-1">💬 AI Chat Interface is Ready!</h2>
              <p className="text-green-100">
                Your AI Dock platform is fully operational. Start chatting with LLMs now!
              </p>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="card hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <Bot className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">AI Chat Interface</h3>
            <p className="text-gray-600 text-sm mb-4">
              Chat with OpenAI, Claude, and other AI providers through our secure interface.
            </p>
            <button
              onClick={handleChatInterface}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Bot className="h-4 w-4" />
              <span>Start Chatting</span>
            </button>
          </div>

          <div className="card hover:shadow-md transition-shadow duration-200">
            <Users className="h-8 w-8 text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">User Management</h3>
            <p className="text-gray-600 text-sm">
              Role-based access control with department-level permissions and quotas.
            </p>
            {currentUser?.is_admin ? (
              <button
                onClick={handleAdminPanel}
                className="mt-3 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
              >
                ✨ Open Admin Panel
              </button>
            ) : (
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                Admin Access Required
              </div>
            )}
          </div>

          <div className="card hover:shadow-md transition-shadow duration-200">
            <BarChart3 className="h-8 w-8 text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Usage Analytics</h3>
            <p className="text-gray-600 text-sm">
              Comprehensive tracking and reporting for all AI interactions.
            </p>
            <div className="mt-3 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
              Phase 5: Analytics Dashboard
            </div>
          </div>
        </div>

        {/* Development Status */}
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="font-medium text-blue-800">Development Status:</span>
            <span className="text-blue-700">Chat Interface Ready! 💬</span>
          </div>
          <div className="space-y-2 text-sm text-blue-600">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>React Router DOM with protected routes</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>useAuth custom hook for state management</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>Admin dashboard with role-based access</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✅</span>
              <span>LLM chat interface with provider selection</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-yellow-500">⏳</span>
              <span>Next: Usage tracking and quota management</span>
            </div>
          </div>
        </div>

        {/* 🛡️ Admin Quick Access - Only show for admin users */}
        {currentUser?.is_admin && (
          <div className="card bg-purple-50 border-purple-200 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-purple-800 mb-2">🛡️ Admin Access</h3>
                <p className="text-sm text-purple-700">
                  You have administrator privileges. Access the admin panel to manage users, departments, and system settings.
                </p>
              </div>
              <button
                onClick={handleAdminPanel}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span>Open Admin Panel</span>
              </button>
            </div>
          </div>
        )}

        {/* Route Testing Info */}
        <div className="card bg-gray-50 border-gray-200 mt-6">
          <h3 className="font-semibold text-gray-800 mb-2">🧪 Route Testing Guide</h3>
          <div className="space-y-1 text-sm text-gray-700">
            <p>• Try accessing <code className="bg-gray-100 px-1 rounded">/dashboard</code> without login → should redirect to login</p>
            <p>• Try accessing <code className="bg-gray-100 px-1 rounded">/admin</code> without admin privileges → should show access denied</p>
            <p>• Login successfully → should redirect to dashboard automatically</p>
            <p>• Admin users can access admin panel via header button</p>
            <p>• Logout → should redirect to login and block protected routes</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            AI Dock - Admin Interface Ready! 🛡️
          </p>
        </div>
      </footer>
    </div>
  )
}
