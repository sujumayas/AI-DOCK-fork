// Assistant Utility Service
// Handles convenience methods and utility operations

import {
  Assistant,
  AssistantCreate
} from '../../../types/assistant';
import { assistantCrudService } from '../core/assistantCrudService';
import { assistantListService } from './assistantListService';
import { AssistantErrorHandler } from '../core/assistantErrorHandler';

/**
 * Assistant Utility Service
 * 
 * 🎓 LEARNING: Utility Pattern
 * ===========================
 * Utility service provides:
 * - Convenience methods for common operations
 * - Higher-level operations combining multiple services
 * - Helper functions for complex workflows
 * - Abstraction of multi-step processes
 * - Reusable business logic
 */

export class AssistantUtilityService {
  
  /**
   * Activate an assistant (convenience method)
   */
  async activate(assistantId: number): Promise<Assistant> {
    try {
      console.log('🟢 Activating assistant:', assistantId);
      
      const assistant = await assistantCrudService.update(assistantId, { is_active: true });
      
      console.log('✅ Assistant activated:', assistantId);
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'activate',
        error,
        'Failed to activate assistant',
        assistantId
      );
    }
  }

  /**
   * Deactivate an assistant (convenience method)
   */
  async deactivate(assistantId: number): Promise<Assistant> {
    try {
      console.log('🔴 Deactivating assistant:', assistantId);
      
      const assistant = await assistantCrudService.update(assistantId, { is_active: false });
      
      console.log('✅ Assistant deactivated:', assistantId);
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'deactivate',
        error,
        'Failed to deactivate assistant',
        assistantId
      );
    }
  }

  /**
   * Toggle assistant active status
   */
  async toggleActive(assistantId: number): Promise<Assistant> {
    try {
      const assistant = await assistantCrudService.getById(assistantId);
      const newStatus = !assistant.is_active;
      
      return newStatus 
        ? await this.activate(assistantId)
        : await this.deactivate(assistantId);
        
    } catch (error) {
      AssistantErrorHandler.handleError(
        'toggleActive',
        error,
        'Failed to toggle assistant status',
        assistantId
      );
    }
  }

  /**
   * Clone an assistant with a new name
   */
  async clone(assistantId: number, newName: string): Promise<Assistant> {
    try {
      console.log('🧬 Cloning assistant:', assistantId, 'as', newName);
      
      // Get the original assistant
      const original = await assistantCrudService.getById(assistantId);
      
      // Create a new assistant with the same configuration
      const cloneData: AssistantCreate = {
        name: newName,
        description: original.description ? `Copy of ${original.description}` : undefined,
        system_prompt: original.system_prompt,
        model_preferences: { ...original.model_preferences }
      };
      
      const cloned = await assistantCrudService.create(cloneData);
      
      console.log('✅ Assistant cloned:', { originalId: assistantId, clonedId: cloned.id });
      return cloned;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'clone',
        error,
        'Failed to clone assistant',
        assistantId,
        { newName }
      );
    }
  }

  /**
   * Duplicate an assistant with auto-generated name
   */
  async duplicate(assistantId: number): Promise<Assistant> {
    try {
      const original = await assistantCrudService.getById(assistantId);
      const baseName = `${original.name} (Copy)`;
      
      // Find an available name
      let newName = baseName;
      let counter = 1;
      
      while (!(await assistantListService.isNameAvailable(newName))) {
        newName = `${baseName} ${counter}`;
        counter++;
        
        // Prevent infinite loops
        if (counter > 100) {
          newName = `${baseName} ${Date.now()}`;
          break;
        }
      }
      
      return this.clone(assistantId, newName);
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'duplicate',
        error,
        'Failed to duplicate assistant',
        assistantId
      );
    }
  }

  /**
   * Rename an assistant with name availability check
   */
  async rename(assistantId: number, newName: string): Promise<Assistant> {
    try {
      // Check if name is available (excluding current assistant)
      const isAvailable = await assistantListService.isNameAvailable(newName, assistantId);
      
      if (!isAvailable) {
        throw new Error(`Assistant name "${newName}" is already in use`);
      }
      
      return assistantCrudService.update(assistantId, { name: newName });
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'rename',
        error,
        'Failed to rename assistant',
        assistantId,
        { newName }
      );
    }
  }

  /**
   * Reset assistant to default state (clear conversations, reset settings)
   */
  async reset(assistantId: number): Promise<Assistant> {
    try {
      console.log('🔄 Resetting assistant:', assistantId);
      
      // Note: This is a placeholder implementation
      // In a full implementation, you might want to:
      // 1. Delete all conversations for this assistant
      // 2. Reset usage statistics
      // 3. Clear any cached data
      // 4. Reset model preferences to defaults
      
      const assistant = await assistantCrudService.getById(assistantId);
      
      // For now, we just ensure it's active and return it
      const resetAssistant = await assistantCrudService.update(assistantId, {
        is_active: true
      });
      
      console.log('✅ Assistant reset completed:', assistantId);
      return resetAssistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'reset',
        error,
        'Failed to reset assistant',
        assistantId
      );
    }
  }

  /**
   * Archive an assistant (deactivate with archival metadata)
   */
  async archive(assistantId: number, reason?: string): Promise<Assistant> {
    try {
      console.log('📦 Archiving assistant:', assistantId, reason ? `(${reason})` : '');
      
      // Deactivate the assistant
      const assistant = await this.deactivate(assistantId);
      
      // In a full implementation, you might want to:
      // 1. Add archive metadata
      // 2. Move conversations to archive
      // 3. Update usage statistics
      // 4. Set archive timestamp
      
      console.log('✅ Assistant archived:', assistantId);
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'archive',
        error,
        'Failed to archive assistant',
        assistantId,
        { reason }
      );
    }
  }

  /**
   * Restore an archived assistant
   */
  async restore(assistantId: number): Promise<Assistant> {
    try {
      console.log('🔄 Restoring assistant:', assistantId);
      
      const assistant = await this.activate(assistantId);
      
      console.log('✅ Assistant restored:', assistantId);
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'restore',
        error,
        'Failed to restore assistant',
        assistantId
      );
    }
  }

  /**
   * Generate a unique name for a new assistant
   */
  async generateUniqueName(baseName: string = 'New Assistant'): Promise<string> {
    try {
      let name = baseName;
      let counter = 1;
      
      while (!(await assistantListService.isNameAvailable(name))) {
        name = `${baseName} ${counter}`;
        counter++;
        
        // Prevent infinite loops
        if (counter > 100) {
          name = `${baseName} ${Date.now()}`;
          break;
        }
      }
      
      return name;
      
    } catch (error) {
      console.error('❌ Failed to generate unique name:', error);
      // Fallback to timestamp-based name
      return `${baseName} ${Date.now()}`;
    }
  }
}

// Export singleton instance
export const assistantUtilityService = new AssistantUtilityService();
