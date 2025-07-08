// 🏢 Department Management Component
// Comprehensive admin interface for managing departments

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

import { 
  departmentService, 
  Department, 
  DepartmentWithStats, 
  DepartmentCreate,
  DepartmentUpdate,
  DepartmentSearchFilters
} from '../../services/departmentService';

// Import our new separated components
import DepartmentStatsCards from './components/DepartmentStatsCards';
import DepartmentToolbar from './components/DepartmentToolbar';
import DepartmentTable from './components/DepartmentTable';
import DepartmentModals from './components/DepartmentModals';

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
  showBulkDeleteModal: boolean;
  showDetailsModal: boolean;
  editingDepartment: Department | null;
  deletingDepartment: Department | null;
  viewingDepartment: Department | null;
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
// MAIN COMPONENT (NOW MUCH CLEANER!)
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
    showBulkDeleteModal: false,
    showDetailsModal: false,
    editingDepartment: null,
    deletingDepartment: null,
    viewingDepartment: null,
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
    
    if (state.searchFilters.search_query) {
      const query = state.searchFilters.search_query.toLowerCase();
      filtered = filtered.filter(dept => 
        dept.name.toLowerCase().includes(query) ||
        dept.code.toLowerCase().includes(query) ||
        (dept.description && dept.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [state.departments, state.searchFilters]);

  const departmentStats = useMemo(() => {
    const stats = {
      total: state.departments.length,
      totalBudget: state.departments.reduce(
        (sum, d) => sum + (Number.isFinite(Number(d.monthly_budget)) ? Number(d.monthly_budget) : 0),
        0
      ),
      totalUsage: state.departments.reduce(
        (sum, d) => sum + (Number.isFinite(Number(d.monthly_usage)) ? Number(d.monthly_usage) : 0),
        0
      ),
      avgUtilization: 0
    };
    
    if (stats.total > 0) {
      const totalUtilization = state.departments.reduce(
        (sum, d) => sum + (Number.isFinite(Number(d.budget_utilization)) ? Number(d.budget_utilization) : 0),
        0
      );
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
      throw error;
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

  const handleBulkDelete = useCallback(async () => {
    if (state.selectedDepartments.length === 0) return;
    
    console.log('🗑️ Bulk deleting departments:', state.selectedDepartments);
    
    try {
      for (const departmentId of state.selectedDepartments) {
        await departmentService.deleteDepartment(departmentId);
      }
      
      console.log('✅ Departments deleted successfully');
      
      setState(prev => ({ ...prev, selectedDepartments: [] }));
      await loadDepartments();
    } catch (error) {
      console.error('❌ Failed to delete departments:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to delete departments' 
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
        page: 1
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

      {/* Statistics cards - Now in separate component */}
      <DepartmentStatsCards 
        departmentStats={departmentStats}
        departments={state.departments}
      />

      {/* Toolbar - Now in separate component */}
      <DepartmentToolbar 
        searchFilters={state.searchFilters}
        selectedDepartments={state.selectedDepartments}
        loading={state.loading}
        onSearchChange={handleSearchChange}
        onRefresh={loadDepartments}
        onCreateDepartment={() => setState(prev => ({ ...prev, showCreateModal: true }))}
        onBulkDelete={() => setState(prev => ({ ...prev, showBulkDeleteModal: true }))}
      />

      {/* Departments table - Now in separate component */}
      <DepartmentTable 
        departments={filteredDepartments}
        selectedDepartments={state.selectedDepartments}
        loading={state.loading}
        onSelectDepartment={handleSelectDepartment}
        onSelectAllDepartments={handleSelectAllDepartments}
        onEditDepartment={(dept) => setState(prev => ({ 
          ...prev, 
          showEditModal: true,
          editingDepartment: dept 
        }))}
        onDeleteDepartment={(dept) => setState(prev => ({ 
          ...prev, 
          showDeleteModal: true,
          deletingDepartment: dept 
        }))}
        onViewDepartment={(dept) => setState(prev => ({ 
          ...prev, 
          showDetailsModal: true,
          viewingDepartment: dept 
        }))}
        onCreateDepartment={() => setState(prev => ({ ...prev, showCreateModal: true }))}
        searchQuery={state.searchFilters.search_query}
      />

      {/* All Modals - Now in separate component */}
      <DepartmentModals 
        state={state}
        onCloseModals={() => setState(prev => ({
          ...prev,
          showCreateModal: false,
          showEditModal: false,
          showDeleteModal: false,
          showBulkDeleteModal: false,
          showDetailsModal: false,
          editingDepartment: null,
          deletingDepartment: null,
          viewingDepartment: null
        }))}
        onCreateDepartment={handleCreateDepartment}
        onUpdateDepartment={handleUpdateDepartment}
        onDeleteDepartment={handleDeleteDepartment}
        onBulkDelete={handleBulkDelete}
      />
    </div>
  );
};

export default DepartmentManagement;
