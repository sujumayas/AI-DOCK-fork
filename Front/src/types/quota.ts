// 🎯 Quota Management TypeScript Types
// Complete type definitions for department quota management

// =============================================================================
// ENUMS - MATCHING BACKEND EXACTLY
// =============================================================================

/**
 * Types of quotas that can be set
 * 
 * Learning: These match the backend QuotaType enum exactly.
 * - COST: Dollar amount limits (most common for budget control)
 * - TOKENS: Token count limits (for usage control)
 * - REQUESTS: Request count limits (for rate limiting)
 */
export type QuotaType = 'cost' | 'tokens' | 'requests';

/**
 * How often quotas reset
 * 
 * Learning: Different departments need different reset cycles.
 * - DAILY: For tight control or testing
 * - WEEKLY: For project-based teams
 * - MONTHLY: Most common for budget allocation
 * - YEARLY: For annual planning
 */
export type QuotaPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Current status of a quota
 * 
 * Learning: Status helps admins understand quota health at a glance.
 */
export type QuotaStatus = 'active' | 'inactive' | 'suspended' | 'exceeded';

// =============================================================================
// CORE QUOTA INTERFACES
// =============================================================================

/**
 * Complete quota information returned by the API
 * 
 * Learning: This matches the backend QuotaResponse schema exactly.
 * All the calculated fields (usage_percentage, is_exceeded, etc.) 
 * are computed by the backend for consistency.
 */
export interface QuotaResponse {
  // Basic quota information
  id: number;
  name: string;
  description?: string;
  
  // Department and LLM configuration relationships
  department_id: number;
  department_name?: string;
  llm_config_id?: number; // null means "all providers"
  llm_config_name?: string;
  
  // Quota configuration
  quota_type: string; // 'cost', 'tokens', 'requests'
  quota_period: string; // 'daily', 'weekly', 'monthly', 'yearly'
  limit_value: number; // The maximum allowed amount
  
  // Current usage and status
  current_usage: number; // How much has been used this period
  remaining_quota: number; // How much is left
  usage_percentage: number; // Percentage used (0-100+)
  
  // Status flags
  status: string; // 'active', 'inactive', 'suspended', 'exceeded'
  is_enforced: boolean; // Whether this quota blocks requests when exceeded
  is_exceeded: boolean; // Whether current usage > limit
  is_near_limit: boolean; // Whether usage is close to limit (usually 80%+)
  
  // Time information
  period_start?: string; // When current period started (ISO date)
  period_end?: string; // When current period ends (ISO date)
  next_reset_at?: string; // When quota will next reset (ISO date)
  
  // Audit information
  created_by: string; // Email of admin who created this quota
  created_at: string; // Creation timestamp (ISO date)
  updated_at: string; // Last update timestamp (ISO date)
}

/**
 * Data needed to create a new quota
 * 
 * Learning: This matches the backend QuotaCreateRequest schema.
 * Notice how we use the raw enum types for the form data.
 */
export interface QuotaCreateRequest {
  department_id: number; // Required: which department does this apply to
  llm_config_id?: number; // Optional: specific LLM provider (null = all providers)
  quota_type: QuotaType; // Required: cost, tokens, or requests
  quota_period: QuotaPeriod; // Required: how often it resets
  limit_value: number; // Required: the actual limit amount
  name: string; // Required: human-readable name
  description?: string; // Optional: more details about the quota
  is_enforced?: boolean; // Optional: whether to block when exceeded (default: true)
}

/**
 * Data that can be updated for an existing quota
 * 
 * Learning: All fields optional for partial updates.
 * This matches the backend QuotaUpdateRequest schema.
 */
export interface QuotaUpdateRequest {
  limit_value?: number; // Update the limit amount
  name?: string; // Update the name
  description?: string; // Update the description
  is_enforced?: boolean; // Update enforcement setting
  status?: QuotaStatus; // Update the status
  quota_period?: QuotaPeriod; // Update reset period
}

// =============================================================================
// LIST AND PAGINATION TYPES
// =============================================================================

/**
 * Filters for searching and filtering quotas
 * 
 * Learning: Comprehensive filtering helps admins find specific quotas quickly.
 * This matches the backend query parameters.
 */
export interface QuotaSearchFilters {
  // Basic filters
  department_id?: number;
  llm_config_id?: number;
  quota_type?: QuotaType;
  quota_period?: QuotaPeriod;
  status?: QuotaStatus;
  is_enforced?: boolean;
  is_exceeded?: boolean;
  
  // Text search
  search?: string; // Search in names and descriptions
  
  // Pagination
  page?: number; // Page number (1-based)
  page_size?: number; // Items per page
  
  // Sorting
  sort_by?: string; // Field to sort by
  sort_order?: 'asc' | 'desc'; // Sort direction
}

/**
 * Paginated list of quotas with metadata
 * 
 * Learning: This includes both the quota data and pagination info
 * needed to build a complete UI with page navigation.
 */
export interface QuotaListResponse {
  quotas: QuotaResponse[]; // Array of quota objects
  
  // Pagination metadata
  total_count: number; // Total quotas matching filters
  page: number; // Current page number
  page_size: number; // Items per page
  total_pages: number; // Total number of pages
  has_next: boolean; // Whether there are more pages
  has_previous: boolean; // Whether there are previous pages
  
  // Summary statistics for the current filter results
  summary: {
    total_quotas: number;
    active_quotas: number;
    exceeded_quotas: number;
    near_limit_quotas: number;
    total_monthly_cost_limit: number;
    total_monthly_cost_used: number;
  };
}

// =============================================================================
// DEPARTMENT QUOTA STATUS TYPES
// =============================================================================

/**
 * Comprehensive status for all quotas in a department
 * 
 * Learning: This provides a department-focused view of quota health.
 * Useful for department managers and budget oversight.
 */
export interface DepartmentQuotaStatusResponse {
  department_id: number;
  department_name?: string;
  last_updated: string; // ISO timestamp
  
  overall_status: string; // 'healthy', 'warning', 'exceeded', 'no_quotas'
  
  // Summary counts
  total_quotas: number;
  active_quotas: number;
  exceeded_quotas: number;
  near_limit_quotas: number;
  suspended_quotas: number;
  inactive_quotas: number;
  
  // Aggregated statistics by quota type
  quotas_by_type: Record<string, {
    count: number;
    total_limit: number;
    total_usage: number;
  }>;
  
  // Individual quota details
  quotas: QuotaResponse[];
}

// =============================================================================
// QUOTA OPERATIONS TYPES
// =============================================================================

/**
 * Response from resetting a quota
 * 
 * Learning: Reset operations provide detailed feedback about what happened.
 */
export interface QuotaResetResponse {
  success: boolean;
  message: string;
  quota_id: number;
  quota_name: string;
  reset_at: string; // ISO timestamp
  previous_usage: number;
  new_usage: number;
}

/**
 * Response from bulk operations on multiple quotas
 * 
 * Learning: Bulk operations need detailed reporting so admins know
 * exactly what succeeded and what failed.
 */
export interface BulkQuotaOperationResponse {
  success: boolean; // True if ALL operations succeeded
  message: string;
  total_requested: number;
  successful_operations: number;
  failed_operations: number;
  results: Array<{
    quota_id: number;
    quota_name?: string;
    success: boolean;
    message: string;
  }>;
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

/**
 * Quota system analytics summary
 * 
 * Learning: High-level metrics help admins understand quota system health.
 */
export interface QuotaAnalyticsSummary {
  overview: {
    total_quotas: number;
    active_quotas: number;
    exceeded_quotas: number;
    health_percentage: number; // Percentage of quotas that are healthy
  };
  
  by_type: Record<string, {
    count: number;
    total_limit: number;
    total_usage: number;
    utilization_percentage: number;
  }>;
  
  by_period: Record<string, number>; // Count of quotas by reset period
  
  top_departments: Array<{
    department_name: string;
    quota_count: number;
    total_usage: number;
  }>;
  
  last_updated: string; // ISO timestamp
}

// =============================================================================
// UI HELPER TYPES
// =============================================================================

/**
 * Form state for quota creation/editing
 * 
 * Learning: Separating form state helps manage complex forms with validation.
 */
export interface QuotaFormState {
  data: QuotaCreateRequest | QuotaUpdateRequest;
  errors: QuotaFormErrors;
  isSubmitting: boolean;
  isDirty: boolean;
}

/**
 * Form validation errors
 * 
 * Learning: Field-specific errors provide better user experience.
 */
export interface QuotaFormErrors {
  department_id?: string;
  llm_config_id?: string;
  quota_type?: string;
  quota_period?: string;
  limit_value?: string;
  name?: string;
  description?: string;
  is_enforced?: string;
  submit?: string; // General form-level errors
}

/**
 * Options for quota type dropdowns
 * 
 * Learning: UI components need human-readable labels and descriptions.
 */
export interface QuotaTypeOption {
  value: QuotaType;
  label: string;
  description: string;
  icon?: string;
}

export interface QuotaPeriodOption {
  value: QuotaPeriod;
  label: string;
  description: string;
  icon?: string;
}

// =============================================================================
// DEPARTMENT AND LLM CONFIG REFERENCE TYPES
// =============================================================================

/**
 * Simplified department info for quota forms
 * 
 * Learning: We need basic department info for dropdown selections.
 * This avoids importing the full admin types in quota components.
 */
export interface DepartmentOption {
  id: number;
  name: string;
  code?: string;
  is_active: boolean;
}

/**
 * Simplified LLM config info for quota forms
 * 
 * Learning: Similar to department - just what we need for form dropdowns.
 */
export interface LLMConfigOption {
  id: number;
  name: string;
  provider: string;
  is_active: boolean;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/**
 * Custom error class for quota API operations
 * 
 * Learning: Custom errors provide better debugging and user feedback.
 */
export class QuotaApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'QuotaApiError';
  }
}

// =============================================================================
// CONSTANTS FOR UI
// =============================================================================

/**
 * Predefined quota type options for UI components
 * 
 * Learning: Centralizing UI constants makes the interface consistent.
 */
export const QUOTA_TYPE_OPTIONS: QuotaTypeOption[] = [
  {
    value: 'cost',
    label: 'Cost (USD)',
    description: 'Limit spending in dollars',
    icon: '💰'
  },
  {
    value: 'tokens',
    label: 'Tokens',
    description: 'Limit AI processing tokens',
    icon: '🎯'
  },
  {
    value: 'requests',
    label: 'Requests',
    description: 'Limit number of API calls',
    icon: '📞'
  }
];

/**
 * Predefined quota period options for UI components
 */
export const QUOTA_PERIOD_OPTIONS: QuotaPeriodOption[] = [
  {
    value: 'daily',
    label: 'Daily',
    description: 'Resets every day at midnight',
    icon: '📅'
  },
  {
    value: 'weekly',
    label: 'Weekly',
    description: 'Resets every Monday',
    icon: '📆'
  },
  {
    value: 'monthly',
    label: 'Monthly',
    description: 'Resets on the 1st of each month',
    icon: '🗓️'
  },
  {
    value: 'yearly',
    label: 'Yearly',
    description: 'Resets on January 1st',
    icon: '📋'
  }
];

// =============================================================================
// UTILITY TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a quota is exceeded
 * 
 * Learning: Type guards provide runtime type safety and better code clarity.
 */
export function isQuotaExceeded(quota: QuotaResponse): boolean {
  return quota.is_exceeded || quota.current_usage >= quota.limit_value;
}

/**
 * Type guard to check if a quota is near its limit
 */
export function isQuotaNearLimit(quota: QuotaResponse): boolean {
  return quota.is_near_limit || quota.usage_percentage >= 80;
}

/**
 * Type guard to check if a quota is healthy
 */
export function isQuotaHealthy(quota: QuotaResponse): boolean {
  return quota.status === 'active' && !isQuotaExceeded(quota) && !isQuotaNearLimit(quota);
}

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

export type {
  // Core types
  QuotaResponse,
  QuotaCreateRequest,
  QuotaUpdateRequest,
  QuotaSearchFilters,
  QuotaListResponse,
  
  // Status and analytics
  DepartmentQuotaStatusResponse,
  QuotaAnalyticsSummary,
  
  // Operations
  QuotaResetResponse,
  BulkQuotaOperationResponse,
  
  // UI helpers
  QuotaFormState,
  QuotaFormErrors,
  DepartmentOption,
  LLMConfigOption,
  
  // Utility types
  QuotaType,
  QuotaPeriod,
  QuotaStatus
};
