// 🛠️ Pure Chat Utility Functions
// Helper functions for chat operations and data processing
// Extracted from ChatInterface.tsx for better modularity

import { ChatMessage } from '../types/chat';
import { AssistantSummary } from '../types/assistant';
import type { FileAttachment } from '../types/file';

/**
 * Extract file attachment IDs from FileAttachment objects
 * Handles parsing and validation of backend file IDs
 */
export function extractFileAttachmentIds(attachments?: FileAttachment[]): number[] | undefined {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }
  
  const fileIds = attachments.map(attachment => {
    const backendFileId = attachment.fileUpload.uploadedFileId;
    const parsedId = backendFileId ? parseInt(backendFileId, 10) : undefined;
    
    console.log('🔍 DEBUG - File ID Extraction:', {
      fileName: attachment.fileUpload.file.name,
      rawUploadedFileId: backendFileId,
      rawType: typeof backendFileId,
      parsedId: parsedId,
      isValidNumber: !isNaN(parsedId || NaN),
      willBeIncluded: parsedId !== undefined && !isNaN(parsedId)
    });
    
    return parsedId;
  }).filter(id => id !== undefined && !isNaN(id)) as number[];
  
  console.log('🔍 DEBUG - Final File Attachment IDs:', {
    originalAttachmentCount: attachments.length,
    finalIdCount: fileIds.length,
    fileAttachmentIds: fileIds,
    issue: attachments.length > 0 && fileIds.length === 0 
      ? 'FILE IDs NOT EXTRACTED - Check uploadedFileId assignment'
      : null
  });
  
  return fileIds.length > 0 ? fileIds : undefined;
}

/**
 * Create assistant introduction message
 */
export function createAssistantIntroMessage(
  assistant: AssistantSummary, 
  previousAssistant: AssistantSummary | null
): ChatMessage {
  return {
    role: 'assistant',
    content: `Hello! I'm **${assistant.name}**, your AI assistant.\n\n${assistant.description || assistant.system_prompt_preview || 'I\'m here to help you with your questions.'}\n\nHow can I assist you today?`,
    assistantId: assistant.id,
    assistantName: assistant.name,
    assistantIntroduction: true,
    assistantChanged: !!previousAssistant,
    previousAssistantName: previousAssistant?.name
  };
}

/**
 * Create assistant deselection message
 */
export function createAssistantDeselectionMessage(previousAssistant: AssistantSummary): ChatMessage {
  return {
    role: 'system',
    content: `Switched back to default AI chat`,
    assistantChanged: true,
    previousAssistantName: previousAssistant.name
  };
}

/**
 * Prepare messages with system prompt for assistant
 */
export function prepareMessagesWithSystemPrompt(
  messages: ChatMessage[],
  newUserMessage: ChatMessage,
  selectedAssistant: AssistantSummary | null
): ChatMessage[] {
  if (!selectedAssistant) {
    return [...messages, newUserMessage];
  }
  
  // Add assistant's system prompt as the first message
  const systemMessage: ChatMessage = {
    role: 'system',
    content: selectedAssistant.system_prompt_preview
  };
  
  return [systemMessage, ...messages, newUserMessage];
}

/**
 * Create streaming placeholder message
 */
export function createStreamingPlaceholder(): ChatMessage {
  return {
    role: 'assistant',
    content: '' // Will be updated by streaming
  };
}

/**
 * Create final AI response message
 */
export function createFinalAIMessage(
  content: string, 
  selectedAssistantId: number | null, 
  selectedAssistant: AssistantSummary | null
): ChatMessage {
  return {
    role: 'assistant',
    content,
    assistantId: selectedAssistantId || undefined,
    assistantName: selectedAssistant?.name || undefined
  };
}

/**
 * Validate chat prerequisites before sending
 */
export function validateChatPrerequisites(selectedConfigId: number | null): string | null {
  if (!selectedConfigId) {
    return 'Please select an LLM provider first.';
  }
  return null;
}

/**
 * Determine placeholder text based on current state
 */
export function getChatPlaceholderText(
  selectedConfigId: number | null,
  modelsLoading: boolean,
  modelsError: string | null,
  selectedAssistant: AssistantSummary | null,
  currentModelInfo: any,
  connectionStatus: string
): string {
  if (!selectedConfigId) {
    return "Select an AI model to start chatting...";
  }
  
  if (modelsLoading) {
    return "Loading AI models...";
  }
  
  if (modelsError) {
    return "Model loading failed - using default model";
  }
  
  if (connectionStatus === 'error') {
    return "Connection error - please try again";
  }
  
  if (selectedAssistant && currentModelInfo) {
    return `Chatting with ${selectedAssistant.name} via ${currentModelInfo.display_name}...`;
  }
  
  if (currentModelInfo) {
    return `Chatting with *${currentModelInfo.display_name}*`;
  }
  
  return "Type your message here...";
}

/**
 * Check if chat should show assistant suggestions
 */
export function shouldShowAssistantSuggestions(
  selectedAssistantId: number | null,
  messagesLength: number,
  availableAssistantsLength: number
): boolean {
  return !selectedAssistantId && messagesLength === 0 && availableAssistantsLength > 0;
}

/**
 * Check if save conversation button should be shown
 */
export function shouldShowSaveButton(
  messagesLength: number,
  currentConversationId: number | null
): boolean {
  return messagesLength > 0 && !currentConversationId;
}

/**
 * Get model tooltip text
 */
export function getModelTooltipText(model: any): string {
  if (!model) return '';
  
  return `${model.provider} model`;
}

/**
 * Format conversation title for display
 */
export function formatConversationTitle(title: string, maxLength: number = 20): string {
  if (!title) return '';
  
  return title.length > maxLength 
    ? title.substring(0, maxLength) + '...' 
    : title;
}

/**
 * Determine if mobile sidebar should close
 */
export function shouldCloseMobileSidebar(screenWidth: number): boolean {
  return screenWidth < 1024;
}

/**
 * Get error message for chat service errors
 */
export function getChatErrorMessage(error: any): string {
  if (error && typeof error === 'object' && 'errorType' in error) {
    switch (error.errorType) {
      case 'QUOTA_EXCEEDED':
        return 'Usage quota exceeded. Please contact your administrator.';
      case 'PROVIDER_ERROR':
        return 'AI provider is currently unavailable. Please try a different provider.';
      case 'UNAUTHORIZED':
        return 'Your session has expired. Please log in again.';
      default:
        return error.message || 'Failed to send message. Please try again.';
    }
  }
  
  return 'Failed to send message. Please try again.';
}

/**
 * Debug log for streaming state
 */
export function logStreamingDebug(
  isStreaming: boolean, 
  connectionState: string, 
  hasError: boolean
): void {
  console.log('🌊 Streaming Debug:', {
    isStreaming,
    connectionState,
    hasError,
    timestamp: new Date().toISOString()
  });
}

/**
 * Create conversation summary for sidebar
 */
export function createConversationSummary(
  savedConversation: any,
  messageCount: number
): any {
  return {
    id: savedConversation.id,
    title: savedConversation.title,
    message_count: messageCount,
    created_at: savedConversation.created_at || new Date().toISOString(),
    updated_at: savedConversation.updated_at || new Date().toISOString(),
    last_message_at: savedConversation.last_message_at || new Date().toISOString()
  };
}

/**
 * Format timestamp for conversation display with enhanced precision and debugging
 * 
 * Requirements:
 * - "Just now" for < 30 seconds
 * - "< 1m ago" for 30 seconds to 1 minute  
 * - Specific minutes up to 1h (1m, 2m, ..., 59m)
 * - Increments of 1h until yesterday (1h, 2h, ..., 23h)  
 * - Yesterday with exact time (Yesterday 3:45 PM)
 * - After that: date and time (Dec 15, 3:45 PM or Dec 15, 2023, 3:45 PM)
 * 
 * ENHANCED: Better error handling, debugging, and timestamp format support
 */
export function formatConversationTimestamp(dateString: string | null | undefined): string {
  // Handle missing or invalid timestamps
  if (!dateString) {
    console.warn('⚠️ formatConversationTimestamp: No dateString provided');
    return 'Unknown time';
  }

  try {
    // Handle different timestamp formats and ensure proper parsing
    let date: Date;
    
    // Ensure proper ISO string format for parsing
    const cleanDateString = typeof dateString === 'string' ? dateString.trim() : String(dateString);
    
    // Handle potential timezone issues by ensuring Z suffix for UTC timestamps
    const isoDateString = cleanDateString.includes('T') && !cleanDateString.includes('Z') && !cleanDateString.includes('+')
      ? `${cleanDateString}Z`
      : cleanDateString;
    
    date = new Date(isoDateString);
    
    const now = new Date();
    
    // 🔧 FIX: Validate the date and provide comprehensive debugging info
    if (isNaN(date.getTime())) {
      console.error('❌ Invalid date for timestamp formatting:', {
        originalInput: dateString,
        type: typeof dateString,
        length: dateString ? String(dateString).length : 0,
        parseAttempt: date.toString()
      });
      return 'Invalid time';
    }
    
    // Calculate time differences for formatting
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Debug logging for troubleshooting (only when in development)
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) { // Random sampling to avoid spam
      console.log('🕒 Timestamp formatting debug:', {
        input: dateString,
        parsed: date.toISOString(),
        now: now.toISOString(),
        diffMs,
        diffMinutes,
        diffHours,
        diffDays,
        isToday: date.toDateString() === now.toDateString(),
        isYesterday: (() => {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          return date.toDateString() === yesterday.toDateString();
        })()
      });
    }
    
    // Handle future timestamps (clock skew protection)
    if (diffMs < 0) {
      const futureMs = Math.abs(diffMs);
      if (futureMs < 60000) { // Less than 1 minute in the future
        return 'Just now'; // Treat minor clock skew as "just now"
      }
      console.warn('⚠️ Future timestamp detected:', {
        dateString,
        parsed: date.toISOString(),
        now: now.toISOString(),
        futureBy: `${Math.floor(futureMs / 1000)}s`
      });
      return 'Just now'; // Fallback for future timestamps
    }
    
    // Check if it's yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    // Check if it's today
    const isToday = date.toDateString() === now.toDateString();
    
    // 🔧 ENHANCED: More precise timing for better user experience
    if (diffMs < 30000) {
      // Less than 30 seconds
      return 'Just now';
    } else if (diffMinutes < 1) {
      // Between 30 seconds and 1 minute
      return '< 1m ago';
    } else if (diffMinutes < 60) {
      // 1-59 minutes ago
      return `${diffMinutes}m ago`;
    } else if (isToday && diffHours < 24) {
      // Today, show hours
      return `${diffHours}h ago`;
    } else if (isYesterday) {
      // Yesterday with exact time
      return `Yesterday ${date.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else {
      // Date and time for older conversations
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      
      // Add year if it's not current year
      if (date.getFullYear() !== now.getFullYear()) {
        options.year = 'numeric';
      }
      
      return date.toLocaleDateString([], options);
    }
  } catch (error) {
    console.error('💥 Error formatting conversation timestamp:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      input: dateString,
      type: typeof dateString
    });
    return 'Time error';
  }
}