// 📊 Usage Dashboard Overview Cards
// Executive-level metrics display with key usage statistics
// This shows the most important numbers at the top of the dashboard

import React from 'react';
import { UsageSummary, HealthStatus } from '../../types/usage';

/**
 * Usage Dashboard Overview Component
 * 
 * Learning: This component displays key metrics in card format.
 * It's designed like an "executive dashboard" that shows the most
 * important numbers at a glance - total costs, usage, success rates, etc.
 * 
 * Design Pattern: This follows the "metrics cards" pattern common
 * in admin dashboards. Each card shows one key metric with context.
 */

interface UsageDashboardOverviewProps {
  summary: UsageSummary | null;
  systemHealth: HealthStatus;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const UsageDashboardOverview: React.FC<UsageDashboardOverviewProps> = ({
  summary,
  systemHealth,
  isLoading,
  error,
  onRefresh
}) => {

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Format currency values consistently
   * 
   * Learning: Consistent formatting is crucial for professional dashboards.
   * We format costs to show meaningful precision without overwhelming detail.
   */
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    } else if (amount >= 1) {
      return `$${amount.toFixed(2)}`;
    } else {
      return `$${(amount * 100).toFixed(1)}¢`;
    }
  };

  /**
   * Format large numbers with proper abbreviations
   * 
   * Learning: Large numbers are hard to read. We use K/M abbreviations
   * to make them more digestible in a dashboard context.
   */
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toLocaleString();
    }
  };

  /**
   * Format response time for display
   * 
   * Learning: Performance metrics need context. We show response times
   * in the most appropriate unit (ms vs seconds).
   */
  const formatResponseTime = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${Math.round(ms)}ms`;
    }
  };

  /**
   * Get status color for health indicator
   * 
   * Learning: Visual indicators help users quickly understand system status.
   * We use standard color conventions (green=good, yellow=warning, red=error).
   */
  const getStatusColor = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  /**
   * Get success rate color based on percentage
   * 
   * Learning: Success rates have natural thresholds. We use colors to
   * quickly indicate whether the rate is good (>95%), concerning (85-95%), or bad (<85%).
   */
  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  // =============================================================================
  // LOADING AND ERROR STATES
  // =============================================================================

  if (isLoading && !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-6 w-6 bg-gray-200 rounded"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Failed to load usage data</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8 text-center">
        <p className="text-gray-600">No usage data available for the selected period.</p>
      </div>
    );
  }

  // =============================================================================
  // MAIN DASHBOARD CARDS
  // =============================================================================

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      
      {/* Total Requests Card */}
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Total Requests
          </h3>
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(summary.overview.total_requests)}
            </p>
            <p className="text-sm text-gray-600">
              Last {summary.period.days} days
            </p>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSuccessRateColor(summary.overview.success_rate_percent)}`}>
            {summary.overview.success_rate_percent.toFixed(1)}% success
          </div>
        </div>
      </div>

      {/* Total Cost Card */}
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Total Cost
          </h3>
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.overview.total_cost_usd)}
            </p>
            <p className="text-sm text-gray-600">
              {formatCurrency(summary.overview.average_cost_per_request)} avg/request
            </p>
          </div>
          <div className="text-xs text-gray-500">
            USD
          </div>
        </div>
      </div>

      {/* Token Usage Card */}
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Tokens Used
          </h3>
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(summary.overview.total_tokens)}
            </p>
            <p className="text-sm text-gray-600">
              {Math.round(summary.overview.average_tokens_per_request)} avg/request
            </p>
          </div>
          <div className="text-xs text-gray-500">
            tokens
          </div>
        </div>
      </div>

      {/* Performance Card */}
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Avg Response Time
          </h3>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(systemHealth)}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatResponseTime(summary.overview.average_response_time_ms)}
            </p>
            <p className="text-sm text-gray-600">
              System: {systemHealth}
            </p>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemHealth)}`}>
            {systemHealth}
          </div>
        </div>
      </div>

    </div>
  );
};

export default UsageDashboardOverview;
