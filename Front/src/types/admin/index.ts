// 🛡️ Admin Types
// TypeScript definitions for admin operations
// These match our FastAPI backend schemas exactly

// =============================================================================
// USER DATA TYPES
// =============================================================================

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  job_title: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_verified: boolean;
  bio: string | null;
  
  // Foreign keys
  role_id: number;
  department_id: number | null;
  
  // Related object info (populated by backend)
  role_name: string | null;
  department_name: string | null;
  
  // Timestamps
  created_at: string; // ISO date string
  updated_at: string;
  last_login_at: string | null;
  
  // Computed fields
  display_name: string | null;
  account_age_days: number | null;
}

// =============================================================================
// USER MANAGEMENT REQUESTS
// =============================================================================

export interface CreateUserRequest {
  email: string;
  username: string;
  full_name: string;
  password: string;
  role_id: number;
  department_id?: number;
  job_title?: string;
  is_active?: boolean;
  is_admin?: boolean;
  bio?: string;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  full_name?: string;
  role_id?: number;
  department_id?: number;
  job_title?: string;
  is_active?: boolean;
  is_admin?: boolean;
  bio?: string;
}

export interface UpdatePasswordRequest {
  new_password: string;
  admin_password_confirmation?: string;
}

// =============================================================================
// SEARCH AND FILTERING
// =============================================================================

export interface UserSearchFilters {
  // Text search
  search_query?: string;
  
  // Role filters
  role_id?: number;
  role_name?: string;
  
  // Department filters
  department_id?: number;
  department_name?: string;
  
  // Status filters
  is_active?: boolean;
  is_admin?: boolean;
  is_verified?: boolean;
  
  // Date filters
  created_after?: string;
  created_before?: string;
  
  // Pagination
  page?: number;
  page_size?: number;
  
  // Sorting
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: User[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

export type BulkUserAction = 
  | 'activate' 
  | 'deactivate' 
  | 'delete' 
  | 'change_role' 
  | 'change_department';

export interface BulkUserOperation {
  user_ids: number[];
  action: BulkUserAction;
  new_role_id?: number;
  new_department_id?: number;
}

export interface BulkOperationResult {
  total_requested: number;
  successful_count: number;
  failed_count: number;
  successful_user_ids: number[];
  failed_operations: Array<{
    user_id: number;
    error: string;
  }>;
  summary_message: string;
}

// =============================================================================
// STATISTICS AND DASHBOARD
// =============================================================================

export interface UserStatistics {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admin_users: number;
  verified_users: number;
  unverified_users: number;
  new_users_this_week: number;
  new_users_this_month: number;
  
  // Role and department breakdowns
  users_by_role: Record<string, number>;
  users_by_department: Record<string, number>;
  
  // Activity metrics
  recent_logins_count: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: Record<string, any>;
  error_code?: string;
}

export interface SuccessResponse {
  success: true;
  message: string;
  data?: Record<string, any>;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: Record<string, any>;
  error_code?: string;
}

// =============================================================================
// COMPONENT STATE TYPES
// =============================================================================

export interface AdminState {
  users: User[];
  loading: boolean;
  error: string | null;
  searchFilters: UserSearchFilters;
  selectedUsers: number[];
  statistics: UserStatistics | null;
}

// Form validation states
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormState<T> {
  data: T;
  errors: FormErrors;
  isSubmitting: boolean;
  isDirty: boolean;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

// For loading states in UI components
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// For modal states
export type ModalState = 'closed' | 'create' | 'edit' | 'delete' | 'bulk';

// For table sorting
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// For pagination controls
export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  page_size: number;
  total_count: number;
  has_next: boolean;
  has_previous: boolean;
}
