import { useState, useEffect } from 'react'
import { authService } from '../services/authService'

// Types for user data
interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  department?: string;
}

// 🎯 Custom Hook: useAuth
// This hook manages all authentication-related state and logic
// Custom hooks are functions that start with "use" and can call other hooks

export const useAuth = () => {
  // 📊 Authentication state - these track the current auth status
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [user, setUser] = useState<User | null>(null)

  // 🚀 Check authentication status when hook is first used
  useEffect(() => {
    // This function checks if user is already logged in (has valid token)
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
          console.log('❌ No authentication token found')
          setIsAuthenticated(false)
          setUser(null)
        }
      } catch (error) {
        console.error('❌ Auth verification failed:', error)
        // If token exists but is invalid, clear it
        authService.logout()
        setIsAuthenticated(false)
        setUser(null)
      } finally {
        setIsLoading(false) // We've finished checking
      }
    }

    // Run the check immediately when hook mounts
    checkAuthStatus()
  }, []) // Empty dependency array = run once on mount

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
      // Even if user fetch fails, they're still logged in
      setIsAuthenticated(true)
    }
  }

  // 🚪 Logout function - call this when user wants to log out
  const logout = () => {
    console.log('👋 User logging out...')
    
    // Clear the token from storage
    authService.logout()
    
    // Update our state
    setIsAuthenticated(false)
    setUser(null)
  }

  // 📤 Return all the authentication data and functions
  // Other components can use these by calling useAuth()
  return {
    // State
    isAuthenticated,   // boolean: is user logged in?
    isLoading,        // boolean: are we still checking auth status?
    user,             // User | null: current user data
    
    // Functions
    login,            // function: call when user logs in
    logout,           // function: call when user logs out
  }
}

// 💡 How to use this hook in a component:
// const { isAuthenticated, isLoading, user, login, logout } = useAuth()
