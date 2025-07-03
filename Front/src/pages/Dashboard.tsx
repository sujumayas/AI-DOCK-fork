import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Bot, MessageSquare, Settings, LogOut, User, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'
import { UnifiedTraversalButtons } from '../components/ui/UnifiedTraversalButtons'

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-blue-950">
      {/* Header Section with Intercorp Retail Branding */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">AI Dock</h1>
                <p className="text-blue-100 text-sm">InDigital XP Platform</p>
              </div>
            </div>
            
            {/* Integrated Navigation Buttons */}
            <div className="ml-2 md:ml-4">
              <UnifiedTraversalButtons 
                variant="inline" 
                size="md"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16 relative">
          {/* Decorative gradient blobs */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -rotate-45 pointer-events-none" />
          <div className="relative">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <Sparkles className="h-8 w-8 text-yellow-300 animate-pulse" />
            <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">Welcome to AI Dock</h2>
            <Sparkles className="h-8 w-8 text-yellow-300 animate-pulse" />
          </div>
          <p className="text-2xl text-blue-100/90 max-w-3xl mx-auto leading-relaxed">
            Your secure gateway to enterprise AI. Access multiple LLM providers with enterprise-grade security and usage controls.
          </p>
          </div>
        </div>

        {/* Primary Action Cards */}
        <div className="grid md:grid-cols-12 gap-8 mb-12 max-w-7xl mx-auto">
          {/* Chat Interface Card */}
          <div className="md:col-span-8 bg-white/5 backdrop-blur-lg rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-[1.02] border border-white/10">
            <div className="text-center">
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-6 rounded-2xl w-24 h-24 mx-auto mb-8 flex items-center justify-center ring-4 ring-blue-500/20 shadow-xl">
                <MessageSquare className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Start AI Chat</h3>
              <p className="text-blue-100 mb-8 leading-relaxed text-lg">
                Chat with OpenAI GPT, Claude, and other AI providers through our secure, enterprise-grade interface with full conversation tracking.
              </p>
              <button
                onClick={handleChatInterface}
                className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-lg font-semibold py-4 px-8 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 hover:ring-2 hover:ring-blue-400/50"
              >
                <div className="flex items-center justify-center space-x-3">
                  <Bot className="h-5 w-5" />
                  <span>Start Chatting</span>
                </div>
              </button>
            </div>
          </div>

          {/* User Settings Card */}
          <div className="md:col-span-4 bg-white/5 backdrop-blur-lg rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-[1.02] border border-white/10">
            <div className="text-center">
              <div className="bg-gradient-to-br from-gray-400 to-gray-600 p-6 rounded-2xl w-24 h-24 mx-auto mb-8 flex items-center justify-center ring-4 ring-gray-500/20 shadow-xl">
                <User className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">My Settings</h3>
              <p className="text-blue-100 mb-8 leading-relaxed text-lg">
                Manage your profile, update preferences, view your usage statistics, and customize your AI Dock experience.
              </p>
              <button
                onClick={handleUserSettings}
                className="w-full bg-gradient-to-br from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white text-lg font-semibold py-4 px-8 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 hover:ring-2 hover:ring-gray-400/50"
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
          <div className="relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-3xl mx-auto border border-white/10 shadow-2xl overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 rounded-3xl pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
            <p className="text-lg text-white/90 font-medium">
              Powered by <span className="font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Intercorp Retail</span> & <span className="font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">InDigital XP</span>
            </p>
            <p className="text-blue-200/90 text-sm mt-3 font-light">
              Making AI accessible to enterprises with security and control
            </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
