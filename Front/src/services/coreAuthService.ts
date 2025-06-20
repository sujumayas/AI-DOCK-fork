// 🔐 Core Authentication Service
// Handles login/logout/token operations and auth event management

import { LoginCredentials, LoginResponse } from '../types/auth';
import { tokenManager } from '../utils/tokenManager';

// Configuration - where our backend lives
const API_BASE_URL = 'http://localhost:8000';

class CoreAuthService {
  constructor() {
    // Initialize token manager on service creation
    tokenManager.init();
    
    // Listen for token events
    this.setupTokenEventListeners();
  }

  /**
   * Setup event listeners for token management
   */
  private setupTokenEventListeners(): void {
    // Handle token refresh needed
    window.addEventListener('tokenRefreshNeeded', () => {
      console.log('🔄 Token refresh needed, attempting refresh...');
      this.handleTokenRefresh();
    });

    // Handle token expiry
    window.addEventListener('tokenExpired', () => {
      console.log('🔒 Token expired, user needs to re-authenticate');
      this.handleTokenExpiry();
    });
  }

  /**
   * Handle token refresh attempt
   */
  private async handleTokenRefresh(): Promise<void> {
    try {
      const newToken = await tokenManager.refreshToken();
      if (newToken) {
        console.log('✅ Token refreshed successfully');
      } else {
        console.log('❌ Token refresh failed, user needs to re-login');
        this.logout();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.logout();
    }
  }

  /**
   * Handle token expiry
   */
  private handleTokenExpiry(): void {
    // Emit custom event for auth state management
    const event = new CustomEvent('authStateChanged', { 
      detail: { isAuthenticated: false, reason: 'tokenExpired' } 
    });
    window.dispatchEvent(event);
  }

  /**
   * 🎯 LOGIN: Send credentials to backend and store the token
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // 🧪 TESTING: Add delay to see loading state (remove in production)
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Send JSON request to match backend schema
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        }),
      });

      // Check if request was successful
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.detail?.message || errorData.detail || 'Login failed';
        throw new Error(errorMessage);
      }

      // Parse the successful response
      const data: LoginResponse = await response.json();
      
      // Store the JWT token using token manager
      tokenManager.setToken(data.access_token);
      
      // Emit auth state change event
      const event = new CustomEvent('authStateChanged', { 
        detail: { isAuthenticated: true, user: data.user } 
      });
      window.dispatchEvent(event);
      
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during login');
    }
  }

  /**
   * 🔑 TOKEN MANAGEMENT: Delegated to TokenManager
   */
  setToken(token: string): void {
    tokenManager.setToken(token);
  }

  getToken(): string | null {
    return tokenManager.getToken();
  }

  /**
   * 🚪 LOGOUT: Clear token and user data
   */
  logout(): void {
    tokenManager.clearToken();
    
    // Emit auth state change event
    const event = new CustomEvent('authStateChanged', { 
      detail: { isAuthenticated: false, reason: 'logout' } 
    });
    window.dispatchEvent(event);
  }

  /**
   * 🔒 Get authorization headers for protected API calls
   */
  getAuthHeaders(): HeadersInit {
    return tokenManager.getAuthHeaders();
  }

  /**
   * 🔍 Check if token is expired (delegated to TokenManager)
   */
  isTokenExpired(): boolean {
    return tokenManager.isTokenExpired();
  }

  /**
   * ✅ Enhanced authentication check with token validation
   */
  isAuthenticated(): boolean {
    return tokenManager.isAuthenticated();
  }

  /**
   * 🔄 Check if token needs refresh
   */
  needsTokenRefresh(): boolean {
    return tokenManager.needsRefresh();
  }

  /**
   * ⏰ Get time until token expiry
   */
  getTokenTimeToExpiry(): number {
    return tokenManager.getTimeToExpiry();
  }
}

// Export a single instance
export const coreAuthService = new CoreAuthService();
