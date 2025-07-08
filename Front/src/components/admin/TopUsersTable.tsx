// 🏆 Top Users Table Component
// Displays users with highest usage by various metrics (cost, tokens, requests)
// Helps identify heavy users and usage patterns for cost allocation

import React, { useState, useMemo } from 'react';
import { TopUsersResponse, TopUserMetric } from '../../types/usage';

/**
 * Top Users Table Component
 * 
 * Learning: Usage analytics help identify patterns and outliers.
 * This component shows the "leaderboard" of users by different metrics,
 * which is crucial for cost allocation, training programs, and quota management.
 * 
 * Design Pattern: This follows a sortable table pattern with metric switching.
 * Users can view top users by cost, tokens, or request count.
 */

interface TopUsersTableProps {
  topUsersByCost: TopUsersResponse | null;
  topUsersByTokens: TopUsersResponse | null;
  topUsersByRequests: TopUsersResponse | null;
  isLoading: boolean;
  error: string | null;
  onUserClick?: (userId: number) => void;
}

const TopUsersTable: React.FC<TopUsersTableProps> = ({
  topUsersByCost,
  topUsersByTokens,
  topUsersByRequests,
  isLoading,
  error,
  onUserClick
}) => {

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  const [selectedMetric, setSelectedMetric] = useState<TopUserMetric>('total_cost');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // =============================================================================
  // DATA PROCESSING
  // =============================================================================

  /**
   * Get the appropriate data based on selected metric
   * 
   * Learning: We allow users to switch between different ranking criteria.
   * This helps identify different types of patterns (cost vs usage vs frequency).
   */
  const currentData = useMemo(() => {
    switch (selectedMetric) {
      case 'total_cost':
        return topUsersByCost;
      case 'total_tokens':
        return topUsersByTokens;
      case 'request_count':
        return topUsersByRequests;
      default:
        return topUsersByCost;
    }
  }, [selectedMetric, topUsersByCost, topUsersByTokens, topUsersByRequests]);

  /**
   * Format values based on metric type
   * 
   * Learning: Different metrics need different formatting for readability.
   * Costs use currency, tokens use number abbreviations, etc.
   * FIXED: Clearer cost formatting that doesn't mix dollar and cent symbols.
   */
  const formatMetricValue = (metric: TopUserMetric, value: number): string => {
    switch (metric) {
      case 'total_cost':
        if (value >= 1) {
          return `${value.toFixed(2)}`;
        } else if (value >= 0.01) {
          // Show just cents for small amounts (no dollar sign)
          return `${(value * 100).toFixed(1)}¢`;
        } else {
          // For very small amounts, show as dollars with more precision
          return `${value.toFixed(4)}`;
        }
      case 'total_tokens':
        if (value >= 1000000) {
          return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}K`;
        } else {
          return value.toLocaleString();
        }
      case 'request_count':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  /**
   * Get metric display information
   * 
   * Learning: Good UX provides clear labels and context for data.
   * This helps users understand what they're looking at.
   */
  const getMetricInfo = (metric: TopUserMetric) => {
    switch (metric) {
      case 'total_cost':
        return {
          label: 'Total Cost',
          icon: '💰',
          description: 'Users ranked by total AI usage cost'
        };
      case 'total_tokens':
        return {
          label: 'Token Usage',
          icon: '🔢',
          description: 'Users ranked by total token consumption'
        };
      case 'request_count':
        return {
          label: 'Request Count',
          icon: '📊',
          description: 'Users ranked by number of AI requests'
        };
      default:
        return {
          label: 'Usage',
          icon: '📈',
          description: 'User ranking'
        };
    }
  };

  /**
   * Toggle row expansion for detailed metrics
   * 
   * Learning: Progressive disclosure helps manage information density.
   * Users can click to see more details without overwhelming the interface.
   */
  const toggleRowExpansion = (userId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  };

  /**
   * Get success rate color styling
   * 
   * Learning: Visual indicators help users quickly assess data quality.
   * Color coding makes it easy to spot concerning patterns.
   */
  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 95) return 'text-green-600 bg-green-100';
    if (rate >= 85) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  /**
   * Get ranking badge styling
   * 
   * Learning: Gamification elements like rankings make data more engaging.
   * Special styling for top positions adds visual interest.
   */
  const getRankingBadge = (index: number): string => {
    switch (index) {
      case 0: return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Gold
      case 1: return 'bg-gray-100 text-gray-800 border-gray-200';       // Silver
      case 2: return 'bg-orange-100 text-orange-800 border-orange-200'; // Bronze
      default: return 'bg-blue-100 text-blue-800 border-blue-200';      // Regular
    }
  };

  // =============================================================================
  // LOADING AND ERROR STATES
  // =============================================================================

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="flex space-x-2">
            {[...Array(3)].map((_, i) => (
              <div key={`selector-${i}`} className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={`loading-row-${i}`} className="flex items-center space-x-4 p-4 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load top users</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentData || currentData.top_users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users</h3>
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <p className="text-gray-600">No usage data available for the selected period.</p>
        </div>
      </div>
    );
  }

  const metricInfo = getMetricInfo(selectedMetric);

  // =============================================================================
  // MAIN COMPONENT RENDER
  // =============================================================================

  return (
    <div className="bg-white rounded-lg shadow">
      
      {/* Header with metric selector */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <span>{metricInfo.icon}</span>
              <span>Top Users by {metricInfo.label}</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">{metricInfo.description}</p>
          </div>
          
          {/* Metric selector buttons */}
          <div className="flex space-x-2">
            {(['total_cost', 'total_tokens', 'request_count'] as TopUserMetric[]).map((metric) => {
              const info = getMetricInfo(metric);
              return (
                <button
                  key={`metric-${metric}`}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedMetric === metric
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {info.icon} {info.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top users list */}
      <div className="divide-y divide-gray-200">
        {currentData.top_users.map((userStats, index) => (
          <div key={`user-${userStats.user.id}-${index}`} className="p-6 hover:bg-gray-50 transition-colors">
            
            {/* Main row */}
            <div className="flex items-center justify-between">
              
              {/* User info with ranking */}
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${getRankingBadge(index)}`}>
                  {index + 1}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{userStats.user.email}</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {userStats.user.role}
                    </span>
                    {userStats.user.department_id && (
                      <span className="text-xs text-gray-500">
                        Dept: {userStats.user.department_id}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                    <span>{userStats.metrics.request_count.toLocaleString()} requests</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getSuccessRateColor(userStats.metrics.success_rate_percent)}`}>
                      {userStats.metrics.success_rate_percent.toFixed(1)}% success
                    </span>
                  </div>
                </div>
              </div>

              {/* Metric value and expand button */}
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatMetricValue(selectedMetric, 
                      selectedMetric === 'total_cost' ? userStats.metrics.total_cost :
                      selectedMetric === 'total_tokens' ? userStats.metrics.total_tokens :
                      userStats.metrics.request_count
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedMetric === 'total_cost' && `${userStats.metrics.average_cost_per_request.toFixed(4)} avg/req`}
                    {selectedMetric === 'total_tokens' && `${(userStats.metrics.total_tokens / userStats.metrics.successful_requests).toFixed(0)} avg/req`}
                    {selectedMetric === 'request_count' && `${userStats.metrics.average_response_time_ms.toFixed(0)}ms avg`}
                  </div>
                </div>
                
                <button
                  onClick={() => toggleRowExpansion(userStats.user.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg 
                    className={`w-5 h-5 transition-transform ${expandedRows.has(userStats.user.id) ? 'rotate-180' : ''}`}
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
            {expandedRows.has(userStats.user.id) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  
                  <div className="bg-blue-50 rounded p-3">
                    <div className="font-medium text-blue-900">Total Requests</div>
                    <div className="text-blue-700 text-lg font-semibold">
                      {userStats.metrics.request_count.toLocaleString()}
                    </div>
                    <div className="text-blue-600 text-xs">
                      {userStats.metrics.failed_requests} failed
                    </div>
                  </div>

                  <div className="bg-green-50 rounded p-3">
                    <div className="font-medium text-green-900">Total Cost</div>
                    <div className="text-green-700 text-lg font-semibold">
                      ${userStats.metrics.total_cost.toFixed(4)}
                    </div>
                    <div className="text-green-600 text-xs">
                      ${userStats.metrics.average_cost_per_request.toFixed(4)} avg
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded p-3">
                    <div className="font-medium text-purple-900">Total Tokens</div>
                    <div className="text-purple-700 text-lg font-semibold">
                      {userStats.metrics.total_tokens.toLocaleString()}
                    </div>
                    <div className="text-purple-600 text-xs">
                      {Math.round(userStats.metrics.total_tokens / userStats.metrics.successful_requests)} avg/req
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded p-3">
                    <div className="font-medium text-orange-900">Avg Response</div>
                    <div className="text-orange-700 text-lg font-semibold">
                      {userStats.metrics.average_response_time_ms.toFixed(0)}ms
                    </div>
                    <div className="text-orange-600 text-xs">
                      {userStats.metrics.success_rate_percent.toFixed(1)}% success
                    </div>
                  </div>

                </div>
                
                {/* User actions */}
                <div className="flex justify-end mt-4 space-x-2">
                  {onUserClick && (
                    <button
                      onClick={() => onUserClick(userStats.user.id)}
                      className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded transition-colors"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        ))}
      </div>

      {/* Footer with period info */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>
            Showing top {currentData.top_users.length} users for {currentData.period.days} day period
          </span>
          <span>
            Updated: {new Date(currentData.generated_at).toLocaleString()}
          </span>
        </div>
      </div>

    </div>
  );
};

export default TopUsersTable;
