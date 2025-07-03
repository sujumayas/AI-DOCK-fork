import React, { createContext, useContext, ReactNode } from 'react'
import { useAuth as useAuthHook } from '../hooks/useAuth'

// Types for user data - keeping consistent with existing implementation
interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  profile_picture_url?: string;
  role?: string;
  department?: string;
  is_admin?: boolean;
  is_active?: boolean;
}

// Auth context interface - defines what the context provides
interface AuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  
  // Functions
  login: () => Promise<void>;
  logout: () => void;
  updateUser: (updatedUserData?: any) => Promise<void>;
  
  // Token utilities
  needsTokenRefresh: () => boolean;
  getTokenInfo: () => {
    timeToExpiry: number;
    needsRefresh: boolean;
    isExpired: boolean;
  };
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider props interface
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider Component - wraps the app and provides auth state
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use our existing useAuth hook internally
  const auth = useAuthHook()

  // The context value matches our existing useAuth interface exactly
  const contextValue: AuthContextType = {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    user: auth.user,
    login: auth.login,
    logout: auth.logout,
    updateUser: auth.updateUser,
    needsTokenRefresh: auth.needsTokenRefresh,
    getTokenInfo: auth.getTokenInfo,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

// Export the context for advanced use cases (testing, etc.)
export { AuthContext }

// 💡 How this works:
//
// 1. AuthProvider wraps the entire app and creates global auth state
// 2. It uses the existing useAuth hook internally to manage state
// 3. Components use the new useAuth from this file instead of the hook directly
// 4. All components share the same auth state instance
// 5. No more props drilling - any component can access auth state
//
// 🔄 Migration benefits:
// - Centralized state management
// - Eliminates props drilling
// - Maintains existing API compatibility
// - Single source of truth for auth state
// - Better performance (fewer re-renders)
//
// 🎯 Usage:
// 1. Wrap App with <AuthProvider>
// 2. Import useAuth from this file instead of hooks/useAuth
// 3. All existing code continues to work unchanged
