// 🎯 Quota Management Frontend Service
// Complete service for quota CRUD operations and analytics

import { authService } from './authService';
import {
  QuotaResponse,
  QuotaCreateRequest,
  QuotaUpdateRequest,
  QuotaSearchFilters,
  QuotaListResponse,
  DepartmentQuotaStatusResponse,
  QuotaResetResponse,
  BulkQuotaOperationResponse,
  QuotaAnalyticsSummary,
  QuotaApiError,
  DepartmentOption,
  LLMConfigOption,
  QuotaType,
  QuotaPeriod,
  QUOTA_TYPE_OPTIONS,
  QUOTA_PERIOD_OPTIONS
} from '../types/quota';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const QUOTA_API_BASE = `${API_BASE_URL}/admin/quotas`;

// =============================================================================
// HTTP CLIENT HELPER
// =============================================================================

/**
 * Make authenticated API requests to quota endpoints
 * 
 * Learning: This helper centralizes:
 * - Authentication header management
 * - Error handling and conversion
 * - Response parsing and validation
 * - Consistent logging for debugging
 */
async function quotaApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get authentication token
  const token = authService.getToken();
  if (!token) {
    throw new QuotaApiError('Authentication required. Please log in.', 401);
  }

  // Build full URL
  const url = `${QUOTA_API_BASE}${endpoint}`;

  // Set up headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  try {
    console.log(`🎯 Quota API: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle authentication errors
    if (response.status === 401) {
      authService.logout(); // Clear invalid token
      throw new QuotaApiError('Session expired. Please log in again.', 401);
    }

    if (response.status === 403) {
      throw new QuotaApiError('Access denied. Admin privileges required.', 403);
    }

    if (response.status === 404) {
      throw new QuotaApiError('Quota not found.', 404);
    }

    // Handle client errors (400-499)
    if (response.status >= 400 && response.status < 500) {
      let errorMessage = `Request failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If we can't parse error response, use the default message
      }
      throw new QuotaApiError(errorMessage, response.status);
    }

    // Handle server errors (500+)
    if (response.status >= 500) {
      throw new QuotaApiError('Server error. Please try again later.', response.status);
    }

    // Handle successful responses
    if (response.status === 204) {
      // No content (successful delete)
      return null as T;
    }

    if (!response.ok) {
      throw new QuotaApiError(`Unexpected response: ${response.statusText}`, response.status);
    }

    // Parse and return JSON response
    const data = await response.json();
    console.log(`✅ Quota API Success:`, data);
    return data;

  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof QuotaApiError) {
      console.error('❌ Quota API Error:', error.message);
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError) {
      console.error('❌ Network Error:', error);
      throw new QuotaApiError('Network error. Please check your connection.', 0);
    }

    // Handle unexpected errors
    console.error('❌ Unexpected Error:', error);
    throw new QuotaApiError(`Unexpected error: ${error.message}`, 500);
  }
}

/**
 * Build query string from search filters
 * 
 * Learning: Clean way to convert filter objects into URL parameters.
 * Handles undefined values and proper URL encoding.
 */
function buildQueryString(filters: QuotaSearchFilters): string {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  
  return params.toString();
}

// =============================================================================
// QUOTA SERVICE CLASS
// =============================================================================

/**
 * Quota Management Service
 * 
 * Learning: This service provides all the methods needed to manage quotas
 * from the frontend. It follows the same patterns as our other services:
 * 
 * - Centralized API communication
 * - Consistent error handling
 * - TypeScript type safety
 * - Helpful utility methods
 * - Good separation of concerns
 */
class QuotaService {
  
  // =============================================================================
  // QUOTA CRUD OPERATIONS
  // =============================================================================

  /**
   * Get all quotas with optional filtering and pagination
   * 
   * @param filters - Search and filter criteria
   * @returns Paginated list of quotas with metadata
   */
  async getQuotas(filters: QuotaSearchFilters = {}): Promise<QuotaListResponse> {
    console.log('📋 Fetching quotas with filters:', filters);
    
    // Set default pagination if not provided
    const searchFilters = {
      page: 1,
      page_size: 20,
      sort_by: 'name',
      sort_order: 'asc' as const,
      ...filters
    };
    
    const queryString = buildQueryString(searchFilters);
    const endpoint = queryString ? `/?${queryString}` : '/';
    
    return quotaApiRequest<QuotaListResponse>(endpoint);
  }

  /**
   * Get a specific quota by ID
   * 
   * @param quotaId - ID of the quota to retrieve
   * @returns Detailed quota information
   */
  async getQuota(quotaId: number): Promise<QuotaResponse> {
    console.log(`📄 Fetching quota ${quotaId}...`);
    return quotaApiRequest<QuotaResponse>(`/${quotaId}`);
  }

  /**
   * Create a new quota
   * 
   * @param quotaData - Quota configuration data
   * @returns The newly created quota
   */
  async createQuota(quotaData: QuotaCreateRequest): Promise<QuotaResponse> {
    console.log('➕ Creating quota:', quotaData.name);
    return quotaApiRequest<QuotaResponse>('/', {
      method: 'POST',
      body: JSON.stringify(quotaData),
    });
  }

  /**
   * Update an existing quota
   * 
   * @param quotaId - ID of quota to update
   * @param updateData - Updated quota data
   * @returns The updated quota
   */
  async updateQuota(quotaId: number, updateData: QuotaUpdateRequest): Promise<QuotaResponse> {
    console.log(`✏️ Updating quota ${quotaId}:`, updateData);
    return quotaApiRequest<QuotaResponse>(`/${quotaId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * Delete a quota permanently
   * 
   * @param quotaId - ID of quota to delete
   */
  async deleteQuota(quotaId: number): Promise<void> {
    console.log(`🗑️ Deleting quota ${quotaId}...`);
    await quotaApiRequest<void>(`/${quotaId}`, {
      method: 'DELETE',
    });
  }

  // =============================================================================
  // DEPARTMENT QUOTA STATUS
  // =============================================================================

  /**
   * Get comprehensive quota status for a specific department
   * 
   * @param departmentId - ID of the department
   * @returns Complete department quota overview
   */
  async getDepartmentQuotaStatus(departmentId: number): Promise<DepartmentQuotaStatusResponse> {
    console.log(`🏢 Fetching quota status for department ${departmentId}...`);
    return quotaApiRequest<DepartmentQuotaStatusResponse>(`/department/${departmentId}/status`);
  }

  // =============================================================================
  // QUOTA OPERATIONS
  // =============================================================================

  /**
   * Reset a quota's current usage to zero
   * 
   * @param quotaId - ID of quota to reset
   * @returns Reset operation result
   */
  async resetQuota(quotaId: number): Promise<QuotaResetResponse> {
    console.log(`🔄 Resetting quota ${quotaId}...`);
    return quotaApiRequest<QuotaResetResponse>(`/${quotaId}/reset`, {
      method: 'POST',
    });
  }

  /**
   * Reset multiple quotas at once
   * 
   * @param quotaIds - Array of quota IDs to reset
   * @returns Bulk operation result with detailed feedback
   */
  async bulkResetQuotas(quotaIds: number[]): Promise<BulkQuotaOperationResponse> {
    console.log(`🔄 Bulk resetting ${quotaIds.length} quotas...`);
    return quotaApiRequest<BulkQuotaOperationResponse>('/bulk/reset', {
      method: 'POST',
      body: JSON.stringify(quotaIds),
    });
  }

  // =============================================================================
  // ANALYTICS AND REPORTING
  // =============================================================================

  /**
   * Get overall quota system analytics
   * 
   * @returns High-level quota system statistics
   */
  async getQuotaAnalytics(): Promise<QuotaAnalyticsSummary> {
    console.log('📊 Fetching quota analytics...');
    return quotaApiRequest<QuotaAnalyticsSummary>('/analytics/summary');
  }

  // =============================================================================
  // REFERENCE DATA (DEPARTMENTS AND LLM CONFIGS)
  // =============================================================================

  /**
   * Get list of departments for quota form dropdowns
   * 
   * Learning: We reuse the admin API to get department data
   * but format it specifically for quota forms.
   */
  async getDepartments(): Promise<DepartmentOption[]> {
    try {
      console.log('🏢 Fetching departments for quota forms...');
      
      // Reuse the admin service to get departments
      // Note: This is a simplified approach - in a larger app you might have a dedicated departments service
      const response = await fetch(`${API_BASE_URL}/admin/users/search?page=1&page_size=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch departments');
      }
      
      // For now, return mock data - in a real app, you'd have a proper departments endpoint
      // This matches the pattern we'll need for the UI
      const mockDepartments: DepartmentOption[] = [
        { id: 1, name: 'Engineering', code: 'ENG', is_active: true },
        { id: 2, name: 'Marketing', code: 'MKT', is_active: true },
        { id: 3, name: 'Sales', code: 'SALES', is_active: true },
        { id: 4, name: 'HR', code: 'HR', is_active: true },
        { id: 5, name: 'Finance', code: 'FIN', is_active: true }
      ];
      
      console.log('✅ Departments loaded:', mockDepartments);
      return mockDepartments;
      
    } catch (error) {
      console.error('❌ Error fetching departments:', error);
      throw new QuotaApiError('Failed to load departments', 500);
    }
  }

  /**
   * Get list of LLM configurations for quota form dropdowns
   * 
   * Learning: We reuse the LLM config service data but transform it
   * into the simplified format needed for quota forms.
   */
  async getLLMConfigs(): Promise<LLMConfigOption[]> {
    try {
      console.log('🤖 Fetching LLM configs for quota forms...');
      
      // Call the LLM configs API directly
      const response = await fetch(`${API_BASE_URL}/admin/llm-configs/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch LLM configurations');
      }
      
      const llmConfigs = await response.json();
      
      // Transform to our simplified format
      const options: LLMConfigOption[] = llmConfigs.map((config: any) => ({
        id: config.id,
        name: config.name,
        provider: config.provider_name || config.provider,
        is_active: config.is_active
      }));
      
      console.log('✅ LLM configs loaded:', options);
      return options;
      
    } catch (error) {
      console.error('❌ Error fetching LLM configs:', error);
      // Return empty array rather than throwing - quotas can work without specific LLM configs
      console.log('ℹ️ Continuing without LLM configs - quotas can apply to all providers');
      return [];
    }
  }

  // =============================================================================
  // UTILITY AND HELPER METHODS
  // =============================================================================

  /**
   * Check if a quota name is available (not already used)
   * 
   * @param name - Quota name to check
   * @param excludeId - Exclude this quota ID from the check (for updates)
   * @returns True if name is available
   */
  async isNameAvailable(name: string, excludeId?: number): Promise<boolean> {
    try {
      const quotas = await this.getQuotas({ search: name, page_size: 100 });
      return !quotas.quotas.some(quota => 
        quota.name.toLowerCase() === name.toLowerCase() && 
        quota.id !== excludeId
      );
    } catch (error) {
      console.warn('Could not check quota name availability:', error);
      return true; // Assume available if we can't check
    }
  }

  /**
   * Get quota type options for UI dropdowns
   * 
   * @returns Array of quota type options with labels and descriptions
   */
  getQuotaTypeOptions() {
    return QUOTA_TYPE_OPTIONS;
  }

  /**
   * Get quota period options for UI dropdowns
   * 
   * @returns Array of quota period options with labels and descriptions
   */
  getQuotaPeriodOptions() {
    return QUOTA_PERIOD_OPTIONS;
  }

  /**
   * Format quota usage as a percentage string
   * 
   * @param quota - Quota object
   * @returns Formatted percentage (e.g., "75.2%")
   */
  formatUsagePercentage(quota: QuotaResponse): string {
    return `${quota.usage_percentage.toFixed(1)}%`;
  }

  /**
   * Format quota amounts based on type
   * 
   * @param amount - Numeric amount
   * @param quotaType - Type of quota
   * @returns Formatted string with appropriate units
   */
  formatQuotaAmount(amount: number, quotaType: string): string {
    switch (quotaType) {
      case 'cost':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
        }).format(amount);
      
      case 'tokens':
        return new Intl.NumberFormat('en-US').format(amount) + ' tokens';
      
      case 'requests':
        return new Intl.NumberFormat('en-US').format(amount) + ' requests';
      
      default:
        return new Intl.NumberFormat('en-US').format(amount);
    }
  }

  /**
   * Get status color for UI components
   * 
   * @param quota - Quota object
   * @returns CSS color class or color code
   */
  getStatusColor(quota: QuotaResponse): string {
    if (quota.is_exceeded) {
      return 'text-red-600'; // Exceeded - red
    } else if (quota.is_near_limit) {
      return 'text-yellow-600'; // Near limit - yellow
    } else if (quota.status === 'active') {
      return 'text-green-600'; // Healthy - green
    } else {
      return 'text-gray-500'; // Inactive/suspended - gray
    }
  }

  /**
   * Get status icon for UI components
   * 
   * @param quota - Quota object
   * @returns Unicode emoji or icon name
   */
  getStatusIcon(quota: QuotaResponse): string {
    if (quota.is_exceeded) {
      return '🚨'; // Exceeded
    } else if (quota.is_near_limit) {
      return '⚠️'; // Near limit
    } else if (quota.status === 'active') {
      return '✅'; // Healthy
    } else {
      return '⏸️'; // Inactive/suspended
    }
  }

  /**
   * Calculate days until quota reset
   * 
   * @param quota - Quota object
   * @returns Number of days until reset (or null if unknown)
   */
  getDaysUntilReset(quota: QuotaResponse): number | null {
    if (!quota.next_reset_at) {
      return null;
    }
    
    const resetDate = new Date(quota.next_reset_at);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Validate quota form data
   * 
   * @param data - Quota form data
   * @returns Array of validation errors (empty if valid)
   */
  validateQuotaData(data: Partial<QuotaCreateRequest>): string[] {
    const errors: string[] = [];

    // Required field validation
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Quota name is required');
    } else if (data.name.length > 200) {
      errors.push('Quota name must be 200 characters or less');
    }

    if (!data.department_id || data.department_id <= 0) {
      errors.push('Please select a department');
    }

    if (!data.quota_type) {
      errors.push('Please select a quota type');
    }

    if (!data.quota_period) {
      errors.push('Please select a quota period');
    }

    if (!data.limit_value || data.limit_value <= 0) {
      errors.push('Quota limit must be greater than 0');
    } else if (data.limit_value > 999999999) {
      errors.push('Quota limit is too large');
    }

    // Business logic validation
    if (data.description && data.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }

    return errors;
  }
}

// =============================================================================
// EXPORT SERVICE INSTANCE
// =============================================================================

/**
 * Global quota service instance
 * 
 * Learning: Single instance pattern ensures consistent state
 * and reduces memory usage across the application.
 */
export const quotaService = new QuotaService();

// Export types for convenience
export type {
  QuotaResponse,
  QuotaCreateRequest,
  QuotaUpdateRequest,
  QuotaSearchFilters,
  QuotaListResponse,
  DepartmentQuotaStatusResponse,
  QuotaAnalyticsSummary,
  DepartmentOption,
  LLMConfigOption,
} from '../types/quota';

// Export the service class for testing
export { QuotaService };
