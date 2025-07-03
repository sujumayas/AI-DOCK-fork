// AI Dock Manager Dashboard
// Comprehensive overview of department status, users, quotas, and activity

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Shield,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  PieChart,
  ArrowLeft,
  Home
} from 'lucide-react';
import managerService from '../services/managerService';
import { DepartmentDashboardData } from '../types/manager';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { UnifiedTraversalButtons } from '../components/ui/UnifiedTraversalButtons';

interface ManagerDashboardProps {
  className?: string;
}

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ className = '' }) => {
  // =============================================================================
  // HOOKS & NAVIGATION
  // =============================================================================
  
  const navigate = useNavigate();
  const { logout } = useAuth();

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  const [dashboardData, setDashboardData] = useState<DepartmentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // Optimized data loading functions with useCallback
  const loadCurrentUser = useCallback(async () => {
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to load current user:', error);
    } finally {
      setIsLoadingUser(false);
    }
  }, []);

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await managerService.getDepartmentDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Optimized navigation and action handlers with useCallback
  const handleRefresh = useCallback(() => {
    loadDashboardData(true);
  }, [loadDashboardData]);

  const handleBackToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Load data on component mount
  useEffect(() => {
    loadDashboardData();
    loadCurrentUser();
  }, [loadDashboardData, loadCurrentUser]);

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  // Optimized utility functions with useCallback for stable references
  const getQuotaStatusColor = useCallback((exceeded: number, total: number) => {
    if (total === 0) return 'text-gray-500';
    const percentage = (exceeded / total) * 100;
    if (percentage > 20) return 'text-red-600';
    if (percentage > 10) return 'text-yellow-600';
    return 'text-green-600';
  }, []);

  const formatTimeAgo = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }, []);

  // =============================================================================
  // RENDER FUNCTIONS
  // =============================================================================

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
            <p className="text-blue-100">Loading department dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load dashboard</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => loadDashboardData()}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No dashboard data available</h3>
            <p className="text-gray-600">Dashboard data could not be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  const { department, user_stats, quota_stats, usage_stats, recent_activity } = dashboardData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
      {/* Header Section with Intercorp Retail Branding */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
                <p className="text-blue-100 text-sm">
                  {department.name} {department.description && `• ${department.description}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Integrated Navigation Buttons */}
              <div className="ml-2 md:ml-4">
                <UnifiedTraversalButtons 
                  variant="inline" 
                  size="md"
                />
              </div>
              
              <div className="text-right border-l border-white/20 pl-4">
                <p className="text-white font-medium">
                  {currentUser && !isLoadingUser ? (
                    currentUser.full_name || currentUser.username
                  ) : (
                    'Loading...'
                  )}
                </p>
                <p className="text-blue-100 text-sm">
                  {currentUser?.role?.name || 'Manager'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Users Card */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{user_stats.total_users}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {user_stats.active_users} active
                  </p>
                </div>
                <div className="bg-gradient-to-r from-blue-500 to-teal-500 p-3 rounded-full">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Quotas Card */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Quotas</p>
                  <p className="text-2xl font-bold text-gray-900">{quota_stats.active_quotas}</p>
                  <p className={`text-xs mt-1 ${getQuotaStatusColor(quota_stats.exceeded_quotas, quota_stats.active_quotas)}`}>
                    {quota_stats.exceeded_quotas} exceeded
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-full">
                  <Shield className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Monthly Spending Card */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Budget</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${quota_stats.total_monthly_cost_used?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    of ${quota_stats.total_monthly_cost_limit?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Activity Card */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">30-Day Requests</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {usage_stats.total_requests?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {Math.round(usage_stats.avg_response_time_ms || 0)}ms avg
                  </p>
                </div>
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-3 rounded-full">
                  <Activity className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Analytics Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* User Statistics */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">User Distribution</h3>
                <div className="bg-gradient-to-r from-blue-500 to-teal-500 p-2 rounded-lg">
                  <PieChart className="h-5 w-5 text-white" />
                </div>
              </div>
          
          <div className="space-y-3">
            {user_stats.users_by_role?.map((role, index) => {
              const percentage = user_stats.total_users > 0 
                ? (role.count / user_stats.total_users) * 100 
                : 0;
              
              return (
                <div key={role.role_name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ 
                        backgroundColor: `hsl(${index * 137.5 % 360}, 70%, 60%)` 
                      }}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {role.role_display_name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{role.count}</span>
                    <span className="text-xs text-gray-500 ml-1">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            }) || []}
          </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Recent additions:</span>
                  <span className="font-medium text-gray-900">{user_stats.recent_users || 0} this month</span>
                </div>
              </div>
            </div>

            {/* Quota Health */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Quota Health</h3>
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
              </div>
          
          <div className="space-y-4">
            {/* Total Quotas */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Quotas</span>
              <span className="text-sm font-bold text-gray-900">{quota_stats.total_quotas || 0}</span>
            </div>
            
            {/* Active Quotas */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-sm text-gray-600">Active</span>
              </div>
              <span className="text-sm font-bold text-green-600">{quota_stats.active_quotas || 0}</span>
            </div>
            
            {/* Exceeded Quotas */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-sm text-gray-600">Exceeded</span>
              </div>
              <span className="text-sm font-bold text-red-600">{quota_stats.exceeded_quotas || 0}</span>
            </div>
            
            {/* Near Limit Quotas */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-yellow-500 mr-2" />
                <span className="text-sm text-gray-600">Near Limit</span>
              </div>
              <span className="text-sm font-bold text-yellow-600">{quota_stats.near_limit_quotas || 0}</span>
            </div>
          </div>

              {/* Monthly Budget Progress */}
              {(quota_stats.total_monthly_cost_limit || 0) > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Monthly Budget Usage</span>
                    <span className="text-sm font-medium text-gray-900">
                      {((quota_stats.total_monthly_cost_used || 0) / (quota_stats.total_monthly_cost_limit || 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-teal-500"
                      style={{
                        width: `${Math.min(
                          ((quota_stats.total_monthly_cost_used || 0) / (quota_stats.total_monthly_cost_limit || 1)) * 100,
                          100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-2 rounded-lg">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
        
            <div className="divide-y divide-gray-200">
              {recent_activity && recent_activity.length > 0 ? (
                recent_activity.slice(0, 8).map((activity) => (
                  <div key={activity.id} className="px-8 py-5 hover:bg-blue-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{activity.user_name}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-sm text-gray-600">{activity.llm_provider}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-sm text-gray-600">{activity.request_type}</span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500">
                            {(activity.total_tokens || 0).toLocaleString()} tokens
                          </span>
                          <span className="text-xs text-gray-500">
                            ${(activity.estimated_cost || 0).toFixed(4)}
                          </span>
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                            activity.status === 'success' 
                              ? 'bg-green-100 text-green-800'
                              : activity.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {activity.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        {formatTimeAgo(activity.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-8 py-12 text-center">
                  <Activity className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-lg">No recent activity in your department</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer with Intercorp Retail Branding */}
          <div className="text-center mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-2xl mx-auto border border-white/20">
              <p className="text-white/80 text-sm mb-2">
                Powered by <span className="font-semibold text-white">Intercorp Retail</span> & <span className="font-semibold text-white">InDigital XP</span>
              </p>
              <p className="text-blue-200 text-xs">
                Last updated: {dashboardData.last_updated ? new Date(dashboardData.last_updated).toLocaleString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerDashboard;

/**
 * Learning Summary: Manager Dashboard Component
 * 
 * This component demonstrates several key React and enterprise UI patterns:
 * 
 * 1. **Comprehensive Data Visualization**: Shows multiple types of data
 *    (users, quotas, usage, activity) in a unified dashboard view
 * 
 * 2. **Real-time Status Indicators**: Uses color coding and progress bars
 *    to show quota health and usage percentages
 * 
 * 3. **Responsive Design**: Adapts layout for different screen sizes
 *    using Tailwind's responsive grid classes
 * 
 * 4. **Loading and Error States**: Provides proper feedback during
 *    data fetching and error conditions
 * 
 * 5. **Data Formatting**: Uses utility functions to format currencies,
 *    numbers, and percentages consistently
 * 
 * 6. **Interactive Elements**: Includes refresh functionality and
 *    hover effects for better user experience
 * 
 * 7. **Department Scoping**: All data is automatically scoped to the
 *    manager's department through the API service layer
 * 
 * This pattern can be applied to other dashboard interfaces in enterprise
 * applications where managers need oversight of their domain.
 */
