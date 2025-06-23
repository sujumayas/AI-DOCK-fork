import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Bot, MessageSquare, Settings, LogOut, User, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'

// 🏠 Professional Dashboard - Intercorp Retail & InDigital XP Branded
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
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadCurrentUser()
  }, [])

  // Optimized navigation handlers with useCallback to prevent unnecessary re-renders
  const handleLogout = useCallback(() => {
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const handleAdminPanel = useCallback(() => {
    navigate('/admin')
  }, [navigate])

  const handleChatInterface = useCallback(() => {
    navigate('/chat')
  }, [navigate])

  const handleUserSettings = useCallback(() => {
    navigate('/settings')
  }, [navigate])
  
  const handleManagerDashboard = useCallback(() => {
    navigate('/manager')
  }, [navigate])
  


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
      {/* Header Section with Intercorp Retail Branding */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI Dock</h1>
                <p className="text-blue-100 text-sm">InDigital XP Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-white font-medium">
                  {currentUser && !isLoadingUser ? (
                    currentUser.full_name || currentUser.username
                  ) : (
                    'Loading...'
                  )}
                </p>
                <p className="text-blue-100 text-sm">
                  {currentUser?.role?.name || 'User'}
                </p>
              </div>
              
              {/* 🛡️ Admin Panel Button - Only show for admin users */}
              {currentUser?.is_admin && (
                <button
                  onClick={handleAdminPanel}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-700 bg-white/90 rounded-lg hover:bg-white transition-all duration-200 shadow-lg"
                >
                  <Settings className="h-4 w-4" />
                  <span>Admin Panel</span>
                </button>
              )}
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-white/20 rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Sparkles className="h-6 w-6 text-yellow-300" />
            <h2 className="text-3xl font-bold text-white">Welcome to AI Dock</h2>
            <Sparkles className="h-6 w-6 text-yellow-300" />
          </div>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Your secure gateway to enterprise AI. Access multiple LLM providers with enterprise-grade security and usage controls.
          </p>
        </div>

        {/* Primary Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
          {/* Chat Interface Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-500 to-teal-500 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Start AI Chat</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Chat with OpenAI GPT, Claude, and other AI providers through our secure, enterprise-grade interface with full conversation tracking.
              </p>
              <button
                onClick={handleChatInterface}
                className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white text-lg font-semibold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-3">
                  <Bot className="h-5 w-5" />
                  <span>Start Chatting</span>
                </div>
              </button>
            </div>
          </div>

          {/* User Settings Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
            <div className="text-center">
              <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <User className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">My Settings</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Manage your profile, update preferences, view your usage statistics, and customize your AI Dock experience.
              </p>
              <button
                onClick={handleUserSettings}
                className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-lg font-semibold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex items-center justify-center space-x-3">
                  <Settings className="h-5 w-5" />
                  <span>My Settings</span>
                </div>
              </button>
            </div>
          </div>
          

        </div>

        {/* 🛡️ Admin & Manager Quick Access - Only show for admin/manager users */}
        {(currentUser?.is_admin || currentUser?.role?.name === 'manager') && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Admin Panel Access */}
            {currentUser?.is_admin && (
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-full">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Administrator Access</h3>
                      <p className="text-purple-100">
                        Manage users, departments, LLM configurations, and system analytics.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAdminPanel}
                    className="flex items-center space-x-2 px-6 py-3 text-sm font-medium text-purple-700 bg-white/90 rounded-xl hover:bg-white transition-all duration-200 shadow-lg"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Open Admin Panel</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Manager Dashboard Access */}
            {currentUser?.role?.name === 'manager' && (
              <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-3 rounded-full">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Department Manager</h3>
                      <p className="text-emerald-100">
                        Manage your department users, quotas, and view detailed analytics.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleManagerDashboard}
                    className="flex items-center space-x-2 px-6 py-3 text-sm font-medium text-emerald-700 bg-white/90 rounded-xl hover:bg-white transition-all duration-200 shadow-lg"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Open Manager Dashboard</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Intercorp Retail Branding Footer */}
        <div className="text-center mt-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-2xl mx-auto border border-white/20">
            <p className="text-white/80 text-sm">
              Powered by <span className="font-semibold text-white">Intercorp Retail</span> & <span className="font-semibold text-white">InDigital XP</span>
            </p>
            <p className="text-blue-200 text-xs mt-2">
              Making AI accessible to enterprises with security and control
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
