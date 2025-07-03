import { useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'

// Types for user data
interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  role?: string;
  department?: string;
}

// 🎯 Core useAuth Hook (Internal Use Only)
// This hook is used internally by AuthContext.tsx
// Components should import useAuth from '../contexts/AuthContext' instead
// 
// This provides the core auth logic that AuthContext wraps for global state

export const useAuth = () => {
  // 📊 Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [user, setUser] = useState<User | null>(null)

  // 🔄 Handle authentication state changes from authService events
  const handleAuthStateChange = useCallback((event: CustomEvent) => {
    const { isAuthenticated: newAuthState, user: userData, reason } = event.detail;
    
    console.log('🔄 Auth state change:', { newAuthState, reason });
    
    setIsAuthenticated(newAuthState);
    
    if (newAuthState && userData) {
      setUser(userData);
    } else {
      setUser(null);
      
      // Handle different logout reasons
      if (reason === 'tokenExpired') {
        console.log('🔒 Session expired, user needs to re-authenticate');
        // Could show a toast notification here
      }
    }
  }, []);

  // 🚀 Check authentication status when hook is first used
  useEffect(() => {
    const checkAuthStatus = async () => {
      console.log('🔍 Checking authentication status...')
      
      try {
        // Use our authService to check if user has valid token
        const authenticated = authService.isAuthenticated()
        
        if (authenticated) {
          // If we have a token, try to fetch user data to verify it's valid
          console.log('🔍 Token found, verifying with backend...')
          const userData = await authService.getCurrentUser()
          
          console.log('✅ Authentication verified with user data:', userData)
          setUser(userData)
          setIsAuthenticated(true)
        } else {
          console.log('❌ No valid authentication token found')
          setIsAuthenticated(false)
          setUser(null)
        }
      } catch (error) {
        console.error('❌ Auth verification failed:', error)
        // If token exists but is invalid, authService.getCurrentUser() already clears it
        setIsAuthenticated(false)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    // Set up event listeners for auth state changes
    const authStateListener = (event: Event) => {
      handleAuthStateChange(event as CustomEvent);
    };

    window.addEventListener('authStateChanged', authStateListener);

    // Run the initial check
    checkAuthStatus()

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('authStateChanged', authStateListener);
    };
  }, [handleAuthStateChange])

  // 🎯 Login function - call this when user successfully logs in
  const login = async () => {
    console.log('🎉 User logged in successfully!')
    
    try {
      // Fetch user data after successful login
      const userData = await authService.getCurrentUser()
      setUser(userData)
      setIsAuthenticated(true)
    } catch (error) {
      console.error('❌ Failed to fetch user data after login:', error)
      // Even if user fetch fails, they're still logged in if token exists
      const stillAuthenticated = authService.isAuthenticated()
      setIsAuthenticated(stillAuthenticated)
    }
  }

  // 🚪 Logout function - call this when user wants to log out
  const logout = useCallback(() => {
    console.log('👋 User logging out...')
    
    // Clear the token from storage
    authService.logout()
    
    // Update our state (will also be updated by event listener)
    setIsAuthenticated(false)
    setUser(null)
  }, [])

  // 🔄 Check if token needs refresh
  const needsTokenRefresh = useCallback(() => {
    return authService.needsTokenRefresh()
  }, [])

  // 🔄 Update user data (for profile changes)
  const updateUser = useCallback(async (updatedUserData?: any) => {
    console.log('🔄 Updating user data...', updatedUserData)
    
    try {
      // If specific user data is provided, use it
      if (updatedUserData) {
        setUser(updatedUserData)
      } else {
        // Otherwise, fetch fresh user data from the backend
        const userData = await authService.getCurrentUser()
        setUser(userData)
      }
    } catch (error) {
      console.error('❌ Failed to update user data:', error)
    }
  }, [])

  // ⏰ Get token expiry info
  const getTokenInfo = useCallback(() => {
    return {
      timeToExpiry: authService.getTokenTimeToExpiry(),
      needsRefresh: authService.needsTokenRefresh(),
      isExpired: authService.isTokenExpired()
    }
  }, [])

  // 📤 Return all the authentication data and functions
  return {
    // State
    isAuthenticated,   // boolean: is user logged in?
    isLoading,        // boolean: are we still checking auth status?
    user,             // User | null: current user data
    
    // Functions
    login,            // function: call when user logs in
    logout,           // function: call when user logs out
    updateUser,       // function: update user data after profile changes
    
    // Token utilities
    needsTokenRefresh, // function: check if token needs refresh
    getTokenInfo,     // function: get token expiry information
  }
}

// 💡 Enhanced usage example:
// const { 
//   isAuthenticated, 
//   isLoading, 
//   user, 
//   login, 
//   logout,
//   updateUser,
//   needsTokenRefresh,
//   getTokenInfo 
// } = useAuth()
