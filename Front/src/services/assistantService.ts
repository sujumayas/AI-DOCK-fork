// AI Dock Assistant Service
// Frontend service for Custom Assistants API operations

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
  AssistantServiceError,
  ASSISTANT_API_DEFAULTS
} from '../types/assistant';
import { authService } from './authService';

// Configuration - using same base URL as other services
const API_BASE_URL = 'http://localhost:8000';

/**
 * Assistant Service Class
 * 
 * 🎓 LEARNING: Service Layer Architecture
 * =======================================
 * The service layer provides:
 * - Clean separation between UI and API logic
 * - Consistent error handling across the app
 * - Reusable API methods for multiple components
 * - Type safety with TypeScript interfaces
 * - Authentication handling
 * - Request/response transformation
 * 
 * This service handles all assistant-related API operations:
 * - CRUD operations (Create, Read, Update, Delete)
 * - List management with pagination and filtering
 * - Conversation integration
 * - Bulk operations
 * - Statistics and analytics
 */
class AssistantService {
  
  /**
   * 🎓 LEARNING: Private Helper Methods
   * ===================================
   * Private methods help us:
   * - Avoid code duplication
   * - Maintain consistency
   * - Centralize complex logic
   * - Make testing easier
   */
  
  /**
   * Parse error response from backend API
   * Handles different error response structures consistently
   */
  private parseErrorResponse(errorData: any, defaultMessage: string): { message: string; type: string } {
    let errorMessage = defaultMessage;
    let errorType = 'unknown_error';
    
    // Try different possible message and error type locations
    if (typeof errorData.message === 'string' && errorData.message) {
      // Flat structure - message at top level
      errorMessage = errorData.message;
      errorType = errorData.error || errorData.error_type || 'unknown_error';
    } else if (typeof errorData.detail === 'object' && errorData.detail) {
      // Nested structure - check detail object
      if (typeof errorData.detail.message === 'string' && errorData.detail.message) {
        errorMessage = errorData.detail.message;
      }
      errorType = errorData.detail.error || errorData.detail.error_type || 'unknown_error';
    } else if (typeof errorData.detail === 'string' && errorData.detail) {
      // Detail is a string message
      errorMessage = errorData.detail;
    } else if (typeof errorData.error === 'string' && errorData.error) {
      // Error field contains the message
      errorMessage = errorData.error;
    } else if (typeof errorData === 'string') {
      // Entire response is a string
      errorMessage = errorData;
    }
    
    return { message: errorMessage, type: errorType };
  }
  
  // =============================================================================
  // ASSISTANT CRUD OPERATIONS
  // =============================================================================
  
  /**
   * Create a new assistant
   * 
   * 🎓 LEARNING: API POST Requests
   * =============================
   * When creating resources:
   * - Use POST method
   * - Send data in request body as JSON
   * - Include authentication headers
   * - Handle validation errors from backend
   * - Return the created resource with ID
   */
  async createAssistant(data: AssistantCreate): Promise<Assistant> {
    try {
      console.log('🤖 Creating new assistant:', data.name);
      
      const response = await fetch(`${API_BASE_URL}/assistants/`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // 🔍 DEBUG: Let's see exactly what the backend returns
        console.log('Raw error response:', errorData);
        console.log('errorData.message:', errorData.message);
        console.log('errorData.detail:', errorData.detail);
        console.log('errorData.error:', errorData.error);
        
        // 🎓 LEARNING: Using Helper Methods for Consistency
        // ================================================
        // Instead of duplicating error parsing logic, we use our helper method
        const { message: errorMessage, type: errorType } = this.parseErrorResponse(
          errorData, 
          'Failed to create assistant'
        );
        
        console.log('Final parsed error message:', errorMessage);
        console.log('Final parsed error type:', errorType);
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          undefined,
          errorType,
          errorData.field_errors
        );
      }
      
      const assistant: Assistant = await response.json();
      console.log('✅ Assistant created:', assistant.id);
      
      return assistant;
      
    } catch (error) {
      console.error('❌ Failed to create assistant:', error);
      
      // 🔍 DEBUG: Let's see what type of error this is
      console.log('Error type:', typeof error);
      console.log('Error instanceof AssistantServiceError:', error instanceof AssistantServiceError);
      console.log('Error message:', error instanceof Error ? error.message : error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to create assistant'
      );
    }
  }
  
  /**
   * Get a specific assistant by ID
   */
  async getAssistant(assistantId: number): Promise<Assistant> {
    try {
      console.log('📖 Loading assistant:', assistantId);
      
      const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}`, {
        method: 'GET',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const { message: errorMessage, type: errorType } = this.parseErrorResponse(
          errorData, 
          'Failed to load assistant'
        );
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          assistantId,
          errorType
        );
      }
      
      const assistant: Assistant = await response.json();
      console.log('✅ Assistant loaded:', { 
        id: assistant.id, 
        name: assistant.name,
        conversationCount: assistant.conversation_count 
      });
      
      return assistant;
      
    } catch (error) {
      console.error('❌ Failed to load assistant:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to load assistant',
        undefined,
        assistantId
      );
    }
  }
  
  /**
   * Get user's assistants with pagination and filtering
   * 
   * 🎓 LEARNING: Query Parameters and Pagination
   * ===========================================
   * For list endpoints:
   * - Use GET with query parameters
   * - Implement pagination (limit/offset)
   * - Support filtering and searching
   * - Return metadata (total count, has_more)
   * - Provide sensible defaults
   */
  async getAssistants(params: AssistantListRequest = {}): Promise<AssistantListResponse> {
    try {
      const {
        limit = ASSISTANT_API_DEFAULTS.LIST_LIMIT,
        offset = 0,
        search,
        status_filter,
        sort_by = ASSISTANT_API_DEFAULTS.DEFAULT_SORT_BY,
        sort_order = ASSISTANT_API_DEFAULTS.DEFAULT_SORT_ORDER,
        include_inactive = false
      } = params;
      
      console.log('📋 Fetching assistants:', { limit, offset, search, status_filter });
      
      // Build query parameters
      const url = new URL(`${API_BASE_URL}/assistants/`);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());
      url.searchParams.set('sort_by', sort_by);
      url.searchParams.set('sort_order', sort_order);
      url.searchParams.set('include_inactive', include_inactive.toString());
      
      if (search) {
        url.searchParams.set('search', search);
      }
      
      if (status_filter) {
        url.searchParams.set('status_filter', status_filter);
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.detail || 'Failed to fetch assistants';
        const errorType = errorData.error || errorData.error_type;
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          undefined,
          errorType
        );
      }
      
      const data: AssistantListResponse = await response.json();
      console.log('✅ Assistants fetched:', {
        count: data.assistants.length,
        total: data.total_count,
        hasMore: data.has_more
      });
      
      return data;
      
    } catch (error) {
      console.error('❌ Failed to fetch assistants:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to fetch assistants'
      );
    }
  }
  
  /**
   * Update an existing assistant
   * 
   * 🎓 LEARNING: PATCH vs PUT
   * ========================
   * - PUT: Replace entire resource (all fields required)
   * - PATCH: Update specific fields (partial update)
   * 
   * We use PUT here to match backend implementation,
   * but it accepts partial data (optional fields).
   */
  async updateAssistant(assistantId: number, data: AssistantUpdate): Promise<Assistant> {
    try {
      console.log('✏️ Updating assistant:', assistantId, data);
      
      const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}`, {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.detail || 'Failed to update assistant';
        const errorType = errorData.error || errorData.error_type;
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          assistantId,
          errorType,
          errorData.field_errors
        );
      }
      
      const assistant: Assistant = await response.json();
      console.log('✅ Assistant updated:', assistant.id);
      
      return assistant;
      
    } catch (error) {
      console.error('❌ Failed to update assistant:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to update assistant',
        undefined,
        assistantId
      );
    }
  }
  
  /**
   * Delete an assistant
   * 
   * 🎓 LEARNING: Resource Deletion
   * =============================
   * When deleting resources:
   * - Use DELETE method
   * - No request body needed
   * - Return operation result (success/failure)
   * - Handle cascading deletes (conversations)
   * - Consider soft delete vs hard delete
   */
  async deleteAssistant(assistantId: number): Promise<AssistantOperationResponse> {
    try {
      console.log('🗑️ Deleting assistant:', assistantId);
      
      const response = await fetch(`${API_BASE_URL}/assistants/${assistantId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.detail || 'Failed to delete assistant';
        const errorType = errorData.error || errorData.error_type;
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          assistantId,
          errorType
        );
      }
      
      const result: AssistantOperationResponse = await response.json();
      console.log('✅ Assistant deleted:', assistantId);
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to delete assistant:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to delete assistant',
        undefined,
        assistantId
      );
    }
  }
  
  // =============================================================================
  // CONVERSATION INTEGRATION
  // =============================================================================
  
  /**
   * Create a conversation with a specific assistant
   * 
   * 🎓 LEARNING: Feature Integration
   * ===============================
   * This method bridges assistants and conversations:
   * - Associates conversation with assistant
   * - Applies assistant's system prompt
   * - Uses assistant's model preferences
   * - Validates user owns the assistant
   */
  async createConversationWithAssistant(data: AssistantConversationCreate): Promise<AssistantConversationResponse> {
    try {
      console.log('💬 Creating conversation with assistant:', data.assistant_id);
      
      const response = await fetch(`${API_BASE_URL}/assistants/${data.assistant_id}/conversations`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          title: data.title,
          first_message: data.first_message
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.detail || 'Failed to create conversation';
        const errorType = errorData.error || errorData.error_type;
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          data.assistant_id,
          errorType
        );
      }
      
      const conversation: AssistantConversationResponse = await response.json();
      console.log('✅ Conversation created with assistant:', {
        conversationId: conversation.id,
        assistantId: conversation.assistant_id,
        assistantName: conversation.assistant_name
      });
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Failed to create conversation with assistant:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to create conversation with assistant'
      );
    }
  }
  
  /**
   * Get conversations for a specific assistant
   */
  async getAssistantConversations(assistantId: number, limit: number = 20, offset: number = 0): Promise<AssistantConversationResponse[]> {
    try {
      console.log('📋 Fetching conversations for assistant:', assistantId);
      
      const url = new URL(`${API_BASE_URL}/assistants/${assistantId}/conversations`);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.detail || 'Failed to fetch assistant conversations';
        const errorType = errorData.error || errorData.error_type;
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          assistantId,
          errorType
        );
      }
      
      const conversations: AssistantConversationResponse[] = await response.json();
      console.log('✅ Assistant conversations fetched:', conversations.length);
      
      return conversations;
      
    } catch (error) {
      console.error('❌ Failed to fetch assistant conversations:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to fetch assistant conversations',
        undefined,
        assistantId
      );
    }
  }
  
  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================
  
  /**
   * Perform bulk operations on multiple assistants
   * 
   * 🎓 LEARNING: Bulk Operations
   * ===========================
   * Bulk operations improve UX by:
   * - Reducing API calls (one request vs many)
   * - Providing atomic operations (all or nothing)
   * - Showing progress feedback
   * - Handling partial failures gracefully
   */
  async bulkAssistantAction(action: AssistantBulkAction): Promise<AssistantBulkResponse> {
    try {
      console.log('🔄 Performing bulk action:', action.action, 'on', action.assistant_ids.length, 'assistants');
      
      const response = await fetch(`${API_BASE_URL}/assistants/bulk`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(action)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.detail || 'Bulk operation failed';
        const errorType = errorData.error || errorData.error_type;
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          undefined,
          errorType
        );
      }
      
      const result: AssistantBulkResponse = await response.json();
      console.log('✅ Bulk operation completed:', {
        action: action.action,
        successful: result.successful_count,
        failed: result.failed_count
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Bulk operation failed:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Bulk operation failed'
      );
    }
  }
  
  // =============================================================================
  // STATISTICS AND ANALYTICS
  // =============================================================================
  
  /**
   * Get assistant statistics and usage analytics
   */
  async getAssistantStats(): Promise<AssistantStatsResponse> {
    try {
      console.log('📊 Fetching assistant statistics');
      
      const response = await fetch(`${API_BASE_URL}/assistants/stats`, {
        method: 'GET',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.detail || 'Failed to get assistant stats';
        const errorType = errorData.error || errorData.error_type;
        
        throw new AssistantServiceError(
          errorMessage,
          response.status,
          undefined,
          errorType
        );
      }
      
      const stats: AssistantStatsResponse = await response.json();
      console.log('✅ Assistant stats loaded:', {
        totalAssistants: stats.total_assistants,
        activeAssistants: stats.active_assistants,
        totalConversations: stats.total_conversations
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Failed to get assistant stats:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to get assistant stats'
      );
    }
  }
  
  // =============================================================================
  // SEARCH AND FILTERING
  // =============================================================================
  
  /**
   * Search assistants by name or description
   */
  async searchAssistants(query: string, limit: number = 20): Promise<AssistantSummary[]> {
    try {
      console.log('🔍 Searching assistants:', query);
      
      const response = await this.getAssistants({
        search: query,
        limit: limit,
        sort_by: 'name',
        sort_order: 'asc'
      });
      
      console.log('✅ Search completed:', response.assistants.length, 'results');
      return response.assistants;
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Search failed'
      );
    }
  }
  
  /**
   * Get only active assistants (convenience method)
   */
  async getActiveAssistants(limit: number = 50): Promise<AssistantSummary[]> {
    try {
      const response = await this.getAssistants({
        limit: limit,
        include_inactive: false,
        sort_by: 'name',
        sort_order: 'asc'
      });
      
      return response.assistants;
      
    } catch (error) {
      console.error('❌ Failed to get active assistants:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to get active assistants'
      );
    }
  }
  
  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================
  
  /**
   * Activate an assistant (convenience method)
   */
  async activateAssistant(assistantId: number): Promise<Assistant> {
    return this.updateAssistant(assistantId, { is_active: true });
  }
  
  /**
   * Deactivate an assistant (convenience method)
   */
  async deactivateAssistant(assistantId: number): Promise<Assistant> {
    return this.updateAssistant(assistantId, { is_active: false });
  }
  
  /**
   * Clone an assistant with a new name
   */
  async cloneAssistant(assistantId: number, newName: string): Promise<Assistant> {
    try {
      console.log('🧬 Cloning assistant:', assistantId, 'as', newName);
      
      // Get the original assistant
      const original = await this.getAssistant(assistantId);
      
      // Create a new assistant with the same configuration
      const cloneData: AssistantCreate = {
        name: newName,
        description: original.description ? `Copy of ${original.description}` : undefined,
        system_prompt: original.system_prompt,
        model_preferences: { ...original.model_preferences }
      };
      
      const cloned = await this.createAssistant(cloneData);
      console.log('✅ Assistant cloned:', { originalId: assistantId, clonedId: cloned.id });
      
      return cloned;
      
    } catch (error) {
      console.error('❌ Failed to clone assistant:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to clone assistant',
        undefined,
        assistantId
      );
    }
  }
  
  /**
   * Check if assistant name is available
   */
  async isNameAvailable(name: string, excludeId?: number): Promise<boolean> {
    try {
      const response = await this.searchAssistants(name, 10);
      
      // Check if any result has exact name match
      const exactMatch = response.find(assistant => 
        assistant.name.toLowerCase() === name.toLowerCase() &&
        assistant.id !== excludeId
      );
      
      return !exactMatch;
      
    } catch (error) {
      console.error('❌ Failed to check name availability:', error);
      // If we can't check, assume name is available
      return true;
    }
  }
  
  // =============================================================================
  // HEALTH CHECK
  // =============================================================================
  
  /**
   * Check if assistant service is working
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      // Test by fetching assistants (with limit 1 for efficiency)
      await this.getAssistants({ limit: 1, offset: 0 });
      
      return {
        status: 'healthy',
        message: 'Assistant service is working'
      };
      
    } catch (error) {
      console.error('❌ Assistant service health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }
  
  // =============================================================================
  // EXPORT AND IMPORT (FUTURE FEATURE)
  // =============================================================================
  
  /**
   * Export assistant configuration (placeholder for future implementation)
   */
  async exportAssistant(assistantId: number): Promise<Blob> {
    try {
      console.log('📤 Exporting assistant:', assistantId);
      
      const assistant = await this.getAssistant(assistantId);
      
      // Create export data
      const exportData = {
        name: assistant.name,
        description: assistant.description,
        system_prompt: assistant.system_prompt,
        model_preferences: assistant.model_preferences,
        export_version: '1.0',
        exported_at: new Date().toISOString()
      };
      
      // Convert to JSON blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      console.log('✅ Assistant exported successfully');
      return blob;
      
    } catch (error) {
      console.error('❌ Failed to export assistant:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to export assistant',
        undefined,
        assistantId
      );
    }
  }
  
  /**
   * Import assistant configuration (placeholder for future implementation)
   */
  async importAssistant(file: File): Promise<Assistant> {
    try {
      console.log('📥 Importing assistant from file:', file.name);
      
      // Read file content
      const content = await file.text();
      const importData = JSON.parse(content);
      
      // Validate import data structure
      if (!importData.name || !importData.system_prompt) {
        throw new AssistantServiceError('Invalid import file: missing required fields');
      }
      
      // Create assistant from import data
      const createData: AssistantCreate = {
        name: importData.name,
        description: importData.description,
        system_prompt: importData.system_prompt,
        model_preferences: importData.model_preferences
      };
      
      const assistant = await this.createAssistant(createData);
      console.log('✅ Assistant imported successfully:', assistant.id);
      
      return assistant;
      
    } catch (error) {
      console.error('❌ Failed to import assistant:', error);
      
      if (error instanceof AssistantServiceError) {
        throw error;
      }
      
      throw new AssistantServiceError(
        error instanceof Error ? error.message : 'Failed to import assistant'
      );
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE EXPORT
// =============================================================================

/**
 * Export singleton instance following the same pattern as other services
 * 
 * 🎓 LEARNING: Singleton Pattern
 * =============================
 * Singleton pattern ensures:
 * - Only one instance of the service exists
 * - Shared state and configuration
 * - Consistent behavior across the app
 * - Easy to mock for testing
 * - Memory efficiency
 */
export const assistantService = new AssistantService();

/**
 * Export the class for testing purposes
 */
export { AssistantService };

/**
 * Export the error class for error handling
 */
export { AssistantServiceError };
