// AI Dock Conversation Types
// TypeScript interfaces for conversation save/load functionality
// This file contains ONLY conversation-specific types

import { ChatMessage } from './chat';

// =============================================================================
// CORE CONVERSATION TYPES
// =============================================================================

export interface Conversation {
  id: number;
  title: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  message_count: number;
  llm_config_id?: number;
  model_used?: string;
  project_id?: number; // Add project/folder assignment support
}

export interface ConversationMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  model_used?: string;
  tokens_used?: number;
  cost?: string;
  response_time_ms?: number;
  metadata?: Record<string, any>;
}

// =============================================================================
// CONVERSATION VARIANTS
// =============================================================================

export interface ConversationSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_at?: string;
  model_used?: string;
  project_id?: number; // Add project/folder assignment support
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
  project?: {
    id: number;
    name: string;
    color?: string;
    icon?: string;
  }; // Full project information from backend
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface ConversationCreate {
  title: string;
  llm_config_id?: number;
  model_used?: string;
  project_id?: number; // Add project/folder assignment support
}

export interface ConversationUpdate {
  title?: string;
}

export interface ConversationMessageCreate {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_used?: string;
  tokens_used?: number;
  cost?: string;
  response_time_ms?: number;
  metadata?: Record<string, any>;
}

export interface ConversationSaveFromMessages {
  title?: string;
  messages: ConversationMessageCreate[];
  llm_config_id?: number;
  model_used?: string;
  project_id?: number;  // Add project/folder assignment support
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ConversationStatsResponse {
  total_conversations: number;
  total_messages: number;
}

export interface ConversationOperationResponse {
  success: boolean;
  message: string;
  conversation_id?: number;
}

// =============================================================================
// API REQUEST TYPES
// =============================================================================

export interface ConversationListRequest {
  limit?: number;
  offset?: number;
}

export interface ConversationSearchRequest {
  query: string;
  limit?: number;
}

// =============================================================================
// FRONTEND UI STATE TYPES
// =============================================================================

export interface ConversationUIState {
  conversations: ConversationSummary[];
  currentConversation?: ConversationDetail;
  isLoading: boolean;
  isLoadingConversations: boolean;
  isSaving: boolean;
  error?: string;
  
  // Pagination state
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  
  // Search state
  searchQuery: string;
  searchResults: ConversationSummary[];
  isSearching: boolean;
}

export interface ConversationSidebarState {
  isOpen: boolean;
  selectedConversationId?: number;
  showSearchBox: boolean;
}

// =============================================================================
// AUTO-SAVE CONFIGURATION
// =============================================================================

export interface AutoSaveConfig {
  enabled: boolean;
  triggerAfterMessages: number; // Save after X user messages (default: 1, ignores system messages)
  maxConversationsToKeep: number; // Cleanup old conversations
}

// =============================================================================
// INTEGRATION WITH CHAT SYSTEM
// =============================================================================

export interface ChatToConversationMapper {
  /**
   * Convert ChatMessage array to ConversationMessageCreate array
   */
  chatMessagesToConversationMessages(messages: ChatMessage[]): ConversationMessageCreate[];
  
  /**
   * Convert ConversationMessage array to ChatMessage array  
   */
  conversationMessagesToChatMessages(messages: ConversationMessage[]): ChatMessage[];
  
  /**
   * Extract conversation title from chat messages
   */
  generateTitleFromMessages(messages: ChatMessage[]): string;
}

// =============================================================================
// FILTER AND SEARCH TYPES
// =============================================================================

export interface ConversationFilterOptions {
  searchQuery?: string;
  modelFilter?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy: 'updated_at' | 'created_at' | 'title' | 'message_count';
  sortOrder: 'asc' | 'desc';
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class ConversationServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public conversationId?: number
  ) {
    super(message);
    this.name = 'ConversationServiceError';
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert ChatMessage to ConversationMessageCreate
 */
export function chatMessageToConversationMessage(
  chatMessage: ChatMessage,
  metadata: {
    model_used?: string;
    tokens_used?: number;
    cost?: string;
    response_time_ms?: number;
  } = {}
): ConversationMessageCreate {
  return {
    role: chatMessage.role,
    content: chatMessage.content,
    model_used: metadata.model_used,
    tokens_used: metadata.tokens_used,
    cost: metadata.cost,
    response_time_ms: metadata.response_time_ms,
    metadata: {} // 🔧 FIX: Always include metadata field as empty object
  };
}

/**
 * Convert ConversationMessage to ChatMessage
 */
export function conversationMessageToChatMessage(
  conversationMessage: ConversationMessage
): ChatMessage {
  return {
    role: conversationMessage.role,
    content: conversationMessage.content,
    name: undefined // ConversationMessage doesn't have name field
  };
}

/**
 * Convert array of ConversationMessages to ChatMessages
 */
export function conversationMessagesToChatMessages(
  conversationMessages: ConversationMessage[]
): ChatMessage[] {
  return conversationMessages.map(conversationMessageToChatMessage);
}

/**
 * Convert array of ChatMessages to ConversationMessageCreate
 */
export function chatMessagesToConversationMessages(
  chatMessages: ChatMessage[],
  metadata: {
    model_used?: string;
    tokens_used?: number;
    cost?: string;
    response_time_ms?: number;
  } = {}
): ConversationMessageCreate[] {
  return chatMessages.map(msg => chatMessageToConversationMessage(msg, metadata));
}

/**
 * Generate conversation title from first user message
 */
export function generateTitleFromMessages(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  
  if (firstUserMessage?.content) {
    let title = firstUserMessage.content.trim();
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    return title;
  }
  
  return `Conversation ${new Date().toLocaleDateString()}`;
}

/**
 * Check if auto-save should trigger - only save after actual user messages
 */
export function shouldAutoSave(
  messages: ChatMessage[], 
  triggerAfterMessages: number = 1
): boolean {
  // Count only user messages, not system messages (like project introductions)
  const userMessages = messages.filter(msg => msg.role === 'user');
  return userMessages.length >= triggerAfterMessages;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  enabled: true,
  triggerAfterMessages: 1, // Save immediately after first user message (ignores system messages)
  maxConversationsToKeep: 100
};

export const DEFAULT_CONVERSATION_LIST_LIMIT = 50;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_CONVERSATION_TITLE_LENGTH = 255;
export const MAX_BULK_DELETE_COUNT = 50;
