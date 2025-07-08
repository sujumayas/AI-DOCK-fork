// Assistant API Client
// Core HTTP client for assistant service operations

import { authService } from '../../authService';

/**
 * Assistant API Client
 * 
 * 🎓 LEARNING: API Client Pattern
 * ==============================
 * Centralized HTTP client provides:
 * - Consistent authentication handling
 * - Shared base URL configuration
 * - Reusable request methods
 * - Error response handling
 * - Type-safe request/response
 */

const API_BASE_URL = 'https://ai-dock-fork-production.up.railway.app';

export class AssistantApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get authentication headers for API requests
   */
  private getHeaders(): HeadersInit {
    return authService.getAuthHeaders();
  }

  /**
   * Build full URL for assistant endpoints
   */
  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/assistants/${cleanEndpoint}`;
  }

  /**
   * Generic GET request method
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.buildUrl(endpoint));
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw { status: response.status, data: errorData };
    }

    return response.json();
  }

  /**
   * Generic POST request method
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw { status: response.status, data: errorData };
    }

    return response.json();
  }

  /**
   * Generic PUT request method
   */
  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw { status: response.status, data: errorData };
    }

    return response.json();
  }

  /**
   * Generic DELETE request method
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw { status: response.status, data: errorData };
    }

    return response.json();
  }
}

// Export singleton instance
export const assistantApiClient = new AssistantApiClient();
