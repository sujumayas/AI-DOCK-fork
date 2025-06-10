// 🎯 Quota Management - Main Admin Interface
// Complete quota management dashboard with table, filters, and actions

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { quotaService, QuotaListResponse, QuotaResponse, QuotaSearchFilters } from '../../services/quotaService';
import { DepartmentOption, LLMConfigOption, QuotaType, QuotaPeriod, QuotaStatus } from '../../types/quota';
import QuotaTable from './QuotaTable';
import QuotaCreateModal from './QuotaCreateModal';
import QuotaEditModal from './QuotaEditModal';

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

interface QuotaManagementProps {
  onCreateQuota?: () => void; // Callback when create button is clicked
  onEditQuota?: (quota: QuotaResponse) => void; // Callback when edit action is triggered
  className?: string;
}

interface QuotaTableState {
  quotas: QuotaResponse[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  summary: {
    totalQuotas: number;
    activeQuotas: number;
    exceededQuotas: number;
    nearLimitQuotas: number;
  };
}

interface FilterState {
  search: string;
  departmentId: number | null;
  llmConfigId: number | null;
  quotaType: QuotaType | null;
  quotaPeriod: QuotaPeriod | null;
  status: QuotaStatus | null;
  isEnforced: boolean | null;
  isExceeded: boolean | null;
}

// =============================================================================
// MAIN QUOTA MANAGEMENT COMPONENT
// =============================================================================

/**
 * Quota Management Component
 * 
 * Learning: This is a complex data management component that demonstrates:
 * - State management for tables with filters and pagination
 * - Real-time data loading and error handling
 * - Professional admin UI patterns
 * - Integration between multiple services (quota, department, LLM config)
 */
export function QuotaManagement({ onCreateQuota, onEditQuota, className = '' }: QuotaManagementProps) {
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Main table state
  const [tableState, setTableState] = useState<QuotaTableState>({
    quotas: [],
    loading: true,
    error: null,
    pagination: {
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    },
    summary: {
      totalQuotas: 0,
      activeQuotas: 0,
      exceededQuotas: 0,
      nearLimitQuotas: 0,
    },
  });

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    departmentId: null,
    llmConfigId: null,
    quotaType: null,
    quotaPeriod: null,
    status: null,
    isEnforced: null,
    isExceeded: null,
  });

  // Reference data for dropdowns
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [llmConfigs, setLLMConfigs] = useState<LLMConfigOption[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);

  // UI state
  const [selectedQuotas, setSelectedQuotas] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [quotaToEdit, setQuotaToEdit] = useState<QuotaResponse | null>(null);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  /**
   * Load quotas with current filters and pagination
   * 
   * Learning: This function demonstrates how to:
   * - Convert UI state to API parameters
   * - Handle loading states properly
   * - Provide user feedback on errors
   */
  const loadQuotas = useCallback(async () => {
    try {
      console.log('📊 Loading quotas with filters:', filters);
      setTableState(prev => ({ ...prev, loading: true, error: null }));

      // Build search filters from UI state
      const searchFilters: QuotaSearchFilters = {
        page: tableState.pagination.page,
        page_size: tableState.pagination.pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      // Add active filters
      if (filters.search.trim()) searchFilters.search = filters.search.trim();
      if (filters.departmentId) searchFilters.department_id = filters.departmentId;
      if (filters.llmConfigId) searchFilters.llm_config_id = filters.llmConfigId;
      if (filters.quotaType) searchFilters.quota_type = filters.quotaType;
      if (filters.quotaPeriod) searchFilters.quota_period = filters.quotaPeriod;
      if (filters.status) searchFilters.status = filters.status;
      if (filters.isEnforced !== null) searchFilters.is_enforced = filters.isEnforced;
      if (filters.isExceeded !== null) searchFilters.is_exceeded = filters.isExceeded;

      // Call the API
      const response: QuotaListResponse = await quotaService.getQuotas(searchFilters);

      // Update state with response data
      setTableState(prev => ({
        ...prev,
        quotas: response.quotas,
        loading: false,
        pagination: {
          page: response.page,
          pageSize: response.page_size,
          totalCount: response.total_count,
          totalPages: response.total_pages,
          hasNext: response.has_next,
          hasPrevious: response.has_previous,
        },
        summary: {
          totalQuotas: response.summary.total_quotas,
          activeQuotas: response.summary.active_quotas,
          exceededQuotas: response.summary.exceeded_quotas,
          nearLimitQuotas: response.summary.near_limit_quotas,
        },
      }));

      console.log('✅ Quotas loaded successfully:', response.quotas.length, 'items');

    } catch (error) {
      console.error('❌ Error loading quotas:', error);
      setTableState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load quotas',
      }));
    }
  }, [filters, tableState.pagination.page, tableState.pagination.pageSize, sortBy, sortOrder]);

  /**
   * Load reference data for filter dropdowns
   * 
   * Learning: Loading reference data separately prevents blocking
   * the main UI if one data source is slow or fails.
   */
  const loadReferenceData = useCallback(async () => {
    try {
      console.log('📚 Loading reference data for filters...');
      setReferencesLoading(true);

      // Load departments and LLM configs in parallel
      const [deptData, llmData] = await Promise.all([
        quotaService.getDepartments(),
        quotaService.getLLMConfigs(),
      ]);

      setDepartments(deptData);
      setLLMConfigs(llmData);
      setReferencesLoading(false);

      console.log('✅ Reference data loaded:', deptData.length, 'departments,', llmData.length, 'LLM configs');

    } catch (error) {
      console.error('❌ Error loading reference data:', error);
      setReferencesLoading(false);
      // Don't set error state for reference data - the table can still work
    }
  }, []);

  // =============================================================================
  // EFFECT HOOKS
  // =============================================================================

  // Load reference data on component mount
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Load quotas when filters change
  useEffect(() => {
    loadQuotas();
  }, [loadQuotas]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle filter changes
   * 
   * Learning: When filters change, we reset to page 1 and reload data.
   * This provides consistent UX behavior.
   */
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    console.log('🔍 Filter changed:', newFilters);
    setFilters(prev => ({ ...prev, ...newFilters }));
    
    // Reset to first page when filters change
    setTableState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page: 1 }
    }));
  }, []);

  /**
   * Handle pagination changes
   */
  const handlePageChange = useCallback((newPage: number) => {
    console.log('📄 Page changed to:', newPage);
    setTableState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page: newPage }
    }));
  }, []);

  /**
   * Handle sorting changes
   */
  const handleSortChange = useCallback((field: string) => {
    console.log('📊 Sort changed:', field);
    setSortBy(field);
    setSortOrder(prev => 
      sortBy === field && prev === 'asc' ? 'desc' : 'asc'
    );
  }, [sortBy]);

  /**
   * Handle quota selection for bulk operations
   */
  const handleQuotaSelection = useCallback((quotaId: number, selected: boolean) => {
    setSelectedQuotas(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(quotaId);
      } else {
        newSet.delete(quotaId);
      }
      return newSet;
    });
  }, []);

  /**
   * Select/deselect all quotas
   */
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedQuotas(new Set(tableState.quotas.map(q => q.id)));
    } else {
      setSelectedQuotas(new Set());
    }
  }, [tableState.quotas]);

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  /**
   * Handle opening the create quota modal
   */
  const handleCreateQuota = useCallback(() => {
    console.log('🎯 Opening quota creation modal...');
    setShowCreateModal(true);
  }, []);

  /**
   * Handle opening the edit quota modal
   */
  const handleEditQuota = useCallback((quota: QuotaResponse) => {
    console.log('✏️ Opening quota edit modal for:', quota.name);
    setQuotaToEdit(quota);
    setShowEditModal(true);
  }, []);

  /**
   * Handle successful quota creation
   */
  const handleQuotaCreated = useCallback(async (newQuota: QuotaResponse) => {
    console.log('✅ Quota created successfully:', newQuota.name);
    
    // Reload quotas to include the new one
    await loadQuotas();
    
    // Show success message
    // Note: In a production app, you might use a toast notification instead
    alert(`✅ Quota "${newQuota.name}" created successfully!`);
  }, [loadQuotas]);

  /**
   * Handle successful quota update
   */
  const handleQuotaUpdated = useCallback(async (updatedQuota: QuotaResponse) => {
    console.log('✅ Quota updated successfully:', updatedQuota.name);
    
    // Update the quota in our local state immediately (optimistic update)
    setTableState(prev => ({
      ...prev,
      quotas: prev.quotas.map(q => 
        q.id === updatedQuota.id ? updatedQuota : q
      )
    }));
    
    // Also reload to ensure we have the latest data
    await loadQuotas();
    
    // Show success message
    alert(`✅ Quota "${updatedQuota.name}" updated successfully!`);
  }, [loadQuotas]);

  /**
   * Handle closing modals
   */
  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setQuotaToEdit(null);
  }, []);

  // =============================================================================
  // QUOTA ACTIONS
  // =============================================================================

  /**
   * Handle quota reset operation
   */
  const handleQuotaReset = useCallback(async (quota: QuotaResponse) => {
    try {
      console.log('🔄 Resetting quota:', quota.name);
      
      // Show confirmation dialog
      const confirmed = window.confirm(
        `Reset quota "${quota.name}" usage to zero?\n\n` +
        `Current usage: ${quotaService.formatQuotaAmount(quota.current_usage, quota.quota_type)}\n` +
        `This action cannot be undone.`
      );
      
      if (!confirmed) return;
      
      // Perform reset
      await quotaService.resetQuota(quota.id);
      
      // Reload quotas to reflect changes
      await loadQuotas();
      
      console.log('✅ Quota reset successfully');
      
    } catch (error) {
      console.error('❌ Error resetting quota:', error);
      alert(`Failed to reset quota: ${error.message}`);
    }
  }, [loadQuotas]);

  /**
   * Handle quota delete operation
   */
  const handleQuotaDelete = useCallback(async (quota: QuotaResponse) => {
    try {
      console.log('🗑️ Deleting quota:', quota.name);
      
      // Show confirmation dialog
      const confirmed = window.confirm(
        `Delete quota "${quota.name}"?\n\n` +
        `Department: ${quota.department_name}\n` +
        `Type: ${quota.quota_type}\n` +
        `Limit: ${quotaService.formatQuotaAmount(quota.limit_value, quota.quota_type)}\n\n` +
        `⚠️ This action cannot be undone!`
      );
      
      if (!confirmed) return;
      
      // Double confirmation for active quotas with usage
      if (quota.status === 'active' && quota.current_usage > 0) {
        const doubleConfirmed = window.confirm(
          `⚠️ FINAL CONFIRMATION ⚠️\n\n` +
          `This quota is active and has current usage.\n` +
          `Deleting it will permanently remove all tracking data.\n\n` +
          `Type "DELETE" to confirm:`
        );
        
        if (!doubleConfirmed) return;
      }
      
      // Perform delete
      await quotaService.deleteQuota(quota.id);
      
      // Clear selection if this quota was selected
      if (selectedQuotas.has(quota.id)) {
        setSelectedQuotas(prev => {
          const newSet = new Set(prev);
          newSet.delete(quota.id);
          return newSet;
        });
      }
      
      // Reload quotas to reflect changes
      await loadQuotas();
      
      console.log('✅ Quota deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting quota:', error);
      alert(`Failed to delete quota: ${error.message}`);
    }
  }, [loadQuotas, selectedQuotas]);

  /**
   * Handle enforcement toggle
   */
  const handleToggleEnforcement = useCallback(async (quota: QuotaResponse) => {
    try {
      console.log('🔄 Toggling enforcement for quota:', quota.name);
      
      // Update enforcement setting
      const updatedQuota = await quotaService.updateQuota(quota.id, {
        is_enforced: !quota.is_enforced
      });
      
      // Update the quota in our local state
      setTableState(prev => ({
        ...prev,
        quotas: prev.quotas.map(q => 
          q.id === quota.id ? updatedQuota : q
        )
      }));
      
      console.log(`✅ Enforcement ${updatedQuota.is_enforced ? 'enabled' : 'disabled'} for quota`);
      
    } catch (error) {
      console.error('❌ Error toggling enforcement:', error);
      alert(`Failed to update enforcement: ${error.message}`);
    }
  }, []);

  /**
   * Handle bulk reset operation
   */
  const handleBulkReset = useCallback(async () => {
    try {
      const quotaIds = Array.from(selectedQuotas);
      console.log('🔄 Bulk resetting quotas:', quotaIds);
      
      // Show confirmation
      const confirmed = window.confirm(
        `Reset usage for ${quotaIds.length} selected quota(s)?\n\n` +
        `This will set current usage to zero for all selected quotas.\n` +
        `This action cannot be undone.`
      );
      
      if (!confirmed) return;
      
      // Perform bulk reset
      const result = await quotaService.bulkResetQuotas(quotaIds);
      
      // Clear selection
      setSelectedQuotas(new Set());
      
      // Reload quotas
      await loadQuotas();
      
      // Show result summary
      if (result.successful_operations === quotaIds.length) {
        alert(`✅ Successfully reset ${result.successful_operations} quota(s)`);
      } else {
        alert(
          `⚠️ Reset completed with mixed results:\n` +
          `✅ Successful: ${result.successful_operations}\n` +
          `❌ Failed: ${result.failed_operations}\n\n` +
          `Check the quota list for details.`
        );
      }
      
      console.log('✅ Bulk reset completed');
      
    } catch (error) {
      console.error('❌ Error in bulk reset:', error);
      alert(`Failed to reset quotas: ${error.message}`);
    }
  }, [selectedQuotas, loadQuotas]);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return filters.search.trim() !== '' ||
           filters.departmentId !== null ||
           filters.llmConfigId !== null ||
           filters.quotaType !== null ||
           filters.quotaPeriod !== null ||
           filters.status !== null ||
           filters.isEnforced !== null ||
           filters.isExceeded !== null;
  }, [filters]);

  /**
   * Get filter summary for UI display
   */
  const filterSummary = useMemo(() => {
    const active = [];
    if (filters.search.trim()) active.push(`Search: "${filters.search}"`);
    if (filters.departmentId) {
      const dept = departments.find(d => d.id === filters.departmentId);
      active.push(`Dept: ${dept?.name || filters.departmentId}`);
    }
    if (filters.quotaType) active.push(`Type: ${filters.quotaType}`);
    if (filters.status) active.push(`Status: ${filters.status}`);
    if (filters.isExceeded === true) active.push('Exceeded only');
    if (filters.isEnforced === false) active.push('Unenforced only');
    return active;
  }, [filters, departments]);

  // =============================================================================
  // RENDER METHODS
  // =============================================================================

  /**
   * Render summary statistics cards
   */
  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/20">
        <div className="text-2xl font-bold text-gray-900">{tableState.summary.totalQuotas}</div>
        <div className="text-sm text-gray-700">Total Quotas</div>
      </div>
      
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/20">
        <div className="text-2xl font-bold text-green-600">{tableState.summary.activeQuotas}</div>
        <div className="text-sm text-gray-700">Active Quotas</div>
      </div>
      
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/20">
        <div className="text-2xl font-bold text-yellow-600">{tableState.summary.nearLimitQuotas}</div>
        <div className="text-sm text-gray-700">Near Limit</div>
      </div>
      
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/20">
        <div className="text-2xl font-bold text-red-600">{tableState.summary.exceededQuotas}</div>
        <div className="text-sm text-gray-700">Exceeded</div>
      </div>
    </div>
  );

  /**
   * Render filter controls
   */
  const renderFilters = () => (
    <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/20 mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search input */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="quota-search" className="block text-sm font-medium text-gray-800 mb-1">
            Search Quotas
          </label>
          <input
            id="quota-search"
            name="quota-search"
            type="text"
            value={filters.search}
            onChange={(e) => handleFilterChange({ search: e.target.value })}
            placeholder="Search by name or description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
        </div>

        {/* Department filter */}
        <div className="min-w-[150px]">
          <label htmlFor="quota-department-filter" className="block text-sm font-medium text-gray-800 mb-1">
            Department
          </label>
          <select
            id="quota-department-filter"
            name="quota-department-filter"
            value={filters.departmentId || ''}
            onChange={(e) => handleFilterChange({ departmentId: e.target.value ? Number(e.target.value) : null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={referencesLoading}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quota type filter */}
        <div className="min-w-[120px]">
          <label htmlFor="quota-type-filter" className="block text-sm font-medium text-gray-800 mb-1">
            Type
          </label>
          <select
            id="quota-type-filter"
            name="quota-type-filter"
            value={filters.quotaType || ''}
            onChange={(e) => handleFilterChange({ quotaType: e.target.value as QuotaType || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="cost">Cost</option>
            <option value="tokens">Tokens</option>
            <option value="requests">Requests</option>
          </select>
        </div>

        {/* Status filter */}
        <div className="min-w-[120px]">
          <label htmlFor="quota-status-filter" className="block text-sm font-medium text-gray-800 mb-1">
            Status
          </label>
          <select
            id="quota-status-filter"
            name="quota-status-filter"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange({ status: e.target.value as QuotaStatus || null })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="exceeded">Exceeded</option>
          </select>
        </div>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters({
                search: '',
                departmentId: null,
                llmConfigId: null,
                quotaType: null,
                quotaPeriod: null,
                status: null,
                isEnforced: null,
                isExceeded: null,
              });
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Active filters summary */}
      {filterSummary.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <strong>Active filters:</strong> {filterSummary.join(', ')}
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <div className="text-gray-600">Loading quotas...</div>
    </div>
  );

  /**
   * Render error state
   */
  const renderError = () => (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20">
      <div className="text-center">
        <div className="text-red-600 text-lg font-medium mb-2">
          ❌ Error Loading Quotas
        </div>
        <div className="text-gray-600 mb-4">{tableState.error}</div>
        <button
          onClick={loadQuotas}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  /**
   * Render empty state
   */
  const renderEmpty = () => (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20 text-center">
      <div className="text-gray-400 text-lg mb-2">📊</div>
      <div className="text-gray-600 text-lg font-medium mb-2">
        {hasActiveFilters ? 'No quotas match your filters' : 'No quotas configured yet'}
      </div>
      <div className="text-gray-500 mb-4">
        {hasActiveFilters 
          ? 'Try adjusting your search criteria or clearing filters.'
          : 'Create your first quota to start managing department budgets.'
        }
      </div>
      <button
        onClick={handleCreateQuota}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Create First Quota
      </button>
    </div>
  );

  /**
   * Render pagination controls
   */
  const renderPagination = () => {
    const { page, totalPages, totalCount, pageSize, hasNext, hasPrevious } = tableState.pagination;
    
    if (totalPages <= 1) return null;
    
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);
    
    // Generate page numbers to show
    const getPageNumbers = () => {
      const delta = 2; // Pages to show on each side of current page
      const pages = [];
      
      // Always show first page
      pages.push(1);
      
      // Add pages around current page
      for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      
      // Always show last page (if not already included)
      if (totalPages > 1 && !pages.includes(totalPages)) {
        pages.push(totalPages);
      }
      
      return pages.sort((a, b) => a - b);
    };
    
    const pageNumbers = getPageNumbers();
    
    return (
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          {/* Results info */}
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalCount}</span> quota(s)
          </div>
          
          {/* Page controls */}
          <div className="flex items-center space-x-2">
            {/* Previous button */}
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={!hasPrevious}
              className={`px-3 py-2 text-sm rounded-md ${
                hasPrevious
                  ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              Previous
            </button>
            
            {/* Page numbers */}
            <div className="flex space-x-1">
              {pageNumbers.map((pageNum, index) => {
                const prevPage = pageNumbers[index - 1];
                const showEllipsis = prevPage && pageNum - prevPage > 1;
                
                return (
                  <React.Fragment key={pageNum}>
                    {/* Ellipsis before page number */}
                    {showEllipsis && (
                      <span className="px-3 py-2 text-sm text-gray-500">...</span>
                    )}
                    
                    {/* Page number button */}
                    <button
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 text-sm rounded-md ${
                        pageNum === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
            
            {/* Next button */}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasNext}
              className={`px-3 py-2 text-sm rounded-md ${
                hasNext
                  ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          </div>
          
          {/* Page size selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Show:</span>
            <select
              value={tableState.pagination.pageSize}
              onChange={(e) => {
                const newPageSize = Number(e.target.value);
                setTableState(prev => ({
                  ...prev,
                  pagination: {
                    ...prev.pagination,
                    pageSize: newPageSize,
                    page: 1 // Reset to first page when changing page size
                  }
                }));
              }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">per page</span>
          </div>
        </div>
      </div>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`quota-management ${className}`}>
      {/* Page header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Quota Management</h2>
          <p className="text-blue-100 mt-1">
            Manage department usage limits and monitor consumption
          </p>
        </div>
        
        <button
          onClick={handleCreateQuota}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          + Create Quota
        </button>
      </div>

      {/* Summary cards */}
      {renderSummaryCards()}

      {/* Filters */}
      {renderFilters()}

      {/* Main content */}
      {tableState.loading ? (
        renderLoading()
      ) : tableState.error ? (
        renderError()
      ) : tableState.quotas.length === 0 ? (
        renderEmpty()
      ) : (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20">
          <QuotaTable
            quotas={tableState.quotas}
            selectedQuotas={selectedQuotas}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSortChange}
            onSelect={handleQuotaSelection}
            onSelectAll={handleSelectAll}
            onEdit={handleEditQuota}
            onReset={handleQuotaReset}
            onDelete={handleQuotaDelete}
            onToggleEnforcement={handleToggleEnforcement}
            loading={tableState.loading}
          />
          
          {/* Pagination */}
          {renderPagination()}
        </div>
      )}

      {/* Selection and bulk actions bar */}
      {selectedQuotas.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-4">
            <span>{selectedQuotas.size} quota(s) selected</span>
            <button
              onClick={handleBulkReset}
              className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100"
            >
              Reset Selected
            </button>
            <button
              onClick={() => setSelectedQuotas(new Set())}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-400"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Create Quota Modal */}
      <QuotaCreateModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        onSuccess={handleQuotaCreated}
      />

      {/* Edit Quota Modal */}
      <QuotaEditModal
        isOpen={showEditModal}
        quota={quotaToEdit}
        onClose={handleCloseEditModal}
        onSuccess={handleQuotaUpdated}
      />
    </div>
  );
}

export default QuotaManagement;
