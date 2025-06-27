// Assistant Bulk Service
// Handles bulk operations on multiple assistants

import {
  AssistantBulkAction,
  AssistantBulkResponse
} from '../../../types/assistant';
import { assistantApiClient } from '../core/assistantApiClient';
import { AssistantErrorHandler } from '../core/assistantErrorHandler';

/**
 * Assistant Bulk Service
 * 
 * 🎓 LEARNING: Bulk Operations Pattern
 * ===================================
 * Bulk operations service provides:
 * - Multi-assistant operations in single request
 * - Atomic operations (all or nothing)
 * - Progress feedback capabilities
 * - Partial failure handling
 * - Performance optimization
 */

export class AssistantBulkService {
  
  /**
   * Perform bulk operations on multiple assistants
   */
  async performBulkAction(action: AssistantBulkAction): Promise<AssistantBulkResponse> {
    try {
      console.log('🔄 Performing bulk action:', action.action, 'on', action.assistant_ids.length, 'assistants');
      
      const result = await assistantApiClient.post<AssistantBulkResponse>('bulk', action);
      
      console.log('✅ Bulk operation completed:', {
        action: action.action,
        successful: result.successful_count,
        failed: result.failed_count
      });
      
      return result;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'performBulkAction',
        error,
        'Bulk operation failed',
        undefined,
        action
      );
    }
  }

  /**
   * Bulk delete multiple assistants
   */
  async bulkDelete(assistantIds: number[]): Promise<AssistantBulkResponse> {
    return this.performBulkAction({
      action: 'delete',
      assistant_ids: assistantIds
    });
  }

  /**
   * Bulk activate multiple assistants
   */
  async bulkActivate(assistantIds: number[]): Promise<AssistantBulkResponse> {
    return this.performBulkAction({
      action: 'activate',
      assistant_ids: assistantIds
    });
  }

  /**
   * Bulk deactivate multiple assistants
   */
  async bulkDeactivate(assistantIds: number[]): Promise<AssistantBulkResponse> {
    return this.performBulkAction({
      action: 'deactivate',
      assistant_ids: assistantIds
    });
  }

  /**
   * Bulk update status for multiple assistants
   */
  async bulkUpdateStatus(assistantIds: number[], isActive: boolean): Promise<AssistantBulkResponse> {
    const action = isActive ? 'activate' : 'deactivate';
    return this.performBulkAction({
      action,
      assistant_ids: assistantIds
    });
  }

  /**
   * Validate bulk operation before execution
   */
  validateBulkAction(action: AssistantBulkAction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if assistant IDs are provided
    if (!action.assistant_ids || action.assistant_ids.length === 0) {
      errors.push('No assistants selected for bulk operation');
    }

    // Check for reasonable batch size
    if (action.assistant_ids && action.assistant_ids.length > 100) {
      errors.push('Bulk operation limited to 100 assistants at a time');
    }

    // Check if action is valid
    const validActions = ['delete', 'activate', 'deactivate'];
    if (!validActions.includes(action.action)) {
      errors.push(`Invalid action: ${action.action}. Valid actions: ${validActions.join(', ')}`);
    }

    // Check for duplicate IDs
    if (action.assistant_ids) {
      const uniqueIds = new Set(action.assistant_ids);
      if (uniqueIds.size !== action.assistant_ids.length) {
        errors.push('Duplicate assistant IDs found in bulk operation');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Perform validated bulk operation
   */
  async performValidatedBulkAction(action: AssistantBulkAction): Promise<AssistantBulkResponse> {
    const validation = this.validateBulkAction(action);
    
    if (!validation.valid) {
      throw new Error(`Bulk operation validation failed: ${validation.errors.join(', ')}`);
    }

    return this.performBulkAction(action);
  }
}

// Export singleton instance
export const assistantBulkService = new AssistantBulkService();
