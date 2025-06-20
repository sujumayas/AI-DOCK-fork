// 🏢 Department Management Service
// Frontend service for department CRUD operations

import { authService } from './authService';

const API_BASE_URL = 'http://localhost:8000';

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  monthly_budget: number;
  manager_email?: string;
  location?: string;
  cost_center?: string;
  parent_id?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Computed fields
  full_path?: string;
  user_count?: number;
  monthly_usage?: number;
  budget_utilization?: number;
}

export interface DepartmentWithStats extends Department {
  user_count: number;
  admin_user_count: number;
  monthly_usage: number;
  monthly_requests: number;
  monthly_tokens: number;
  budget_utilization: number;
  full_path: string;
  children_count: number;
  last_activity_at?: string;
  active_users_today: number;
}

export interface DepartmentCreate {
  name: string;
  code: string;
  description?: string;
  monthly_budget: number;
  manager_email?: string;
  location?: string;
  cost_center?: string;
  parent_id?: number;
}

export interface DepartmentUpdate {
  name?: string;
  code?: string;
  description?: string;
  monthly_budget?: number;
  manager_email?: string;
  location?: string;
  cost_center?: string;
  parent_id?: number;
}

export interface DepartmentDropdownOption {
  value: number;
  label: string;
  code?: string;
}

export interface DepartmentSearchFilters {
  search_query?: string;
  parent_id?: number;
  min_budget?: number;
  max_budget?: number;
  min_utilization?: number;
  max_utilization?: number;
  created_after?: string;
  created_before?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface DepartmentListResponse {
  departments: DepartmentWithStats[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface DepartmentOperationResponse {
  success: boolean;
  message: string;
  department?: Department;
  affected_users?: number;
}

export interface DepartmentInitializationResponse {
  success: boolean;
  message: string;
  created_count: number;
  skipped_count: number;
  total_departments: number;
  created_departments: string[];
}

export interface DepartmentUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role_id: number;
  job_title?: string;
  last_login_at?: string;
}

export interface DepartmentService {
  getAllDepartments: () => Promise<Department[]>;
  getDepartmentsWithStats: () => Promise<DepartmentWithStats[]>;
  getDepartmentsForDropdown: () => Promise<DepartmentDropdownOption[]>;
  getDepartment: (departmentId: number) => Promise<Department>;
  createDepartment: (data: DepartmentCreate) => Promise<Department>;
  updateDepartment: (id: number, data: DepartmentUpdate) => Promise<Department>;
  deleteDepartment: (id: number) => Promise<void>;
  getDepartmentUsers: (departmentId: number) => Promise<DepartmentUser[]>;
}

// =============================================================================
// API HELPER FUNCTIONS
// =============================================================================

/**
 * Get authentication headers for API requests
 */
function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Handle API response errors
 */
async function handleApiError(response: Response): Promise<never> {
  let errorMessage = 'An unexpected error occurred';
  
  try {
    const errorData = await response.json();
    if (errorData.detail) {
      errorMessage = typeof errorData.detail === 'string' 
        ? errorData.detail 
        : errorData.detail.message || JSON.stringify(errorData.detail);
    } else if (errorData.message) {
      errorMessage = errorData.message;
    } else if (errorData.error) {
      errorMessage = errorData.error;
    }
  } catch (parseError) {
    // If we can't parse JSON, use status text
    errorMessage = response.statusText || `HTTP ${response.status} Error`;
  }
  
  console.error(`API Error (${response.status}):`, errorMessage);
  throw new Error(errorMessage);
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: getAuthHeaders(),
    ...options,
  };
  
  console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      await handleApiError(response);
    }
    
    const data = await response.json();
    console.log(`✅ API Response: ${options.method || 'GET'} ${url}`, data);
    return data;
  } catch (error) {
    console.error(`❌ API Request failed: ${options.method || 'GET'} ${url}`, error);
    throw error;
  }
}

// =============================================================================
// DEPARTMENT SERVICE CLASS
// =============================================================================

class DepartmentServiceImpl implements DepartmentService {
  
  // ===========================================================================
  // BASIC CRUD OPERATIONS
  // ===========================================================================

  /**
   * Get all departments
   */
  async getAllDepartments(): Promise<Department[]> {
    return apiRequest<Department[]>('/admin/departments/');
  }

  /**
   * Get departments with statistics
   */
  async getDepartmentsWithStats(): Promise<DepartmentWithStats[]> {
    return apiRequest<DepartmentWithStats[]>('/admin/departments/with-stats');
  }

  /**
   * Get departments for dropdown selection
   */
  async getDepartmentsForDropdown(): Promise<DepartmentDropdownOption[]> {
    return apiRequest<DepartmentDropdownOption[]>('/admin/departments/list');
  }

  /**
   * Get specific department by ID
   */
  async getDepartment(departmentId: number): Promise<Department> {
    return apiRequest<Department>(`/admin/departments/${departmentId}`);
  }

  /**
   * Create new department
   */
  async createDepartment(departmentData: DepartmentCreate): Promise<Department> {
    return apiRequest<Department>('/admin/departments/', {
      method: 'POST',
      body: JSON.stringify(departmentData),
    });
  }

  /**
   * Update existing department
   */
  async updateDepartment(
    departmentId: number, 
    departmentData: DepartmentUpdate
  ): Promise<Department> {
    return apiRequest<Department>(`/admin/departments/${departmentId}`, {
      method: 'PUT',
      body: JSON.stringify(departmentData),
    });
  }

  /**
   * Delete a department
   */
  async deleteDepartment(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/admin/departments/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get users of a specific department
   */
  async getDepartmentUsers(departmentId: number): Promise<DepartmentUser[]> {
    return apiRequest<DepartmentUser[]>(`/admin/departments/${departmentId}/users`);
  }

  // ===========================================================================
  // SPECIALIZED OPERATIONS
  // ===========================================================================

  /**
   * Initialize default departments
   */
  async initializeDefaultDepartments(): Promise<DepartmentInitializationResponse> {
    return apiRequest<DepartmentInitializationResponse>(
      '/admin/departments/initialize-defaults',
      { method: 'POST' }
    );
  }

  /**
   * Update department budget
   */
  async updateDepartmentBudget(
    departmentId: number, 
    newBudget: number,
    reason?: string
  ): Promise<Department> {
    return apiRequest<Department>(`/admin/departments/${departmentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        monthly_budget: newBudget,
        reason: reason
      }),
    });
  }

  /**
   * Activate department
   */
  async activateDepartment(departmentId: number): Promise<Department> {
    return apiRequest<Department>(`/admin/departments/${departmentId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: true }),
    });
  }

  /**
   * Deactivate department
   */
  async deactivateDepartment(departmentId: number): Promise<Department> {
    return apiRequest<Department>(`/admin/departments/${departmentId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: false }),
    });
  }

  // ===========================================================================
  // SEARCH AND FILTERING
  // ===========================================================================

  /**
   * Search departments with filters
   */
  async searchDepartments(filters: DepartmentSearchFilters = {}): Promise<DepartmentListResponse> {
    const queryParams = new URLSearchParams();
    
    // Add filter parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = queryString 
      ? `/admin/departments/search?${queryString}`
      : '/admin/departments/search';
    
    return apiRequest<DepartmentListResponse>(endpoint);
  }

  // ===========================================================================
  // BULK OPERATIONS
  // ===========================================================================

  /**
   * Bulk activate departments
   */
  async bulkActivateDepartments(departmentIds: number[]): Promise<DepartmentOperationResponse> {
    return apiRequest<DepartmentOperationResponse>('/admin/departments/bulk', {
      method: 'POST',
      body: JSON.stringify({
        department_ids: departmentIds,
        action: 'activate'
      }),
    });
  }

  /**
   * Bulk deactivate departments
   */
  async bulkDeactivateDepartments(departmentIds: number[]): Promise<DepartmentOperationResponse> {
    return apiRequest<DepartmentOperationResponse>('/admin/departments/bulk', {
      method: 'POST',
      body: JSON.stringify({
        department_ids: departmentIds,
        action: 'deactivate'
      }),
    });
  }

  /**
   * Bulk delete departments
   */
  async bulkDeleteDepartments(departmentIds: number[]): Promise<DepartmentOperationResponse> {
    return apiRequest<DepartmentOperationResponse>('/admin/departments/bulk', {
      method: 'POST',
      body: JSON.stringify({
        department_ids: departmentIds,
        action: 'delete'
      }),
    });
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Test backend connectivity for departments
   */
  async testBackendConnection(): Promise<boolean> {
    try {
      await this.getAllDepartments();
      return true;
    } catch (error) {
      console.warn('⚠️ Department service backend connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Format budget for display
   */
  formatBudget(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Format budget utilization percentage
   */
  formatUtilization(utilization: number): string {
    return `${Math.round(utilization * 100) / 100}%`;
  }

  /**
   * Get budget utilization color
   */
  getBudgetUtilizationColor(utilization: number): string {
    if (utilization >= 90) return 'bg-red-500';
    if (utilization >= 75) return 'bg-yellow-500';
    if (utilization >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  }

  /**
   * Validate department data
   */
  validateDepartmentData(data: DepartmentCreate | DepartmentUpdate): string[] {
    const errors: string[] = [];
    
    if ('name' in data && data.name) {
      if (data.name.length < 2) {
        errors.push('Department name must be at least 2 characters long');
      }
      if (data.name.length > 100) {
        errors.push('Department name must be no more than 100 characters');
      }
    }
    
    if ('code' in data && data.code) {
      if (data.code.length < 2) {
        errors.push('Department code must be at least 2 characters long');
      }
      if (data.code.length > 10) {
        errors.push('Department code must be no more than 10 characters');
      }
      if (!/^[A-Z0-9]+$/.test(data.code.toUpperCase())) {
        errors.push('Department code can only contain letters and numbers');
      }
    }
    
    if ('monthly_budget' in data && data.monthly_budget !== undefined) {
      if (data.monthly_budget < 0) {
        errors.push('Monthly budget cannot be negative');
      }
      if (data.monthly_budget > 999999.99) {
        errors.push('Monthly budget cannot exceed $999,999.99');
      }
    }
    
    if ('manager_email' in data && data.manager_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.manager_email)) {
        errors.push('Manager email must be a valid email address');
      }
    }
    
    return errors;
  }
}

// Export singleton instance
const departmentService: DepartmentService = new DepartmentServiceImpl();
export { departmentService };
