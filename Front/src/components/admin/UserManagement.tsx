// 👥 User Management Component
// Comprehensive user management interface for admins
// This showcases advanced React patterns and admin UX design
// 
// 🚀 OPTIMIZED VERSION - Fixed rapid refreshing and performance issues

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX, 
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  AlertCircle,
  Loader2
} from 'lucide-react';

import { adminService } from '../../services/adminService';
import { 
  User, 
  UserSearchFilters, 
  UserListResponse,
  LoadingState 
} from '../../types/admin';
import { UserCreateModal } from './UserCreateModal';
import { UserEditModal } from './UserEditModal';
import { UserSearch } from './user/UserSearch';

/**
 * UserManagement Component
 * 
 * Learning: This is a "feature component" that encapsulates all user management functionality.
 * 
 * 🔧 PERFORMANCE OPTIMIZATIONS:
 * - Fixed circular dependencies in useCallback chains
 * - Added request deduplication to prevent duplicate API calls
 * - Proper form element IDs to fix accessibility warnings
 * - Optimized effect dependencies to prevent infinite re-renders
 * - Added cleanup to prevent memory leaks
 */
export const UserManagement: React.FC = () => {
  
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // User data and pagination
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // UI states
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  
  // Search and filtering
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<UserSearchFilters>({
    page: 1,
    page_size: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Request tracking to prevent duplicates
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const currentRequestRef = useRef<AbortController | null>(null);

  // =============================================================================
  // MEMOIZED VALUES
  // =============================================================================

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  /**
   * Load users from the API with deduplication and proper error handling
   * 
   * Learning: This function demonstrates proper async data fetching with
   * loading states, error handling, and request deduplication.
   */
  const loadUsers = useCallback(async (searchFilters: UserSearchFilters = {}) => {
    // Prevent duplicate requests
    if (loadingRef.current) {
      console.log('⏭️ Skipping user load - already in progress');
      return;
    }

    // Cancel any existing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    console.log('👥 Loading users with filters:', searchFilters);
    loadingRef.current = true;
    setLoadingState('loading');
    setError(null);

    // Create abort controller for this request
    const abortController = new AbortController();
    currentRequestRef.current = abortController;

    try {
      // Merge with current filters
      const finalFilters = { ...filters, ...searchFilters };
      
      const response: UserListResponse = await adminService.searchUsers(finalFilters);
      
      // Only update state if component is still mounted and request wasn't aborted
      if (mountedRef.current && !abortController.signal.aborted) {
        console.log('✅ Users loaded:', response.users.length, 'total:', response.total_count);
        setUsers(response.users);
        setTotalUsers(response.total_count);
        setCurrentPage(response.page);
        setTotalPages(response.total_pages);
        setLoadingState('success');
      }
      
    } catch (err) {
      // Only handle error if not aborted and component is mounted
      if (mountedRef.current && !abortController.signal.aborted) {
        console.error('❌ Failed to load users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load users');
        setLoadingState('error');
      }
    } finally {
      if (mountedRef.current) {
        loadingRef.current = false;
      }
      if (currentRequestRef.current === abortController) {
        currentRequestRef.current = null;
      }
    }
  }, []); // No dependencies to prevent circular loops

  /**
   * Handle search query changes from UserSearch component
   * 
   * Learning: Clean callback interface between extracted components
   */
  const handleSearch = useCallback((query: string) => {
    const newFilters = {
      ...filters,
      search_query: query || undefined,
      page: 1 // Reset to first page when searching
    };
    setFilters(newFilters);
    loadUsers(newFilters);
  }, [filters, loadUsers]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle user edit with proper state management
   */
  const handleEditUser = useCallback((user: User) => {
    setEditingUser(user);
    setShowEditModal(true);
  }, []);

  /**
   * Handle user update success
   */
  const handleUserUpdated = useCallback(() => {
    // Refresh the user list with current filters
    loadUsers(filters);
    // Close the modal
    setShowEditModal(false);
    setEditingUser(null);
  }, [loadUsers, filters]);

  /**
   * Handle user creation success
   */
  const handleUserCreated = useCallback(() => {
    // Refresh the user list with current filters
    loadUsers(filters);
    // Close the modal
    setShowCreateModal(false);
  }, [loadUsers, filters]);

  /**
   * Handle opening create user modal
   */
  const handleCreateUser = useCallback(() => {
    setShowCreateModal(true);
  }, []);



  /**
   * Handle filter changes with proper state management
   */
  const handleFilterChange = useCallback((newFilters: Partial<UserSearchFilters>) => {
    const updatedFilters = {
      ...filters,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    };
    setFilters(updatedFilters);
    loadUsers(updatedFilters);
  }, [filters, loadUsers]);

  /**
   * Handle pagination changes
   */
  const handlePageChange = useCallback((newPage: number) => {
    const newFilters = {
      ...filters,
      page: newPage
    };
    setFilters(newFilters);
    loadUsers(newFilters);
  }, [filters, loadUsers]);

  /**
   * Handle user selection (for bulk operations)
   */
  const handleUserSelection = useCallback((userId: number, selected: boolean) => {
    setSelectedUsers(prev => 
      selected 
        ? [...prev, userId]
        : prev.filter(id => id !== userId)
    );
  }, []);

  /**
   * Handle select all users
   */
  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedUsers(selected ? users.map(user => user.id) : []);
  }, [users]);

  /**
   * Handle user actions (edit, delete, etc.)
   */
  const handleUserAction = useCallback(async (action: string, userId: number) => {
    try {
      setLoadingState('loading');
      
      switch (action) {
        case 'activate':
          await adminService.activateUser(userId);
          break;
        case 'deactivate':
          await adminService.deactivateUser(userId);
          break;
        case 'delete':
          if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            await adminService.deleteUser(userId);
          } else {
            setLoadingState('success');
            return;
          }
          break;
        default:
          console.log(`Action ${action} for user ${userId} not implemented yet`);
          setLoadingState('success');
          return;
      }
      
      // Reload users after action
      await loadUsers(filters);
      
    } catch (err) {
      console.error(`Failed to ${action} user:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${action} user`);
      setLoadingState('error');
    }
  }, [loadUsers, filters]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Initialize component and load initial data
   */
  useEffect(() => {
    console.log('🚀 UserManagement component mounted');
    mountedRef.current = true;
    
    // Load initial user data
    loadUsers(filters);
    
    // Cleanup function
    return () => {
      console.log('🧹 UserManagement component unmounting');
      mountedRef.current = false;
      loadingRef.current = false;
      
      // Cancel any ongoing requests
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []); // Only run on mount/unmount

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render loading state
   */
  const renderLoading = useCallback(() => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-4" />
        <p className="text-blue-200">Loading users...</p>
      </div>
    </div>
  ), []);

  /**
   * Render error state
   */
  const renderError = useCallback(() => (
    <div className="bg-red-500/10 backdrop-blur-lg border border-red-400/20 rounded-3xl p-6 text-center">
      <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-red-300 mb-2">Error Loading Users</h3>
      <p className="text-red-400 mb-4">{error}</p>
      <button
        onClick={() => loadUsers(filters)}
        className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white px-6 py-3 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform"
      >
        Try Again
      </button>
    </div>
  ), [error, loadUsers, filters]);

  /**
   * Render empty state
   */
  const renderEmptyState = useCallback(() => (
    <div className="text-center py-12">
      <UsersIcon className="h-12 w-12 text-blue-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">No Users Found</h3>
      <p className="text-blue-200 mb-4">
        {filters.search_query ? 'Try adjusting your search or filters.' : 'Get started by creating your first user.'}
      </p>
      <button
        onClick={handleCreateUser}
        className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white px-6 py-3 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform"
      >
        Create User
      </button>
    </div>
  ), [filters.search_query, handleCreateUser]);

  /**
   * Render search and filter controls
   */
  const renderSearchAndFilters = useCallback(() => (
    <div className="bg-white/5 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/10 p-6 mb-6 hover:shadow-3xl transition-all duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        
        {/* Search Input - Now using extracted UserSearch component */}
        <div className="flex-1">
          <UserSearch
            onSearch={handleSearch}
            placeholder="Search users by name, email, or username..."
            initialValue={filters.search_query || ''}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-105 transform ${
              showFilters
                ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30 backdrop-blur-lg'
                : 'bg-white/10 text-blue-200 border border-white/20 hover:bg-white/20 backdrop-blur-lg'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </button>
          
          <button
            onClick={handleCreateUser}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform"
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* Status Filter */}
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-800 mb-1">Status</label>
              <select
                id="status-filter"
                name="status-filter"
                value={filters.is_active?.toString() || ''}
                onChange={(e) => handleFilterChange({
                  is_active: e.target.value === '' ? undefined : e.target.value === 'true'
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Users</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {/* Admin Filter */}
            <div>
              <label htmlFor="type-filter" className="block text-sm font-medium text-gray-800 mb-1">Type</label>
              <select
                id="type-filter"
                name="type-filter"
                value={filters.is_admin?.toString() || ''}
                onChange={(e) => handleFilterChange({
                  is_admin: e.target.value === '' ? undefined : e.target.value === 'true'
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="true">Admins</option>
                <option value="false">Regular Users</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label htmlFor="sort-by-filter" className="block text-sm font-medium text-gray-800 mb-1">Sort By</label>
              <select
                id="sort-by-filter"
                name="sort-by-filter"
                value={filters.sort_by || 'created_at'}
                onChange={(e) => handleFilterChange({ 
                  sort_by: e.target.value as "id" | "username" | "email" | "department" | "created_at" | "last_login_at"
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="created_at">Date Created</option>
                <option value="username">Username</option>
                <option value="email">Email</option>
                <option value="department">Department</option>
                <option value="last_login_at">Last Login</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label htmlFor="sort-order-filter" className="block text-sm font-medium text-gray-800 mb-1">Order</label>
              <select
                id="sort-order-filter"
                name="sort-order-filter"
                value={filters.sort_order || 'desc'}
                onChange={(e) => handleFilterChange({ sort_order: e.target.value as 'asc' | 'desc' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  ), [handleSearch, showFilters, handleCreateUser, filters, handleFilterChange]);

  /**
   * Render user status badge
   */
  const renderStatusBadge = useCallback((user: User) => {
    if (!user.is_active) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Inactive
        </span>
      );
    }
    
    if (user.is_admin) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Admin
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    );
  }, []);

  /**
   * Render users table
   */
  const renderUsersTable = useCallback(() => (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  id="select-all-users"
                  name="select-all-users"
                  type="checkbox"
                  checked={selectedUsers.length === users.length && users.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role & Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    id={`user-select-${user.id}`}
                    name={`user-select-${user.id}`}
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {(user.full_name || user.username).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.full_name || user.username}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.role_name || 'No Role'}</div>
                  <div className="text-sm text-gray-500">{user.department_name || 'No Department'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {renderStatusBadge(user)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.last_login_at 
                    ? new Date(user.last_login_at).toLocaleDateString()
                    : 'Never'
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                      title="Edit User"
                      aria-label={`Edit user ${user.username}`}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    
                    {user.is_active ? (
                      <button
                        onClick={() => handleUserAction('deactivate', user.id)}
                        className="text-yellow-600 hover:text-yellow-900 transition-colors"
                        title="Deactivate User"
                        aria-label={`Deactivate user ${user.username}`}
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUserAction('activate', user.id)}
                        className="text-green-600 hover:text-green-900 transition-colors"
                        title="Activate User"
                        aria-label={`Activate user ${user.username}`}
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleUserAction('delete', user.id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Delete User"
                      aria-label={`Delete user ${user.username}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ), [users, selectedUsers, handleSelectAll, handleUserSelection, renderStatusBadge, handleEditUser, handleUserAction]);

  /**
   * Render pagination controls
   */
  const renderPagination = useCallback(() => {
    if (totalPages <= 1) return null;

    return (
      <div className="bg-white/95 backdrop-blur-sm px-6 py-3 border-t border-white/20 flex items-center justify-between">
        <div className="flex-1 flex justify-between sm:hidden">
          {/* Mobile pagination */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">{((currentPage - 1) * (filters.page_size || 20)) + 1}</span>
              {' '}to{' '}
              <span className="font-medium">
                {Math.min(currentPage * (filters.page_size || 20), totalUsers)}
              </span>
              {' '}of{' '}
              <span className="font-medium">{totalUsers}</span>
              {' '}results
            </p>
          </div>
          
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                const isActive = page === currentPage;
                
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      isActive
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                    aria-label={`Go to page ${page}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  }, [totalPages, currentPage, handlePageChange, filters.page_size, totalUsers]);

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-blue-100">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="text-sm text-blue-200">
          {totalUsers} total users
        </div>
      </div>

      {/* Search and Filters */}
      {renderSearchAndFilters()}

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              {selectedUsers.length} user{selectedUsers.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {/* TODO: Bulk activate */}}
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
              >
                Activate
              </button>
              <button
                onClick={() => {/* TODO: Bulk deactivate */}}
                className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded transition-colors"
              >
                Deactivate
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loadingState === 'loading' && renderLoading()}
      {loadingState === 'error' && renderError()}
      {loadingState === 'success' && users.length === 0 && renderEmptyState()}
      {loadingState === 'success' && users.length > 0 && (
        <>
          {renderUsersTable()}
          {renderPagination()}
        </>
      )}

      {/* User Creation Modal */}
      <UserCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={handleUserCreated}
      />

      {/* User Edit Modal */}
      <UserEditModal
        isOpen={showEditModal}
        user={editingUser}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
};
