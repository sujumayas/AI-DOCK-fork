// 🎯 Quota Management - Refactored Main Admin Interface
// Clean orchestrator component using modular hooks and atomic components

import React, { useEffect, useCallback } from 'react';
import { QuotaResponse } from '../../types/quota';
import QuotaTable from './QuotaTable';
import QuotaCreateModal from './QuotaCreateModal';
import QuotaEditModal from './QuotaEditModal';

// Modular hooks
import { 
  useQuotaTable,
  useQuotaModals,
  useQuotaReferenceData
} from '../../hooks/quota';

// Atomic components
import {
  QuotaSummaryCards,
  QuotaFilters,
  QuotaPagination,
  QuotaBulkActions,
  QuotaToolbar
} from './quota';

// Business logic services
import { QuotaOperations } from '../../services/quota/quotaOperations';

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

interface QuotaManagementProps {
  onCreateQuota?: () => void; // Callback when create button is clicked
  onEditQuota?: (quota: QuotaResponse) => void; // Callback when edit action is triggered
  className?: string;
}

// =============================================================================
// MAIN QUOTA MANAGEMENT COMPONENT
// =============================================================================

/**
 * Quota Management Component (Refactored)
 * 
 * Learning: This refactored version demonstrates:
 * - Clean separation of concerns using custom hooks
 * - Atomic component composition
 * - Single responsibility principle
 * - Modular business logic
 * - Maintainable and testable architecture
 */
export function QuotaManagement({ onCreateQuota, onEditQuota, className = '' }: QuotaManagementProps) {
  // =============================================================================
  // HOOKS - STATE MANAGEMENT
  // =============================================================================

  // Table state and operations
  const {
    tableState,
    filters,
    selectedQuotas,
    sortBy,
    sortOrder,
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
    hasActiveFilters,
    filterSummary,
  } = useQuotaTable();

  // Modal state and operations
  const {
    showCreateModal,
    showEditModal,
    quotaToEdit,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    handleQuotaCreated,
    handleQuotaUpdated,
  } = useQuotaModals();

  // Reference data for filters
  const {
    departments,
    llmConfigs,
    loading: referencesLoading,
    getDepartmentName,
  } = useQuotaReferenceData();

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Load quotas when hook triggers change
  useEffect(() => {
    loadQuotas();
  }, [loadQuotas]);

  // =============================================================================
  // BUSINESS LOGIC HANDLERS
  // =============================================================================

  /**
   * Create operation handlers for quota operations
   */
  const createOperationHandlers = useCallback(() => ({
    onReload: loadQuotas,
    onUpdate: updateQuotaInState,
    onRemove: removeQuotaFromState,
    onClearSelection: clearSelection,
  }), [loadQuotas, updateQuotaInState, removeQuotaFromState, clearSelection]);

  /**
   * Handle quota reset operation
   */
  const handleQuotaReset = useCallback(async (quota: QuotaResponse) => {
    await QuotaOperations.resetQuota(quota, createOperationHandlers());
  }, [createOperationHandlers]);

  /**
   * Handle quota delete operation
   */
  const handleQuotaDelete = useCallback(async (quota: QuotaResponse) => {
    await QuotaOperations.deleteQuota(quota, createOperationHandlers());
  }, [createOperationHandlers]);

  /**
   * Handle enforcement toggle
   */
  const handleToggleEnforcement = useCallback(async (quota: QuotaResponse) => {
    await QuotaOperations.toggleEnforcement(quota, createOperationHandlers());
  }, [createOperationHandlers]);

  /**
   * Handle bulk reset operation
   */
  const handleBulkReset = useCallback(async () => {
    const selectedQuotaIds = Array.from(selectedQuotas);
    await QuotaOperations.bulkResetQuotas(selectedQuotaIds, createOperationHandlers());
  }, [selectedQuotas, createOperationHandlers]);

  // =============================================================================
  // MODAL OPERATION HANDLERS
  // =============================================================================

  /**
   * Handle opening the create quota modal
   */
  const handleCreateQuota = useCallback(() => {
    onCreateQuota?.(); // Call optional parent callback
    openCreateModal();
  }, [onCreateQuota, openCreateModal]);

  /**
   * Handle opening the edit quota modal
   */
  const handleEditQuota = useCallback((quota: QuotaResponse) => {
    onEditQuota?.(quota); // Call optional parent callback
    openEditModal(quota);
  }, [onEditQuota, openEditModal]);

  /**
   * Handle successful quota creation with reload
   */
  const handleQuotaCreatedWithReload = useCallback(async (newQuota: QuotaResponse) => {
    handleQuotaCreated(newQuota, async () => {
      await loadQuotas(); // Reload to include the new quota
    });
  }, [handleQuotaCreated, loadQuotas]);

  /**
   * Handle successful quota update with optimistic update
   */
  const handleQuotaUpdatedWithUpdate = useCallback(async (updatedQuota: QuotaResponse) => {
    handleQuotaUpdated(updatedQuota, async () => {
      updateQuotaInState(updatedQuota); // Optimistic update
      await loadQuotas(); // Also reload to ensure we have the latest data
    });
  }, [handleQuotaUpdated, updateQuotaInState, loadQuotas]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <div className="text-gray-600">
        {tableState.refreshing ? 'Refreshing quotas...' : 'Loading quotas...'}
      </div>
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
          onClick={refreshQuotas}
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
   * Render quota table with pagination
   */
  const renderQuotaTable = () => (
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
      <QuotaPagination
        pagination={tableState.pagination}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`quota-management ${className}`}>
      {/* Toolbar with refresh button */}
      <QuotaToolbar
        loading={tableState.loading}
        refreshing={tableState.refreshing}
        onRefresh={refreshQuotas}
        onCreateQuota={handleCreateQuota}
        className="mb-6"
      />

      {/* Summary cards */}
      <QuotaSummaryCards
        summary={tableState.summary}
        loading={tableState.loading}
        className="mb-6"
      />

      {/* Filters */}
      <QuotaFilters
        filters={filters}
        departments={departments}
        llmConfigs={llmConfigs}
        referencesLoading={referencesLoading}
        hasActiveFilters={hasActiveFilters}
        filterSummary={filterSummary.map(summary => {
          // Enhance filter summary with department names
          return summary.replace(/Dept: (\d+)/, (match, id) => {
            return `Dept: ${getDepartmentName(Number(id))}`;
          });
        })}
        onFilterChange={setFilters}
        onResetFilters={resetFilters}
        className="mb-6"
      />

      {/* Main content */}
      {tableState.loading || tableState.refreshing ? (
        renderLoading()
      ) : tableState.error ? (
        renderError()
      ) : tableState.quotas.length === 0 ? (
        renderEmpty()
      ) : (
        renderQuotaTable()
      )}

      {/* Bulk actions bar (only shows when quotas are selected) */}
      <QuotaBulkActions
        selectedQuotas={selectedQuotas}
        quotas={tableState.quotas}
        onBulkReset={handleBulkReset}
        onClearSelection={clearSelection}
      />

      {/* Create Quota Modal */}
      <QuotaCreateModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        onSuccess={handleQuotaCreatedWithReload}
      />

      {/* Edit Quota Modal */}
      <QuotaEditModal
        isOpen={showEditModal}
        quota={quotaToEdit}
        onClose={closeEditModal}
        onSuccess={handleQuotaUpdatedWithUpdate}
      />
    </div>
  );
}

export default QuotaManagement;