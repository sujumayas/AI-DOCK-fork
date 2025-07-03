// 📊 Usage Dashboard Overview Cards
// Executive-level metrics display with key usage statistics
// This shows the most important numbers at the top of the dashboard

import React from 'react';
import { UsageSummary, HealthStatus } from '../../types/usage';
import { formatCurrency, formatNumber, formatResponseTime, formatPercentage } from '../../utils/formatUtils';

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
  // HELPER FUNCTIONS (formatting functions now imported from formatUtils)
  // =============================================================================

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
          <div key={index} className="bg-white/5 backdrop-blur-lg rounded-3xl shadow-2xl p-6 animate-pulse border border-white/10">
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
      <div className="bg-red-500/10 backdrop-blur-lg border border-red-400/20 rounded-3xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-300">Failed to load usage data</h3>
              <p className="text-sm text-red-400 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1 rounded-lg text-sm font-medium transition-all duration-300 backdrop-blur-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 mb-8 text-center">
        <p className="text-blue-200">No usage data available for the selected period.</p>
      </div>
    );
  }

  // =============================================================================
  // MAIN DASHBOARD CARDS
  // =============================================================================

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      
      {/* Total Requests Card */}
      <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-lg rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 p-6 border border-blue-400/20 hover:scale-[1.02] transform group">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-blue-200 uppercase tracking-wide">
            Total Requests
          </h3>
          <div className="w-10 h-10 bg-blue-500/30 rounded-2xl flex items-center justify-center ring-2 ring-blue-400/30 group-hover:ring-blue-400/50 transition-all duration-300">
            <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-white group-hover:scale-105 transition-all duration-300">
              {formatNumber(summary.overview.total_requests)}
            </p>
            <p className="text-sm text-blue-200">
              Last {summary.period.days} days
            </p>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSuccessRateColor(summary.overview.success_rate_percent)}`}>
            {formatPercentage(summary.overview.success_rate_percent)} success
          </div>
        </div>
      </div>

      {/* Total Cost Card */}
      <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 backdrop-blur-lg rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 p-6 border border-emerald-400/20 hover:scale-[1.02] transform group">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-emerald-200 uppercase tracking-wide">
            Total Cost
          </h3>
          <div className="w-10 h-10 bg-emerald-500/30 rounded-2xl flex items-center justify-center ring-2 ring-emerald-400/30 group-hover:ring-emerald-400/50 transition-all duration-300">
            <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-white group-hover:scale-105 transition-all duration-300">
              {formatCurrency(summary.overview.total_cost_usd)}
            </p>
            <p className="text-sm text-emerald-200">
              {formatCurrency(summary.overview.average_cost_per_request)} avg/request
            </p>
          </div>
          <div className="text-xs text-gray-500">
            USD
          </div>
        </div>
      </div>

      {/* Token Usage Card */}
      <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-lg rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 p-6 border border-purple-400/20 hover:scale-[1.02] transform group">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-purple-200 uppercase tracking-wide">
            Tokens Used
          </h3>
          <div className="w-10 h-10 bg-purple-500/30 rounded-2xl flex items-center justify-center ring-2 ring-purple-400/30 group-hover:ring-purple-400/50 transition-all duration-300">
            <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-white group-hover:scale-105 transition-all duration-300">
              {formatNumber(summary.overview.total_tokens)}
            </p>
            <p className="text-sm text-purple-200">
              {Math.round(summary.overview.average_tokens_per_request)} avg/request
            </p>
          </div>
          <div className="text-xs text-gray-500">
            tokens
          </div>
        </div>
      </div>

      {/* Performance Card */}
      <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-lg rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 p-6 border border-orange-400/20 hover:scale-[1.02] transform group">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-orange-200 uppercase tracking-wide">
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
            <p className="text-3xl font-bold text-white group-hover:scale-105 transition-all duration-300">
              {formatResponseTime(summary.overview.average_response_time_ms)}
            </p>
            <p className="text-sm text-orange-200">
              System: {systemHealth === 'error' ? 'Not Set Up' : systemHealth}
            </p>
            {systemHealth === 'error' && (
              <div className="mt-1">
                <p className="text-xs text-orange-300">
                  API connectivity issue
                </p>
                <button
                  onClick={onRefresh}
                  className="text-xs text-blue-300 hover:text-blue-200 underline mt-1"
                >
                  Retry connection
                </button>
              </div>
            )}
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemHealth)}`}>
            {systemHealth === 'error' ? 'Setup Needed' : systemHealth}
          </div>
        </div>
      </div>

    </div>
  );
};

export default UsageDashboardOverview;
