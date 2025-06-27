// 🎯 Quota Filters Component
// Filter controls for quota table with search and dropdown filters

import React from 'react';
import { DepartmentOption, LLMConfigOption, QuotaType, QuotaStatus } from '../../../types/quota';
import { FilterState } from '../../../hooks/quota/useQuotaTable';

// =============================================================================
// INTERFACES
// =============================================================================

interface QuotaFiltersProps {
  filters: FilterState;
  departments: DepartmentOption[];
  llmConfigs: LLMConfigOption[];
  referencesLoading: boolean;
  hasActiveFilters: boolean;
  filterSummary: string[];
  onFilterChange: (filters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Quota Filters Component
 * 
 * Provides comprehensive filtering controls for the quota table.
 * Learning: This component demonstrates the separation of filtering logic
 * from the main table component, following single responsibility principle.
 */
export const QuotaFilters: React.FC<QuotaFiltersProps> = ({
  filters,
  departments,
  llmConfigs,
  referencesLoading,
  hasActiveFilters,
  filterSummary,
  onFilterChange,
  onResetFilters,
  className = ''
}) => {
  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render text search input
   */
  const renderSearchInput = () => (
    <div className="flex-1 min-w-[200px]">
      <label htmlFor="quota-search" className="block text-sm font-medium text-gray-800 mb-1">
        Search Quotas
      </label>
      <input
        id="quota-search"
        name="quota-search"
        type="text"
        value={filters.search}
        onChange={(e) => onFilterChange({ search: e.target.value })}
        placeholder="Search by name or description..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
    </div>
  );

  /**
   * Render department filter dropdown
   */
  const renderDepartmentFilter = () => (
    <div className="min-w-[150px]">
      <label htmlFor="quota-department-filter" className="block text-sm font-medium text-gray-800 mb-1">
        Department
      </label>
      <select
        id="quota-department-filter"
        name="quota-department-filter"
        value={filters.departmentId || ''}
        onChange={(e) => onFilterChange({ departmentId: e.target.value ? Number(e.target.value) : null })}
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
  );

  /**
   * Render LLM config filter dropdown
   */
  const renderLLMConfigFilter = () => (
    <div className="min-w-[150px]">
      <label htmlFor="quota-llm-filter" className="block text-sm font-medium text-gray-800 mb-1">
        LLM Config
      </label>
      <select
        id="quota-llm-filter"
        name="quota-llm-filter"
        value={filters.llmConfigId || ''}
        onChange={(e) => onFilterChange({ llmConfigId: e.target.value ? Number(e.target.value) : null })}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={referencesLoading}
      >
        <option value="">All LLM Configs</option>
        {llmConfigs.map(config => (
          <option key={config.id} value={config.id}>
            {config.name}
          </option>
        ))}
      </select>
    </div>
  );

  /**
   * Render quota type filter dropdown
   */
  const renderQuotaTypeFilter = () => (
    <div className="min-w-[120px]">
      <label htmlFor="quota-type-filter" className="block text-sm font-medium text-gray-800 mb-1">
        Type
      </label>
      <select
        id="quota-type-filter"
        name="quota-type-filter"
        value={filters.quotaType || ''}
        onChange={(e) => onFilterChange({ quotaType: e.target.value as QuotaType || null })}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Types</option>
        <option value="cost">Cost</option>
        <option value="tokens">Tokens</option>
        <option value="requests">Requests</option>
      </select>
    </div>
  );

  /**
   * Render status filter dropdown
   */
  const renderStatusFilter = () => (
    <div className="min-w-[120px]">
      <label htmlFor="quota-status-filter" className="block text-sm font-medium text-gray-800 mb-1">
        Status
      </label>
      <select
        id="quota-status-filter"
        name="quota-status-filter"
        value={filters.status || ''}
        onChange={(e) => onFilterChange({ status: e.target.value as QuotaStatus || null })}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="suspended">Suspended</option>
        <option value="exceeded">Exceeded</option>
      </select>
    </div>
  );

  /**
   * Render enforcement filter
   */
  const renderEnforcementFilter = () => (
    <div className="min-w-[120px]">
      <label htmlFor="quota-enforcement-filter" className="block text-sm font-medium text-gray-800 mb-1">
        Enforcement
      </label>
      <select
        id="quota-enforcement-filter"
        name="quota-enforcement-filter"
        value={filters.isEnforced === null ? '' : filters.isEnforced.toString()}
        onChange={(e) => {
          const value = e.target.value;
          onFilterChange({ 
            isEnforced: value === '' ? null : value === 'true' 
          });
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All</option>
        <option value="true">Enforced</option>
        <option value="false">Not Enforced</option>
      </select>
    </div>
  );

  /**
   * Render exceeded filter
   */
  const renderExceededFilter = () => (
    <div className="min-w-[120px]">
      <label htmlFor="quota-exceeded-filter" className="block text-sm font-medium text-gray-800 mb-1">
        Usage Status
      </label>
      <select
        id="quota-exceeded-filter"
        name="quota-exceeded-filter"
        value={filters.isExceeded === null ? '' : filters.isExceeded.toString()}
        onChange={(e) => {
          const value = e.target.value;
          onFilterChange({ 
            isExceeded: value === '' ? null : value === 'true' 
          });
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All</option>
        <option value="true">Exceeded</option>
        <option value="false">Within Limit</option>
      </select>
    </div>
  );

  /**
   * Render clear filters button
   */
  const renderClearButton = () => {
    if (!hasActiveFilters) return null;
    
    return (
      <div className="flex items-end">
        <button
          type="button"
          onClick={onResetFilters}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Clear Filters
        </button>
      </div>
    );
  };

  /**
   * Render active filters summary
   */
  const renderFilterSummary = () => {
    if (filterSummary.length === 0) return null;

    return (
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <strong>Active filters:</strong> {filterSummary.join(', ')}
        </div>
      </div>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`quota-filters bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/20 ${className}`}>
      {/* Filter Controls Grid */}
      <div className="flex flex-wrap gap-4 items-end">
        {renderSearchInput()}
        {renderDepartmentFilter()}
        {renderLLMConfigFilter()}
        {renderQuotaTypeFilter()}
        {renderStatusFilter()}
        {renderEnforcementFilter()}
        {renderExceededFilter()}
        {renderClearButton()}
      </div>

      {/* Active Filters Summary */}
      {renderFilterSummary()}

      {/* Loading State for References */}
      {referencesLoading && (
        <div className="mt-2 text-sm text-gray-500">
          <span className="animate-pulse">Loading filter options...</span>
        </div>
      )}
    </div>
  );
};

export default QuotaFilters;