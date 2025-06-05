// 🔍 Authentication Debugging Utilities
// This file helps us debug authentication issues

import { authService } from '../services/authService';

export class AuthDebugger {
  
  // 🔍 Check what's in localStorage
  static checkStoredToken(): void {
    console.log('🔍 === AUTH DEBUG REPORT ===');
    
    const token = authService.getToken();
    console.log('📄 Stored token exists:', !!token);
    
    if (token) {
      console.log('📄 Token length:', token.length);
      console.log('📄 Token starts with:', token.substring(0, 20) + '...');
      
      // Try to decode JWT payload (without verification)
      try {
        const payload = this.decodeJWTPayload(token);
        console.log('📄 Token payload:', payload);
        
        if (payload.exp) {
          const expirationDate = new Date(payload.exp * 1000);
          const now = new Date();
          console.log('📄 Token expires:', expirationDate.toISOString());
          console.log('📄 Current time:', now.toISOString());
          console.log('📄 Token expired:', now > expirationDate);
        }
      } catch (error) {
        console.log('❌ Failed to decode token:', error);
      }
    }
    
    console.log('📄 Auth headers would be:', authService.getAuthHeaders());
    console.log('🔍 === END DEBUG REPORT ===');
  }
  
  // 🔓 Decode JWT payload (client-side only, for debugging)
  private static decodeJWTPayload(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Failed to decode JWT payload');
    }
  }
  
  // 🧪 Test backend authentication endpoint
  static async testAuthEndpoint(): Promise<void> {
    console.log('🧪 Testing backend authentication...');
    
    try {
      const response = await fetch('http://localhost:8000/auth/me', {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });
      
      console.log('📡 Auth test response status:', response.status);
      console.log('📡 Auth test response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Auth test successful:', userData);
      } else {
        const errorData = await response.text();
        console.log('❌ Auth test failed:', errorData);
      }
    } catch (error) {
      console.error('❌ Auth test network error:', error);
    }
  }
  
  // 🧪 Test chat configurations endpoint directly
  static async testChatConfigEndpoint(): Promise<void> {
    console.log('🧪 Testing chat configurations endpoint...');
    
    try {
      const response = await fetch('http://localhost:8000/chat/configurations', {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });
      
      console.log('📡 Chat config response status:', response.status);
      
      if (response.ok) {
        const configs = await response.json();
        console.log('✅ Chat config test successful:', configs);
      } else {
        const errorData = await response.text();
        console.log('❌ Chat config test failed:', errorData);
      }
    } catch (error) {
      console.error('❌ Chat config test network error:', error);
    }
  }
  
  // 🔄 Full debugging suite
  static async runFullDebug(): Promise<void> {
    this.checkStoredToken();
    await this.testAuthEndpoint();
    await this.testChatConfigEndpoint();
  }
}

// 🎯 How to use this debugger:
// 1. Open browser console on chat page
// 2. Import and run: AuthDebugger.runFullDebug()
// 3. Check the detailed output to see what's wrong
