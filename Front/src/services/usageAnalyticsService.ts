// 📊 Usage Analytics Service
// Frontend service for accessing usage tracking and analytics data
// This connects to the comprehensive usage APIs we already have working

import { authService } from './authService';

// Base API configuration
const API_BASE_URL = 'http://localhost:8000';

/**
 * Usage Analytics Service
 * 
 * Learning: This service provides a clean interface for fetching usage data
 * from our backend APIs. It handles authentication, error handling, and
 * data transformation for the frontend.
 * 
 * The backend already has rich analytics endpoints that we'll connect to:
 * - /admin/usage/summary - Overall usage summary
 * - /admin/usage/users/{id} - Per-user usage stats
 * - /admin/usage/departments/{id} - Per-department usage stats
 * - /admin/usage/logs/recent - Recent usage logs
 * - /admin/usage/top-users - Top users by various metrics
 * - /admin/usage/health - Usage system health
 */
class UsageAnalyticsService {

  // =============================================================================
  // AUTHENTICATION HELPER
  // =============================================================================

  /**
   * Get authorization headers for API requests
   * 
   * Learning: Every API request needs the JWT token for authentication.
   * This helper method gets the token and formats it properly.
   * Now includes validation to ensure we have a valid token.
   */
  private getAuthHeaders(): HeadersInit {
    const token = authService.getToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    if (authService.isTokenExpired()) {
      authService.logout();
      throw new Error('Authentication token has expired. Please log in again.');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Handle API response and errors consistently
   * 
   * Learning: This standardizes how we handle API responses and errors
   * across all usage analytics endpoints. Now includes automatic auth failure handling.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // If parsing JSON fails, use the default error message
      }
      
      // Handle authentication failures specifically
      if (response.status === 401 || response.status === 403) {
        console.warn('🔑 Authentication failed in usage analytics');
        
        // Check if token is expired and clear it
        if (authService.isTokenExpired()) {
          console.log('🔑 Token expired, clearing and suggesting re-login');
          authService.logout();
          errorMessage = 'Your session has expired. Please log in again.';
        } else {
          errorMessage = 'Authentication failed';
        }
      }
      
      throw new Error(errorMessage);
    }
    
    return response.json();
  }

  // =============================================================================
  // OVERALL USAGE SUMMARY
  // =============================================================================

  /**
   * Get overall usage summary for the specified period
   * 
   * This provides executive-level overview of:
   * - Total requests and success rates
   * - Token usage and costs
   * - Performance metrics
   * - Provider breakdown
   * 
   * Args:
   *   days: Number of days to analyze (default: 30)
   * 
   * Returns:
   *   Comprehensive usage summary
   */
  async getUsageSummary(days: number = 30): Promise<UsageSummary> {
    console.log(`📊 Fetching usage summary for ${days} days...`);
    
    const response = await fetch(
      `${API_BASE_URL}/admin/usage/summary?days=${days}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );
    
    const result = await this.handleResponse<UsageSummary>(response);
    console.log('✅ Usage summary loaded:', result);
    return result;
  }

  // =============================================================================
  // USER-SPECIFIC USAGE ANALYTICS
  // =============================================================================

  /**
   * Get detailed usage statistics for a specific user
   * 
   * Shows individual user's:
   * - AI usage patterns and costs
   * - Performance metrics for their requests
   * - Usage trends over time
   * 
   * Perfect for user-specific billing and analysis.
   */
  async getUserUsage(userId: number, days: number = 30): Promise<UserUsageStats> {
    console.log(`👤 Fetching usage stats for user ${userId} (${days} days)...`);
    
    const response = await fetch(
      `${API_BASE_URL}/admin/usage/users/${userId}?days=${days}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );
    
    const result = await this.handleResponse<UserUsageStats>(response);
    console.log('✅ User usage stats loaded:', result);
    return result;
  }

  // =============================================================================
  // DEPARTMENT USAGE ANALYTICS
  // =============================================================================

  /**
   * Get usage statistics for a specific department
   * 
   * Critical for:
   * - Department budget tracking
   * - Quota management
   * - Cost allocation across teams
   * - Department-level usage trends
   */
  async getDepartmentUsage(departmentId: number, days: number = 30): Promise<DepartmentUsageStats> {
    console.log(`🏢 Fetching usage stats for department ${departmentId} (${days} days)...`);
    
    const response = await fetch(
      `${API_BASE_URL}/admin/usage/departments/${departmentId}?days=${days}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );
    
    const result = await this.handleResponse<DepartmentUsageStats>(response);
    console.log('✅ Department usage stats loaded:', result);
    return result;
  }

  // =============================================================================
  // TOP USERS ANALYTICS
  // =============================================================================

  /**
   * Get top users by various usage metrics
   * 
   * Helps identify:
   * - Heavy users for cost allocation
   * - Power users for training programs
   * - Unusual usage patterns
   * - Department champions
   * 
   * Args:
   *   days: Number of days to analyze
   *   limit: Number of top users to return
   *   metric: What to sort by ('total_cost', 'total_tokens', 'request_count')
   */
  async getTopUsers(
    days: number = 30, 
    limit: number = 10, 
    metric: 'total_cost' | 'total_tokens' | 'request_count' = 'total_cost'
  ): Promise<TopUsersResponse> {
    console.log(`🏆 Fetching top ${limit} users by ${metric} (${days} days)...`);
    
    const response = await fetch(
      `${API_BASE_URL}/admin/usage/top-users?days=${days}&limit=${limit}&metric=${metric}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );
    
    const result = await this.handleResponse<TopUsersResponse>(response);
    console.log('✅ Top users loaded:', result);
    return result;
  }

  // =============================================================================
  // RECENT USAGE LOGS
  // =============================================================================

  /**
   * Get recent usage logs with filtering options
   * 
   * Provides real-time visibility into:
   * - Individual LLM requests and responses
   * - Success/failure patterns
   * - Performance issues
   * - User activity monitoring
   * 
   * Perfect for debugging and detailed analysis.
   */
  async getRecentLogs(options: {
    limit?: number;
    offset?: number;
    userId?: number;
    departmentId?: number;
    provider?: string;
    successOnly?: boolean;
  } = {}): Promise<RecentLogsResponse> {
    const {
      limit = 50,
      offset = 0,
      userId,
      departmentId,
      provider,
      successOnly = false
    } = options;
    
    console.log('📋 Fetching recent usage logs...', options);
    
    // Build query parameters
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      success_only: successOnly.toString()
    });
    
    if (userId) params.append('user_id', userId.toString());
    if (departmentId) params.append('department_id', departmentId.toString());
    if (provider) params.append('provider', provider);
    
    const response = await fetch(
      `${API_BASE_URL}/admin/usage/logs/recent?${params}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );
    
    const result = await this.handleResponse<RecentLogsResponse>(response);
    console.log('✅ Recent logs loaded:', result);
    return result;
  }

  // =============================================================================
  // SYSTEM HEALTH
  // =============================================================================

  /**
   * Check the health of the usage tracking system
   * 
   * Verifies:
   * - Usage logging is working
   * - Database connectivity
   * - Recent activity levels
   * - Data integrity
   */
  async getUsageSystemHealth(): Promise<UsageSystemHealth> {
    console.log('🏥 Checking usage system health...');
    
    const response = await fetch(
      `${API_BASE_URL}/admin/usage/health`,
      {
        method: 'GET',
        headers: this.getAuthHeaders()
      }
    );
    
    const result = await this.handleResponse<UsageSystemHealth>(response);
    console.log('✅ Usage system health checked:', result);
    return result;
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  /**
   * Get dashboard data in one call
   * 
   * This is a convenience method that fetches multiple pieces of data
   * needed for the main dashboard view. It's more efficient than making
   * separate calls for each piece.
   */
  async getDashboardData(days: number = 30): Promise<DashboardData> {
    console.log(`🎯 Loading complete dashboard data for ${days} days...`);
    
    try {
      console.log('📊 Testing API endpoints individually...');
      
      // Test each endpoint individually with better error handling
      let usageSummary, topUsersByCost, topUsersByTokens, topUsersByRequests, recentLogs, systemHealth;
      
      try {
        console.log('1. Testing usage summary...');
        usageSummary = await this.getUsageSummary(days);
        console.log('✅ Usage summary OK');
      } catch (err) {
        console.error('❌ Usage summary failed:', err);
        throw err;
      }
      
      try {
        console.log('2. Testing top users by cost...');
        topUsersByCost = await this.getTopUsers(days, 5, 'total_cost');
        console.log('✅ Top users by cost OK');
      } catch (err) {
        console.error('❌ Top users by cost failed:', err);
        throw err;
      }
      
      try {
        console.log('3. Testing top users by tokens...');
        topUsersByTokens = await this.getTopUsers(days, 5, 'total_tokens');
        console.log('✅ Top users by tokens OK');
      } catch (err) {
        console.error('❌ Top users by tokens failed:', err);
        throw err;
      }
      
      try {
        console.log('4. Testing top users by requests...');
        topUsersByRequests = await this.getTopUsers(days, 5, 'request_count');
        console.log('✅ Top users by requests OK');
      } catch (err) {
        console.error('❌ Top users by requests failed:', err);
        throw err;
      }
      
      try {
        console.log('5. Testing recent logs...');
        recentLogs = await this.getRecentLogs({ limit: 20, successOnly: false });
        console.log('✅ Recent logs OK');
      } catch (err) {
        console.error('❌ Recent logs failed:', err);
        throw err;
      }
      
      try {
        console.log('6. Testing system health...');
        systemHealth = await this.getUsageSystemHealth();
        console.log('✅ System health OK');
      } catch (err) {
        console.error('❌ System health failed:', err);
        throw err;
      }
      
      const dashboardData: DashboardData = {
        summary: usageSummary,
        topUsers: {
          byCost: topUsersByCost,
          byTokens: topUsersByTokens,
          byRequests: topUsersByRequests
        },
        recentActivity: recentLogs,
        systemHealth: systemHealth,
        loadedAt: new Date().toISOString()
      };
      
      console.log('✅ Complete dashboard data loaded successfully!');
      return dashboardData;
      
    } catch (error) {
      console.error('❌ Failed to load dashboard data:', error);
      throw new Error(`Failed to load dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get provider statistics for charts
   * 
   * Extract provider data from usage summary for easy chart consumption.
   */
  getProviderStatsFromSummary(summary: UsageSummary): ProviderChartData[] {
    return summary.providers.map(provider => ({
      name: provider.provider,
      requests: provider.requests.total,
      successfulRequests: provider.requests.successful,
      tokens: provider.tokens.total,
      cost: provider.cost.total_usd,
      avgResponseTime: provider.performance.average_response_time_ms,
      successRate: provider.requests.success_rate
    }));
  }

}

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

/**
 * Learning: TypeScript interfaces help us catch errors at compile time
 * and provide excellent autocomplete in our IDE. These match the backend
 * API response formats exactly.
 */

export interface UsageSummary {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  overview: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    success_rate_percent: number;
    total_tokens: number;
    total_cost_usd: number;
    average_cost_per_request: number;
    average_response_time_ms: number;
    average_tokens_per_request: number;
  };
  providers: ProviderStats[];
  generated_at: string;
}

export interface ProviderStats {
  provider: string;
  requests: {
    total: number;
    successful: number;
    success_rate: number;
  };
  tokens: {
    total: number;
  };
  cost: {
    total_usd: number;
    average_per_request: number;
  };
  performance: {
    average_response_time_ms: number;
  };
}

export interface UserUsageStats {
  user_id: number;
  user_info: {
    id: number;
    email: string;
    username: string;
    full_name: string;
    department: string | null;
    role: string;
  };
  period: {
    start_date: string;
    end_date: string;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
  tokens: {
    total: number;
    input: number;
    output: number;
  };
  cost: {
    total_usd: number;
    average_per_request: number;
  };
  performance: {
    average_response_time_ms: number;
    max_response_time_ms: number;
  };
}

export interface DepartmentUsageStats {
  department_id: number;
  department_info: {
    id: number;
    name: string;
    code: string;
    monthly_budget: number;
    is_active: boolean;
  };
  period: {
    start_date: string;
    end_date: string;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
  tokens: {
    total: number;
  };
  cost: {
    total_usd: number;
    average_per_request: number;
  };
  performance: {
    average_response_time_ms: number;
  };
  budget_analysis: {
    monthly_budget: number;
    current_spending: number;
    projected_monthly_cost: number;
    budget_utilization_percent: number;
  };
}

export interface TopUsersResponse {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  top_users: TopUserStats[];
  sort_metric: string;
  limit: number;
  generated_at: string;
}

export interface TopUserStats {
  user: {
    id: number;
    email: string;
    role: string;
    department_id: number | null;
  };
  metrics: {
    request_count: number;
    successful_requests: number;
    failed_requests: number;
    success_rate_percent: number;
    total_tokens: number;
    total_cost: number;
    average_response_time_ms: number;
    average_cost_per_request: number;
  };
}

export interface RecentLogsResponse {
  logs: UsageLogEntry[];
  pagination: {
    limit: number;
    offset: number;
    total_count: number;
    has_more: boolean;
  };
  filters_applied: {
    user_id?: number;
    department_id?: number;
    provider?: string;
    success_only: boolean;
  };
  generated_at: string;
}

export interface UsageLogEntry {
  id: number;
  timestamp: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
  department_id: number | null;
  llm: {
    provider: string;
    model: string;
    config_name: string;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: number | null;
  };
  performance: {
    response_time_ms: number | null;
    success: boolean;
  };
  request_info: {
    messages_count: number;
    total_chars: number;
    session_id: string | null;
  };
  error?: {
    error_type: string;
    error_message: string;
  };
}

export interface UsageSystemHealth {
  status: 'healthy' | 'degraded' | 'error';
  usage_tracking: {
    is_active: boolean;
    logs_last_24h?: number;
    success_rate_24h?: number;
    latest_log_at?: string;
  };
  database: {
    usage_log_table: string;
    can_query: boolean;
    can_aggregate: boolean;
  };
  system_info: {
    logging_service: string;
    async_logging: string;
    error_fallback: string;
  };
  error?: string;
  checked_at: string;
}

export interface DashboardData {
  summary: UsageSummary;
  topUsers: {
    byCost: TopUsersResponse;
    byTokens: TopUsersResponse;
    byRequests: TopUsersResponse;
  };
  recentActivity: RecentLogsResponse;
  systemHealth: UsageSystemHealth;
  loadedAt: string;
}

export interface ProviderChartData {
  name: string;
  requests: number;
  successfulRequests: number;
  tokens: number;
  cost: number;
  avgResponseTime: number;
  successRate: number;
}

// =============================================================================
// EXPORT SERVICE INSTANCE
// =============================================================================

// Create and export a singleton instance
// Learning: This pattern ensures we have one shared instance across the app
export const usageAnalyticsService = new UsageAnalyticsService();
