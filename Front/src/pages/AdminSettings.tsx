// 🛡️ Admin Settings Page
// Main admin dashboard with tabbed navigation
// This is the central hub for all admin operations
// 
// 🚀 OPTIMIZED VERSION - Fixed rapid refreshing and performance issues

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { authService } from '../services/authService';

// Component imports
import { UserManagement } from '../components/admin/UserManagement';
import LLMConfiguration from '../components/admin/LLMConfiguration';
import UsageDashboard from '../components/admin/UsageDashboard';
import QuotaManagement from '../components/admin/QuotaManagement';
import DepartmentManagement from '../components/admin/DepartmentManagement';

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
  const [activeTab, setActiveTab] = useState<'users' | 'llm-configs' | 'usage-analytics' | 'quota-management' | 'departments' | 'settings'>('users');
  
  // Loading and error states
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Admin data
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  
  // Request tracking to prevent duplicates
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  // =============================================================================
  // MEMOIZED VALUES AND CALLBACKS
  // =============================================================================

  /**
   * Memoized tab configuration
   */
  const tabs = useMemo(() => [
    { 
      id: 'users' as const, 
      name: 'User Management', 
      icon: '👥'
    },
    { 
      id: 'llm-configs' as const, 
      name: 'LLM Providers', 
      icon: '🤖'
    },
    { 
      id: 'usage-analytics' as const, 
      name: 'Usage Analytics', 
      icon: '📊'
    },
    { 
      id: 'quota-management' as const, 
      name: 'Quota Management', 
      icon: '🎯'
    },
    { 
      id: 'departments' as const, 
      name: 'Departments', 
      icon: '🏢'
    },
    { 
      id: 'settings' as const, 
      name: 'System Settings', 
      icon: '⚙️'
    },
  ], []);



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

      console.log('✅ Admin access verified');
      
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
  }, [navigate]);

  /**
   * Handle tab change with error clearing
   */
  const handleTabChange = useCallback((tab: 'users' | 'llm-configs' | 'usage-analytics' | 'quota-management' | 'departments' | 'settings') => {
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
  
  /**
   * Handle back to dashboard
   */
  const handleBackToDashboard = useCallback(() => {
    console.log('🏠 Navigating back to dashboard');
    navigate('/');
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
    <div className="bg-white/10 backdrop-blur-sm shadow-sm border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Left side - Title and admin info */}
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            {currentAdmin && (
              <span className="text-sm text-blue-200">
                Welcome, {currentAdmin.full_name || currentAdmin.username}
              </span>
            )}
          </div>

          {/* Right side - dashboard link and logout */}
          <div className="flex items-center space-x-6">
            {/* Dashboard navigation button */}
            <button
              onClick={handleBackToDashboard}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-md transition-all duration-200 backdrop-blur-sm"
              title="Back to Dashboard"
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="text-blue-200 hover:text-white font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  ), [currentAdmin, handleLogout]);

  /**
   * Render tab navigation
   */
  const renderTabs = useCallback(() => (
    <div className="bg-white/5 backdrop-blur-sm border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-white text-white'
                  : 'border-transparent text-blue-200 hover:text-white hover:border-white/50'
              }`}
            >
              {tab.name}
              {tab.icon && (
                <span className="ml-1">{tab.icon}</span>
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

      {activeTab === 'usage-analytics' && (
        <UsageDashboard />
      )}

      {activeTab === 'quota-management' && (
        <QuotaManagement 
          onCreateQuota={() => {
            console.log('🎯 Create quota button clicked from admin settings');
            // The QuotaManagement component handles the modal internally
          }}
          onEditQuota={(quota) => {
            console.log('✏️ Edit quota button clicked:', quota.name);
            // The QuotaManagement component handles the edit modal internally
          }}
        />
      )}

      {activeTab === 'departments' && (
        <DepartmentManagement />
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8">
          {/* System Settings - moved to top */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <span>⚙️</span>
              <span>System Settings</span>
            </h2>
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
              <div className="space-y-6">
                
                {/* Server Configuration Section */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <span>🖥️</span>
                    <span>Server Configuration</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <label className="block text-sm font-medium text-gray-500 mb-1">API Base URL</label>
                      <div className="text-sm text-gray-400">http://localhost:8000</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Environment</label>
                      <div className="text-sm text-gray-400">Development</div>
                    </div>
                  </div>
                </div>

                {/* Security Settings Section */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <span>🔒</span>
                    <span>Security Settings</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-500">Session Timeout</div>
                        <div className="text-xs text-gray-400">Auto-logout after inactivity</div>
                      </div>
                      <div className="text-sm text-gray-400">24 hours</div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-500">Two-Factor Authentication</div>
                        <div className="text-xs text-gray-400">Require 2FA for admin accounts</div>
                      </div>
                      <div className="text-sm text-gray-400">Disabled</div>
                    </div>
                  </div>
                </div>

                {/* System Monitoring Section */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <span>📊</span>
                    <span>System Monitoring</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <div className="text-lg font-semibold text-gray-400">--</div>
                      <div className="text-xs text-gray-500">CPU Usage</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <div className="text-lg font-semibold text-gray-400">--</div>
                      <div className="text-xs text-gray-500">Memory Usage</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <div className="text-lg font-semibold text-gray-400">--</div>
                      <div className="text-xs text-gray-500">Active Connections</div>
                    </div>
                  </div>
                </div>

                {/* Coming Soon Notice */}
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg">⚙️</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Configuration Panel Coming Soon</h4>
                  <p className="text-xs text-gray-500">
                    These settings will be configurable in a future update
                  </p>
                </div>
                
              </div>
            </div>
          </div>
          
          {/* Additional system settings can be added here in the future */}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
      {renderHeader()}
      {renderTabs()}
      {renderTabContent()}
    </div>
  );
};

export default AdminSettings;
