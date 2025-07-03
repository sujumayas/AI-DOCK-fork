// 🔐 Authentication Service (Orchestrator)
// Provides unified API for all authentication operations
// Delegates to specialized services for better organization

import { LoginCredentials, LoginResponse } from '../types/auth';
import { coreAuthService } from './coreAuthService';
import { profileService } from './profileService';

class AuthService {
  // === CORE AUTH OPERATIONS (delegated to coreAuthService) ===
  
  /**
   * 🎯 LOGIN: Send credentials to backend and store the token
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return coreAuthService.login(credentials);
  }

  /**
   * 🔑 TOKEN MANAGEMENT: Delegated to CoreAuthService
   */
  setToken(token: string): void {
    coreAuthService.setToken(token);
  }

  getToken(): string | null {
    return coreAuthService.getToken();
  }

  /**
   * 🚪 LOGOUT: Clear token and user data
   */
  logout(): void {
    coreAuthService.logout();
  }

  /**
   * 🔒 Get authorization headers for protected API calls
   */
  getAuthHeaders(): HeadersInit {
    return coreAuthService.getAuthHeaders();
  }

  /**
   * 🔍 Check if token is expired
   */
  isTokenExpired(): boolean {
    return coreAuthService.isTokenExpired();
  }

  /**
   * ✅ Enhanced authentication check with token validation
   */
  isAuthenticated(): boolean {
    return coreAuthService.isAuthenticated();
  }

  /**
   * 🔄 Check if token needs refresh
   */
  needsTokenRefresh(): boolean {
    return coreAuthService.needsTokenRefresh();
  }

  /**
   * ⏰ Get time until token expiry
   */
  getTokenTimeToExpiry(): number {
    return coreAuthService.getTokenTimeToExpiry();
  }

  // === PROFILE OPERATIONS (delegated to profileService) ===

  /**
   * 👤 Get current user info (from backend using stored token)
   */
  async getCurrentUser(): Promise<any> {
    return profileService.getCurrentUser();
  }

  /**
   * 📝 Update user profile (including password change)
   */
  async updateProfile(updateData: {
    full_name?: string;
    email?: string;
    profile_picture_url?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<any> {
    return profileService.updateProfile(updateData);
  }

  /**
   * 🔐 Change password only (dedicated method)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    return profileService.changePassword(currentPassword, newPassword);
  }
}

// Export a single instance that can be used throughout our app
export const authService = new AuthService();
