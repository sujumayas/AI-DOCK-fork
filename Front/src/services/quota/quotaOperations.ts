// 🎯 Quota Operations Service
// Business logic for quota actions (reset, delete, enforcement, bulk operations)

import { quotaService } from '../../services/quotaService';
import { QuotaResponse } from '../../types/quota';

// =============================================================================
// INTERFACES
// =============================================================================

export interface BulkOperationResult {
  successful_operations: number;
  failed_operations: number;
  errors?: string[];
}

export interface QuotaOperationsHandlers {
  onReload: () => Promise<void>;
  onUpdate: (quota: QuotaResponse) => void;
  onRemove: (quotaId: number) => void;
  onClearSelection: () => void;
}

// =============================================================================
// QUOTA OPERATIONS SERVICE
// =============================================================================

export class QuotaOperations {
  /**
   * Handle quota reset operation
   */
  static async resetQuota(
    quota: QuotaResponse,
    handlers: QuotaOperationsHandlers
  ): Promise<void> {
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
      await handlers.onReload();
      
      console.log('✅ Quota reset successfully');
      
    } catch (error) {
      console.error('❌ Error resetting quota:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to reset quota: ${message}`);
    }
  }

  /**
   * Handle quota delete operation
   */
  static async deleteQuota(
    quota: QuotaResponse,
    handlers: QuotaOperationsHandlers
  ): Promise<void> {
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
          `Are you absolutely sure?`
        );
        
        if (!doubleConfirmed) return;
      }
      
      // Perform delete
      await quotaService.deleteQuota(quota.id);
      
      // Remove from local state and clear selection
      handlers.onRemove(quota.id);
      
      // Reload quotas to reflect changes
      await handlers.onReload();
      
      console.log('✅ Quota deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting quota:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete quota: ${message}`);
    }
  }

  /**
   * Handle enforcement toggle
   */
  static async toggleEnforcement(
    quota: QuotaResponse,
    handlers: QuotaOperationsHandlers
  ): Promise<void> {
    try {
      console.log('🔄 Toggling enforcement for quota:', quota.name);
      
      // Update enforcement setting
      const updatedQuota = await quotaService.updateQuota(quota.id, {
        is_enforced: !quota.is_enforced
      });
      
      // Update the quota in local state
      handlers.onUpdate(updatedQuota);
      
      console.log(`✅ Enforcement ${updatedQuota.is_enforced ? 'enabled' : 'disabled'} for quota`);
      
    } catch (error) {
      console.error('❌ Error toggling enforcement:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to update enforcement: ${message}`);
    }
  }

  /**
   * Handle bulk reset operation
   */
  static async bulkResetQuotas(
    selectedQuotaIds: number[],
    handlers: QuotaOperationsHandlers
  ): Promise<void> {
    try {
      console.log('🔄 Bulk resetting quotas:', selectedQuotaIds);
      
      if (selectedQuotaIds.length === 0) {
        alert('No quotas selected for reset.');
        return;
      }
      
      // Show confirmation
      const confirmed = window.confirm(
        `Reset usage for ${selectedQuotaIds.length} selected quota(s)?\n\n` +
        `This will set current usage to zero for all selected quotas.\n` +
        `This action cannot be undone.`
      );
      
      if (!confirmed) return;
      
      // Perform bulk reset
      const result = await quotaService.bulkResetQuotas(selectedQuotaIds);
      
      // Clear selection
      handlers.onClearSelection();
      
      // Reload quotas
      await handlers.onReload();
      
      // Show result summary
      if (result.successful_operations === selectedQuotaIds.length) {
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to reset quotas: ${message}`);
    }
  }

  /**
   * Handle bulk delete operation
   */
  static async bulkDeleteQuotas(
    selectedQuotaIds: number[],
    quotas: QuotaResponse[],
    handlers: QuotaOperationsHandlers
  ): Promise<void> {
    try {
      console.log('🗑️ Bulk deleting quotas:', selectedQuotaIds);
      
      if (selectedQuotaIds.length === 0) {
        alert('No quotas selected for deletion.');
        return;
      }
      
      // Get quota names for confirmation
      const selectedQuotas = quotas.filter(q => selectedQuotaIds.includes(q.id));
      const quotaNames = selectedQuotas.map(q => q.name).join(', ');
      
      // Show confirmation
      const confirmed = window.confirm(
        `Delete ${selectedQuotaIds.length} selected quota(s)?\n\n` +
        `Quotas: ${quotaNames}\n\n` +
        `⚠️ This action cannot be undone!`
      );
      
      if (!confirmed) return;
      
      // Check for active quotas with usage
      const activeWithUsage = selectedQuotas.filter(q => 
        q.status === 'active' && q.current_usage > 0
      );
      
      if (activeWithUsage.length > 0) {
        const doubleConfirmed = window.confirm(
          `⚠️ FINAL CONFIRMATION ⚠️\n\n` +
          `${activeWithUsage.length} of the selected quotas are active with current usage.\n` +
          `Deleting them will permanently remove all tracking data.\n\n` +
          `Are you absolutely sure?`
        );
        
        if (!doubleConfirmed) return;
      }
      
      // Perform bulk delete
      const result = await quotaService.bulkDeleteQuotas(selectedQuotaIds);
      
      // Clear selection
      handlers.onClearSelection();
      
      // Reload quotas
      await handlers.onReload();
      
      // Show result summary
      if (result.successful_operations === selectedQuotaIds.length) {
        alert(`✅ Successfully deleted ${result.successful_operations} quota(s)`);
      } else {
        alert(
          `⚠️ Deletion completed with mixed results:\n` +
          `✅ Successful: ${result.successful_operations}\n` +
          `❌ Failed: ${result.failed_operations}\n\n` +
          `Check the quota list for details.`
        );
      }
      
      console.log('✅ Bulk delete completed');
      
    } catch (error) {
      console.error('❌ Error in bulk delete:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete quotas: ${message}`);
    }
  }

  /**
   * Handle bulk enforcement toggle
   */
  static async bulkToggleEnforcement(
    selectedQuotaIds: number[],
    quotas: QuotaResponse[],
    enforce: boolean,
    handlers: QuotaOperationsHandlers
  ): Promise<void> {
    try {
      console.log(`🔄 Bulk ${enforce ? 'enabling' : 'disabling'} enforcement for quotas:`, selectedQuotaIds);
      
      if (selectedQuotaIds.length === 0) {
        alert('No quotas selected for enforcement update.');
        return;
      }
      
      // Show confirmation
      const action = enforce ? 'enable' : 'disable';
      const confirmed = window.confirm(
        `${action.charAt(0).toUpperCase() + action.slice(1)} enforcement for ${selectedQuotaIds.length} selected quota(s)?\n\n` +
        `This will ${action} quota limits for all selected quotas.`
      );
      
      if (!confirmed) return;
      
      // Perform bulk enforcement update
      const result = await quotaService.bulkUpdateQuotas(selectedQuotaIds, {
        is_enforced: enforce
      });
      
      // Clear selection
      handlers.onClearSelection();
      
      // Reload quotas
      await handlers.onReload();
      
      // Show result summary
      if (result.successful_operations === selectedQuotaIds.length) {
        alert(`✅ Successfully ${action}d enforcement for ${result.successful_operations} quota(s)`);
      } else {
        alert(
          `⚠️ Update completed with mixed results:\n` +
          `✅ Successful: ${result.successful_operations}\n` +
          `❌ Failed: ${result.failed_operations}\n\n` +
          `Check the quota list for details.`
        );
      }
      
      console.log(`✅ Bulk enforcement ${action} completed`);
      
    } catch (error) {
      console.error(`❌ Error in bulk enforcement ${enforce ? 'enable' : 'disable'}:`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to update enforcement: ${message}`);
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format quota confirmation message
 */
export function formatQuotaConfirmation(quota: QuotaResponse): string {
  return (
    `Quota: ${quota.name}\n` +
    `Department: ${quota.department_name}\n` +
    `Type: ${quota.quota_type}\n` +
    `Current Usage: ${quotaService.formatQuotaAmount(quota.current_usage, quota.quota_type)}\n` +
    `Limit: ${quotaService.formatQuotaAmount(quota.limit_value, quota.quota_type)}\n` +
    `Status: ${quota.status}`
  );
}

/**
 * Check if quota can be safely deleted
 */
export function canSafelyDelete(quota: QuotaResponse): boolean {
  return quota.status !== 'active' || quota.current_usage === 0;
}

/**
 * Get quota usage percentage
 */
export function getUsagePercentage(quota: QuotaResponse): number {
  if (quota.limit_value === 0) return 0;
  return Math.round((quota.current_usage / quota.limit_value) * 100);
}