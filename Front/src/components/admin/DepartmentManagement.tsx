// 🏢 Department Management Component
// Comprehensive admin interface for managing departments

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Building2, 
  Users, 
  DollarSign, 
  BarChart3,
  Power,
  PowerOff,
  RefreshCw,
  Download,
  Settings,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';

import { 
  departmentService, 
  Department, 
  DepartmentWithStats, 
  DepartmentCreate,
  DepartmentUpdate,
  DepartmentSearchFilters
} from '../../services/departmentService';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface DepartmentManagementState {
  departments: DepartmentWithStats[];
  loading: boolean;
  error: string | null;
  selectedDepartments: number[];
  searchFilters: DepartmentSearchFilters;
  showCreateModal: boolean;
  showEditModal: boolean;
  showDeleteModal: boolean;
  editingDepartment: Department | null;
  deletingDepartment: Department | null;
  stats: {
    total: number;
    active: number;
    inactive: number;
    totalBudget: number;
    totalUsage: number;
    avgUtilization: number;
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const DepartmentManagement: React.FC = () => {
  
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  const [state, setState] = useState<DepartmentManagementState>({
    departments: [],
    loading: true,
    error: null,
    selectedDepartments: [],
    searchFilters: {
      page: 1,
      page_size: 20,
      sort_by: 'name',
      sort_order: 'asc'
    },
    showCreateModal: false,
    showEditModal: false,
    showDeleteModal: false,
    editingDepartment: null,
    deletingDepartment: null,
    stats: {
      total: 0,
      active: 0,
      inactive: 0,
      totalBudget: 0,
      totalUsage: 0,
      avgUtilization: 0
    }
  });

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  const filteredDepartments = useMemo(() => {
    let filtered = [...state.departments];
    
    // Apply search filter
    if (state.searchFilters.search_query) {
      const query = state.searchFilters.search_query.toLowerCase();
      filtered = filtered.filter(dept => 
        dept.name.toLowerCase().includes(query) ||
        dept.code.toLowerCase().includes(query) ||
        (dept.description && dept.description.toLowerCase().includes(query))
      );
    }
    
    // Apply active filter
    if (state.searchFilters.is_active !== undefined) {
      filtered = filtered.filter(dept => dept.is_active === state.searchFilters.is_active);
    }
    
    return filtered;
  }, [state.departments, state.searchFilters]);

  const departmentStats = useMemo(() => {
    const stats = {
      total: state.departments.length,
      active: state.departments.filter(d => d.is_active).length,
      inactive: state.departments.filter(d => !d.is_active).length,
      totalBudget: state.departments.reduce((sum, d) => sum + d.monthly_budget, 0),
      totalUsage: state.departments.reduce((sum, d) => sum + (d.monthly_usage || 0), 0),
      avgUtilization: 0
    };
    
    if (stats.total > 0) {
      const totalUtilization = state.departments.reduce((sum, d) => sum + (d.budget_utilization || 0), 0);
      stats.avgUtilization = totalUtilization / stats.total;
    }
    
    return stats;
  }, [state.departments]);

  // ===========================================================================
  // DATA LOADING
  // ===========================================================================

  const loadDepartments = useCallback(async () => {
    console.log('📊 Loading departments...');
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const departments = await departmentService.getDepartmentsWithStats();
      console.log('✅ Departments loaded:', departments);
      
      setState(prev => ({ 
        ...prev, 
        departments,
        loading: false,
        error: null 
      }));
    } catch (error) {
      console.error('❌ Failed to load departments:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to load departments' 
      }));
    }
  }, []);

  // Load departments on component mount
  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  const handleCreateDepartment = useCallback(async (departmentData: DepartmentCreate) => {
    console.log('➕ Creating department:', departmentData);
    
    try {
      await departmentService.createDepartment(departmentData);
      console.log('✅ Department created successfully');
      
      setState(prev => ({ ...prev, showCreateModal: false }));
      await loadDepartments();
    } catch (error) {
      console.error('❌ Failed to create department:', error);
      throw error; // Re-throw so modal can handle it
    }
  }, [loadDepartments]);

  const handleUpdateDepartment = useCallback(async (
    departmentId: number, 
    departmentData: DepartmentUpdate
  ) => {
    console.log('✏️ Updating department:', departmentId, departmentData);
    
    try {
      await departmentService.updateDepartment(departmentId, departmentData);
      console.log('✅ Department updated successfully');
      
      setState(prev => ({ 
        ...prev, 
        showEditModal: false,
        editingDepartment: null 
      }));
      await loadDepartments();
    } catch (error) {
      console.error('❌ Failed to update department:', error);
      throw error;
    }
  }, [loadDepartments]);

  const handleDeleteDepartment = useCallback(async (departmentId: number) => {
    console.log('🗑️ Deleting department:', departmentId);
    
    try {
      await departmentService.deleteDepartment(departmentId);
      console.log('✅ Department deleted successfully');
      
      setState(prev => ({ 
        ...prev, 
        showDeleteModal: false,
        deletingDepartment: null 
      }));
      await loadDepartments();
    } catch (error) {
      console.error('❌ Failed to delete department:', error);
      throw error;
    }
  }, [loadDepartments]);

  // ===========================================================================
  // BULK OPERATIONS
  // ===========================================================================

  const handleInitializeDefaults = useCallback(async () => {
    console.log('🏗️ Initializing default departments...');
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      const result = await departmentService.initializeDefaultDepartments();
      console.log('✅ Default departments initialized:', result);
      
      await loadDepartments();
    } catch (error) {
      console.error('❌ Failed to initialize defaults:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize departments' 
      }));
    }
  }, [loadDepartments]);

  const handleBulkActivate = useCallback(async () => {
    if (state.selectedDepartments.length === 0) return;
    
    console.log('⚡ Bulk activating departments:', state.selectedDepartments);
    
    try {
      await departmentService.bulkActivateDepartments(state.selectedDepartments);
      console.log('✅ Departments activated successfully');
      
      setState(prev => ({ ...prev, selectedDepartments: [] }));
      await loadDepartments();
    } catch (error) {
      console.error('❌ Failed to activate departments:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to activate departments' 
      }));
    }
  }, [state.selectedDepartments, loadDepartments]);

  const handleBulkDeactivate = useCallback(async () => {
    if (state.selectedDepartments.length === 0) return;
    
    console.log('🔌 Bulk deactivating departments:', state.selectedDepartments);
    
    try {
      await departmentService.bulkDeactivateDepartments(state.selectedDepartments);
      console.log('✅ Departments deactivated successfully');
      
      setState(prev => ({ ...prev, selectedDepartments: [] }));
      await loadDepartments();
    } catch (error) {
      console.error('❌ Failed to deactivate departments:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to deactivate departments' 
      }));
    }
  }, [state.selectedDepartments, loadDepartments]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const handleSearchChange = useCallback((searchQuery: string) => {
    setState(prev => ({
      ...prev,
      searchFilters: {
        ...prev.searchFilters,
        search_query: searchQuery,
        page: 1 // Reset to first page
      }
    }));
  }, []);

  const handleFilterChange = useCallback((filters: Partial<DepartmentSearchFilters>) => {
    setState(prev => ({
      ...prev,
      searchFilters: {
        ...prev.searchFilters,
        ...filters,
        page: 1 // Reset to first page
      }
    }));
  }, []);

  const handleSelectDepartment = useCallback((departmentId: number, selected: boolean) => {
    setState(prev => ({
      ...prev,
      selectedDepartments: selected
        ? [...prev.selectedDepartments, departmentId]
        : prev.selectedDepartments.filter(id => id !== departmentId)
    }));
  }, []);

  const handleSelectAllDepartments = useCallback((selected: boolean) => {
    setState(prev => ({
      ...prev,
      selectedDepartments: selected ? filteredDepartments.map(d => d.id) : []
    }));
  }, [filteredDepartments]);

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

  const renderStatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Departments */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Departments</p>
            <p className="text-3xl font-bold text-gray-900">{departmentStats.total}</p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
          <span className="text-green-600 font-medium">{departmentStats.active} Active</span>
          <span className="text-gray-400 mx-2">•</span>
          <span className="text-gray-500">{departmentStats.inactive} Inactive</span>
        </div>
      </div>

      {/* Total Budget */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Monthly Budget</p>
            <p className="text-3xl font-bold text-gray-900">
              {departmentService.formatBudget(departmentStats.totalBudget)}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-gray-500">
            {departmentService.formatBudget(departmentStats.totalUsage)} used
          </div>
        </div>
      </div>

      {/* Average Utilization */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Avg Utilization</p>
            <p className="text-3xl font-bold text-gray-900">
              {departmentService.formatUtilization(departmentStats.avgUtilization)}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${departmentService.getBudgetUtilizationColor(departmentStats.avgUtilization)}`}
              style={{ width: `${Math.min(departmentStats.avgUtilization, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Total Users */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">
              {state.departments.reduce((sum, d) => sum + (d.user_count || 0), 0)}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          Across all departments
        </div>
      </div>
    </div>
  );

  const renderToolbar = () => (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left side - Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments..."
              value={state.searchFilters.search_query || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <select
            value={state.searchFilters.is_active === undefined ? 'all' : state.searchFilters.is_active.toString()}
            onChange={(e) => {
              const value = e.target.value;
              handleFilterChange({
                is_active: value === 'all' ? undefined : value === 'true'
              });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Bulk actions */}
          {state.selectedDepartments.length > 0 && (
            <>
              <button
                onClick={handleBulkActivate}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Power className="w-4 h-4" />
                <span>Activate ({state.selectedDepartments.length})</span>
              </button>
              
              <button
                onClick={handleBulkDeactivate}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <PowerOff className="w-4 h-4" />
                <span>Deactivate ({state.selectedDepartments.length})</span>
              </button>
            </>
          )}

          {/* Initialize defaults */}
          <button
            onClick={handleInitializeDefaults}
            disabled={state.loading}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Initialize Defaults</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadDepartments}
            disabled={state.loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Create department */}
          <button
            onClick={() => setState(prev => ({ ...prev, showCreateModal: true }))}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Department</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderDepartmentsTable = () => (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
      {/* Table header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Departments ({filteredDepartments.length})
          </h3>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={state.selectedDepartments.length === filteredDepartments.length && filteredDepartments.length > 0}
              onChange={(e) => handleSelectAllDepartments(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">Select All</span>
          </div>
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={state.selectedDepartments.length === filteredDepartments.length && filteredDepartments.length > 0}
                  onChange={(e) => handleSelectAllDepartments(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Users
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Budget
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utilization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDepartments.map((department) => (
              <tr 
                key={department.id}
                className={`hover:bg-gray-50 transition-colors ${
                  state.selectedDepartments.includes(department.id) ? 'bg-blue-50' : ''
                }`}
              >
                {/* Selection checkbox */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={state.selectedDepartments.includes(department.id)}
                    onChange={(e) => handleSelectDepartment(department.id, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>

                {/* Department info */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{department.name}</div>
                      <div className="text-sm text-gray-500">{department.code}</div>
                      {department.description && (
                        <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                          {department.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Users */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{department.user_count || 0}</div>
                  <div className="text-xs text-gray-500">
                    {department.active_user_count || 0} active
                  </div>
                </td>

                {/* Budget */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {departmentService.formatBudget(department.monthly_budget)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {departmentService.formatBudget(department.monthly_usage || 0)} used
                  </div>
                </td>

                {/* Utilization */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className={`h-2 rounded-full ${departmentService.getBudgetUtilizationColor(department.budget_utilization || 0)}`}
                        style={{ width: `${Math.min(department.budget_utilization || 0, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-900">
                      {departmentService.formatUtilization(department.budget_utilization || 0)}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    department.is_active 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {department.is_active ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setState(prev => ({ 
                        ...prev, 
                        showEditModal: true,
                        editingDepartment: department 
                      }))}
                      className="text-indigo-600 hover:text-indigo-900 transition-colors"
                      title="Edit department"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => setState(prev => ({ 
                        ...prev, 
                        showDeleteModal: true,
                        deletingDepartment: department 
                      }))}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Delete department"
                      disabled={department.user_count > 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {filteredDepartments.length === 0 && !state.loading && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
          <p className="text-gray-500 mb-4">
            {state.searchFilters.search_query 
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first department'
            }
          </p>
          {!state.searchFilters.search_query && (
            <button
              onClick={() => setState(prev => ({ ...prev, showCreateModal: true }))}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Department</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  if (state.loading && state.departments.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading departments...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
        <div className="flex items-center space-x-3 text-red-600 mb-4">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Error Loading Departments</span>
        </div>
        <p className="text-gray-600 mb-4">{state.error}</p>
        <button
          onClick={loadDepartments}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Department Management</h2>
          <p className="text-blue-100 mt-1">
            Manage organizational departments, budgets, and user assignments
          </p>
        </div>
      </div>

      {/* Statistics cards */}
      {renderStatsCards()}

      {/* Toolbar */}
      {renderToolbar()}

      {/* Departments table */}
      {renderDepartmentsTable()}

      {/* Modals */}
      {state.showCreateModal && (
        <DepartmentCreateModal
          onClose={() => setState(prev => ({ ...prev, showCreateModal: false }))}
          onSubmit={handleCreateDepartment}
        />
      )}

      {state.showEditModal && state.editingDepartment && (
        <DepartmentEditModal
          department={state.editingDepartment}
          onClose={() => setState(prev => ({ 
            ...prev, 
            showEditModal: false,
            editingDepartment: null 
          }))}
          onSubmit={(data) => handleUpdateDepartment(state.editingDepartment!.id, data)}
        />
      )}

      {state.showDeleteModal && state.deletingDepartment && (
        <DepartmentDeleteModal
          department={state.deletingDepartment}
          onClose={() => setState(prev => ({ 
            ...prev, 
            showDeleteModal: false,
            deletingDepartment: null 
          }))}
          onConfirm={() => handleDeleteDepartment(state.deletingDepartment!.id)}
        />
      )}
    </div>
  );
};

// =============================================================================
// MODAL COMPONENTS
// =============================================================================

// Create Department Modal
interface DepartmentCreateModalProps {
  onClose: () => void;
  onSubmit: (data: DepartmentCreate) => Promise<void>;
}

const DepartmentCreateModal: React.FC<DepartmentCreateModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<DepartmentCreate>({
    name: '',
    code: '',
    description: '',
    monthly_budget: 1000,
    manager_email: '',
    location: '',
    cost_center: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate data
      const validationErrors = departmentService.validateDepartmentData(formData);
      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return;
      }

      await onSubmit(formData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Create Department</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Engineering"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ENG"
                maxLength={10}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Software development, DevOps, and technical infrastructure"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Budget ($)
              </label>
              <input
                type="number"
                value={formData.monthly_budget}
                onChange={(e) => setFormData(prev => ({ ...prev, monthly_budget: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manager Email
              </label>
              <input
                type="email"
                value={formData.manager_email}
                onChange={(e) => setFormData(prev => ({ ...prev, manager_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="manager@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tech Building, Floor 3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Center
              </label>
              <input
                type="text"
                value={formData.cost_center}
                onChange={(e) => setFormData(prev => ({ ...prev, cost_center: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="CC-ENG-001"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Department is active
              </label>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {loading ? 'Creating...' : 'Create Department'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit Department Modal (similar structure to create modal)
interface DepartmentEditModalProps {
  department: Department;
  onClose: () => void;
  onSubmit: (data: DepartmentUpdate) => Promise<void>;
}

const DepartmentEditModal: React.FC<DepartmentEditModalProps> = ({ department, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<DepartmentUpdate>({
    name: department.name,
    code: department.code,
    description: department.description || '',
    monthly_budget: department.monthly_budget,
    manager_email: department.manager_email || '',
    location: department.location || '',
    cost_center: department.cost_center || '',
    is_active: department.is_active
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update department');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Edit Department</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Same form fields as create modal but with different submit text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Code *
              </label>
              <input
                type="text"
                value={formData.code || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={10}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Budget ($)
              </label>
              <input
                type="number"
                value={formData.monthly_budget || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, monthly_budget: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manager Email
              </label>
              <input
                type="email"
                value={formData.manager_email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, manager_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Center
              </label>
              <input
                type="text"
                value={formData.cost_center || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, cost_center: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active_edit"
                checked={formData.is_active || false}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_active_edit" className="ml-2 text-sm text-gray-700">
                Department is active
              </label>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {loading ? 'Updating...' : 'Update Department'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Delete Department Modal
interface DepartmentDeleteModalProps {
  department: Department;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const DepartmentDeleteModal: React.FC<DepartmentDeleteModalProps> = ({ department, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      await onConfirm();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete department');
    } finally {
      setLoading(false);
    }
  };

  const hasUsers = department.user_count && department.user_count > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Department</h3>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete the department <strong>{department.name}</strong>?
            </p>
            
            {hasUsers ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2 text-yellow-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Cannot delete department</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  This department has {department.user_count} assigned users. 
                  Please reassign all users to other departments before deleting.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  This action cannot be undone. All data associated with this department will be permanently removed.
                </p>
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || hasUsers}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading ? 'Deleting...' : 'Delete Department'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentManagement;
