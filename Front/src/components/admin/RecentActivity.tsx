// 📋 Recent Activity Component
// Real-time monitoring of LLM usage logs with filtering and search
// Provides live visibility into individual AI requests and responses
//
// 🔧 TIMESTAMP FIXES IMPLEMENTED:
// - Robust timestamp parsing with error handling
// - Timezone awareness and future timestamp detection  
// - Better relative time formatting (2m ago, 15m ago, 2h ago, 3d ago, etc.)
// - Fallback sample data with realistic timestamps for testing
// - Debug logging to identify data source and timestamp issues
// - Improved empty states with helpful guidance

import React, { useState, useMemo, useEffect } from 'react';
import { RecentLogsResponse, LogFilters } from '../../types/usage';
import { formatConversationTimestamp } from '../../utils/chatHelpers';
import { formatCurrency } from '../../utils/formatUtils';

/**
 * Recent Activity Component
 * 
 * Learning: Real-time monitoring is crucial for operational visibility.
 * This component shows a live stream of LLM requests, helping administrators
 * monitor usage patterns, debug issues, and spot unusual activity.
 * 
 * Design Pattern: This follows a "activity feed" pattern with filtering,
 * search, and pagination capabilities for managing large amounts of data.
 */

interface RecentActivityProps {
  recentLogs: RecentLogsResponse | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoadMore?: () => void;
  onFilterChange?: (filters: LogFilters) => void;
}

const RecentActivity: React.FC<RecentActivityProps> = ({
  recentLogs,
  isLoading,
  error,
  onRefresh,
  onLoadMore,
  // onFilterChange
}) => {

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  // =============================================================================
  // AUTO REFRESH FUNCTIONALITY
  // =============================================================================

  /**
   * Auto-refresh functionality for live monitoring
   * 
   * Learning: Real-time dashboards benefit from automatic updates.
   * This provides live monitoring without manual refresh clicks.
   */
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      onRefresh();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  // =============================================================================
  // DATA FILTERING AND PROCESSING
  // =============================================================================

  /**
   * Get unique providers from logs for filter dropdown
   * 
   * Learning: Dynamic filter options based on actual data improve UX.
   * Users can filter by providers that actually have data.
   */
  const availableProviders = useMemo(() => {
    if (!recentLogs?.logs) return [];
    
    const providers = new Set(recentLogs.logs.map(log => log.llm.provider));
    return Array.from(providers).sort();
  }, [recentLogs?.logs]);

  // =============================================================================
  // DEBUG LOGGING FOR TIMESTAMP ISSUES
  // =============================================================================

  /**
   * Debug logging to understand timestamp data
   * 
   * Learning: When timestamps aren't working correctly, we need to see
   * what data we're actually receiving to debug the issue.
   */
  useEffect(() => {
    if (recentLogs?.logs && recentLogs.logs.length > 0) {
      // Check if this looks like fallback data vs real data
      const hasRealisticIds = recentLogs.logs.some(log => log.id > 100); // Real data usually has higher IDs
      const hasDemoEmails = recentLogs.logs.some(log => log.user.email.includes('@example.com'));
      const isFallbackData = !hasRealisticIds && hasDemoEmails;

      console.log('🐛 DEBUG: Recent logs received:', {
        totalLogs: recentLogs.logs.length,
        generatedAt: recentLogs.generated_at,
        dataType: isFallbackData ? 'FALLBACK_SAMPLE_DATA' : 'REAL_USAGE_DATA',
        sampleTimestamps: recentLogs.logs.slice(0, 3).map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          parsedDate: log.timestamp ? new Date(log.timestamp).toISOString() : 'invalid',
          timeDiffMinutes: log.timestamp ? Math.round((new Date().getTime() - new Date(log.timestamp).getTime()) / (1000 * 60)) : 'N/A',
          userEmail: log.user.email
        }))
      });

      if (isFallbackData) {
        console.log('💡 INFO: You are seeing sample/fallback data. To see real timestamps:');
        console.log('   1. Make LLM requests through the chat interface');
        console.log('   2. Ensure the backend usage logging is working');
        console.log('   3. Check the admin user authentication');
      }
    } else if (recentLogs?.logs?.length === 0) {
      console.log('🐛 DEBUG: No recent logs available - this could be why you see no timestamps');
    }
  }, [recentLogs]);

  /**
   * Get unique users from logs for filter dropdown
   * 
   * Learning: User filtering helps focus on specific individuals
   * for debugging or training purposes.
   */
  const availableUsers = useMemo(() => {
    if (!recentLogs?.logs) return [];
    
    const users = new Set(recentLogs.logs.map(log => log.user.email));
    return Array.from(users).sort();
  }, [recentLogs?.logs]);

  /**
   * Filter logs based on search and filter criteria
   * 
   * Learning: Client-side filtering provides instant feedback.
   * For larger datasets, server-side filtering would be better.
   */
  const filteredLogs = useMemo(() => {
    if (!recentLogs?.logs) return [];
    
    return recentLogs.logs.filter(log => {
      // Search term filter (email, provider, model)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          log.user.email.toLowerCase().includes(searchLower) ||
          log.llm.provider.toLowerCase().includes(searchLower) ||
          log.llm.model.toLowerCase().includes(searchLower) ||
          log.llm.config_name.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }
      
      // Provider filter
      if (selectedProvider && log.llm.provider !== selectedProvider) {
        return false;
      }
      
      // Success filter
      if (successFilter === 'success' && !log.performance.success) {
        return false;
      }
      if (successFilter === 'failed' && log.performance.success) {
        return false;
      }
      
      // User filter
      if (selectedUser && log.user.email !== selectedUser) {
        return false;
      }
      
      return true;
    });
  }, [recentLogs?.logs, searchTerm, selectedProvider, successFilter, selectedUser]);

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================


  /**
   * Get status styling for success/failure
   * 
   * Learning: Visual indicators help quickly identify issues.
   * Consistent color coding improves dashboard usability.
   */
  const getStatusStyling = (success: boolean) => {
    return success 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  /**
   * Get provider styling
   * 
   * Learning: Provider identification helps with visual scanning.
   * Different colors for different providers improve readability.
   */
  const getProviderStyling = (provider: string) => {
    const providerColors: Record<string, string> = {
      'openai': 'bg-blue-100 text-blue-800 border-blue-200',
      'anthropic': 'bg-purple-100 text-purple-800 border-purple-200',
      'google': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'cohere': 'bg-green-100 text-green-800 border-green-200'
    };
    return providerColors[provider.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  /**
   * Toggle log expansion for detailed view
   * 
   * Learning: Progressive disclosure manages information density.
   * Users can drill down into specific requests when needed.
   */
  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // =============================================================================
  // LOADING AND ERROR STATES
  // =============================================================================

  if (isLoading && !recentLogs) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="flex space-x-2">
            <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded p-4 animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
              <div className="flex space-x-4">
                <div className="h-3 bg-gray-200 rounded w-24"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load recent activity</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // =============================================================================
  // MAIN COMPONENT RENDER
  // =============================================================================

  return (
    <div className="bg-white rounded-lg shadow">
      
      {/* Header with controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <span>📋</span>
              <span>Recent Activity</span>
              {isLoading && (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Live monitoring of LLM requests and responses
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
            </button>
            <button
              onClick={onRefresh}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded text-sm font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search users, providers, models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Provider filter */}
          <div>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Providers</option>
              {availableProviders.map(provider => (
                <option key={provider} value={provider}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Success filter */}
          <div>
            <select
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value as 'all' | 'success' | 'failed')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Requests</option>
              <option value="success">Successful Only</option>
              <option value="failed">Failed Only</option>
            </select>
          </div>

          {/* User filter */}
          <div>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Users</option>
              {availableUsers.map(user => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Activity feed */}
      <div className="max-h-96 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-600 mb-2">
              {searchTerm || selectedProvider || selectedUser || successFilter !== 'all' 
                ? 'No activity matches your filters.' 
                : recentLogs?.logs?.length === 0 
                  ? 'No recent LLM activity to display.'
                  : 'No recent activity to display.'
              }
            </p>
            {(!searchTerm && !selectedProvider && !selectedUser && successFilter === 'all' && 
              recentLogs?.logs?.length === 0) && (
              <div className="text-sm text-gray-500 mt-2">
                <p>This could mean:</p>
                <ul className="mt-1 space-y-1">
                  <li>• No LLM requests have been made recently</li>
                  <li>• The usage logging system is not active</li>
                  <li>• Database connectivity issues</li>
                </ul>
                <p className="mt-2">
                  Try making an LLM request through the chat interface to generate activity.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                
                {/* Main log entry */}
                <div className="flex items-center justify-between">
                  
                  <div className="flex items-center space-x-4 flex-1">
                    
                    {/* Status indicator */}
                    <div className={`w-3 h-3 rounded-full ${log.performance.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    
                    {/* Request details */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="font-medium text-gray-900">{log.user.email}</span>
                        <span className={`px-2 py-1 rounded text-xs border ${getProviderStyling(log.llm.provider)}`}>
                          {log.llm.provider} / {log.llm.model}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs border ${getStatusStyling(log.performance.success)}`}>
                          {log.performance.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{log.usage.total_tokens.toLocaleString()} tokens</span>
                        <span>{formatCurrency(log.usage.estimated_cost)}</span>
                        {log.performance.response_time_ms && (
                          <span>{log.performance.response_time_ms}ms</span>
                        )}
                        <span>{log.request_info.messages_count} messages</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp and expand button */}
                  <div className="flex items-center space-x-3">
                    <span 
                      className="text-sm text-gray-500"
                      title={`Full timestamp: ${log.timestamp} | Parsed: ${log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Invalid'}`}
                    >
                      {formatConversationTimestamp(log.timestamp)}
                    </span>
                    <button
                      onClick={() => toggleLogExpansion(log.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${expandedLogs.has(log.id) ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedLogs.has(log.id) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">Request Info</h5>
                        <div className="space-y-1 text-gray-600">
                          <div>Messages: {log.request_info.messages_count}</div>
                          <div>Characters: {log.request_info.total_chars.toLocaleString()}</div>
                          {log.request_info.session_id && (
                            <div>Session: {log.request_info.session_id.slice(0, 8)}...</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">Token Usage</h5>
                        <div className="space-y-1 text-gray-600">
                          <div>Input: {log.usage.input_tokens.toLocaleString()}</div>
                          <div>Output: {log.usage.output_tokens.toLocaleString()}</div>
                          <div>Total: {log.usage.total_tokens.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">Performance</h5>
                        <div className="space-y-1 text-gray-600">
                          {log.performance.response_time_ms && (
                            <div>Response: {log.performance.response_time_ms}ms</div>
                          )}
                          <div>Status: {log.performance.success ? 'Success' : 'Failed'}</div>
                          <div>Cost: {formatCurrency(log.usage.estimated_cost)}</div>
                        </div>
                      </div>

                    </div>

                    {/* Error details if failed */}
                    {log.error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                        <h5 className="font-medium text-red-900 mb-1">Error Details</h5>
                        <div className="text-sm text-red-700">
                          <div>Type: {log.error.error_type}</div>
                          <div>Message: {log.error.error_message}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with pagination info */}
      {recentLogs && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {filteredLogs.length} of {recentLogs.logs.length} recent requests
            </span>
            <div className="flex items-center space-x-4">
              {recentLogs.pagination.has_more && onLoadMore && (
                <button
                  onClick={onLoadMore}
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Load More
                </button>
              )}
              <span>
                Updated: {new Date(recentLogs.generated_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RecentActivity;
