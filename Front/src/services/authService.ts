// 🔐 Authentication Service
// This service handles all communication with our FastAPI backend
// It's like a translator between our React app and the server

import { LoginCredentials, LoginResponse, AuthError } from '../types/auth';

// Configuration - where our backend lives
const API_BASE_URL = 'http://localhost:8000';
const TOKEN_KEY = 'ai-dock-token'; // Where we store the JWT in localStorage

class AuthService {
  // 🎯 LOGIN: Send credentials to backend and store the token
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // 🧪 TESTING: Add delay to see loading state (remove in production)
      await new Promise(resolve => setTimeout(resolve,0));
      // Send JSON request (not FormData) to match backend schema
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // Important: tell backend we're sending JSON
        },
        body: JSON.stringify({
          email: credentials.email,     // FastAPI expects 'email' (not 'username')
          password: credentials.password
        }),
      });

      // Check if request was successful
      if (!response.ok) {
        // Extract error message from response
        const errorData = await response.json();
        // Handle different error formats from FastAPI
        const errorMessage = errorData.detail?.message || errorData.detail || 'Login failed';
        throw new Error(errorMessage);
      }

      // Parse the successful response
      const data: LoginResponse = await response.json();
      
      // Store the JWT token in browser's localStorage
      // This keeps user logged in even after browser refresh
      this.setToken(data.access_token);
      
      return data;
    } catch (error) {
      // Convert any error to our standardized AuthError format
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during login');
    }
  }

  // 🔑 TOKEN MANAGEMENT: Store JWT token safely
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  // 🔑 Get stored token from localStorage
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // 🚪 LOGOUT: Clear token and user data
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    // In a real app, you might also call a logout endpoint
  }

  // This method is now replaced by the enhanced version above

  // 🔒 Get authorization headers for protected API calls
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // 🔍 Check if token is expired
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    
    try {
      // JWT tokens have 3 parts separated by dots
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) return true;
      
      // Decode the payload (middle part)
      const payload = JSON.parse(atob(tokenParts[1]));
      
      // Check if token has expiration and if it's expired
      if (payload.exp) {
        const currentTime = Date.now() / 1000; // Convert to seconds
        return payload.exp < currentTime;
      }
      
      // If no expiration, assume it's valid
      return false;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // If we can't parse it, assume it's expired
    }
  }

  // ✅ Enhanced authentication check with token validation
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    // Check if token is expired
    if (this.isTokenExpired()) {
      console.log('🔑 Token is expired, clearing it');
      this.logout(); // Clear expired token
      return false;
    }
    
    return true;
  }

  // 👤 Get current user info (from backend using stored token)
  async getCurrentUser(): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get user information');
    }

    return response.json();
  }

  // 📝 Update user profile (including password change)
  async updateProfile(updateData: {
    full_name?: string;
    email?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    // 🎓 LEARNING: Profile Update API Design
    // =====================================
    // We use PUT method for profile updates because:
    // - PUT is for updating a resource
    // - We're updating the user's profile
    // - This is a standard RESTful pattern

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      // Check if request was successful
      if (!response.ok) {
        // Extract error message from response
        const errorData = await response.json();
        const errorMessage = errorData.detail?.message || errorData.detail || 'Profile update failed';
        throw new Error(errorMessage);
      }

      // Parse and return the successful response
      return response.json();
    } catch (error) {
      // Convert any error to our standardized format
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during profile update');
    }
  }

  // 🔐 Change password only (dedicated method)
  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.detail?.message || errorData.detail || 'Password change failed';
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during password change');
    }
  }
}

// Export a single instance that can be used throughout our app
// This is called the "singleton pattern"
export const authService = new AuthService();
