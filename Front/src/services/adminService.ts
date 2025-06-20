// 🛡️ Admin Service
// Handles all admin API operations with the FastAPI backend
// This is our "data layer" that React components will use

import { authService } from './authService';
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UpdatePasswordRequest,
  UserSearchFilters,
  UserListResponse,
  BulkUserOperation,
  BulkOperationResult,
  ApiResponse,
  SuccessResponse,
  ErrorResponse
} from '../types/admin';

// Configuration
const API_BASE_URL = 'http://localhost:8000';

/**
 * AdminService Class
 * 
 * Learning: This service follows the "separation of concerns" principle.
 * Instead of making API calls directly in React components, we centralize
 * all admin operations here. This makes our code more maintainable and testable.
 */
class AdminService {
  
  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Get headers with admin authentication
   * 
   * Learning: Every admin API call needs the JWT token for authentication.
   * This helper method ensures consistent headers across all requests.
   */
  private getAdminHeaders(): HeadersInit {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Handle API response with proper error handling
   * 
   * Learning: Centralized error handling makes our app more robust.
   * This method converts HTTP errors into user-friendly messages.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = 'An unexpected error occurred';
      
      try {
        const errorData = await response.json();
        // Handle different error response formats
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = typeof errorData.message === 'string' ? errorData.message : JSON.stringify(errorData.message);
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } catch {
        // If we can't parse error, use HTTP status
        errorMessage = `Request failed with status ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    return response.json();
  }

  /**
   * Build query string from search filters
   * 
   * Learning: Clean way to convert filter objects into URL query parameters.
   * This handles undefined values and proper encoding.
   */
  private buildQueryString(filters: UserSearchFilters): string {
    const params = new URLSearchParams();
    
    // Add each filter parameter if it exists
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    
    return params.toString();
  }

  // =============================================================================
  // USER SEARCH AND RETRIEVAL
  // =============================================================================

  /**
   * Search users with filters and pagination
   * 
   * This is probably the most-used admin function - searching and filtering users.
   * 
   * @param filters - Search criteria and pagination settings
   * @returns Promise with paginated user list
   */
  async searchUsers(filters: UserSearchFilters = {}): Promise<UserListResponse> {
    try {
      const queryString = this.buildQueryString(filters);
      const url = `${API_BASE_URL}/admin/users/search?${queryString}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAdminHeaders(),
      });

      return this.handleResponse<UserListResponse>(response);
    } catch (error) {
      console.error('Error searching users:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to search users');
    }
  }

  /**
   * Get a specific user by ID
   * 
   * @param userId - User ID to retrieve
   * @returns Promise with user data
   */
  async getUserById(userId: number): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'GET',
        headers: this.getAdminHeaders(),
      });

      return this.handleResponse<User>(response);
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get user');
    }
  }

  /**
   * Get user by username
   * 
   * @param username - Username to search for
   * @returns Promise with user data
   */
  async getUserByUsername(username: string): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/username/${username}`, {
        method: 'GET',
        headers: this.getAdminHeaders(),
      });

      return this.handleResponse<User>(response);
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get user');
    }
  }

  /**
   * Get user by email
   * 
   * @param email - Email address to search for
   * @returns Promise with user data
   */
  async getUserByEmail(email: string): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/email/${email}`, {
        method: 'GET',
        headers: this.getAdminHeaders(),
      });

      return this.handleResponse<User>(response);
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get user');
    }
  }

  // =============================================================================
  // USER CREATION AND MODIFICATION
  // =============================================================================

  /**
   * Create a new user
   * 
   * Learning: User creation is a critical admin function that requires
   * careful validation and error handling.
   * 
   * @param userData - New user information
   * @returns Promise with created user data
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/`, {
        method: 'POST',
        headers: this.getAdminHeaders(),
        body: JSON.stringify(userData),
      });

      return this.handleResponse<User>(response);
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create user');
    }
  }

  /**
   * Update an existing user
   * 
   * @param userId - ID of user to update
   * @param userData - Updated user information
   * @returns Promise with updated user data
   */
  async updateUser(userId: number, userData: UpdateUserRequest): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: this.getAdminHeaders(),
        body: JSON.stringify(userData),
      });

      return this.handleResponse<User>(response);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update user');
    }
  }

  /**
   * Update user password
   * 
   * Learning: Password updates are separated for security reasons.
   * This allows different validation and logging.
   * 
   * @param userId - ID of user whose password to update
   * @param passwordData - New password information
   * @returns Promise with success confirmation
   */
  async updateUserPassword(userId: number, passwordData: UpdatePasswordRequest): Promise<SuccessResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/password`, {
        method: 'PUT',
        headers: this.getAdminHeaders(),
        body: JSON.stringify(passwordData),
      });

      return this.handleResponse<SuccessResponse>(response);
    } catch (error) {
      console.error('Error updating user password:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update password');
    }
  }

  // =============================================================================
  // USER ACTIVATION AND DEACTIVATION
  // =============================================================================

  /**
   * Activate a user account
   * 
   * @param userId - ID of user to activate
   * @returns Promise with updated user data
   */
  async activateUser(userId: number): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: this.getAdminHeaders(),
      });

      return this.handleResponse<User>(response);
    } catch (error) {
      console.error('Error activating user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to activate user');
    }
  }

  /**
   * Deactivate a user account
   * 
   * @param userId - ID of user to deactivate
   * @returns Promise with updated user data
   */
  async deactivateUser(userId: number): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/deactivate`, {
        method: 'POST',
        headers: this.getAdminHeaders(),
      });

      return this.handleResponse<User>(response);
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to deactivate user');
    }
  }

  /**
   * Delete a user permanently
   * 
   * ⚠️ WARNING: This cannot be undone!
   * 
   * @param userId - ID of user to delete
   * @returns Promise with success confirmation
   */
  async deleteUser(userId: number): Promise<SuccessResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: this.getAdminHeaders(),
      });

      return this.handleResponse<SuccessResponse>(response);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Perform bulk operations on multiple users
   * 
   * Learning: Bulk operations are powerful but need careful UX design.
   * Always provide detailed feedback about what succeeded and what failed.
   * 
   * @param operation - Bulk operation details
   * @returns Promise with operation results
   */
  async performBulkOperation(operation: BulkUserOperation): Promise<BulkOperationResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/bulk`, {
        method: 'POST',
        headers: this.getAdminHeaders(),
        body: JSON.stringify(operation),
      });

      return this.handleResponse<BulkOperationResult>(response);
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to perform bulk operation');
    }
  }



  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  /**
   * Get all users (convenience method with sensible defaults)
   * 
   * @param pageSize - Number of users per page (default: 50)
   * @returns Promise with user list
   */
  async getAllUsers(pageSize: number = 50): Promise<UserListResponse> {
    return this.searchUsers({
      page: 1,
      page_size: pageSize,
      sort_by: 'created_at',
      sort_order: 'desc'
    });
  }

  /**
   * Get active users only
   * 
   * @param pageSize - Number of users per page
   * @returns Promise with active user list
   */
  async getActiveUsers(pageSize: number = 50): Promise<UserListResponse> {
    return this.searchUsers({
      is_active: true,
      page: 1,
      page_size: pageSize,
      sort_by: 'last_login_at',
      sort_order: 'desc'
    });
  }

  /**
   * Get admin users only
   * 
   * @param pageSize - Number of users per page
   * @returns Promise with admin user list
   */
  async getAdminUsers(pageSize: number = 50): Promise<UserListResponse> {
    return this.searchUsers({
      is_admin: true,
      page: 1,
      page_size: pageSize,
      sort_by: 'username',
      sort_order: 'asc'
    });
  }

  /**
   * Search users by text query
   * 
   * @param query - Search term
   * @param pageSize - Number of results per page
   * @returns Promise with search results
   */
  async quickSearchUsers(query: string, pageSize: number = 20): Promise<UserListResponse> {
    return this.searchUsers({
      search_query: query,
      page: 1,
      page_size: pageSize,
      sort_by: 'username',
      sort_order: 'asc'
    });
  }

  /**
   * Get usage analytics health check
   * 
   * Learning: This connects to the usage analytics system to check its health.
   * Useful for dashboard monitoring and ensuring data is being collected.
   * 
   * @returns Promise with usage system health status
   */
  async getUsageSystemHealth(): Promise<any> {
    try {
      console.log('🏥 Checking usage system health...');
      
      const response = await fetch(`${API_BASE_URL}/admin/usage/health`, {
        method: 'GET',
        headers: this.getAdminHeaders(),
      });

      const result = await this.handleResponse<any>(response);
      console.log('✅ Usage system health checked:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error checking usage system health:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to check usage system health');
    }
  }

  /**
   * Test backend connectivity
   * 
   * Learning: This is a simple health check to verify the backend is accessible.
   * Useful for debugging connection issues.
   * 
   * @returns Promise with backend status
   */
  async testBackendConnection(): Promise<boolean> {
    try {
      console.log('🔌 Testing backend connection...');
      
      const response = await fetch(`${API_BASE_URL}/admin/users/search?page=1&page_size=1`, {
        method: 'GET',
        headers: this.getAdminHeaders(),
      });

      if (response.ok) {
        console.log('✅ Backend connection successful');
        return true;
      } else {
        console.error('❌ Backend connection failed:', response.status, response.statusText);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Backend connection error:', error);
      return false;
    }
  }

  // =============================================================================
  // VALIDATION HELPERS
  // =============================================================================

  /**
   * Validate user data before creation/update
   * 
   * Learning: Client-side validation improves UX by catching errors early.
   * But always validate on the server too for security!
   * 
   * @param userData - User data to validate
   * @returns Array of validation errors (empty if valid)
   */
  validateUserData(userData: Partial<CreateUserRequest | UpdateUserRequest>): string[] {
    const errors: string[] = [];

    // Email validation
    if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Please enter a valid email address');
    }

    // Username validation
    if (userData.username) {
      if (userData.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(userData.username)) {
        errors.push('Username can only contain letters, numbers, dots, hyphens, and underscores');
      }
    }

    // Password validation (for create operations)
    if ('password' in userData && userData.password) {
      const password = userData.password;
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }
    }

    return errors;
  }
}

// Export singleton instance
export const adminService = new AdminService();

// Export class for testing
export { AdminService };
