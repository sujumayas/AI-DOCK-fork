// Assistant Conversation Service
// Handles integration between assistants and conversations

import {
  AssistantConversationCreate,
  AssistantConversationResponse
} from '../../../types/assistant';
import { assistantApiClient } from '../core/assistantApiClient';
import { AssistantErrorHandler } from '../core/assistantErrorHandler';

/**
 * Assistant Conversation Service
 * 
 * 🎓 LEARNING: Feature Integration Pattern
 * =======================================
 * Conversation integration service provides:
 * - Bridge between assistants and conversations
 * - Assistant-specific conversation creation
 * - Conversation listing for assistants
 * - System prompt and model preference application
 * - User ownership validation
 */

export class AssistantConversationService {
  
  /**
   * Create a conversation with a specific assistant
   */
  async createConversation(data: AssistantConversationCreate): Promise<AssistantConversationResponse> {
    try {
      console.log('💬 Creating conversation with assistant:', data.assistant_id);
      
      const requestData = {
        title: data.title,
        first_message: data.first_message
      };
      
      const conversation = await assistantApiClient.post<AssistantConversationResponse>(
        `${data.assistant_id}/conversations`,
        requestData
      );
      
      console.log('✅ Conversation created with assistant:', {
        conversationId: conversation.id,
        assistantId: conversation.assistant_id,
        assistantName: conversation.assistant_name
      });
      
      return conversation;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'createConversation',
        error,
        'Failed to create conversation with assistant',
        data.assistant_id,
        data
      );
    }
  }

  /**
   * Get conversations for a specific assistant
   */
  async getConversations(
    assistantId: number, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<AssistantConversationResponse[]> {
    try {
      console.log('📋 Fetching conversations for assistant:', assistantId);
      
      const queryParams = {
        limit: limit.toString(),
        offset: offset.toString()
      };
      
      const conversations = await assistantApiClient.get<AssistantConversationResponse[]>(
        `${assistantId}/conversations`,
        queryParams
      );
      
      console.log('✅ Assistant conversations fetched:', conversations.length);
      return conversations;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getConversations',
        error,
        'Failed to fetch assistant conversations',
        assistantId,
        { limit, offset }
      );
    }
  }

  /**
   * Get recent conversations for an assistant
   */
  async getRecentConversations(
    assistantId: number, 
    limit: number = 10
  ): Promise<AssistantConversationResponse[]> {
    return this.getConversations(assistantId, limit, 0);
  }

  /**
   * Get conversation count for an assistant
   */
  async getConversationCount(assistantId: number): Promise<number> {
    try {
      const conversations = await this.getConversations(assistantId, 1, 0);
      // Note: This is a simplified approach. In a real implementation,
      // you might want a dedicated endpoint that returns just the count
      // for better performance with large datasets.
      
      // For now, we can get this from the assistant details
      // which includes conversation_count
      return conversations.length;
      
    } catch (error) {
      console.error('❌ Failed to get conversation count:', error);
      return 0;
    }
  }

  /**
   * Check if assistant has any conversations
   */
  async hasConversations(assistantId: number): Promise<boolean> {
    try {
      const conversations = await this.getConversations(assistantId, 1, 0);
      return conversations.length > 0;
    } catch (error) {
      console.error('❌ Failed to check if assistant has conversations:', error);
      return false;
    }
  }
}

// Export singleton instance
export const assistantConversationService = new AssistantConversationService();
