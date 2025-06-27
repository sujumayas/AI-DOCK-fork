// 🎯 Quota Bulk Actions Component
// Floating action bar for bulk operations on selected quotas

import React from 'react';
import { QuotaResponse } from '../../../types/quota';

// =============================================================================
// INTERFACES
// =============================================================================

interface QuotaBulkActionsProps {
  selectedQuotas: Set<number>;
  quotas: QuotaResponse[];
  onBulkReset: () => void;
  onBulkDelete?: () => void;
  onBulkEnforce?: (enforce: boolean) => void;
  onClearSelection: () => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Quota Bulk Actions Component
 * 
 * Displays a floating action bar when quotas are selected,
 * providing bulk operations like reset, delete, and enforcement toggle.
 * Learning: This demonstrates conditional rendering and bulk operation UX patterns.
 */
export const QuotaBulkActions: React.FC<QuotaBulkActionsProps> = ({
  selectedQuotas,
  quotas,
  onBulkReset,
  onBulkDelete,
  onBulkEnforce,
  onClearSelection,
  className = ''
}) => {
  // Don't render if no quotas are selected
  if (selectedQuotas.size === 0) return null;

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  /**
   * Get selected quota objects for analysis
   */
  const selectedQuotaObjects = quotas.filter(q => selectedQuotas.has(q.id));

  /**
   * Check if all selected quotas are enforced/unenforced
   */
  const allEnforced = selectedQuotaObjects.every(q => q.is_enforced);
  const allUnenforced = selectedQuotaObjects.every(q => !q.is_enforced);

  /**
   * Check if any selected quotas have usage (for reset confirmation)
   */
  const hasUsage = selectedQuotaObjects.some(q => q.current_usage > 0);

  /**
   * Check if any selected quotas are active (for delete confirmation)
   */
  const hasActiveQuotas = selectedQuotaObjects.some(q => q.status === 'active');

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render selection info
   */
  const renderSelectionInfo = () => (
    <div className="flex items-center">
      <span className="text-white font-medium">
        {selectedQuotas.size} quota(s) selected
      </span>
      {hasUsage && (
        <span className="ml-2 text-blue-200 text-sm">
          • Some have usage
        </span>
      )}
      {hasActiveQuotas && (
        <span className="ml-2 text-blue-200 text-sm">
          • Some are active
        </span>
      )}
    </div>
  );

  /**
   * Render action buttons
   */
  const renderActionButtons = () => (
    <div className="flex items-center gap-3">
      {/* Reset Selected */}
      <button
        onClick={onBulkReset}
        className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100 transition-colors"
        title="Reset usage for selected quotas"
      >
        🔄 Reset Selected
      </button>

      {/* Enforcement Toggle (if callback provided) */}
      {onBulkEnforce && (
        <>
          {!allEnforced && (
            <button
              onClick={() => onBulkEnforce(true)}
              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-400 transition-colors"
              title="Enable enforcement for selected quotas"
            >
              ✅ Enable Enforcement
            </button>
          )}
          {!allUnenforced && (
            <button
              onClick={() => onBulkEnforce(false)}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-400 transition-colors"
              title="Disable enforcement for selected quotas"
            >
              ⚠️ Disable Enforcement
            </button>
          )}
        </>
      )}

      {/* Delete Selected (if callback provided) */}
      {onBulkDelete && (
        <button
          onClick={onBulkDelete}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-400 transition-colors"
          title="Delete selected quotas"
        >
          🗑️ Delete Selected
        </button>
      )}

      {/* Clear Selection */}
      <button
        onClick={onClearSelection}
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-400 transition-colors"
        title="Clear selection"
      >
        ✕ Clear Selection
      </button>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`quota-bulk-actions fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 ${className}`}>
      <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg border border-blue-500">
        <div className="flex items-center justify-between gap-6 min-w-0">
          {/* Selection Info */}
          {renderSelectionInfo()}
          
          {/* Action Buttons */}
          {renderActionButtons()}
        </div>
      </div>
    </div>
  );
};

export default QuotaBulkActions;