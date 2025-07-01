import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Lock, Shield, BarChart3, Save, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'
import { usageAnalyticsService } from '../services/usageAnalyticsService'
import { UserUsageStats } from '../types/usage'

// 👤 User Settings Page - Personal Profile Management
export const UserSettings: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  
  // 👤 User data state
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // 📝 Form state for profile updates
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  
  // 📊 Add state for real usage stats
  const [usageStats, setUsageStats] = useState<UserUsageStats | null>(null)
  const [isUsageLoading, setIsUsageLoading] = useState(true)
  const [usageError, setUsageError] = useState<string | null>(null)
  
  // 🔔 Success/error messages
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 👤 Load current user data on component mount
  useEffect(() => {
    const loadCurrentUserAndUsage = async () => {
      try {
        const user = await authService.getCurrentUser()
        setCurrentUser(user)
        setProfileForm({
          full_name: user.full_name || '',
          email: user.email || '',
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
        // Fetch usage stats for this user
        setIsUsageLoading(true)
        setUsageError(null)
        try {
          const stats = await usageAnalyticsService.getMyUsageStats()
          setUsageStats(stats)
        } catch (err: any) {
          setUsageError(err.message || 'Failed to load usage stats')
        } finally {
          setIsUsageLoading(false)
        }
      } catch (error) {
        console.error('Failed to load current user:', error)
        setMessage({ type: 'error', text: 'Failed to load user profile' })
        setIsUsageLoading(false)
      } finally {
        setIsLoading(false)
      }
    }
    loadCurrentUserAndUsage()
  }, [])

  // Optimized navigation and form handlers with useCallback
  const handleBackToDashboard = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  const handleInputChange = useCallback((field: string, value: string) => {
    setProfileForm(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])
  
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev)
  }, [])
  
  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword(prev => !prev)
  }, [])

  // Optimized profile save handler with useCallback
  const handleSaveProfile = useCallback(async () => {
    try {
      setIsSaving(true)
      setMessage(null)

      // Basic validation
      if (profileForm.new_password && profileForm.new_password !== profileForm.confirm_password) {
        setMessage({ type: 'error', text: 'New passwords do not match' })
        return
      }

      if (profileForm.new_password && profileForm.new_password.length < 6) {
        setMessage({ type: 'error', text: 'New password must be at least 6 characters' })
        return
      }

      // Prepare update data
      const updateData: any = {
        full_name: profileForm.full_name,
        email: profileForm.email
      }

      // Only include password fields if user wants to change password
      if (profileForm.new_password) {
        updateData.current_password = profileForm.current_password
        updateData.new_password = profileForm.new_password
      }

      // 🚀 REAL API CALL: Update user profile via backend
      // This replaces the mock/simulated call with actual functionality!
      const result = await authService.updateProfile(updateData)
      
      // 🎓 LEARNING: API Response Handling
      // ==================================
      // The backend returns both a success message and updated user data
      // We use this to update the UI immediately without reloading
      
      // Update success message from API
      setMessage({ type: 'success', text: result.message })
      
      // Update current user data if profile fields changed
      if (result.user) {
        setCurrentUser(result.user)
        // Update form with new data
        setProfileForm(prev => ({
          ...prev,
          full_name: result.user.full_name || '',
          email: result.user.email || ''
        }))
      }
      
      // Clear password fields
      setProfileForm(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }))
      
    } catch (error) {
      console.error('Failed to update profile:', error)
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }, [profileForm])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600 flex items-center justify-center">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center space-x-2 px-4 py-2 text-white bg-white/20 rounded-lg hover:bg-white/30 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-white/30"></div>
              <h1 className="text-2xl font-bold text-white">My Settings</h1>
            </div>
            
            <div className="text-right">
              <p className="text-white font-medium">
                {currentUser?.full_name || currentUser?.username}
              </p>
              <p className="text-blue-100 text-sm">
                {currentUser?.role?.name || 'User'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Profile Settings */}
          <div className="lg:col-span-2">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center space-x-3 mb-6">
                <User className="h-6 w-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
              </div>

              {/* Success/Error Messages */}
              {message && (
                <div className={`p-4 rounded-lg mb-6 ${
                  message.type === 'success' 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>

                {/* Password Change Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Lock className="h-5 w-5" />
                    <span>Change Password</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={profileForm.current_password}
                          onChange={(e) => handleInputChange('current_password', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={profileForm.new_password}
                        onChange={(e) => handleInputChange('new_password', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter new password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={profileForm.confirm_password}
                          onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={toggleConfirmPasswordVisibility}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-6">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {isSaving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Stats Sidebar */}
          <div className="space-y-6">
            {/* Account Info */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Account Info</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Username:</span>
                  <span className="font-medium">{currentUser?.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Role:</span>
                  <span className="font-medium">{currentUser?.role?.name || 'User'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Department:</span>
                  <span className="font-medium">{currentUser?.department?.name || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${currentUser?.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    {currentUser?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Usage Statistics */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center space-x-3 mb-4">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Usage This Month</h3>
              </div>
              <div className="space-y-4">
                {isUsageLoading ? (
                  <div className="text-center text-gray-500">Loading usage stats...</div>
                ) : usageError ? (
                  <div className="text-center text-red-600">{usageError}</div>
                ) : usageStats ? (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{usageStats.requests.total}</div>
                      <div className="text-sm text-gray-600">AI Requests</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-teal-600">{usageStats.tokens.total.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Tokens Used</div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-sm text-gray-600 mb-1">Favorite Provider:</div>
                      <div className="font-medium">{usageStats.favorite_provider || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Last Activity:</div>
                      <div className="font-medium text-green-600">{usageStats.last_activity || 'N/A'}</div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500">No usage data available.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Intercorp Branding Footer */}
        <div className="text-center mt-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 max-w-md mx-auto border border-white/20">
            <p className="text-white/80 text-sm">
              Powered by <span className="font-semibold">Intercorp Retail</span> & <span className="font-semibold">InDigital XP</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
