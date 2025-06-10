// 🎯 Quota Table Component
// Professional data table with progress indicators and actions

import React, { useMemo } from 'react';
import { QuotaResponse } from '../../types/quota';
import { quotaService } from '../../services/quotaService';

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

interface QuotaTableProps {
  quotas: QuotaResponse[];
  selectedQuotas: Set<number>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  onSelect: (quotaId: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onEdit?: (quota: QuotaResponse) => void;
  onReset?: (quota: QuotaResponse) => void;
  onDelete?: (quota: QuotaResponse) => void;
  onToggleEnforcement?: (quota: QuotaResponse) => void;
  loading?: boolean;
}

interface TableColumn {
  key: string;
  label: string;
  sortable: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

/**
 * Usage Progress Bar Component
 * 
 * Learning: Progress bars provide immediate visual feedback about quota consumption.
 * Color coding helps users quickly identify problem areas.
 */
interface UsageProgressProps {
  quota: QuotaResponse;
  showLabel?: boolean;
}

function UsageProgress({ quota, showLabel = true }: UsageProgressProps) {
  const percentage = Math.min(quota.usage_percentage, 100);
  
  // Determine color based on usage level
  const getProgressColor = () => {
    if (quota.is_exceeded) return 'bg-red-500';
    if (quota.is_near_limit) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getBackgroundColor = () => {
    if (quota.is_exceeded) return 'bg-red-100';
    if (quota.is_near_limit) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className={`w-full h-2 rounded-full ${getBackgroundColor()}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      {/* Usage label */}
      {showLabel && (
        <div className="mt-1 text-xs text-gray-600 flex justify-between">
          <span>{quotaService.formatQuotaAmount(quota.current_usage, quota.quota_type)}</span>
          <span>{quotaService.formatUsagePercentage(quota)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Status Badge Component
 * 
 * Learning: Status badges provide instant visual status recognition.
 * Consistent color coding improves user experience.
 */
interface StatusBadgeProps {
  quota: QuotaResponse;
}

function StatusBadge({ quota }: StatusBadgeProps) {
  const getStatusInfo = () => {
    if (quota.is_exceeded) {
      return { 
        label: 'Exceeded', 
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '🚨'
      };
    }
    
    if (quota.is_near_limit) {
      return { 
        label: 'Near Limit', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '⚠️'
      };
    }
    
    if (quota.status === 'active') {
      return { 
        label: 'Healthy', 
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '✅'
      };
    }
    
    if (quota.status === 'suspended') {
      return { 
        label: 'Suspended', 
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: '⏸️'
      };
    }
    
    return { 
      label: 'Inactive', 
      color: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: '⏹️'
    };
  };

  const status = getStatusInfo();

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
      <span className="mr-1">{status.icon}</span>
      {status.label}
    </span>
  );
}

/**
 * Enforcement Toggle Component
 * 
 * Learning: Toggle switches provide clear on/off state indication.
 * This controls whether quotas actually block requests when exceeded.
 */
interface EnforcementToggleProps {
  quota: QuotaResponse;
  onChange?: (quota: QuotaResponse) => void;
  disabled?: boolean;
}

function EnforcementToggle({ quota, onChange, disabled = false }: EnforcementToggleProps) {
  return (
    <button
      onClick={() => onChange?.(quota)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        quota.is_enforced 
          ? 'bg-blue-600' 
          : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      title={quota.is_enforced ? 'Enforcement enabled - blocks requests when exceeded' : 'Enforcement disabled - allows requests when exceeded'}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          quota.is_enforced ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/**
 * Action Buttons Component
 * 
 * Learning: Action buttons should be grouped logically and use consistent styling.
 * Destructive actions (delete) should be visually distinct.
 */
interface ActionButtonsProps {
  quota: QuotaResponse;
  onEdit?: (quota: QuotaResponse) => void;
  onReset?: (quota: QuotaResponse) => void;
  onDelete?: (quota: QuotaResponse) => void;
}

function ActionButtons({ quota, onEdit, onReset, onDelete }: ActionButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Edit button */}
      {onEdit && (
        <button
          onClick={() => onEdit(quota)}
          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
          title="Edit quota"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
      
      {/* Reset button */}
      {onReset && (
        <button
          onClick={() => onReset(quota)}
          className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
          title="Reset usage to zero"
          disabled={quota.current_usage === 0}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
      
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={() => onDelete(quota)}
          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
          title="Delete quota"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Sort Header Component
 * 
 * Learning: Sortable headers need visual indicators for current sort state.
 * Clear affordances help users understand interactive elements.
 */
interface SortHeaderProps {
  column: TableColumn;
  currentSort: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

function SortHeader({ column, currentSort, sortOrder, onSort }: SortHeaderProps) {
  const isSorted = currentSort === column.key;
  const isAsc = isSorted && sortOrder === 'asc';
  const isDesc = isSorted && sortOrder === 'desc';

  if (!column.sortable) {
    return <span>{column.label}</span>;
  }

  return (
    <button
      onClick={() => onSort(column.key)}
      className="flex items-center gap-1 text-left hover:text-gray-900 group"
    >
      <span>{column.label}</span>
      <div className="flex flex-col">
        <svg 
          className={`w-3 h-3 ${isAsc ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        <svg 
          className={`w-3 h-3 -mt-1 ${isDesc ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    </button>
  );
}

// =============================================================================
// MAIN QUOTA TABLE COMPONENT
// =============================================================================

/**
 * Quota Table Component
 * 
 * Learning: This demonstrates a professional data table pattern with:
 * - Sortable columns with visual indicators
 * - Row selection for bulk operations
 * - Progress bars for visual data representation
 * - Status badges for quick status recognition
 * - Action buttons for row-level operations
 * - Responsive design considerations
 */
export function QuotaTable({
  quotas,
  selectedQuotas,
  sortBy,
  sortOrder,
  onSort,
  onSelect,
  onSelectAll,
  onEdit,
  onReset,
  onDelete,
  onToggleEnforcement,
  loading = false
}: QuotaTableProps) {
  
  // =============================================================================
  // TABLE CONFIGURATION
  // =============================================================================

  const columns: TableColumn[] = useMemo(() => [
    { key: 'select', label: '', sortable: false, width: '40px', align: 'center' },
    { key: 'name', label: 'Quota Name', sortable: true, width: '200px' },
    { key: 'department_name', label: 'Department', sortable: true, width: '150px' },
    { key: 'quota_type', label: 'Type', sortable: true, width: '100px' },
    { key: 'quota_period', label: 'Period', sortable: true, width: '100px' },
    { key: 'usage', label: 'Usage', sortable: false, width: '200px' },
    { key: 'limit_value', label: 'Limit', sortable: true, width: '120px', align: 'right' },
    { key: 'status', label: 'Status', sortable: true, width: '120px' },
    { key: 'is_enforced', label: 'Enforced', sortable: true, width: '100px', align: 'center' },
    { key: 'actions', label: 'Actions', sortable: false, width: '120px', align: 'center' },
  ], []);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const allSelected = quotas.length > 0 && quotas.every(quota => selectedQuotas.has(quota.id));
  const someSelected = quotas.some(quota => selectedQuotas.has(quota.id)) && !allSelected;

  // =============================================================================
  // RENDER METHODS
  // =============================================================================

  /**
   * Render table header with sorting and selection
   */
  const renderHeader = () => (
    <thead className="bg-gray-50">
      <tr>
        {columns.map(column => (
          <th
            key={column.key}
            className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
              column.align === 'center' ? 'text-center' : 
              column.align === 'right' ? 'text-right' : 'text-left'
            }`}
            style={{ width: column.width }}
          >
            {column.key === 'select' ? (
              // Select all checkbox
              <input
                type="checkbox"
                checked={allSelected}
                ref={input => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            ) : (
              <SortHeader
                column={column}
                currentSort={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            )}
          </th>
        ))}
      </tr>
    </thead>
  );

  /**
   * Render table row for a quota
   */
  const renderQuotaRow = (quota: QuotaResponse) => (
    <tr
      key={quota.id}
      className={`border-b border-gray-200 hover:bg-gray-50 ${
        selectedQuotas.has(quota.id) ? 'bg-blue-50' : ''
      }`}
    >
      {/* Selection checkbox */}
      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={selectedQuotas.has(quota.id)}
          onChange={(e) => onSelect(quota.id, e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </td>

      {/* Quota name */}
      <td className="px-4 py-4">
        <div>
          <div className="font-medium text-gray-900">{quota.name}</div>
          {quota.description && (
            <div className="text-sm text-gray-500 truncate max-w-[180px]" title={quota.description}>
              {quota.description}
            </div>
          )}
        </div>
      </td>

      {/* Department */}
      <td className="px-4 py-4">
        <span className="text-sm text-gray-900">
          {quota.department_name || `Dept ${quota.department_id}`}
        </span>
      </td>

      {/* Quota type */}
      <td className="px-4 py-4">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {quota.quota_type === 'cost' && '💰'} 
          {quota.quota_type === 'tokens' && '🎯'} 
          {quota.quota_type === 'requests' && '📞'}
          <span className="ml-1 capitalize">{quota.quota_type}</span>
        </span>
      </td>

      {/* Quota period */}
      <td className="px-4 py-4">
        <span className="text-sm text-gray-900 capitalize">{quota.quota_period}</span>
      </td>

      {/* Usage progress */}
      <td className="px-4 py-4">
        <UsageProgress quota={quota} />
      </td>

      {/* Limit */}
      <td className="px-4 py-4 text-right">
        <div className="text-sm font-medium text-gray-900">
          {quotaService.formatQuotaAmount(quota.limit_value, quota.quota_type)}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <StatusBadge quota={quota} />
      </td>

      {/* Enforcement toggle */}
      <td className="px-4 py-4 text-center">
        <EnforcementToggle 
          quota={quota} 
          onChange={onToggleEnforcement}
          disabled={loading}
        />
      </td>

      {/* Actions */}
      <td className="px-4 py-4 text-center">
        <ActionButtons
          quota={quota}
          onEdit={onEdit}
          onReset={onReset}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <tr>
      <td colSpan={columns.length} className="px-4 py-8 text-center">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-gray-600">Loading quotas...</span>
        </div>
      </td>
    </tr>
  );

  /**
   * Render empty state
   */
  const renderEmpty = () => (
    <tr>
      <td colSpan={columns.length} className="px-4 py-8 text-center">
        <div className="text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <div>No quotas found</div>
        </div>
      </td>
    </tr>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        {renderHeader()}
        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            renderLoading()
          ) : quotas.length === 0 ? (
            renderEmpty()
          ) : (
            quotas.map(renderQuotaRow)
          )}
        </tbody>
      </table>
    </div>
  );
}

export default QuotaTable;
