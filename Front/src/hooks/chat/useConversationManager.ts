// 💾 Conversation Save/Load Management Hook
// Manages conversation persistence, auto-save, and history operations
// Extracted from ChatInterface.tsx for better modularity

import { useState, useEffect, useCallback } from 'react';
import { conversationService } from '../../services/conversationService';
import { ConversationServiceError, DEFAULT_AUTO_SAVE_CONFIG, shouldAutoSave } from '../../types/conversation';
import { ChatMessage } from '../../types/chat';

export interface ConversationManagerState {
  // Conversation data
  currentConversationId: number | null;
  conversationTitle: string | null;
  
  // Save state
  isSavingConversation: boolean;
  lastAutoSaveMessageCount: number;
  autoSaveFailedAt: number | null;
  
  // Sidebar state
  showConversationSidebar: boolean;
  conversationRefreshTrigger: number;
  sidebarUpdateFunction: ((id: number, count: number) => void) | null;
  sidebarAddConversationFunction: ((conv: any) => void) | null;
}

export interface ConversationManagerActions {
  // Save operations
  handleAutoSaveConversation: (messages: ChatMessage[], config?: { selectedConfigId?: number; selectedModelId?: string }) => Promise<void>;
  handleSaveConversation: (messages: ChatMessage[], config?: { selectedConfigId?: number; selectedModelId?: string }) => Promise<void>;
  handleLoadConversation: (conversationId: number) => Promise<ChatMessage[]>;
  
  // Conversation lifecycle
  handleNewConversation: () => void;
  
  // Sidebar management
  setShowConversationSidebar: (show: boolean) => void;
  setSidebarFunctions: (updateFn: (id: number, count: number) => void, addFn: (conv: any) => void) => void;
  handleAddConversationToSidebar: (conversation: any) => void;
  
  // Error handling
  setConversationError: (error: string | null) => void;
}

export interface ConversationManagerReturn extends ConversationManagerState, ConversationManagerActions {}

export const useConversationManager = (
  onError?: (error: string) => void,
  onConversationLoad?: (messages: ChatMessage[]) => void,
  onConversationClear?: () => void
): ConversationManagerReturn => {
  // 💾 Conversation state
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [lastAutoSaveMessageCount, setLastAutoSaveMessageCount] = useState(0);
  const [autoSaveFailedAt, setAutoSaveFailedAt] = useState<number | null>(null);
  
  // 💾 Sidebar state
  const [showConversationSidebar, setShowConversationSidebar] = useState(false);
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = useState(0);
  const [sidebarUpdateFunction, setSidebarUpdateFunction] = useState<((id: number, count: number) => void) | null>(null);
  const [sidebarAddConversationFunction, setSidebarAddConversationFunction] = useState<((conv: any) => void) | null>(null);
  
  // 💾 Auto-save conversation
  const handleAutoSaveConversation = useCallback(async (
    messages: ChatMessage[], 
    config?: { selectedConfigId?: number; selectedModelId?: string }
  ) => {
    if (messages.length < DEFAULT_AUTO_SAVE_CONFIG.triggerAfterMessages) {
      return;
    }
    
    try {
      setIsSavingConversation(true);
      console.log('💾 Auto-saving conversation with', messages.length, 'messages');
      
      const savedConversation = await conversationService.saveCurrentChat(
        messages,
        undefined, // Auto-generate title
        config?.selectedConfigId || undefined,
        config?.selectedModelId || undefined
      );
      
      setCurrentConversationId(savedConversation.id);
      setConversationTitle(savedConversation.title);
      setLastAutoSaveMessageCount(messages.length);
      setAutoSaveFailedAt(null); // Clear failure tracking on success
      
      // Add conversation to sidebar immediately
      if (sidebarAddConversationFunction) {
        const conversationSummary = {
          id: savedConversation.id,
          title: savedConversation.title,
          message_count: messages.length,
          created_at: savedConversation.created_at || new Date().toISOString(),
          updated_at: savedConversation.updated_at || new Date().toISOString()
        };
        sidebarAddConversationFunction(conversationSummary);
      } else {
        // Fallback to refresh trigger
        setConversationRefreshTrigger(prev => prev + 1);
      }
      
      console.log('✅ Conversation auto-saved:', savedConversation.id);
      
    } catch (error) {
      console.error('❌ Failed to auto-save conversation:', error);
      setAutoSaveFailedAt(messages.length); // Track failure at this message count
      console.warn('🚫 Auto-save blocked for message count:', messages.length);
    } finally {
      setIsSavingConversation(false);
    }
  }, [sidebarAddConversationFunction]);
  
  // 💾 Manually save conversation
  const handleSaveConversation = useCallback(async (
    messages: ChatMessage[],
    config?: { selectedConfigId?: number; selectedModelId?: string }
  ) => {
    if (messages.length === 0) {
      if (onError) onError('No messages to save');
      return;
    }
    
    try {
      setIsSavingConversation(true);
      console.log('💾 Manually saving conversation');
      
      if (currentConversationId) {
        // Conversation already saved
        console.log('✅ Conversation already saved:', currentConversationId);
      } else {
        // Save as new conversation
        const savedConversation = await conversationService.saveCurrentChat(
          messages,
          undefined, // Auto-generate title
          config?.selectedConfigId || undefined,
          config?.selectedModelId || undefined
        );
        
        setCurrentConversationId(savedConversation.id);
        setConversationTitle(savedConversation.title);
        setLastAutoSaveMessageCount(messages.length);
        setAutoSaveFailedAt(null); // Clear failure tracking
        
        // Add conversation to sidebar immediately
        if (sidebarAddConversationFunction) {
          const conversationSummary = {
            id: savedConversation.id,
            title: savedConversation.title,
            message_count: messages.length,
            created_at: savedConversation.created_at || new Date().toISOString(),
            updated_at: savedConversation.updated_at || new Date().toISOString()
          };
          sidebarAddConversationFunction(conversationSummary);
        } else {
          setConversationRefreshTrigger(prev => prev + 1);
        }
        
        // Update message count in sidebar
        if (sidebarUpdateFunction) {
          sidebarUpdateFunction(savedConversation.id, messages.length);
        }
        
        console.log('✅ Conversation saved:', savedConversation.id);
      }
      
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
      if (onError) {
        onError(
          error instanceof ConversationServiceError 
            ? error.message 
            : 'Failed to save conversation'
        );
      }
    } finally {
      setIsSavingConversation(false);
    }
  }, [currentConversationId, sidebarAddConversationFunction, sidebarUpdateFunction, onError]);
  
  // 📖 Load conversation
  const handleLoadConversation = useCallback(async (conversationId: number): Promise<ChatMessage[]> => {
    try {
      console.log('📖 Loading conversation:', conversationId);
      
      const chatMessages = await conversationService.loadConversationAsChat(conversationId);
      
      setCurrentConversationId(conversationId);
      setLastAutoSaveMessageCount(chatMessages.length);
      setAutoSaveFailedAt(null); // Reset auto-save tracking
      
      // Close sidebar on mobile
      if (window.innerWidth < 1024) {
        setShowConversationSidebar(false);
      }
      
      console.log('✅ Conversation loaded:', chatMessages.length, 'messages');
      
      if (onConversationLoad) {
        onConversationLoad(chatMessages);
      }
      
      return chatMessages;
      
    } catch (error) {
      console.error('❌ Failed to load conversation:', error);
      if (onError) {
        onError(
          error instanceof ConversationServiceError 
            ? error.message 
            : 'Failed to load conversation'
        );
      }
      return [];
    }
  }, [onConversationLoad, onError]);
  
  // 🆕 Start new conversation
  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setConversationTitle(null);
    setLastAutoSaveMessageCount(0);
    setAutoSaveFailedAt(null); // Reset auto-save failure tracking
    
    if (onConversationClear) {
      onConversationClear();
    }
    
    console.log('🆕 Started new conversation');
  }, [onConversationClear]);
  
  // 🔄 Set sidebar functions
  const setSidebarFunctions = useCallback((
    updateFn: (id: number, count: number) => void, 
    addFn: (conv: any) => void
  ) => {
    setSidebarUpdateFunction(() => updateFn);
    setSidebarAddConversationFunction(() => addFn);
    console.log('🔄 Connected sidebar functions for reactive updates');
  }, []);
  
  // 🔄 Handle adding conversations to sidebar
  const handleAddConversationToSidebar = useCallback((conversation: any) => {
    if (sidebarAddConversationFunction) {
      sidebarAddConversationFunction(conversation);
      console.log('🔄 Added conversation to sidebar:', conversation.id);
    }
  }, [sidebarAddConversationFunction]);
  
  // 🚨 Set conversation error
  const setConversationError = useCallback((error: string | null) => {
    if (error && onError) {
      onError(error);
    }
  }, [onError]);
  
  // 🔄 Update message count in sidebar when conversation ID exists
  const updateSidebarMessageCount = useCallback((messageCount: number) => {
    if (currentConversationId && sidebarUpdateFunction && messageCount > 0) {
      sidebarUpdateFunction(currentConversationId, messageCount);
      console.log('🔄 Updated message count for conversation', currentConversationId, 'to', messageCount);
    }
  }, [currentConversationId, sidebarUpdateFunction]);
  
  return {
    // State
    currentConversationId,
    conversationTitle,
    isSavingConversation,
    lastAutoSaveMessageCount,
    autoSaveFailedAt,
    showConversationSidebar,
    conversationRefreshTrigger,
    sidebarUpdateFunction,
    sidebarAddConversationFunction,
    
    // Actions
    handleAutoSaveConversation,
    handleSaveConversation,
    handleLoadConversation,
    handleNewConversation,
    setShowConversationSidebar,
    setSidebarFunctions,
    handleAddConversationToSidebar,
    setConversationError
  };
};