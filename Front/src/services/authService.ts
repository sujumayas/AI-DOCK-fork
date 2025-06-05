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

  // ✅ Check if user is currently authenticated
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    // TODO: In production, you'd also check if token is expired
    // For now, we just check if a token exists
    return true;
  }

  // 🔒 Get authorization headers for protected API calls
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
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
}

// Export a single instance that can be used throughout our app
// This is called the "singleton pattern"
export const authService = new AuthService();
