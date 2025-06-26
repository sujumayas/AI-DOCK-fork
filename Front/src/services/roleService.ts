// 🔐 Role Management Service
// Frontend service for role CRUD operations and dropdown data

import { authService } from './authService';

const API_BASE_URL = 'http://localhost:8000';

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  level: number;
  is_active: boolean;
  is_system_role: boolean;
  permissions: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RoleDropdownOption {
  value: number;
  label: string;
  name: string;
}

export interface RoleCreate {
  name: string;
  display_name: string;
  description?: string;
  level: number;
  is_active: boolean;
  permissions: Record<string, any>;
}

export interface RoleUpdate {
  name?: string;
  display_name?: string;
  description?: string;
  level?: number;
  is_active?: boolean;
  permissions?: Record<string, any>;
}

export interface RoleListResponse {
  roles: Role[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

export interface RoleService {
  getAllRoles: () => Promise<Role[]>;
  getRolesForDropdown: () => Promise<RoleDropdownOption[]>;
  getRole: (roleId: number) => Promise<Role>;
  createRole: (data: RoleCreate) => Promise<Role>;
  updateRole: (id: number, data: RoleUpdate) => Promise<Role>;
  deleteRole: (id: number) => Promise<void>;
}

// =============================================================================
// API HELPER FUNCTIONS
// =============================================================================

/**
 * Get authentication headers for API requests
 * 
 * Learning: This follows the same pattern as departmentService,
 * ensuring consistent authentication across all services.
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
 * 
 * Learning: Consistent error handling makes debugging easier
 * and provides better user experience.
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
 * 
 * Learning: This abstraction reduces code duplication and ensures
 * consistent request handling across all role operations.
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
// ROLE SERVICE CLASS
// =============================================================================

class RoleServiceImpl implements RoleService {
  
  // ===========================================================================
  // BASIC CRUD OPERATIONS
  // ===========================================================================

  /**
   * Get all roles with detailed information
   * 
   * Learning: This provides complete role data for admin management
   */
  async getAllRoles(): Promise<Role[]> {
    return apiRequest<Role[]>('/admin/roles/');
  }

  /**
   * Get roles formatted for dropdown selection
   * 
   * Learning: This endpoint follows the same pattern as departments,
   * providing only the data needed for dropdown components:
   * - value: role ID for form submission
   * - label: human-readable name for display
   * - name: system name for reference
   */
  async getRolesForDropdown(): Promise<RoleDropdownOption[]> {
    return apiRequest<RoleDropdownOption[]>('/admin/roles/list');
  }

  /**
   * Get specific role by ID
   */
  async getRole(roleId: number): Promise<Role> {
    return apiRequest<Role>(`/admin/roles/${roleId}`);
  }

  /**
   * Create new role
   */
  async createRole(roleData: RoleCreate): Promise<Role> {
    return apiRequest<Role>('/admin/roles/', {
      method: 'POST',
      body: JSON.stringify(roleData),
    });
  }

  /**
   * Update existing role
   */
  async updateRole(roleId: number, roleData: RoleUpdate): Promise<Role> {
    return apiRequest<Role>(`/admin/roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(roleData),
    });
  }

  /**
   * Delete a role
   */
  async deleteRole(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/admin/roles/${id}`, {
      method: 'DELETE'
    });
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Test backend connectivity for roles
   */
  async testBackendConnection(): Promise<boolean> {
    try {
      await this.getAllRoles();
      return true;
    } catch (error) {
      console.warn('⚠️ Role service backend connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Format role level for display
   */
  formatRoleLevel(level: number): string {
    const levelNames = {
      1: 'Basic',
      2: 'Standard', 
      3: 'Advanced',
      4: 'Manager',
      5: 'Administrator'
    };
    return levelNames[level as keyof typeof levelNames] || `Level ${level}`;
  }

  /**
   * Get role hierarchy color for UI
   */
  getRoleLevelColor(level: number): string {
    if (level >= 5) return 'bg-red-500';    // Admin
    if (level >= 4) return 'bg-purple-500'; // Manager
    if (level >= 3) return 'bg-blue-500';   // Advanced
    if (level >= 2) return 'bg-green-500';  // Standard
    return 'bg-gray-500';                   // Basic
  }

  /**
   * Check if role can be deleted
   */
  canDeleteRole(role: Role): boolean {
    // System roles cannot be deleted
    return !role.is_system_role;
  }

  /**
   * Check if role can be edited
   */
  canEditRole(role: Role): boolean {
    // System roles have limited editing capabilities
    return true; // Allow editing but with restrictions in the UI
  }

  /**
   * Validate role data
   */
  validateRoleData(data: RoleCreate | RoleUpdate): string[] {
    const errors: string[] = [];
    
    if ('name' in data && data.name) {
      if (data.name.length < 2) {
        errors.push('Role name must be at least 2 characters long');
      }
      if (data.name.length > 50) {
        errors.push('Role name must be no more than 50 characters');
      }
      if (!/^[a-z][a-z0-9_]*$/.test(data.name)) {
        errors.push('Role name must start with a letter and contain only lowercase letters, numbers, and underscores');
      }
    }
    
    if ('display_name' in data && data.display_name) {
      if (data.display_name.length < 2) {
        errors.push('Display name must be at least 2 characters long');
      }
      if (data.display_name.length > 100) {
        errors.push('Display name must be no more than 100 characters');
      }
    }
    
    if ('level' in data && data.level !== undefined) {
      if (data.level < 1 || data.level > 10) {
        errors.push('Role level must be between 1 and 10');
      }
    }
    
    if ('description' in data && data.description && data.description.length > 500) {
      errors.push('Description must be no more than 500 characters');
    }
    
    return errors;
  }
}

// Export singleton instance
const roleService: RoleService = new RoleServiceImpl();
export { roleService };

// =============================================================================
// ROLE CONSTANTS AND HELPERS
// =============================================================================

/**
 * Common role names for reference
 * 
 * Learning: Having constants prevents typos and makes code more maintainable
 */
export const ROLE_NAMES = {
  ADMIN: 'admin',
  MANAGER: 'manager', 
  ANALYST: 'analyst',
  USER: 'user',
  GUEST: 'guest'
} as const;

/**
 * Default role levels
 */
export const ROLE_LEVELS = {
  GUEST: 1,
  USER: 2,
  ANALYST: 3,
  MANAGER: 4,
  ADMIN: 5
} as const;

/**
 * Get default role for new users
 */
export function getDefaultRoleLevel(): number {
  return ROLE_LEVELS.USER;
}

/**
 * Check if user can manage another role based on levels
 */
export function canManageRole(userLevel: number, targetLevel: number): boolean {
  return userLevel > targetLevel;
}
