// 💬 Core Chat State Management Hook
// Manages messages, loading states, and chat operations
// Extracted from ChatInterface.tsx for better modularity

import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatMessage, ChatServiceError, StreamingChatRequest, ChatResponse } from '../../types/chat';
import { AssistantSummary } from '../../types/assistant';
import { chatService } from '../../services/chatService';
import { useStreamingChat } from '../../utils/streamingStateManager';
import type { FileAttachment } from '../../types/file';

export interface ChatStateConfig {
  selectedConfigId: number | null;
  selectedModelId: string | null;
  selectedAssistantId: number | null;
  selectedAssistant: AssistantSummary | null;
  currentConversationId: number | null;
}

export interface ChatStateActions {
  sendMessage: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  clearChat: () => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  setError: (error: string | null) => void;
  handleCancelStreaming: () => void;
}

export interface ChatStateReturn extends ChatStateActions {
  // State
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  
  // Streaming state
  isStreaming: boolean;
  accumulatedContent: string;
  streamingHasError: boolean;
  streamingError: any;
  connectionState: string;
}

export const useChatState = (config: ChatStateConfig): ChatStateReturn => {
  // 💬 Core chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 🌊 Streaming functionality
  const {
    accumulatedContent,
    isStreaming,
    streamMessage,
    hasError: streamingHasError,
    error: streamingError,
    connectionState,
    stopStreaming
  } = useStreamingChat();
  
  // 📤 Send message handler
  const sendMessage = useCallback(async (content: string, attachments?: FileAttachment[]) => {
    const { selectedConfigId, selectedModelId, selectedAssistantId, selectedAssistant, currentConversationId } = config;
    
    if (!selectedConfigId) {
      setError('Please select an LLM provider first.');
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);
      
      // 🔍 Extract file attachment IDs
      const fileAttachmentIds = attachments?.map(attachment => {
        const backendFileId = attachment.fileUpload.uploadedFileId;
        const parsedId = backendFileId ? parseInt(backendFileId, 10) : undefined;
        return parsedId;
      }).filter(id => id !== undefined && !isNaN(id)) as number[] | undefined;
      
      // 👤 Add user message immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: content
      };
      
      // 🤖 Prepare messages with system prompt if assistant selected
      let messagesWithSystemPrompt = [userMessage];
      if (selectedAssistant) {
        const systemMessage: ChatMessage = {
          role: 'system',
          content: selectedAssistant.system_prompt_preview
        };
        messagesWithSystemPrompt = [systemMessage, ...messages, userMessage];
      } else {
        messagesWithSystemPrompt = [...messages, userMessage];
      }
      
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      
      // 🌊 Try streaming first
      console.log('🌊 Attempting streaming response...');
      
      // Add streaming placeholder
      const streamingPlaceholder: ChatMessage = {
        role: 'assistant',
        content: ''
      };
      setMessages([...updatedMessages, streamingPlaceholder]);
      
      const streamingRequest: StreamingChatRequest = {
        config_id: selectedConfigId,
        messages: messagesWithSystemPrompt,
        model: selectedModelId || undefined,
        file_attachment_ids: fileAttachmentIds,
        assistant_id: selectedAssistantId || undefined,
        conversation_id: currentConversationId || undefined
      };
      
      const streamingSuccess = await streamMessage(
        streamingRequest,
        (finalResponse: ChatResponse) => {
          console.log('✅ Streaming completed');
          
          const finalMessage: ChatMessage = {
            role: 'assistant',
            content: finalResponse.content,
            assistantId: selectedAssistantId || undefined,
            assistantName: selectedAssistant?.name || undefined
          };
          
          setMessages(prev => [
            ...prev.slice(0, -1),
            finalMessage
          ]);
          
          setIsLoading(false);
        }
      );
      
      if (streamingSuccess) {
        console.log('🌊 Streaming initiated successfully');
        return;
      } else {
        console.log('⚠️ Streaming failed, falling back to regular chat');
        setMessages(updatedMessages);
        await sendRegularMessage(updatedMessages, messagesWithSystemPrompt, fileAttachmentIds);
      }
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      handleChatError(error);
      setIsLoading(false);
    }
  }, [config, messages, streamMessage]);
  
  // 🔄 Regular message fallback
  const sendRegularMessage = async (
    updatedMessages: ChatMessage[], 
    messagesWithSystemPrompt: ChatMessage[],
    fileAttachmentIds?: number[]
  ) => {
    const { selectedConfigId, selectedModelId, selectedAssistantId, selectedAssistant, currentConversationId } = config;
    
    try {
      const response = await chatService.sendMessage({
        config_id: selectedConfigId!,
        messages: messagesWithSystemPrompt,
        model: selectedModelId || undefined,
        file_attachment_ids: fileAttachmentIds,
        assistant_id: selectedAssistantId || undefined,
        conversation_id: currentConversationId || undefined
      });
      
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
        assistantId: selectedAssistantId || undefined,
        assistantName: selectedAssistant?.name || undefined
      };
      
      setMessages([...updatedMessages, aiMessage]);
      
      console.log('✅ Received AI response via regular chat');
      
    } finally {
      setIsLoading(false);
    }
  };
  
  // 🚨 Error handling helper
  const handleChatError = (error: unknown) => {
    let errorMessage = 'Failed to send message. Please try again.';
    
    if (error instanceof ChatServiceError) {
      switch (error.errorType) {
        case 'QUOTA_EXCEEDED':
          errorMessage = 'Usage quota exceeded. Please contact your administrator.';
          break;
        case 'PROVIDER_ERROR':
          errorMessage = 'AI provider is currently unavailable. Please try a different provider.';
          break;
        case 'UNAUTHORIZED':
          errorMessage = 'Your session has expired. Please log in again.';
          break;
        default:
          errorMessage = error.message;
      }
    }
    
    setError(errorMessage);
  };
  
  // 🆕 Clear chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);
  
  // 📝 Add message
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  // ✏️ Update last message
  const updateLastMessage = useCallback((content: string) => {
    setMessages(prev => [
      ...prev.slice(0, -1),
      { ...prev[prev.length - 1], content }
    ]);
  }, []);
  
  // 🛑 Enhanced cancel handler
  const handleCancelStreaming = useCallback(() => {
    console.log('🛑 User canceled streaming response - resetting all states');
    stopStreaming();
    setIsLoading(false);
    setError(null);
  }, [stopStreaming]);
  
  return {
    // State
    messages,
    isLoading,
    error,
    
    // Streaming state
    isStreaming,
    accumulatedContent,
    streamingHasError,
    streamingError,
    connectionState,
    
    // Actions
    sendMessage,
    clearChat,
    addMessage,
    updateLastMessage,
    setError,
    handleCancelStreaming
  };
};