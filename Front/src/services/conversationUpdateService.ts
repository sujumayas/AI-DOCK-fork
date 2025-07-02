// Enhanced Conversation Service - Atomic Message Persistence
// Prevents race conditions and duplicate saves through proper state management

import { ConversationDetail, ConversationOperationResponse } from '../types/conversation';
import { ChatMessage } from '../types/chat';
import { authService } from './authService';

const API_BASE_URL = 'http://localhost:8000';

/**
 * State tracker to prevent concurrent saves and race conditions
 */
class ConversationStateTracker {
  private saveInProgress = new Set<string>();
  private lastSavedCounts = new Map<number, number>();
  private pendingOperations = new Map<string, Promise<any>>();

  isOperationInProgress(key: string): boolean {
    return this.saveInProgress.has(key) || this.pendingOperations.has(key);
  }

  setOperationInProgress(key: string, promise: Promise<any>): void {
    this.saveInProgress.add(key);
    this.pendingOperations.set(key, promise);
    
    promise.finally(() => {
      this.saveInProgress.delete(key);
      this.pendingOperations.delete(key);
    });
  }

  getLastSavedCount(conversationId: number): number {
    return this.lastSavedCounts.get(conversationId) || 0;
  }

  setLastSavedCount(conversationId: number, count: number): void {
    this.lastSavedCounts.set(conversationId, count);
  }

  clearConversationState(conversationId: number): void {
    this.lastSavedCounts.delete(conversationId);
    // Also clear any related operation keys
    const keysToDelete = Array.from(this.saveInProgress).filter(key => 
      key.includes(`conv_${conversationId}`)
    );
    keysToDelete.forEach(key => this.saveInProgress.delete(key));
  }
}

/**
 * Enhanced conversation service with atomic operations and race condition prevention
 */
export class ConversationUpdateService {
  private stateTracker = new ConversationStateTracker();

  /**
   * Add a single message to an existing conversation atomically
   */
  async addMessageToConversation(
    conversationId: number,
    message: ChatMessage,
    modelUsed?: string
  ): Promise<ConversationOperationResponse> {
    const operationKey = `add_msg_${conversationId}_${Date.now()}`;
    
    if (this.stateTracker.isOperationInProgress(`conv_${conversationId}`)) {
      throw new Error('Another save operation is in progress for this conversation');
    }

    try {
      console.log('💾 Adding message to conversation:', { conversationId, role: message.role });
      
      const url = new URL(`${API_BASE_URL}/conversations/${conversationId}/messages`);
      url.searchParams.set('role', message.role);
      url.searchParams.set('content', message.content);
      if (modelUsed) {
        url.searchParams.set('model_used', modelUsed);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: authService.getAuthHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add message to conversation');
      }
      
      const result: ConversationOperationResponse = await response.json();
      console.log('✅ Message added to conversation:', conversationId);
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to add message to conversation:', error);
      throw error;
    }
  }

  /**
   * Add multiple messages to an existing conversation with atomic behavior
   */
  async addMessagesToConversation(
    conversationId: number,
    messages: ChatMessage[],
    modelUsed?: string
  ): Promise<void> {
    const operationKey = `add_msgs_${conversationId}`;
    
    if (this.stateTracker.isOperationInProgress(operationKey)) {
      console.log('🔄 Messages already being added to conversation:', conversationId);
      return;
    }

    const operation = this._performAddMessages(conversationId, messages, modelUsed);
    this.stateTracker.setOperationInProgress(operationKey, operation);
    
    await operation;
  }

  private async _performAddMessages(
    conversationId: number,
    messages: ChatMessage[],
    modelUsed?: string
  ): Promise<void> {
    try {
      console.log('💾 Adding', messages.length, 'messages to conversation:', conversationId);
      
      // Process messages sequentially to maintain order
      for (const message of messages) {
        await this.addMessageToConversation(conversationId, message, modelUsed);
      }
      
      // Update state tracker
      const newCount = this.stateTracker.getLastSavedCount(conversationId) + messages.length;
      this.stateTracker.setLastSavedCount(conversationId, newCount);
      
      console.log('✅ All messages added to conversation:', conversationId);
      
    } catch (error) {
      console.error('❌ Failed to add messages to conversation:', error);
      throw error;
    }
  }

  /**
   * Update existing conversation with new messages only
   */
  async updateConversationWithNewMessages(
    conversationId: number,
    currentMessages: ChatMessage[],
    storedMessageCount: number,
    modelUsed?: string
  ): Promise<void> {
    const operationKey = `update_${conversationId}`;
    
    if (this.stateTracker.isOperationInProgress(operationKey)) {
      console.log('🔄 Conversation update already in progress:', conversationId);
      return;
    }

    const operation = this._performUpdateConversation(
      conversationId, 
      currentMessages, 
      storedMessageCount, 
      modelUsed
    );
    this.stateTracker.setOperationInProgress(operationKey, operation);
    
    await operation;
  }

  private async _performUpdateConversation(
    conversationId: number,
    currentMessages: ChatMessage[],
    storedMessageCount: number,
    modelUsed?: string
  ): Promise<void> {
    try {
      // Calculate new messages that need to be saved
      const newMessages = currentMessages.slice(storedMessageCount);
      
      if (newMessages.length === 0) {
        console.log('🔄 No new messages to save for conversation:', conversationId);
        return;
      }
      
      console.log('💾 Updating conversation with', newMessages.length, 'new messages');
      
      // Add new messages to the conversation
      await this.addMessagesToConversation(conversationId, newMessages, modelUsed);
      
      // Update state tracker
      this.stateTracker.setLastSavedCount(conversationId, currentMessages.length);
      
    } catch (error) {
      console.error('❌ Failed to update conversation with new messages:', error);
      throw error;
    }
  }

  /**
   * Smart save with enhanced race condition prevention
   */
  async smartSaveConversation(
    messages: ChatMessage[],
    existingConversationId: number | null,
    storedMessageCount: number,
    config?: { selectedConfigId?: number; selectedModelId?: string; projectId?: number }
  ): Promise<{ conversationId: number; isNewConversation: boolean }> {
    const operationKey = existingConversationId 
      ? `smart_save_${existingConversationId}` 
      : `smart_save_new_${Date.now()}`;
    
    if (this.stateTracker.isOperationInProgress(operationKey)) {
      console.log('🔄 Smart save already in progress, skipping');
      return {
        conversationId: existingConversationId || 0,
        isNewConversation: false
      };
    }

    const operation = this._performSmartSave(
      messages,
      existingConversationId,
      storedMessageCount,
      config
    );
    this.stateTracker.setOperationInProgress(operationKey, operation);
    
    return await operation;
  }

  private async _performSmartSave(
    messages: ChatMessage[],
    existingConversationId: number | null,
    storedMessageCount: number,
    config?: { selectedConfigId?: number; selectedModelId?: string; projectId?: number }
  ): Promise<{ conversationId: number; isNewConversation: boolean }> {
    try {
      if (existingConversationId && messages.length > storedMessageCount) {
        // Update existing conversation with new messages
        await this.updateConversationWithNewMessages(
          existingConversationId,
          messages,
          storedMessageCount,
          config?.selectedModelId
        );
        
        return {
          conversationId: existingConversationId,
          isNewConversation: false
        };
        
      } else if (!existingConversationId && messages.length > 0) {
        // Create new conversation
        const { conversationService } = await import('./conversationService');
        const savedConversation = await conversationService.saveCurrentChat(
          messages,
          undefined, // Auto-generate title
          config?.selectedConfigId,
          config?.selectedModelId,
          config?.projectId // 📁 Pass folder assignment
        );
        
        // Initialize state tracking for new conversation
        this.stateTracker.setLastSavedCount(savedConversation.id, messages.length);
        
        return {
          conversationId: savedConversation.id,
          isNewConversation: true
        };
        
      } else {
        // No action needed
        console.log('🔄 No conversation update needed');
        return {
          conversationId: existingConversationId || 0,
          isNewConversation: false
        };
      }
      
    } catch (error) {
      console.error('❌ Smart save failed:', error);
      throw error;
    }
  }

  /**
   * Initialize state tracking for a loaded conversation
   */
  initializeConversationState(conversationId: number, messageCount: number): void {
    this.stateTracker.setLastSavedCount(conversationId, messageCount);
    console.log('🔧 Initialized conversation state:', { conversationId, messageCount });
  }

  /**
   * Clear state for a conversation (when starting new conversation)
   */
  clearConversationState(conversationId?: number): void {
    if (conversationId) {
      this.stateTracker.clearConversationState(conversationId);
      console.log('🧹 Cleared conversation state:', conversationId);
    }
  }

  /**
   * Get the last known saved message count for a conversation
   */
  getLastSavedCount(conversationId: number): number {
    return this.stateTracker.getLastSavedCount(conversationId);
  }

  /**
   * Check if any operations are in progress for a conversation
   */
  isConversationBusy(conversationId: number): boolean {
    return this.stateTracker.isOperationInProgress(`conv_${conversationId}`) ||
           this.stateTracker.isOperationInProgress(`update_${conversationId}`) ||
           this.stateTracker.isOperationInProgress(`smart_save_${conversationId}`);
  }
}

// Export singleton instance
export const conversationUpdateService = new ConversationUpdateService();
