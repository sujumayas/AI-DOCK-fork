// AI Dock Manager Types
// TypeScript types for manager functionality

import { UserResponse } from './admin';
import { QuotaResponse } from './quota';

// =============================================================================
// DEPARTMENT TYPES
// =============================================================================

export interface DepartmentInfo {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

// =============================================================================
// MANAGER USER MANAGEMENT TYPES
// =============================================================================

export interface ManagerUserListResponse {
  users: UserResponse[];
  pagination: {
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  department: DepartmentInfo;
  summary: {
    total_users_in_department: number;
    users_on_current_page: number;
  };
}

export interface ManagerUserCreateRequest {
  email: string;
  username: string;
  full_name: string;
  password: string;
  role_id?: number;
  job_title?: string;
  phone_number?: string;
}

export interface ManagerUserUpdateRequest {
  full_name?: string;
  job_title?: string;
  phone_number?: string;
  role_id?: number;
  is_active?: boolean;
}

export interface DepartmentUserStats {
  department: DepartmentInfo;
  user_stats: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    recent_users: number;
    users_by_role: Array<{
      role_name: string;
      role_display_name: string;
      count: number;
    }>;
  };
  last_updated: string;
}

// =============================================================================
// MANAGER QUOTA MANAGEMENT TYPES
// =============================================================================

export interface ManagerQuotaListResponse {
  quotas: QuotaResponse[];
  pagination: {
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  department: DepartmentInfo;
  summary: {
    total_quotas: number;
    active_quotas: number;
    exceeded_quotas: number;
    near_limit_quotas: number;
    total_monthly_cost_limit: number;
    total_monthly_cost_used: number;
  };
}

export interface ManagerQuotaCreateRequest {
  quota_type: 'cost' | 'tokens' | 'requests';
  quota_period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  limit_value: number;
  name: string;
  description?: string;
  llm_config_id?: number;
  is_enforced?: boolean;
}

export interface ManagerQuotaUpdateRequest {
  limit_value?: number;
  name?: string;
  description?: string;
  is_enforced?: boolean;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface QuotaResetResponse {
  success: boolean;
  message: string;
  quota_id: number;
  quota_name: string;
  reset_at: string;
  previous_usage: number;
  new_usage: number;
  quota_status: string;
}

export interface DepartmentQuotaStats {
  department: DepartmentInfo;
  quota_stats: {
    total_quotas: number;
    active_quotas: number;
    exceeded_quotas: number;
    near_limit_quotas: number;
    total_monthly_cost_limit: number;
    total_monthly_cost_used: number;
  };
  last_updated: string;
}

// =============================================================================
// DEPARTMENT DASHBOARD TYPES
// =============================================================================

export interface DepartmentDashboardData {
  department: DepartmentInfo;
  user_stats: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    recent_users: number;
    users_by_role: Array<{
      role_name: string;
      role_display_name: string;
      count: number;
    }>;
  };
  quota_stats: {
    total_quotas: number;
    active_quotas: number;
    exceeded_quotas: number;
    near_limit_quotas: number;
    total_monthly_cost_limit: number;
    total_monthly_cost_used: number;
  };
  usage_stats: {
    period_days: number;
    total_requests: number;
    total_tokens: number;
    total_cost: number;
    avg_response_time_ms: number;
    daily_trend: Array<{
      date: string;
      requests: number;
      cost: number;
    }>;
  };
  recent_activity: Array<{
    id: number;
    user_name: string;
    user_email: string;
    llm_provider: string;
    request_type: string;
    total_tokens: number;
    estimated_cost: number;
    status: string;
    created_at: string;
  }>;
  last_updated: string;
}

// =============================================================================
// API FILTER TYPES
// =============================================================================

export interface ManagerUserFilters {
  search_query?: string;
  role_id?: number;
  is_active?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ManagerQuotaFilters {
  quota_type?: 'cost' | 'tokens' | 'requests';
  quota_period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  status?: 'active' | 'inactive' | 'suspended';
  is_exceeded?: boolean;
  page?: number;
  page_size?: number;
}

// =============================================================================
// MANAGER PERMISSION TYPES
// =============================================================================

export type ManagerPermission = 
  | 'can_view_users'
  | 'can_create_department_users'
  | 'can_edit_users'
  | 'can_manage_department_users'
  | 'can_manage_department_quotas'
  | 'can_view_department_usage'
  | 'can_reset_department_quotas';

export interface ManagerCapabilities {
  can_manage_users: boolean;
  can_create_users: boolean;
  can_edit_users: boolean;
  can_manage_quotas: boolean;
  can_view_usage: boolean;
  can_reset_quotas: boolean;
  department_id: number;
  department_name: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface ManagerApiError {
  message: string;
  code?: string;
  field?: string;
}

export interface ManagerApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ManagerApiError;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type ManagerSection = 'dashboard' | 'users' | 'quotas' | 'analytics';

export interface ManagerNavigationItem {
  id: ManagerSection;
  label: string;
  icon: string;
  description: string;
  permission_required?: ManagerPermission;
}

// =============================================================================
// FORM TYPES
// =============================================================================

export interface UserFormData {
  email: string;
  username: string;
  full_name: string;
  password?: string;
  role_id: number;
  job_title?: string;
  phone_number?: string;
  is_active: boolean;
}

export interface QuotaFormData {
  quota_type: 'cost' | 'tokens' | 'requests';
  quota_period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  limit_value: number;
  name: string;
  description?: string;
  llm_config_id?: number;
  is_enforced: boolean;
}

// =============================================================================
// COMPONENT PROPS TYPES
// =============================================================================

export interface ManagerLayoutProps {
  children: React.ReactNode;
  currentSection: ManagerSection;
  onSectionChange: (section: ManagerSection) => void;
}

export interface DepartmentSummaryProps {
  department: DepartmentInfo;
  userStats: DepartmentDashboardData['user_stats'];
  quotaStats: DepartmentDashboardData['quota_stats'];
  className?: string;
}

export interface UserManagementTableProps {
  users: UserResponse[];
  onUserEdit: (user: UserResponse) => void;
  onUserActivate: (userId: number) => void;
  onUserDeactivate: (userId: number) => void;
  loading?: boolean;
  className?: string;
}

export interface QuotaManagementTableProps {
  quotas: QuotaResponse[];
  onQuotaEdit: (quota: QuotaResponse) => void;
  onQuotaReset: (quotaId: number) => void;
  loading?: boolean;
  className?: string;
}

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

export type {
  // Re-export commonly used types for convenience
  UserResponse as ManagerUserResponse,
  QuotaResponse as ManagerQuotaResponse
};