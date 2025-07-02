// AI Dock Conversation Service
// Frontend service for conversation save/load functionality

// Import conversation types from cleaned-up type system
import {
  ConversationSummary,
  ConversationDetail,
  ConversationCreate,
  ConversationUpdate,
  ConversationSaveFromMessages,
  ConversationListResponse,
  ConversationStatsResponse,
  ConversationOperationResponse,
  ConversationListRequest,
  ConversationSearchRequest,
  ConversationServiceError,
  ConversationMessageCreate,
  chatMessagesToConversationMessages,
  generateTitleFromMessages,
  shouldAutoSave
} from '../types/conversation';
import { ChatMessage } from '../types/chat';
import { authService } from './authService';

// Configuration - using same base URL as other services
const API_BASE_URL = 'http://localhost:8000';

class ConversationService {
  
  // =============================================================================
  // CONVERSATION CRUD OPERATIONS
  // =============================================================================
  
  /**
   * Create a new empty conversation
   */
  async createConversation(data: ConversationCreate): Promise<ConversationDetail> {
    try {
      console.log('📝 Creating new conversation:', data.title);
      
      const response = await fetch(`${API_BASE_URL}/conversations/`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Failed to create conversation',
          response.status
        );
      }
      
      const conversation: ConversationDetail = await response.json();
      console.log('✅ Conversation created:', conversation.id);
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Failed to create conversation:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Failed to create conversation'
      );
    }
  }
  
  /**
   * Save a complete conversation from message array
   */
  async saveConversationFromMessages(data: ConversationSaveFromMessages): Promise<ConversationDetail> {
    try {
      console.log('💾 Saving conversation from messages:', {
        messageCount: data.messages.length,
        title: data.title,
        model: data.model_used
      });
      
      const response = await fetch(`${API_BASE_URL}/conversations/save-from-messages`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Failed to save conversation',
          response.status
        );
      }
      
      const conversation: ConversationDetail = await response.json();
      console.log('✅ Conversation saved:', conversation.id);
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Failed to save conversation'
      );
    }
  }
  
  /**
   * Get user's conversations with pagination
   */
  async getConversations(params: ConversationListRequest = {}): Promise<ConversationListResponse> {
    try {
      const { limit = 50, offset = 0 } = params;
      
      console.log('📋 Fetching conversations:', { limit, offset });
      
      const url = new URL(`${API_BASE_URL}/conversations/`);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Failed to fetch conversations',
          response.status
        );
      }
      
      const data: ConversationListResponse = await response.json();
      console.log('✅ Conversations fetched:', data.conversations.length);
      
      return data;
      
    } catch (error) {
      console.error('❌ Failed to fetch conversations:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Failed to fetch conversations'
      );
    }
  }
  
  /**
   * Get a specific conversation with all messages
   */
  async getConversation(conversationId: number): Promise<ConversationDetail> {
    try {
      console.log('📖 Loading conversation:', conversationId);
      
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'GET',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Failed to load conversation',
          response.status,
          conversationId
        );
      }
      
      const conversation: ConversationDetail = await response.json();
      console.log('✅ Conversation loaded:', { 
        id: conversation.id, 
        messageCount: conversation.messages.length 
      });
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Failed to load conversation:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Failed to load conversation',
        undefined,
        conversationId
      );
    }
  }
  
  /**
   * Update conversation (currently only title)
   */
  async updateConversation(
    conversationId: number, 
    data: ConversationUpdate
  ): Promise<ConversationDetail> {
    try {
      console.log('✏️ Updating conversation:', conversationId, data);
      
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Failed to update conversation',
          response.status,
          conversationId
        );
      }
      
      const conversation: ConversationDetail = await response.json();
      console.log('✅ Conversation updated:', conversation.id);
      
      return conversation;
      
    } catch (error) {
      console.error('❌ Failed to update conversation:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Failed to update conversation',
        undefined,
        conversationId
      );
    }
  }
  
  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: number): Promise<ConversationOperationResponse> {
    try {
      console.log('🗑️ Deleting conversation:', conversationId);
      
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Failed to delete conversation',
          response.status,
          conversationId
        );
      }
      
      const result: ConversationOperationResponse = await response.json();
      console.log('✅ Conversation deleted:', conversationId);
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to delete conversation:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Failed to delete conversation',
        undefined,
        conversationId
      );
    }
  }
  
  // =============================================================================
  // SEARCH AND STATISTICS
  // =============================================================================
  
  /**
   * Search conversations by title
   */
  async searchConversations(params: ConversationSearchRequest): Promise<ConversationSummary[]> {
    try {
      console.log('🔍 Searching conversations:', params.query);
      
      const response = await fetch(`${API_BASE_URL}/conversations/search`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Search failed',
          response.status
        );
      }
      
      const results: ConversationSummary[] = await response.json();
      console.log('✅ Search completed:', results.length, 'results');
      
      return results;
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Search failed'
      );
    }
  }
  
  /**
   * Get conversation statistics
   */
  async getConversationStats(): Promise<ConversationStatsResponse> {
    try {
      console.log('📊 Fetching conversation stats');
      
      const response = await fetch(`${API_BASE_URL}/conversations/stats/summary`, {
        method: 'GET',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new ConversationServiceError(
          errorData.detail || 'Failed to get stats',
          response.status
        );
      }
      
      const stats: ConversationStatsResponse = await response.json();
      console.log('✅ Stats loaded:', stats);
      
      return stats;
      
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      
      if (error instanceof ConversationServiceError) {
        throw error;
      }
      
      throw new ConversationServiceError(
        error instanceof Error ? error.message : 'Failed to get stats'
      );
    }
  }
  
  // =============================================================================
  // PROJECT-CONVERSATION INTEGRATION
  // =============================================================================
  
  
  
  
  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================
  
  /**
   * Save current chat messages as a new conversation
   * 🔧 FIXED: Removed model name storage per user request
   * 📁 ENHANCED: Added folder/project assignment support
   */
  async saveCurrentChat(
    messages: ChatMessage[],
    title?: string,
    configId?: number,
    model?: string, // Parameter kept for backward compatibility but not used
    projectId?: number // 📁 NEW: Add folder assignment
  ): Promise<ConversationDetail> {
    // Convert ChatMessage to ConversationMessageCreate using utility function
    // 🔧 FIXED: No longer storing model names per user request
    const conversationMessages = chatMessagesToConversationMessages(messages, {
      // Removed all model_used references - no longer storing model names
    });
    
    // Auto-generate title if not provided using utility function
    const conversationTitle = title || generateTitleFromMessages(messages);
    
    return this.saveConversationFromMessages({
      title: conversationTitle,
      messages: conversationMessages,
      llm_config_id: configId,
      project_id: projectId, // 📁 Include folder assignment
      // 🔧 REMOVED: model_used field completely - no longer storing model names
    });
  }
  
  /**
   * Load conversation as chat messages
   */
  async loadConversationAsChat(conversationId: number): Promise<ChatMessage[]> {
    const conversation = await this.getConversation(conversationId);
    
    // Convert ConversationMessage to ChatMessage using utility function
    return conversation.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));
  }
  
  // =============================================================================
  // HEALTH CHECK
  // =============================================================================
  
  /**
   * Check if conversation service is working
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      // Test by fetching conversations (with limit 1 for efficiency)
      await this.getConversations({ limit: 1, offset: 0 });
      
      return {
        status: 'healthy',
        message: 'Conversation service is working'
      };
      
    } catch (error) {
      console.error('❌ Conversation service health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }
}

// Export singleton instance following the same pattern as other services
export const conversationService = new ConversationService();
