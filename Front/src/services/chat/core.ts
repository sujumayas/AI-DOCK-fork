// 💬 Core Chat Service
// Basic chat operations and message sending functionality

import { ChatRequest, ChatResponse } from '../../types/chat';
import { authService } from '../authService';
import { createChatServiceError, logChatError } from './errors';

// Configuration - using same base URL as auth service
const API_BASE_URL = 'http://localhost:8000';

/**
 * Core Chat Service - handles basic chat operations
 * 🎓 Learning: Separation of core functionality from advanced features
 */
export class CoreChatService {
  
  /**
   * Send a basic chat message to the LLM
   * 💬 Main function for non-streaming chat interactions
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      console.log('📤 Sending chat message:', { 
        config_id: request.config_id, 
        messageCount: request.messages.length,
        url: `${API_BASE_URL}/chat/send`,
        headers: authService.getAuthHeaders()
      });

      const response = await fetch(`${API_BASE_URL}/chat/send`, {
        method: 'POST',
        headers: authService.getAuthHeaders(), // Use existing auth pattern
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.detail || 'Failed to send chat message';
        
        // Create specific error with status code for better error handling
        throw createChatServiceError(
          errorMessage, 
          errorMessage,
          response.status
        );
      }

      const chatResponse: ChatResponse = await response.json();
      
      console.log('📥 Received chat response:', { 
        provider: chatResponse.provider, 
        model: chatResponse.model,
        tokenCount: chatResponse.usage.total_tokens 
      });
      
      return chatResponse;
      
    } catch (error) {
      logChatError('Chat service error', error, {
        configId: request.config_id,
        messageCount: request.messages.length
      });
      
      throw createChatServiceError(
        error,
        'An unexpected error occurred while processing your chat message'
      );
    }
  }

  /**
   * Get API base URL for other services
   */
  getApiBaseUrl(): string {
    return API_BASE_URL;
  }

  /**
   * Get authenticated headers for requests
   */
  getAuthHeaders(): Record<string, string> {
    return authService.getAuthHeaders() as Record<string, string>;
  }
}

// Export singleton instance
export const coreChatService = new CoreChatService();
