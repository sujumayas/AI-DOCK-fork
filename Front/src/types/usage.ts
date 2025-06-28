// 📊 Usage Analytics TypeScript Types
// Comprehensive type definitions for usage tracking and analytics data

// =============================================================================
// CORE USAGE SUMMARY TYPES
// =============================================================================

/**
 * Overall usage summary for a time period
 * 
 * Learning: This represents the main dashboard overview that shows
 * executive-level metrics like total costs, token usage, and success rates.
 */
export interface UsageSummary {
  period: TimePeriod;
  overview: UsageOverview;
  providers: ProviderStats[];
  generated_at: string;
}

export interface TimePeriod {
  start_date: string;
  end_date: string;
  days: number;
}

export interface UsageOverview {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate_percent: number;
  total_tokens: number;
  total_cost_usd: number;
  average_cost_per_request: number;
  average_response_time_ms: number;
  average_tokens_per_request: number;
}

export interface ProviderStats {
  provider: string;
  requests: RequestStats;
  tokens: TokenStats;
  cost: CostStats;
  performance: PerformanceStats;
}

export interface RequestStats {
  total: number;
  successful: number;
  success_rate: number;
}

export interface TokenStats {
  total: number;
  input?: number;
  output?: number;
}

export interface CostStats {
  total_usd: number;
  average_per_request: number;
}

export interface PerformanceStats {
  average_response_time_ms: number;
  max_response_time_ms?: number;
}

// =============================================================================
// USER USAGE ANALYTICS TYPES
// =============================================================================

/**
 * Detailed usage statistics for a specific user
 * 
 * Learning: This is used for user-specific billing and usage analysis.
 * It includes user context information along with their usage metrics.
 */
export interface UserUsageStats {
  user_id: number;
  user_info: UserInfo;
  period: TimePeriod;
  requests: RequestStats;
  tokens: DetailedTokenStats;
  cost: CostStats;
  performance: PerformanceStats;
}

export interface UserInfo {
  id: number;
  email: string;
  username: string;
  full_name: string;
  department: string | null;
  role: string;
}

export interface DetailedTokenStats {
  total: number;
  input: number;
  output: number;
}

// =============================================================================
// DEPARTMENT USAGE ANALYTICS TYPES
// =============================================================================

/**
 * Usage statistics for a department with budget analysis
 * 
 * Learning: This is crucial for department-level cost allocation
 * and quota management. It includes budget context and projections.
 */
export interface DepartmentUsageStats {
  department_id: number;
  department_info: DepartmentInfo;
  period: TimePeriod;
  requests: RequestStats;
  tokens: TokenStats;
  cost: CostStats;
  performance: PerformanceStats;
  budget_analysis: BudgetAnalysis;
}

export interface DepartmentInfo {
  id: number;
  name: string;
  code: string;
  monthly_budget: number;
  is_active: boolean;
}

export interface BudgetAnalysis {
  monthly_budget: number;
  current_spending: number;
  projected_monthly_cost: number;
  budget_utilization_percent: number;
}

// =============================================================================
// TOP USERS ANALYTICS TYPES
// =============================================================================

/**
 * Top users by various metrics (cost, tokens, requests)
 * 
 * Learning: This helps identify heavy users and usage patterns.
 * Useful for training programs and cost allocation.
 */
export interface TopUsersResponse {
  period: TimePeriod;
  top_users: TopUserStats[];
  sort_metric: TopUserMetric | string;
  limit: number;
  generated_at: string;
}

export interface TopUserStats {
  user: BasicUserInfo;
  metrics: UserMetrics;
}

export interface BasicUserInfo {
  id: number;
  email: string;
  role: string;
  department_id: number | null;
}

export interface UserMetrics {
  request_count: number;
  successful_requests: number;
  failed_requests: number;
  success_rate_percent: number;
  total_tokens: number;
  total_cost: number;
  average_response_time_ms: number;
  average_cost_per_request: number;
}

export type TopUserMetric = 'total_cost' | 'total_tokens' | 'request_count';

// =============================================================================
// RECENT LOGS TYPES
// =============================================================================

/**
 * Recent usage logs with detailed request information
 * 
 * Learning: This provides real-time visibility into individual
 * LLM interactions for debugging and monitoring.
 */
export interface RecentLogsResponse {
  logs: UsageLogEntry[];
  pagination: PaginationInfo;
  filters_applied: LogFilters;
  generated_at: string;
}

export interface UsageLogEntry {
  id: number;
  timestamp: string;
  user: LogUserInfo;
  department_id: number | null;
  llm: LLMInfo;
  usage: UsageInfo;
  performance: LogPerformanceInfo;
  request_info: RequestInfo;
  error?: ErrorInfo;
}

export interface LogUserInfo {
  id: number;
  email: string;
  role: string;
}

export interface LLMInfo {
  provider: string;
  model: string;
  config_name: string;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number | null;
}

export interface LogPerformanceInfo {
  response_time_ms: number | null;
  success: boolean;
}

export interface RequestInfo {
  messages_count: number;
  total_chars: number;
  session_id: string | null;
}

export interface ErrorInfo {
  error_type: string;
  error_message: string;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  total_count: number;
  has_more: boolean;
}

export interface LogFilters {
  user_id?: number;
  department_id?: number;
  provider?: string;
  success_only: boolean;
}

// =============================================================================
// SYSTEM HEALTH TYPES
// =============================================================================

/**
 * Usage system health monitoring
 * 
 * Learning: This helps verify that the usage tracking system
 * is working properly and data is being collected correctly.
 */
export interface UsageSystemHealth {
  status: HealthStatus;
  usage_tracking: UsageTrackingHealth;
  database: DatabaseHealth;
  system_info: SystemInfo;
  error?: string;
  checked_at: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'error';

export interface UsageTrackingHealth {
  is_active: boolean;
  logs_last_24h?: number;
  success_rate_24h?: number;
  latest_log_at?: string;
}

export interface DatabaseHealth {
  usage_log_table: string;
  can_query: boolean;
  can_aggregate: boolean;
}

export interface SystemInfo {
  logging_service: string;
  async_logging: string;
  error_fallback: string;
}

// =============================================================================
// DASHBOARD DATA TYPES
// =============================================================================

/**
 * Complete dashboard data loaded in one API call
 * 
 * Learning: This aggregates all the data needed for the main
 * usage dashboard view for better performance.
 */
export interface DashboardData {
  summary: UsageSummary;
  topUsers: TopUsersCollection;
  recentActivity: RecentLogsResponse;
  systemHealth: UsageSystemHealth;
  loadedAt: string;
}

export interface TopUsersCollection {
  byCost: TopUsersResponse;
  byTokens: TopUsersResponse;
  byRequests: TopUsersResponse;
}

// =============================================================================
// CHART DATA TYPES
// =============================================================================

/**
 * Data structures optimized for chart rendering
 * 
 * Learning: These types transform API responses into formats
 * that are easy to use with charting libraries like Recharts.
 */
export interface ProviderChartData {
  name: string;
  requests: number;
  successfulRequests: number;
  tokens: number;
  cost: number;
  avgResponseTime: number;
  successRate: number;
}

export interface TimeSeriesPoint {
  date: string;
  timestamp: number;
  requests: number;
  tokens: number;
  cost: number;
  avgResponseTime: number;
}

export interface UsageTrendData {
  daily: TimeSeriesPoint[];
  weekly: TimeSeriesPoint[];
  monthly: TimeSeriesPoint[];
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

/**
 * Types for managing dashboard UI state
 * 
 * Learning: These help manage the complex state of a data-heavy
 * dashboard interface with loading states and error handling.
 */
export interface DashboardState {
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  data: DashboardData | null;
  lastUpdated: string | null;
  selectedPeriod: number;
  selectedProvider: string | null;
  selectedMetric: TopUserMetric;
}

export interface ChartConfig {
  showProviders: boolean;
  showTrends: boolean;
  showTopUsers: boolean;
  showRecentActivity: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

// =============================================================================
// FILTER AND QUERY TYPES
// =============================================================================

/**
 * Types for filtering and querying usage data
 * 
 * Learning: These provide type safety for the various filter
 * options available in the usage analytics APIs.
 */
export interface UsageQueryParams {
  days?: number;
  limit?: number;
  offset?: number;
  metric?: TopUserMetric;
}

export interface UsageFilters {
  userId?: number;
  departmentId?: number;
  provider?: string;
  successOnly?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface SortOptions {
  field: 'cost' | 'tokens' | 'requests' | 'success_rate' | 'response_time';
  direction: 'asc' | 'desc';
}

// =============================================================================
// ANALYTICS RESULT TYPES
// =============================================================================

/**
 * Types for computed analytics and insights
 * 
 * Learning: These represent processed data that provides
 * business insights rather than raw usage statistics.
 */
export interface UsageInsights {
  costTrends: {
    currentPeriod: number;
    previousPeriod: number;
    percentChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  topSpendingDepartments: {
    department: string;
    cost: number;
    percentOfTotal: number;
  }[];
  providerEfficiency: {
    provider: string;
    costPerToken: number;
    avgResponseTime: number;
    successRate: number;
    score: number;
  }[];
  unusualActivity: {
    type: 'high_cost' | 'high_usage' | 'many_failures';
    description: string;
    value: number;
    threshold: number;
  }[];
}

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

export type {
  // Re-export key types for convenience
  UsageSummary,
  UserUsageStats,
  DepartmentUsageStats,
  TopUsersResponse,
  RecentLogsResponse,
  UsageSystemHealth,
  DashboardData,
  ProviderChartData,
  DashboardState,
  UsageFilters,
  UsageInsights
};
