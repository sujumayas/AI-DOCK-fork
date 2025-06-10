// AI Dock Manager Service
// API service for manager functionality - communicates with /manager/* endpoints

import {
  ManagerUserListResponse,
  ManagerUserCreateRequest,
  ManagerUserUpdateRequest,
  ManagerUserFilters,
  DepartmentUserStats,
  ManagerQuotaListResponse,
  ManagerQuotaCreateRequest,
  ManagerQuotaUpdateRequest,
  ManagerQuotaFilters,
  DepartmentQuotaStats,
  QuotaResetResponse,
  DepartmentDashboardData,
  ManagerApiResponse
} from '../types/manager';
import { UserResponse } from '../types/admin';
import { QuotaResponse } from '../types/quota';

// Get the API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ManagerService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = API_BASE_URL;
  }

  /**
   * Get authentication headers with JWT token
   * 
   * Learning: Every API call needs the JWT token for authentication.
   * We store this in localStorage and include it in every request.
   * 
   * 🔧 FIX: Use the same token key as authService to avoid mismatch!
   */
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('ai-dock-token'); // Fixed: match authService key
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  /**
   * Handle API response and check for errors
   * 
   * Learning: Centralized error handling makes the service more robust
   * and provides consistent error messages across the application.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - token expired or invalid
        localStorage.removeItem('ai-dock-token'); // Fixed: match authService key
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
      
      const errorText = await response.text();
      let errorMessage = 'An error occurred';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Build query string from filters object
   * 
   * Learning: Converting TypeScript objects to URL query parameters
   * is a common pattern for API filtering and pagination.
   */
  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  // =============================================================================
  // DASHBOARD METHODS
  // =============================================================================

  /**
   * Get comprehensive dashboard data for the manager's department
   * 
   * @returns Promise resolving to complete dashboard data
   * 
   * Learning: Dashboard endpoints typically aggregate data from multiple
   * sources to provide a comprehensive overview in a single API call.
   */
  async getDepartmentDashboard(): Promise<DepartmentDashboardData> {
    const response = await fetch(`${this.apiUrl}/manager/dashboard`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<DepartmentDashboardData>(response);
  }

  // =============================================================================
  // USER MANAGEMENT METHODS
  // =============================================================================

  /**
   * Get users in the manager's department
   * 
   * @param filters - Search, pagination, and filtering options
   * @returns Promise resolving to department users with pagination
   */
  async getDepartmentUsers(filters: ManagerUserFilters = {}): Promise<ManagerUserListResponse> {
    const queryString = this.buildQueryString({
      search_query: filters.search_query,
      role_id: filters.role_id,
      is_active: filters.is_active,
      page: filters.page || 1,
      page_size: filters.page_size || 20,
      sort_by: filters.sort_by || 'created_at',
      sort_order: filters.sort_order || 'desc'
    });

    const response = await fetch(`${this.apiUrl}/manager/users${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ManagerUserListResponse>(response);
  }

  /**
   * Get a specific user from the manager's department
   * 
   * @param userId - ID of the user to retrieve
   * @returns Promise resolving to user data
   */
  async getDepartmentUser(userId: number): Promise<UserResponse> {
    const response = await fetch(`${this.apiUrl}/manager/users/${userId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<UserResponse>(response);
  }

  /**
   * Create a new user in the manager's department
   * 
   * @param userData - User creation data
   * @returns Promise resolving to created user
   */
  async createDepartmentUser(userData: ManagerUserCreateRequest): Promise<UserResponse> {
    const response = await fetch(`${this.apiUrl}/manager/users/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });

    return this.handleResponse<UserResponse>(response);
  }

  /**
   * Update a user in the manager's department
   * 
   * @param userId - ID of the user to update
   * @param userData - User update data
   * @returns Promise resolving to updated user
   */
  async updateDepartmentUser(userId: number, userData: ManagerUserUpdateRequest): Promise<UserResponse> {
    const response = await fetch(`${this.apiUrl}/manager/users/${userId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });

    return this.handleResponse<UserResponse>(response);
  }

  /**
   * Get user statistics for the manager's department
   * 
   * @returns Promise resolving to department user statistics
   */
  async getDepartmentUserStats(): Promise<DepartmentUserStats> {
    const response = await fetch(`${this.apiUrl}/manager/users/statistics`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<DepartmentUserStats>(response);
  }

  // =============================================================================
  // QUOTA MANAGEMENT METHODS
  // =============================================================================

  /**
   * Get quotas for the manager's department
   * 
   * @param filters - Filtering and pagination options
   * @returns Promise resolving to department quotas with pagination
   */
  async getDepartmentQuotas(filters: ManagerQuotaFilters = {}): Promise<ManagerQuotaListResponse> {
    const queryString = this.buildQueryString({
      quota_type: filters.quota_type,
      quota_period: filters.quota_period,
      status: filters.status,
      is_exceeded: filters.is_exceeded,
      page: filters.page || 1,
      page_size: filters.page_size || 20
    });

    const response = await fetch(`${this.apiUrl}/manager/quotas${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<ManagerQuotaListResponse>(response);
  }

  /**
   * Get quota statistics for the manager's department
   * 
   * @returns Promise resolving to department quota statistics
   */
  async getDepartmentQuotaStats(): Promise<DepartmentQuotaStats> {
    const response = await fetch(`${this.apiUrl}/manager/quotas/statistics`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<DepartmentQuotaStats>(response);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check if the current user has manager permissions
   * 
   * @returns Promise resolving to boolean indicating manager status
   */
  async checkManagerPermissions(): Promise<boolean> {
    try {
      // Try to fetch dashboard data - if successful, user is a manager
      await this.getDepartmentDashboard();
      return true;
    } catch (error) {
      // If 403 error, user is not a manager
      if (error instanceof Error && error.message.includes('403')) {
        return false;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Format currency values for display
   * 
   * @param amount - Numeric amount to format
   * @returns Formatted currency string
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format large numbers with appropriate suffixes
   * 
   * @param num - Number to format
   * @returns Formatted number string
   */
  static formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}

// Create and export a singleton instance
const managerService = new ManagerService();

// Export the instance as both named and default export
export { managerService };
export default managerService;

// Export the class for testing or custom instances
export { ManagerService };
