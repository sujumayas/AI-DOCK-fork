// Assistant Service - Main Facade
// Unified interface combining all modular assistant services

import {
  Assistant,
  AssistantSummary,
  AssistantCreate,
  AssistantUpdate,
  AssistantListRequest,
  AssistantListResponse,
  AssistantOperationResponse,
  AssistantStatsResponse,
  AssistantConversationCreate,
  AssistantConversationResponse,
  AssistantBulkAction,
  AssistantBulkResponse,
  AssistantServiceError
} from '../../types/assistant';

// Import all modular services
import { assistantCrudService } from './core/assistantCrudService';
import { assistantListService } from './features/assistantListService';
import { assistantConversationService } from './features/assistantConversationService';
import { assistantBulkService } from './features/assistantBulkService';
import { assistantStatsService } from './features/assistantStatsService';
import { assistantUtilityService } from './features/assistantUtilityService';
import { assistantImportExportService } from './features/assistantImportExportService';

/**
 * Assistant Service - Main Facade
 * 
 * 🎓 LEARNING: Facade Pattern
 * ===========================
 * The facade pattern provides:
 * - Simplified interface to complex subsystems
 * - Backward compatibility with existing code
 * - Single entry point for all assistant operations
 * - Composition of modular services
 * - Consistent API contracts
 * 
 * This main service combines all the modular services while
 * maintaining the same interface as the original monolithic service.
 */

class AssistantService {
  
  // =============================================================================
  // ASSISTANT CRUD OPERATIONS
  // =============================================================================
  
  /**
   * Create a new assistant
   */
  async createAssistant(data: AssistantCreate): Promise<Assistant> {
    return assistantCrudService.create(data);
  }
  
  /**
   * Get a specific assistant by ID
   */
  async getAssistant(assistantId: number): Promise<Assistant> {
    return assistantCrudService.getById(assistantId);
  }
  
  /**
   * Update an existing assistant
   */
  async updateAssistant(assistantId: number, data: AssistantUpdate): Promise<Assistant> {
    return assistantCrudService.update(assistantId, data);
  }
  
  /**
   * Delete an assistant
   */
  async deleteAssistant(assistantId: number): Promise<AssistantOperationResponse> {
    return assistantCrudService.delete(assistantId);
  }
  
  // =============================================================================
  // LIST MANAGEMENT AND SEARCH
  // =============================================================================
  
  /**
   * Get user's assistants with pagination and filtering
   */
  async getAssistants(params: AssistantListRequest = {}): Promise<AssistantListResponse> {
    return assistantListService.getAssistants(params);
  }
  
  /**
   * Search assistants by name or description
   */
  async searchAssistants(query: string, limit: number = 20): Promise<AssistantSummary[]> {
    return assistantListService.search(query, limit);
  }
  
  /**
   * Get only active assistants (convenience method)
   */
  async getActiveAssistants(limit: number = 50): Promise<AssistantSummary[]> {
    return assistantListService.getActive(limit);
  }
  
  /**
   * Check if assistant name is available
   */
  async isNameAvailable(name: string, excludeId?: number): Promise<boolean> {
    return assistantListService.isNameAvailable(name, excludeId);
  }
  
  // =============================================================================
  // CONVERSATION INTEGRATION
  // =============================================================================
  
  /**
   * Create a conversation with a specific assistant
   */
  async createConversationWithAssistant(data: AssistantConversationCreate): Promise<AssistantConversationResponse> {
    return assistantConversationService.createConversation(data);
  }
  
  /**
   * Get conversations for a specific assistant
   */
  async getAssistantConversations(
    assistantId: number, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<AssistantConversationResponse[]> {
    return assistantConversationService.getConversations(assistantId, limit, offset);
  }
  
  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================
  
  /**
   * Perform bulk operations on multiple assistants
   */
  async bulkAssistantAction(action: AssistantBulkAction): Promise<AssistantBulkResponse> {
    return assistantBulkService.performBulkAction(action);
  }
  
  // =============================================================================
  // STATISTICS AND ANALYTICS
  // =============================================================================
  
  /**
   * Get assistant statistics and usage analytics
   */
  async getAssistantStats(): Promise<AssistantStatsResponse> {
    return assistantStatsService.getStats();
  }
  
  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================
  
  /**
   * Activate an assistant (convenience method)
   */
  async activateAssistant(assistantId: number): Promise<Assistant> {
    return assistantUtilityService.activate(assistantId);
  }
  
  /**
   * Deactivate an assistant (convenience method)
   */
  async deactivateAssistant(assistantId: number): Promise<Assistant> {
    return assistantUtilityService.deactivate(assistantId);
  }
  
  /**
   * Clone an assistant with a new name
   */
  async cloneAssistant(assistantId: number, newName: string): Promise<Assistant> {
    return assistantUtilityService.clone(assistantId, newName);
  }
  
  // =============================================================================
  // EXPORT AND IMPORT
  // =============================================================================
  
  /**
   * Export assistant configuration
   */
  async exportAssistant(assistantId: number): Promise<Blob> {
    return assistantImportExportService.exportAssistant(assistantId);
  }
  
  /**
   * Import assistant configuration
   */
  async importAssistant(file: File): Promise<Assistant> {
    return assistantImportExportService.importAssistant(file);
  }
  
  // =============================================================================
  // HEALTH CHECK
  // =============================================================================
  
  /**
   * Check if assistant service is working
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    return assistantStatsService.healthCheck();
  }
  
  // =============================================================================
  // ADDITIONAL CONVENIENCE METHODS
  // =============================================================================
  
  /**
   * Toggle assistant active status
   */
  async toggleActiveStatus(assistantId: number): Promise<Assistant> {
    return assistantUtilityService.toggleActive(assistantId);
  }
  
  /**
   * Duplicate an assistant with auto-generated name
   */
  async duplicateAssistant(assistantId: number): Promise<Assistant> {
    return assistantUtilityService.duplicate(assistantId);
  }
  
  /**
   * Rename an assistant with name availability check
   */
  async renameAssistant(assistantId: number, newName: string): Promise<Assistant> {
    return assistantUtilityService.rename(assistantId, newName);
  }
  
  /**
   * Get usage summary for dashboard
   */
  async getUsageSummary(): Promise<{
    totalAssistants: number;
    activeAssistants: number;
    totalConversations: number;
    averageConversationsPerAssistant: number;
  }> {
    return assistantStatsService.getUsageSummary();
  }
  
  /**
   * Export and download assistant
   */
  async exportAndDownloadAssistant(assistantId: number): Promise<void> {
    return assistantImportExportService.exportAndDownload(assistantId);
  }
  
  /**
   * Validate bulk operation before execution
   */
  validateBulkAction(action: AssistantBulkAction): { valid: boolean; errors: string[] } {
    return assistantBulkService.validateBulkAction(action);
  }
  
  /**
   * Generate unique name for new assistant
   */
  async generateUniqueName(baseName: string = 'New Assistant'): Promise<string> {
    return assistantUtilityService.generateUniqueName(baseName);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Export singleton instance for backward compatibility
 * This maintains the same interface as the original assistantService
 */
export const assistantService = new AssistantService();

/**
 * Export individual services for direct access when needed
 * This allows more granular control and testing
 */
export {
  assistantCrudService,
  assistantListService,
  assistantConversationService,
  assistantBulkService,
  assistantStatsService,
  assistantUtilityService,
  assistantImportExportService
};

/**
 * Export the main service class for testing
 */
export { AssistantService };

/**
 * Export the error class for error handling
 */
export { AssistantServiceError };

/**
 * 🎯 LEARNING: Module Organization
 * ===============================
 * This modular organization provides:
 * 
 * ✅ **Single Responsibility**: Each service handles one specific area
 * ✅ **Easy Testing**: Individual services can be tested in isolation
 * ✅ **Better Maintainability**: Changes to one feature don't affect others
 * ✅ **Reusability**: Services can be used independently
 * ✅ **Scalability**: New features can be added as separate services
 * ✅ **Backward Compatibility**: Existing code continues to work
 * 
 * **Service Breakdown:**
 * - **Core Services**: API client, error handling, CRUD operations
 * - **Feature Services**: Lists, conversations, bulk ops, stats, utilities, import/export
 * - **Main Facade**: Unified interface combining all services
 * 
 * **Benefits:**
 * - Easier to understand and modify
 * - Better error isolation
 * - Improved code reusability
 * - Enhanced testing capabilities
 * - Simplified debugging
 */
