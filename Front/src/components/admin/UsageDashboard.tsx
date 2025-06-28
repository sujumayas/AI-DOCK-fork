// 📊 Usage Dashboard - Main Component
// Complete usage analytics dashboard combining all visualization components
// Executive-level overview of AI usage, costs, performance, and activity monitoring

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usageAnalyticsService } from '../../services/usageAnalyticsService';
import { DashboardData, DashboardState, TopUserMetric } from '../../types/usage';

// Import our dashboard components
import UsageDashboardOverview from './UsageDashboardOverview';
import UsageCharts from './UsageCharts';
import TopUsersTable from './TopUsersTable';
import RecentActivity from './RecentActivity';

/**
 * Usage Dashboard Component
 * 
 * Learning: This is the "orchestrator" component that manages the entire
 * usage analytics dashboard. It handles data loading, state management,
 * and coordinates all the sub-components.
 * 
 * Design Pattern: This follows the "container component" pattern where
 * one smart component manages data and passes it to multiple presentation components.
 * This keeps the data logic centralized and components focused.
 * 
 * Architecture: 
 * - Loads all dashboard data in parallel for performance
 * - Manages loading states and error handling
 * - Provides refresh and period selection functionality
 * - Handles component coordination and communication
 */

const UsageDashboard: React.FC = () => {

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  const [dashboardState, setDashboardState] = useState<DashboardState>({
    isLoading: true,
    isRefreshing: false,
    error: null,
    data: null,
    lastUpdated: null,
    selectedPeriod: 30,
    selectedProvider: null,
    selectedMetric: 'total_cost'
  });

  // Prevent duplicate API calls
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // =============================================================================
  // DATA LOADING FUNCTIONS
  // =============================================================================

  /**
   * Load complete dashboard data
   * 
   * Learning: Loading multiple datasets in parallel improves performance.
   * We use Promise.all to fetch everything at once rather than sequentially.
   * This provides better user experience with faster load times.
   */
  const loadDashboardData = useCallback(async (days: number = 30, isRefresh: boolean = false) => {
    // Prevent duplicate requests
    if (loadingRef.current) {
      console.log('⏭️ Skipping dashboard load - already in progress');
      return;
    }

    console.log(`📊 Loading dashboard data for ${days} days (refresh: ${isRefresh})`);
    loadingRef.current = true;

    // Update loading state
    setDashboardState(prev => ({
      ...prev,
      isLoading: !isRefresh && !prev.data, // Only show initial loading if no data
      isRefreshing: isRefresh,
      error: null
    }));

    try {
      // Load all dashboard data in parallel
      const dashboardData = await usageAnalyticsService.getDashboardData(days);
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        console.log('✅ Dashboard data loaded successfully');
        setDashboardState(prev => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: null,
          data: dashboardData,
          lastUpdated: new Date().toISOString(),
          selectedPeriod: days
        }));
      }

    } catch (error) {
      console.error('❌ Failed to load dashboard data:', error);
      
      if (mountedRef.current) {
        setDashboardState(prev => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: error instanceof Error ? error.message : 'Failed to load dashboard data'
        }));
      }

    } finally {
      loadingRef.current = false;
    }
  }, []);

  /**
   * Handle period change (7, 30, 90 days)
   * 
   * Learning: Period selection is a common pattern in analytics dashboards.
   * Different time periods reveal different usage patterns and trends.
   */
  const handlePeriodChange = useCallback((days: number) => {
    console.log(`📅 Changing period to ${days} days`);
    loadDashboardData(days, false);
  }, [loadDashboardData]);

  /**
   * Handle dashboard refresh
   * 
   * Learning: Refresh functionality is essential for operational dashboards.
   * Users need to see latest data without full page reload.
   */
  const handleRefresh = useCallback(() => {
    console.log('🔄 Refreshing dashboard data');
    loadDashboardData(dashboardState.selectedPeriod, true);
  }, [loadDashboardData, dashboardState.selectedPeriod]);

  /**
   * Handle metric selection change
   * 
   * Learning: Allowing users to switch between different metrics
   * (cost vs tokens vs requests) provides different perspectives on usage.
   */
  const handleMetricChange = useCallback((metric: TopUserMetric) => {
    setDashboardState(prev => ({
      ...prev,
      selectedMetric: metric
    }));
  }, []);

  // =============================================================================
  // LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Initialize dashboard on component mount
   * 
   * Learning: useEffect with empty dependency array runs once on mount.
   * This is where we load initial data and set up the component.
   */
  useEffect(() => {
    console.log('🚀 Usage Dashboard mounting - loading initial data');
    mountedRef.current = true;

    // Load initial dashboard data
    loadDashboardData(30, false);

    // Cleanup function
    return () => {
      console.log('🧹 Usage Dashboard unmounting');
      mountedRef.current = false;
      loadingRef.current = false;
    };
  }, []); // Empty dependency array - run once on mount

  /**
   * Auto-refresh setup (optional)
   * 
   * Learning: Auto-refresh can be useful for operational dashboards
   * but should be configurable to avoid unnecessary API calls.
   */
  useEffect(() => {
    // Auto-refresh every 5 minutes (optional)
    const autoRefreshInterval = setInterval(() => {
      if (!loadingRef.current && dashboardState.data) {
        console.log('⏰ Auto-refreshing dashboard data');
        handleRefresh();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(autoRefreshInterval);
  }, [handleRefresh, dashboardState.data]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle user click in top users table
   * 
   * Learning: Cross-component communication helps users drill down into data.
   * Clicking a user could open detailed analytics or filter other views.
   */
  const handleUserClick = useCallback((userId: number) => {
    console.log(`👤 User clicked: ${userId}`);
    // Future: Could open user details modal or navigate to user page
    // For now, we'll just log it
  }, []);

  /**
   * Handle error retry
   * 
   * Learning: Error recovery is important for good UX.
   * Users should always have a way to retry failed operations.
   */
  const handleRetry = useCallback(() => {
    console.log('🔄 Retrying dashboard load after error');
    loadDashboardData(dashboardState.selectedPeriod, false);
  }, [loadDashboardData, dashboardState.selectedPeriod]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render period selector buttons
   * 
   * Learning: Time period selection is a standard pattern in analytics.
   * Common periods are 7, 30, 90 days, and sometimes custom ranges.
   */
  const renderPeriodSelector = () => {
    const periods = [
      { days: 7, label: '7 Days' },
      { days: 30, label: '30 Days' },
      { days: 90, label: '90 Days' }
    ];

    return (
      <div className="flex space-x-2">
        {periods.map(period => (
          <button
            key={period.days}
            onClick={() => handlePeriodChange(period.days)}
            disabled={dashboardState.isLoading || dashboardState.isRefreshing}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              dashboardState.selectedPeriod !== period.days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>
    );
  };

  /**
   * Render dashboard header with controls
   * 
   * Learning: Dashboard headers should include key controls and status information.
   * This provides users with context and control over the view.
   */
  const renderHeader = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
            <span>📊</span>
            <span>Usage Analytics Dashboard</span>
            {dashboardState.isRefreshing && (
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </h1>
          <p className="text-blue-100 mt-2">
            Comprehensive overview of AI usage, costs, and performance metrics
          </p>
          {dashboardState.lastUpdated && (
            <p className="text-sm text-blue-200 mt-1">
              Last updated: {new Date(dashboardState.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {renderPeriodSelector()}
          <button
            onClick={handleRefresh}
            disabled={dashboardState.isLoading || dashboardState.isRefreshing}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </div>
  );

  /**
   * Render error state with retry option
   * 
   * Learning: Error states should be informative and actionable.
   * Users need to understand what went wrong and how to fix it.
   */
  const renderError = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 text-center border border-white/20">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h2>
        <p className="text-gray-600 mb-4">{dashboardState.error}</p>
        <button
          onClick={handleRetry}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  /**
   * Render loading state
   * 
   * Learning: Loading states should indicate progress and what's being loaded.
   * This manages user expectations during data fetching.
   */
  const renderLoading = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderHeader()}
        
        {/* Loading skeleton matching the actual layout */}
        <div className="space-y-8">
          
          {/* Overview cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 animate-pulse border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 w-6 bg-gray-200 rounded"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
            ))}
          </div>

          {/* Charts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 animate-pulse border border-white/20">
                <div className="h-4 bg-gray-200 rounded w-48 mb-4"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>

          {/* Tables skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 animate-pulse border border-white/20">
                <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                <div className="space-y-4">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="flex items-center space-x-4">
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
            ))}
          </div>

        </div>
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  // Show error state if we have an error and no data
  if (dashboardState.error && !dashboardState.data) {
    return renderError();
  }

  // Show loading state if loading and no data
  if (dashboardState.isLoading && !dashboardState.data) {
    return renderLoading();
  }

  // Main dashboard render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {renderHeader()}

        {/* Dashboard content */}
        <div className="space-y-8">
          
          {/* Overview Cards */}
          <UsageDashboardOverview
            summary={dashboardState.data?.summary || null}
            systemHealth={dashboardState.data?.systemHealth?.status || 'error'}
            isLoading={dashboardState.isRefreshing}
            error={dashboardState.error}
            onRefresh={handleRefresh}
          />

          {/* Charts Section */}
          <UsageCharts
            summary={dashboardState.data?.summary || null}
            isLoading={dashboardState.isRefreshing}
            error={dashboardState.error}
          />

          {/* Tables and Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Top Users Table */}
            <div>
              <TopUsersTable
                topUsersByCost={dashboardState.data?.topUsers.byCost || null}
                topUsersByTokens={dashboardState.data?.topUsers.byTokens || null}
                topUsersByRequests={dashboardState.data?.topUsers.byRequests || null}
                isLoading={dashboardState.isRefreshing}
                error={dashboardState.error}
                onUserClick={handleUserClick}
              />
            </div>

            {/* Recent Activity */}
            <div>
              <RecentActivity
                recentLogs={dashboardState.data?.recentActivity || null}
                isLoading={dashboardState.isRefreshing}
                error={dashboardState.error}
                onRefresh={handleRefresh}
              />
            </div>

          </div>

          {/* System Health Footer */}
          {dashboardState.data?.systemHealth && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    dashboardState.data.systemHealth.status === 'healthy' ? 'bg-green-500' :
                    dashboardState.data.systemHealth.status === 'degraded' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-900">
                    Usage Tracking System: {dashboardState.data.systemHealth.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {dashboardState.data.systemHealth.usage_tracking.logs_last_24h || 0} logs in last 24h
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default UsageDashboard;
