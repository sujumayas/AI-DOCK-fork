// 🎯 Quota Table State Management Hook
// Manages table data, pagination, sorting, and selection state

import { useState, useCallback, useMemo } from 'react';
import { quotaService, QuotaListResponse, QuotaSearchFilters } from '../../services/quotaService';
import { QuotaResponse, QuotaType, QuotaPeriod, QuotaStatus } from '../../types/quota';

// =============================================================================
// INTERFACES
// =============================================================================

export interface QuotaTableState {
  quotas: QuotaResponse[];
  loading: boolean;
  refreshing: boolean;
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

export interface FilterState {
  search: string;
  departmentId: number | null;
  llmConfigId: number | null;
  quotaType: QuotaType | null;
  quotaPeriod: QuotaPeriod | null;
  status: QuotaStatus | null;
  isEnforced: boolean | null;
  isExceeded: boolean | null;
}

interface UseQuotaTableReturn {
  // State
  tableState: QuotaTableState;
  filters: FilterState;
  selectedQuotas: Set<number>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  
  // Actions
  loadQuotas: () => Promise<void>;
  refreshQuotas: () => Promise<void>;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (pageSize: number) => void;
  handleSortChange: (field: string) => void;
  handleQuotaSelection: (quotaId: number, selected: boolean) => void;
  handleSelectAll: (selected: boolean) => void;
  clearSelection: () => void;
  updateQuotaInState: (updatedQuota: QuotaResponse) => void;
  removeQuotaFromState: (quotaId: number) => void;
  
  // Computed
  hasActiveFilters: boolean;
  filterSummary: string[];
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export const useQuotaTable = (): UseQuotaTableReturn => {
  // =============================================================================
  // STATE
  // =============================================================================

  const [tableState, setTableState] = useState<QuotaTableState>({
    quotas: [],
    loading: true,
    refreshing: false,
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

  const [filters, setFiltersState] = useState<FilterState>({
    search: '',
    departmentId: null,
    llmConfigId: null,
    quotaType: null,
    quotaPeriod: null,
    status: null,
    isEnforced: null,
    isExceeded: null,
  });

  const [selectedQuotas, setSelectedQuotas] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // =============================================================================
  // ACTIONS
  // =============================================================================

  /**
   * Load quotas with current filters and pagination
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
   * Refresh quotas (refresh button action)
   */
  const refreshQuotas = useCallback(async () => {
    try {
      console.log('🔄 Refreshing quotas...');
      setTableState(prev => ({ ...prev, refreshing: true, error: null }));

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
        refreshing: false,
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

      console.log('✅ Quotas refreshed successfully:', response.quotas.length, 'items');

    } catch (error) {
      console.error('❌ Error refreshing quotas:', error);
      setTableState(prev => ({
        ...prev,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Failed to refresh quotas',
      }));
    }
  }, [filters, tableState.pagination.page, tableState.pagination.pageSize, sortBy, sortOrder]);

  /**
   * Update filters and reset to first page
   */
  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    console.log('🔍 Filter changed:', newFilters);
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    
    // Reset to first page when filters change
    setTableState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page: 1 }
    }));
  }, []);

  /**
   * Reset all filters
   */
  const resetFilters = useCallback(() => {
    setFiltersState({
      search: '',
      departmentId: null,
      llmConfigId: null,
      quotaType: null,
      quotaPeriod: null,
      status: null,
      isEnforced: null,
      isExceeded: null,
    });
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
   * Handle page size changes
   */
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    console.log('📊 Page size changed to:', newPageSize);
    setTableState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        pageSize: newPageSize,
        page: 1 // Reset to first page when changing page size
      }
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

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedQuotas(new Set());
  }, []);

  /**
   * Update quota in local state (optimistic update)
   */
  const updateQuotaInState = useCallback((updatedQuota: QuotaResponse) => {
    setTableState(prev => ({
      ...prev,
      quotas: prev.quotas.map(q => 
        q.id === updatedQuota.id ? updatedQuota : q
      )
    }));
  }, []);

  /**
   * Remove quota from local state
   */
  const removeQuotaFromState = useCallback((quotaId: number) => {
    setTableState(prev => ({
      ...prev,
      quotas: prev.quotas.filter(q => q.id !== quotaId)
    }));
    
    // Clear from selection if selected
    setSelectedQuotas(prev => {
      const newSet = new Set(prev);
      newSet.delete(quotaId);
      return newSet;
    });
  }, []);

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
    if (filters.departmentId) active.push(`Dept: ${filters.departmentId}`);
    if (filters.quotaType) active.push(`Type: ${filters.quotaType}`);
    if (filters.status) active.push(`Status: ${filters.status}`);
    if (filters.isExceeded === true) active.push('Exceeded only');
    if (filters.isEnforced === false) active.push('Unenforced only');
    return active;
  }, [filters]);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    // State
    tableState,
    filters,
    selectedQuotas,
    sortBy,
    sortOrder,
    
    // Actions
    loadQuotas,
    refreshQuotas,
    setFilters,
    resetFilters,
    handlePageChange,
    handlePageSizeChange,
    handleSortChange,
    handleQuotaSelection,
    handleSelectAll,
    clearSelection,
    updateQuotaInState,
    removeQuotaFromState,
    
    // Computed
    hasActiveFilters,
    filterSummary,
  };
};