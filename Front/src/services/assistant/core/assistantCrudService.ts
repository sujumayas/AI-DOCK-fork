// Assistant CRUD Service
// Core Create, Read, Update, Delete operations for assistants

import {
  Assistant,
  AssistantCreate,
  AssistantUpdate,
  AssistantOperationResponse
} from '../../../types/assistant';
import { assistantApiClient } from './assistantApiClient';
import { AssistantErrorHandler } from './assistantErrorHandler';

/**
 * Assistant CRUD Service
 * 
 * 🎓 LEARNING: CRUD Operations Pattern
 * ===================================
 * CRUD service provides:
 * - Basic Create, Read, Update, Delete operations
 * - Single responsibility for data operations
 * - Consistent error handling
 * - Type-safe request/response handling
 * - Foundation for other services
 */

export class AssistantCrudService {
  
  /**
   * Create a new assistant
   */
  async create(data: AssistantCreate): Promise<Assistant> {
    try {
      console.log('🤖 Creating new assistant:', data.name);
      
      const assistant = await assistantApiClient.post<Assistant>('', data);
      
      console.log('✅ Assistant created:', assistant.id);
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'create',
        error,
        'Failed to create assistant',
        undefined,
        { name: data.name }
      );
    }
  }

  /**
   * Get a specific assistant by ID
   */
  async getById(assistantId: number): Promise<Assistant> {
    try {
      console.log('📖 Loading assistant:', assistantId);
      
      const assistant = await assistantApiClient.get<Assistant>(`${assistantId}`);
      
      console.log('✅ Assistant loaded:', { 
        id: assistant.id, 
        name: assistant.name,
        conversationCount: assistant.conversation_count 
      });
      
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getById',
        error,
        'Failed to load assistant',
        assistantId
      );
    }
  }

  /**
   * Update an existing assistant
   */
  async update(assistantId: number, data: AssistantUpdate): Promise<Assistant> {
    try {
      console.log('✏️ Updating assistant:', assistantId, data);
      
      const assistant = await assistantApiClient.put<Assistant>(`${assistantId}`, data);
      
      console.log('✅ Assistant updated:', assistant.id);
      return assistant;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'update',
        error,
        'Failed to update assistant',
        assistantId,
        data
      );
    }
  }

  /**
   * Delete an assistant
   */
  async delete(assistantId: number): Promise<AssistantOperationResponse> {
    try {
      console.log('🗑️ Deleting assistant:', assistantId);
      
      const result = await assistantApiClient.delete<AssistantOperationResponse>(`${assistantId}`);
      
      console.log('✅ Assistant deleted:', assistantId);
      return result;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'delete',
        error,
        'Failed to delete assistant',
        assistantId
      );
    }
  }

  /**
   * Check if assistant exists
   */
  async exists(assistantId: number): Promise<boolean> {
    try {
      await this.getById(assistantId);
      return true;
    } catch (error) {
      // If error is 404, assistant doesn't exist
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      // For other errors, rethrow
      throw error;
    }
  }
}

// Export singleton instance
export const assistantCrudService = new AssistantCrudService();
