// 🛡️ Admin Settings Page
// Main admin dashboard with tabbed navigation
// This is the central hub for all admin operations
// 
// 🚀 OPTIMIZED VERSION - Fixed rapid refreshing and performance issues

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { adminService } from '../services/adminService';
import { UserStatistics } from '../types/admin';

// Component imports
import { UserManagement } from '../components/admin/UserManagement';
import LLMConfiguration from '../components/admin/LLMConfiguration';
// import { DepartmentManagement } from '../components/admin/DepartmentManagement';
// import { SystemSettings } from '../components/admin/SystemSettings';

/**
 * AdminSettings Component
 * 
 * Learning: This is a "container component" that manages the overall admin interface.
 * It handles authentication, navigation between admin sections, and shared state.
 * 
 * 🔧 PERFORMANCE OPTIMIZATIONS:
 * - Request deduplication to prevent multiple simultaneous API calls
 * - Proper loading states to prevent visual flickering
 * - Memoized callbacks to prevent unnecessary re-renders
 * - Effect cleanup to prevent memory leaks
 */
const AdminSettings: React.FC = () => {
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  const navigate = useNavigate();
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<'users' | 'llm-configs' | 'departments' | 'settings'>('users');
  
  // Loading and error states - more granular for better UX
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Admin data
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  
  // Request tracking to prevent duplicates
  const initializingRef = useRef(false);
  const statsLoadingRef = useRef(false);
  const mountedRef = useRef(true);

  // =============================================================================
  // MEMOIZED VALUES AND CALLBACKS
  // =============================================================================

  /**
   * Memoized default statistics to prevent object recreation
   */
  const defaultStatistics = useMemo<UserStatistics>(() => ({
    total_users: 0,
    active_users: 0,
    inactive_users: 0,
    admin_users: 0,
    verified_users: 0,
    unverified_users: 0,
    new_users_this_week: 0,
    new_users_this_month: 0,
    recent_logins_count: 0,
    users_by_role: {},
    users_by_department: {}
  }), []);

  /**
   * Memoized tab configuration
   */
  const tabs = useMemo(() => [
    { 
      id: 'users' as const, 
      name: 'User Management', 
      count: statistics?.total_users || 0 
    },
    { 
      id: 'llm-configs' as const, 
      name: 'LLM Providers', 
      count: null,
      icon: '🤖'
    },
    { 
      id: 'departments' as const, 
      name: 'Departments', 
      count: null 
    },
    { 
      id: 'settings' as const, 
      name: 'System Settings', 
      count: null 
    },
  ], [statistics?.total_users]);

  /**
   * Load dashboard statistics with deduplication
   */
  const loadDashboardStats = useCallback(async () => {
    // Prevent duplicate requests
    if (statsLoadingRef.current) {
      console.log('⏭️ Skipping stats load - already in progress');
      return;
    }

    console.log('📊 Loading dashboard statistics...');
    statsLoadingRef.current = true;
    setIsLoadingStats(true);

    try {
      const stats = await adminService.getUserStatistics();
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        console.log('✅ Statistics loaded:', stats);
        setStatistics(stats);
      }
      
    } catch (err) {
      console.warn('⚠️ Failed to load statistics, using defaults:', err);
      
      // Set default statistics so the UI still works
      if (mountedRef.current) {
        setStatistics(defaultStatistics);
        // Don't set this as an error state since statistics are secondary data
      }
      
    } finally {
      if (mountedRef.current) {
        setIsLoadingStats(false);
      }
      statsLoadingRef.current = false;
    }
  }, [defaultStatistics]);

  /**
   * Initialize admin access with deduplication
   */
  const initializeAdminAccess = useCallback(async () => {
    // Prevent duplicate initialization
    if (initializingRef.current) {
      console.log('⏭️ Skipping initialization - already in progress');
      return;
    }

    console.log('🔐 Initializing admin access...');
    initializingRef.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      // Check authentication
      if (!authService.isAuthenticated()) {
        console.log('❌ User not authenticated, redirecting to login');
        navigate('/login');
        return;
      }

      // Get current user info
      console.log('👤 Getting current user info...');
      const user = await authService.getCurrentUser();
      
      // Only proceed if component is still mounted
      if (!mountedRef.current) return;
      
      console.log('✅ Current user:', user);
      setCurrentAdmin(user);

      // Check admin privileges
      if (!user.is_admin) {
        console.log('❌ User is not admin, access denied');
        setError('You do not have admin privileges. Access denied.');
        return;
      }

      console.log('✅ Admin access verified, loading dashboard data...');
      
      // Load dashboard stats (this is now a separate, non-blocking operation)
      loadDashboardStats();
      
    } catch (err) {
      console.error('❌ Admin access initialization failed:', err);
      if (mountedRef.current) {
        setError('Failed to verify admin access. Please try logging in again.');
      }
    } finally {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
      initializingRef.current = false;
    }
  }, [navigate, loadDashboardStats]);

  /**
   * Handle tab change with error clearing
   */
  const handleTabChange = useCallback((tab: 'users' | 'llm-configs' | 'departments' | 'settings') => {
    console.log('📄 Switching to tab:', tab);
    setActiveTab(tab);
    setError(null); // Clear any errors when switching tabs
  }, []);

  /**
   * Handle logout
   */
  const handleLogout = useCallback(() => {
    console.log('🚪 Logging out...');
    authService.logout();
    navigate('/login');
  }, [navigate]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Initialize admin access on component mount
   * 
   * Learning: Empty dependency array means this only runs once when component mounts.
   * We use refs to track loading states and prevent duplicate requests.
   */
  useEffect(() => {
    console.log('🚀 AdminSettings component mounted');
    mountedRef.current = true;
    
    // Initialize admin access
    initializeAdminAccess();
    
    // Cleanup function
    return () => {
      console.log('🧹 AdminSettings component unmounting');
      mountedRef.current = false;
    };
  }, []); // Note: We intentionally don't include initializeAdminAccess in dependencies

  /**
   * Cleanup effect to prevent memory leaks
   */
  useEffect(() => {
    return () => {
      // Reset loading refs on unmount
      initializingRef.current = false;
      statsLoadingRef.current = false;
    };
  }, []);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render loading state
   */
  const renderLoading = useCallback(() => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading admin dashboard...</p>
        <p className="text-sm text-gray-400 mt-2">
          Verifying admin privileges and loading data
        </p>
      </div>
    </div>
  ), []);

  /**
   * Render error state
   */
  const renderError = useCallback(() => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={handleLogout}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  ), [error, handleLogout]);

  /**
   * Render admin header with user info and navigation
   */
  const renderHeader = useCallback(() => (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Left side - Title and admin info */}
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            {currentAdmin && (
              <span className="text-sm text-gray-500">
                Welcome, {currentAdmin.full_name || currentAdmin.username}
              </span>
            )}
          </div>

          {/* Right side - Quick stats and logout */}
          <div className="flex items-center space-x-6">
            {statistics && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center space-x-1">
                  <span>{statistics.total_users || 0}</span>
                  <span>Users</span>
                  {isLoadingStats && (
                    <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin ml-1"></div>
                  )}
                </span>
                <span>{statistics.active_users || 0} Active</span>
                <span>{statistics.admin_users || 0} Admins</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  ), [currentAdmin, statistics, isLoadingStats, handleLogout]);

  /**
   * Render tab navigation
   */
  const renderTabs = useCallback(() => (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
              {tab.icon && (
                <span className="ml-1">{tab.icon}</span>
              )}
              {tab.count !== null && tab.count !== undefined && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  ), [activeTab, tabs, handleTabChange]);

  /**
   * Render tab content based on active tab
   */
  const renderTabContent = useCallback(() => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {activeTab === 'users' && (
        <UserManagement />
      )}

      {activeTab === 'llm-configs' && (
        <LLMConfiguration />
      )}

      {activeTab === 'departments' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Department Management</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">
              Department management coming in a future update! 📋
            </p>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">
              System settings panel coming in a future update! ⚙️
            </p>
          </div>
        </div>
      )}
    </div>
  ), [activeTab]);

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  // Show loading state while initializing admin access
  if (isInitializing) {
    return renderLoading();
  }

  // Show error state if admin access fails
  if (error) {
    return renderError();
  }

  // Main admin interface
  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}
      {renderTabs()}
      {renderTabContent()}
    </div>
  );
};

export default AdminSettings;
