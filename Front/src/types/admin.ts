// 🏗️ Admin Types for AI Dock
// These TypeScript interfaces define the structure of our admin data
// This helps catch errors early and makes our code more reliable

// =============================================================================
// USER TYPES
// =============================================================================

/**
 * Loading states for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Main User interface - represents a user in our system
 * 
 * Learning: This matches the User model from our FastAPI backend.
 * Keep these types in sync with backend schemas!
 */
export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  department: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  // Additional fields that the components expect
  full_name?: string; // User's full name
  role_name?: string; // User's role name  
  department_name?: string; // Department name
  role_id?: number; // Role ID for forms
  department_id?: number; // Department ID for forms
  job_title?: string; // User's job title
  bio?: string; // User biography
  profile_data?: {
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    timezone?: string;
    language_preference?: string;
  };
}

/**
 * Data needed to create a new user
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role_id: number;
  department_id?: number;
  job_title?: string;
  is_admin: boolean;
  is_active?: boolean; // Optional, defaults to true
  bio?: string;
  profile_data?: {
    phone?: string;
    timezone?: string;
    language_preference?: string;
  };
}

/**
 * Data that can be updated for an existing user
 * All fields are optional for partial updates
 */
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  full_name?: string;
  role_id?: number;
  department_id?: number;
  job_title?: string;
  is_admin?: boolean;
  is_active?: boolean;
  bio?: string;
  profile_data?: {
    phone?: string;
    avatar_url?: string;
    timezone?: string;
    language_preference?: string;
  };
}

/**
 * Password update request
 * Separate from main user update for security
 */
export interface UpdatePasswordRequest {
  new_password: string;
  confirm_password: string;
  require_password_change?: boolean; // Force user to change password on next login
}

// =============================================================================
// SEARCH AND FILTERING
// =============================================================================

/**
 * Filters for user search and listing
 * 
 * Learning: This interface supports advanced search functionality
 * like pagination, sorting, and multiple filter criteria
 */
export interface UserSearchFilters {
  // Pagination
  page?: number;
  page_size?: number;
  
  // Text search
  search_query?: string; // Searches across username, email, full_name
  
  // Specific field filters
  username?: string;
  email?: string;
  department?: string;
  is_admin?: boolean;
  is_active?: boolean;
  
  // Date range filters
  created_after?: string; // ISO date string
  created_before?: string;
  last_login_after?: string;
  last_login_before?: string;
  
  // Sorting
  sort_by?: 'id' | 'username' | 'email' | 'department' | 'created_at' | 'last_login_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Response from user list/search endpoints
 * Includes pagination metadata
 */
export interface UserListResponse {
  users: User[]; // Array of users
  total_count: number; // Total number of users
  page: number; // Current page number
  page_size: number; // Items per page
  total_pages: number; // Total number of pages
  has_next: boolean; // Whether there's a next page
  has_previous: boolean; // Whether there's a previous page
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Bulk operation types
 */
export type BulkOperationType = 
  | 'activate'
  | 'deactivate' 
  | 'delete'
  | 'update_department'
  | 'make_admin'
  | 'remove_admin';

/**
 * Bulk operation request
 * 
 * Learning: Bulk operations let admins modify multiple users at once.
 * This is much more efficient than individual operations.
 */
export interface BulkUserOperation {
  operation: BulkOperationType;
  user_ids: number[];
  data?: {
    department?: string; // For update_department operation
    [key: string]: any; // Allow other operation-specific data
  };
}

/**
 * Individual result from a bulk operation
 */
export interface BulkOperationItem {
  user_id: number;
  username: string;
  success: boolean;
  error?: string;
}

/**
 * Complete bulk operation result
 */
export interface BulkOperationResult {
  operation: BulkOperationType;
  total_requested: number;
  successful_count: number;
  failed_count: number;
  results: BulkOperationItem[];
  started_at: string;
  completed_at: string;
}

// =============================================================================
// STATISTICS AND DASHBOARD
// =============================================================================

/**
 * User statistics for admin dashboard
 * 
 * Learning: Dashboard stats help admins understand their user base.
 * These numbers are great for charts and summary cards.
 * 
 * ⚠️ IMPORTANT: This interface MUST match the backend UserStatsResponse schema!
 */
export interface UserStatistics {
  // Total counts (matches backend exactly)
  total_users: number;
  active_users: number;
  inactive_users: number;
  admin_users: number;
  verified_users: number;
  unverified_users: number;
  
  // Time-based counts
  new_users_this_week: number;
  new_users_this_month: number;
  recent_logins_count: number; // Users who logged in within last 7 days
  
  // Grouped data - backend returns as Dict[str, int]
  users_by_role: Record<string, number>; // e.g., {"admin": 5, "user": 20}
  users_by_department: Record<string, number>; // e.g., {"Engineering": 15, "Sales": 10}
}

// =============================================================================
// API RESPONSES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}

/**
 * Success response for operations that don't return data
 */
export interface SuccessResponse {
  success: true;
  message: string;
  timestamp: string;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  message: string;
  errors?: string[];
  error_code?: string;
  timestamp: string;
}

// =============================================================================
// FORM VALIDATION
// =============================================================================

/**
 * Form errors for any form field
 * Flexible type that allows string errors for any field
 */
export type FormErrors = {
  [key: string]: string | undefined;
  submit?: string; // Special field for form-level errors
};

/**
 * Generic form state for any form data type
 */
export interface FormState<T> {
  data: T;
  errors: FormErrors;
  isSubmitting: boolean;
  isDirty: boolean; // Has the form been modified?
}

/**
 * Client-side validation errors (deprecated - use FormErrors instead)
 * 
 * Learning: Good UX shows field-specific errors.
 * This interface helps organize validation feedback.
 */
export interface ValidationErrors {
  username?: string[];
  email?: string[];
  password?: string[];
  department?: string[];
  general?: string[]; // Non-field-specific errors
}

/**
 * Form state for user creation/editing
 */
export interface UserFormState {
  data: CreateUserRequest | UpdateUserRequest;
  errors: ValidationErrors;
  isSubmitting: boolean;
  isDirty: boolean; // Has the form been modified?
}

// =============================================================================
// UI HELPER TYPES
// =============================================================================

/**
 * Table column configuration
 * For building dynamic user tables
 */
export interface UserTableColumn {
  key: keyof User | 'actions';
  label: string;
  sortable: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (user: User) => React.ReactNode;
}

/**
 * Action menu item for user rows
 */
export interface UserAction {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean; // Red styling for destructive actions
  disabled?: (user: User) => boolean;
  onClick: (user: User) => void;
}

// =============================================================================
// EXPORT TYPES FOR EASY IMPORTING
// =============================================================================

// Re-export commonly used types for convenience
export type {
  // Main entities
  User as AdminUser,
  CreateUserRequest as NewUser,
  UpdateUserRequest as UserUpdate,
  
  // Lists and searches
  UserListResponse as UserList,
  UserSearchFilters as UserFilters,
  
  // Bulk operations
  BulkUserOperation as BulkOperation,
  BulkOperationResult as BulkResult,
  
  // Statistics
  UserStatistics as AdminStats,
  
  // API responses
  ApiResponse as Response,
  SuccessResponse as Success,
  ErrorResponse as Error,
};
