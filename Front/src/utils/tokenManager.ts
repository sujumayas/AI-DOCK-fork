// 🔑 Token Manager Utility
// Centralized token management with automatic refresh capabilities
// Extracted from authService.ts for better separation of concerns

const TOKEN_KEY = 'ai-dock-token';
const REFRESH_THRESHOLD = 5 * 60; // Refresh token 5 minutes before expiry

export interface TokenPayload {
  exp: number;
  sub: string;
  iat: number;
  user_id: number;
  email: string;
  role?: string;
}

export class TokenManager {
  private refreshTimer: NodeJS.Timeout | null = null;

  /**
   * Store JWT token in localStorage
   */
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.scheduleRefresh(token);
  }

  /**
   * Get stored token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Clear token from storage and cancel refresh timer
   */
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.cancelRefreshTimer();
  }

  /**
   * Decode JWT token payload
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) return null;
      
      const payload = JSON.parse(atob(tokenParts[1]));
      return payload as TokenPayload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token?: string): boolean {
    const tokenToCheck = token || this.getToken();
    if (!tokenToCheck) return true;
    
    const payload = this.decodeToken(tokenToCheck);
    if (!payload || !payload.exp) return true;
    
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  }

  /**
   * Check if token needs refresh (within threshold)
   */
  needsRefresh(token?: string): boolean {
    const tokenToCheck = token || this.getToken();
    if (!tokenToCheck) return false;
    
    const payload = this.decodeToken(tokenToCheck);
    if (!payload || !payload.exp) return false;
    
    const currentTime = Date.now() / 1000;
    return (payload.exp - currentTime) <= REFRESH_THRESHOLD;
  }

  /**
   * Get time until token expiry in seconds
   */
  getTimeToExpiry(token?: string): number {
    const tokenToCheck = token || this.getToken();
    if (!tokenToCheck) return 0;
    
    const payload = this.decodeToken(tokenToCheck);
    if (!payload || !payload.exp) return 0;
    
    const currentTime = Date.now() / 1000;
    return Math.max(0, payload.exp - currentTime);
  }

  /**
   * Get authorization headers for API requests
   */
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Check if user is authenticated with valid token
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    if (this.isTokenExpired(token)) {
      console.log('🔑 Token is expired, clearing it');
      this.clearToken();
      return false;
    }
    
    return true;
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleRefresh(token: string): void {
    this.cancelRefreshTimer();
    
    const timeToRefresh = this.getTimeToExpiry(token) - REFRESH_THRESHOLD;
    
    if (timeToRefresh > 0) {
      console.log(`🔄 Token refresh scheduled in ${Math.round(timeToRefresh / 60)} minutes`);
      
      this.refreshTimer = setTimeout(() => {
        this.handleTokenRefresh();
      }, timeToRefresh * 1000);
    }
  }

  /**
   * Cancel refresh timer
   */
  private cancelRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Handle automatic token refresh
   */
  private async handleTokenRefresh(): Promise<void> {
    try {
      console.log('🔄 Attempting automatic token refresh...');
      
      // This will be implemented when we have refresh endpoint
      // For now, we'll emit an event that can be handled by auth context
      const event = new CustomEvent('tokenRefreshNeeded');
      window.dispatchEvent(event);
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      this.clearToken();
      
      // Emit logout event
      const event = new CustomEvent('tokenExpired');
      window.dispatchEvent(event);
    }
  }

  /**
   * Refresh token using refresh endpoint (when available)
   */
  async refreshToken(): Promise<string | null> {
    // This method will be implemented when backend supports refresh tokens
    // For now, it's a placeholder for future enhancement
    
    const token = this.getToken();
    if (!token) return null;
    
    try {
      // TODO: Implement refresh endpoint call when backend supports it
      // const response = await fetch('/auth/refresh', {
      //   method: 'POST',
      //   headers: this.getAuthHeaders()
      // });
      // 
      // if (!response.ok) throw new Error('Refresh failed');
      // 
      // const data = await response.json();
      // this.setToken(data.access_token);
      // return data.access_token;
      
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearToken();
      return null;
    }
  }

  /**
   * Initialize token manager (check existing token and schedule refresh)
   */
  init(): void {
    const token = this.getToken();
    if (token && !this.isTokenExpired(token)) {
      this.scheduleRefresh(token);
    } else if (token) {
      // Clear expired token
      this.clearToken();
    }
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();
