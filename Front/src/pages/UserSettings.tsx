import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Lock, Shield, BarChart3, Save, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'
import { usageAnalyticsService } from '../services/usageAnalyticsService'
import { UnifiedTraversalButtons } from '../components/ui/UnifiedTraversalButtons'
import { UserUsageStats } from '../types/usage'

// 👤 User Settings Page - Personal Profile Management
export const UserSettings: React.FC = () => {
  const navigate = useNavigate()
  const { logout, updateUser } = useAuth()
  
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
    profile_picture_url: '',
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
          profile_picture_url: user.profile_picture_url || '',
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
        email: profileForm.email,
        profile_picture_url: profileForm.profile_picture_url
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
        // 🔄 IMMEDIATE UI UPDATE: Update global auth context
        // This makes the navigation icons update instantly!
        await updateUser(result.user)
        
        // Update form with new data
        setProfileForm(prev => ({
          ...prev,
          full_name: result.user.full_name || '',
          email: result.user.email || '',
          profile_picture_url: result.user.profile_picture_url || ''
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-blue-950">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">My Settings</h1>
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

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Profile Settings */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/10 hover:shadow-3xl transition-duration-300">
              <div className="flex items-center space-x-3 mb-6">
                <User className="h-6 w-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
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
                {/* Profile Picture Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Profile Picture
                  </label>
                  <p className="text-xs text-gray-400 mb-3">Choose an avatar for your account. This will appear in the navigation and across the app.</p>
                  <div className="flex space-x-4">
                    {/* No Picture Option (ø) */}
                    <button
                      type="button"
                      onClick={() => handleInputChange('profile_picture_url', '')}
                      className={`relative rounded-full overflow-hidden border-2 transition-all duration-200 focus:outline-none ${profileForm.profile_picture_url === '' ? 'border-blue-500 ring-2 ring-blue-400' : 'border-transparent'}`}
                      style={{ width: 64, height: 64 }}
                      aria-label="Remove profile picture"
                    >
                      <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">ø</span>
                      </div>
                      {profileForm.profile_picture_url === '' && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-7 h-7 text-blue-500 bg-white/80 rounded-full p-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </button>
                    
                    {/* Avatar Options */}
                    {['avatar1.svg','avatar2.svg','avatar3.svg','avatar4.svg','avatar5.svg','avatar6.svg'].map((avatar, idx) => {
                      const selected = profileForm.profile_picture_url === `/profile-pics/${avatar}`
                      return (
                        <button
                          key={avatar}
                          type="button"
                          onClick={() => handleInputChange('profile_picture_url', `/profile-pics/${avatar}`)}
                          className={`relative rounded-full overflow-hidden border-2 transition-all duration-200 focus:outline-none ${selected ? 'border-blue-500 ring-2 ring-blue-400' : 'border-transparent'}`}
                          style={{ width: 64, height: 64 }}
                          aria-label={`Select avatar ${idx+1}`}
                        >
                          <img
                            src={`/profile-pics/${avatar}`}
                            alt={`Avatar ${idx+1}`}
                            className="w-16 h-16 object-cover rounded-full bg-white/20"
                          />
                          {selected && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <svg className="w-7 h-7 text-blue-500 bg-white/80 rounded-full p-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-lg"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-lg"
                    placeholder="Enter your email"
                  />
                </div>

                {/* Password Change Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                    <Lock className="h-5 w-5" />
                    <span>Change Password</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={profileForm.current_password}
                          onChange={(e) => handleInputChange('current_password', e.target.value)}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-lg pr-10"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={togglePasswordVisibility}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-300" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-300" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={profileForm.new_password}
                        onChange={(e) => handleInputChange('new_password', e.target.value)}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-lg"
                        placeholder="Enter new password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={profileForm.confirm_password}
                          onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-400/50 focus:border-transparent text-white placeholder-gray-400 backdrop-blur-lg pr-10"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={toggleConfirmPasswordVisibility}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-300" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-300" />
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
                    className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] transform hover:ring-2 hover:ring-blue-400/50"
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
            <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/10 hover:shadow-3xl transition-duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-white">Account Info</h3>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Username:</span>
                  <span className="font-medium text-white">{currentUser?.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Role:</span>
                  <span className="font-medium text-white">{currentUser?.role?.name || 'User'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Department:</span>
                  <span className="font-medium text-white">{currentUser?.department?.name || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Status:</span>
                  <span className={`font-medium ${currentUser?.is_active ? 'text-green-400' : 'text-red-400'}`}>
                    {currentUser?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Usage Statistics */}
            <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/10 hover:shadow-3xl transition-duration-300">
              <div className="flex items-center space-x-3 mb-4">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-white">Usage This Month</h3>
              </div>
              <div className="space-y-4">
                {isUsageLoading ? (
                  <div className="text-center text-gray-300">Loading usage stats...</div>
                ) : usageError ? (
                  <div className="text-center text-red-400">{usageError}</div>
                ) : usageStats ? (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-300">{usageStats.requests.total}</div>
                      <div className="text-sm text-gray-300">AI Requests</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-teal-300">{usageStats.tokens.total.toLocaleString()}</div>
                      <div className="text-sm text-gray-300">Tokens Used</div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="text-sm text-gray-300 mb-1">Favorite Provider:</div>
                      <div className="font-medium">{usageStats.favorite_provider || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-300 mb-1">Last Activity:</div>
                      <div className="font-medium text-green-400">{usageStats.last_activity || 'N/A'}</div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-300">No usage data available.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Intercorp Branding Footer */}
        <div className="text-center mt-12">
          <div className="relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-3xl mx-auto border border-white/10 shadow-2xl overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 rounded-3xl pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
            <p className="text-lg text-white/90 font-medium">
              Powered by <span className="font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Intercorp Retail</span> & <span className="font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">InDigital XP</span>
            </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
