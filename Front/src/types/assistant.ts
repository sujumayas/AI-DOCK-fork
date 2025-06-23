// AI Dock Assistant Types
// TypeScript interfaces for Custom Assistants feature
// This file contains ONLY assistant-specific types matching backend schemas

import { ChatMessage } from './chat';
import { ConversationSummary } from './conversation';

// =============================================================================
// CORE ASSISTANT TYPES (MATCHING BACKEND SCHEMAS)
// =============================================================================

/**
 * Core Assistant interface matching backend AssistantResponse schema
 * 
 * 🎓 LEARNING: Interface Design
 * =============================
 * Interfaces define the "contract" or "shape" of data objects.
 * They ensure type safety and provide autocompletion in IDEs.
 * These interfaces match the backend Pydantic schemas exactly.
 */
export interface Assistant {
  id: number;
  name: string;
  description?: string;
  system_prompt: string;
  system_prompt_preview: string;
  model_preferences: Record<string, any>;
  user_id: number;
  is_active: boolean;
  conversation_count: number;
  
  // Timestamps as ISO strings (from backend JSON serialization)
  created_at: string;
  updated_at: string;
  
  // Computed properties for UI
  is_new: boolean;
  status_label: string;
  has_custom_preferences: boolean;
}

/**
 * Lightweight assistant summary for lists and dropdowns
 * Matches backend AssistantSummary schema
 */
export interface AssistantSummary {
  id: number;
  name: string;
  description?: string;
  system_prompt_preview: string;
  is_active: boolean;
  conversation_count: number;
  created_at: string;
  is_new: boolean;
}

// =============================================================================
// REQUEST/RESPONSE TYPES FOR API OPERATIONS
// =============================================================================

/**
 * Data required to create a new assistant
 * Matches backend AssistantCreate schema
 */
export interface AssistantCreate {
  name: string;
  description?: string;
  system_prompt: string;
  model_preferences?: Record<string, any>;
}

/**
 * Data for updating an existing assistant
 * Matches backend AssistantUpdate schema - all fields optional for partial updates
 */
export interface AssistantUpdate {
  name?: string;
  description?: string;
  system_prompt?: string;
  model_preferences?: Record<string, any>;
  is_active?: boolean;
}

/**
 * Request parameters for listing assistants with pagination and filtering
 * Matches backend AssistantListRequest schema
 */
export interface AssistantListRequest {
  limit?: number;
  offset?: number;
  search?: string;
  status_filter?: 'active' | 'inactive' | 'draft';
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'conversation_count';
  sort_order?: 'asc' | 'desc';
  include_inactive?: boolean;
}

/**
 * Response from assistant list API with pagination info
 * Matches backend AssistantListResponse schema
 */
export interface AssistantListResponse {
  assistants: AssistantSummary[];
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  filters_applied: Record<string, any>;
}

/**
 * Standard response for assistant operations (create, update, delete)
 * Matches backend AssistantOperationResponse schema
 */
export interface AssistantOperationResponse {
  success: boolean;
  message: string;
  assistant_id?: number;
  assistant?: Assistant;
}

/**
 * Statistics and analytics for assistants
 * Matches backend AssistantStatsResponse schema
 */
export interface AssistantStatsResponse {
  total_assistants: number;
  active_assistants: number;
  total_conversations: number;
  most_used_assistant?: {
    id: number;
    name: string;
    conversation_count: number;
  };
  recent_activity: Array<{
    type: string;
    assistant_name: string;
    timestamp: string;
  }>;
}

// =============================================================================
// CONVERSATION INTEGRATION TYPES
// =============================================================================

/**
 * Data for creating a conversation with a specific assistant
 * Matches backend AssistantConversationCreate schema
 */
export interface AssistantConversationCreate {
  assistant_id: number;
  title?: string;
  first_message?: string;
}

/**
 * Conversation response with assistant information
 * Matches backend AssistantConversationResponse schema
 */
export interface AssistantConversationResponse {
  id: number;
  title: string;
  user_id: number;
  
  // Assistant information
  assistant_id?: number;
  assistant_name?: string;
  assistant_description?: string;
  
  // Conversation metadata
  message_count: number;
  last_message_at?: string;
  is_active: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/**
 * Comprehensive error response for assistant operations
 * Matches backend AssistantErrorResponse schema
 */
export interface AssistantErrorResponse {
  error_type: string;
  message: string;
  details?: Record<string, any>;
  assistant_id?: number;
  field_errors?: Record<string, string[]>;
  suggestions?: string[];
}

/**
 * Specific error for permission issues
 * Matches backend AssistantPermissionError schema
 */
export interface AssistantPermissionError {
  error_type: 'permission_denied';
  message: string;
  assistant_id: number;
  required_permission: string;
}

/**
 * Custom error class for assistant service operations
 * 
 * 🎓 LEARNING: Custom Error Classes
 * =================================
 * Custom errors provide:
 * - Specific error types for different failure modes
 * - Additional context (assistant ID, error codes)
 * - Better error handling and user feedback
 * - Type safety in catch blocks
 */
export class AssistantServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public assistantId?: number,
    public errorType?: string,
    public fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AssistantServiceError';
  }
}

// =============================================================================
// BULK OPERATIONS TYPES
// =============================================================================

/**
 * Request for bulk operations on multiple assistants
 * Matches backend AssistantBulkAction schema
 */
export interface AssistantBulkAction {
  assistant_ids: number[];
  action: 'activate' | 'deactivate' | 'delete';
}

/**
 * Response from bulk operations
 * Matches backend AssistantBulkResponse schema
 */
export interface AssistantBulkResponse {
  success: boolean;
  message: string;
  total_requested: number;
  successful_count: number;
  failed_count: number;
  failed_assistants?: Array<{
    id: number;
    error: string;
  }>;
}

// =============================================================================
// FRONTEND UI STATE TYPES
// =============================================================================

/**
 * Frontend state for managing assistants in the UI
 * 
 * 🎓 LEARNING: Frontend State Management
 * =====================================
 * These types help manage UI state consistently:
 * - Loading states for better UX
 * - Error handling for user feedback
 * - Selection state for bulk operations
 * - Filter state for search/pagination
 */
export interface AssistantUIState {
  assistants: AssistantSummary[];
  currentAssistant?: Assistant;
  isLoading: boolean;
  isLoadingList: boolean;
  isSaving: boolean;
  error?: string;
  
  // List management
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  
  // Filter state
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  sortBy: 'name' | 'created_at' | 'updated_at' | 'conversation_count';
  sortOrder: 'asc' | 'desc';
  
  // Selection state for bulk operations
  selectedAssistantIds: number[];
  isSelectMode: boolean;
}

/**
 * State for assistant creation/editing modals
 */
export interface AssistantModalState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  assistant?: Assistant;
  isSubmitting: boolean;
  validationErrors?: Record<string, string[]>;
}

/**
 * State for assistant selection in chat interface
 */
export interface AssistantSelectionState {
  selectedAssistantId?: number;
  availableAssistants: AssistantSummary[];
  isLoading: boolean;
  showSelector: boolean;
}

// =============================================================================
// VALIDATION AND FORM TYPES
// =============================================================================

/**
 * Form data for assistant creation/editing
 */
export interface AssistantFormData {
  name: string;
  description: string;
  system_prompt: string;
  model_preferences: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
}

/**
 * Validation rules and error messages
 */
export interface AssistantValidationRules {
  name: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  description: {
    maxLength: number;
  };
  system_prompt: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  model_preferences: {
    temperature: {
      min: number;
      max: number;
    };
    max_tokens: {
      min: number;
      max: number;
    };
  };
}

// =============================================================================
// CHAT INTEGRATION TYPES
// =============================================================================

/**
 * Assistant context for chat interface
 * Combines assistant info with chat-specific data
 */
export interface AssistantChatContext {
  assistant: Assistant;
  system_prompt: string;
  model_preferences: Record<string, any>;
  conversation_id?: number;
  conversation_title?: string;
}

/**
 * Message with assistant context
 * Extends ChatMessage with assistant-specific metadata
 */
export interface AssistantChatMessage extends ChatMessage {
  assistant_id?: number;
  assistant_name?: string;
  model_used?: string;
  tokens_used?: number;
  response_time_ms?: number;
}

// =============================================================================
// CONSTANTS AND DEFAULTS
// =============================================================================

/**
 * Default assistant configuration values
 */
export const DEFAULT_ASSISTANT_CONFIG = {
  model_preferences: {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0
  }
} as const;

/**
 * Validation constants matching backend
 */
export const ASSISTANT_VALIDATION = {
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100
  },
  DESCRIPTION: {
    MAX_LENGTH: 500
  },
  SYSTEM_PROMPT: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 8000
  },
  MAX_ASSISTANTS_PER_USER: 50
} as const;

/**
 * API defaults for pagination
 */
export const ASSISTANT_API_DEFAULTS = {
  LIST_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_SORT_BY: 'updated_at',
  DEFAULT_SORT_ORDER: 'desc'
} as const;

// =============================================================================
// UTILITY TYPE FUNCTIONS
// =============================================================================

/**
 * Type guard to check if an object is an Assistant
 */

export function isAssistant(obj: any): obj is Assistant {
  return (
    obj &&
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.system_prompt === 'string' &&
    typeof obj.user_id === 'number' &&
    typeof obj.is_active === 'boolean'
  );
}

/**
 * Type guard to check if an object is an AssistantSummary
 */
export function isAssistantSummary(obj: any): obj is AssistantSummary {
  return (
    obj &&
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.system_prompt_preview === 'string' &&
    typeof obj.is_active === 'boolean'
  );
}

/**
 * Helper to convert Assistant to AssistantSummary
 */
export function assistantToSummary(assistant: Assistant): AssistantSummary {
  return {
    id: assistant.id,
    name: assistant.name,
    description: assistant.description,
    system_prompt_preview: assistant.system_prompt_preview,
    is_active: assistant.is_active,
    conversation_count: assistant.conversation_count,
    created_at: assistant.created_at,
    is_new: assistant.is_new
  };
}

/**
 * Helper to create default form data for new assistant
 */
export function createDefaultAssistantFormData(): AssistantFormData {
  return {
    name: '',
    description: '',
    system_prompt: '',
    model_preferences: { ...DEFAULT_ASSISTANT_CONFIG.model_preferences }
  };
}

/**
 * Helper to validate assistant form data
 */
export function validateAssistantFormData(data: AssistantFormData): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  
  // Validate name
  if (!data.name.trim()) {
    errors.name = ['Name is required'];
  } else if (data.name.length < ASSISTANT_VALIDATION.NAME.MIN_LENGTH) {
    errors.name = [`Name must be at least ${ASSISTANT_VALIDATION.NAME.MIN_LENGTH} characters`];
  } else if (data.name.length > ASSISTANT_VALIDATION.NAME.MAX_LENGTH) {
    errors.name = [`Name cannot exceed ${ASSISTANT_VALIDATION.NAME.MAX_LENGTH} characters`];
  }
  
  // Validate description
  if (data.description && data.description.length > ASSISTANT_VALIDATION.DESCRIPTION.MAX_LENGTH) {
    errors.description = [`Description cannot exceed ${ASSISTANT_VALIDATION.DESCRIPTION.MAX_LENGTH} characters`];
  }
  
  // Validate system prompt
  if (!data.system_prompt.trim()) {
    errors.system_prompt = ['System prompt is required'];
  } else if (data.system_prompt.length < ASSISTANT_VALIDATION.SYSTEM_PROMPT.MIN_LENGTH) {
    errors.system_prompt = [`System prompt must be at least ${ASSISTANT_VALIDATION.SYSTEM_PROMPT.MIN_LENGTH} characters`];
  } else if (data.system_prompt.length > ASSISTANT_VALIDATION.SYSTEM_PROMPT.MAX_LENGTH) {
    errors.system_prompt = [`System prompt cannot exceed ${ASSISTANT_VALIDATION.SYSTEM_PROMPT.MAX_LENGTH} characters`];
  }
  
  // Validate model preferences
  if (data.model_preferences.temperature !== undefined) {
    const temp = data.model_preferences.temperature;
    if (typeof temp !== 'number' || temp < 0 || temp > 2) {
      errors.temperature = ['Temperature must be between 0 and 2'];
    }
  }
  
  if (data.model_preferences.max_tokens !== undefined) {
    const tokens = data.model_preferences.max_tokens;
    if (typeof tokens !== 'number' || tokens <= 0 || tokens > 32000) {
      errors.max_tokens = ['Max tokens must be between 1 and 32,000'];
    }
  }
  
  return errors;
}

/**
 * Helper to check if form data has validation errors
 */
export function hasValidationErrors(errors: Record<string, string[]>): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Helper to format assistant status for display
 */
export function formatAssistantStatus(assistant: Assistant | AssistantSummary): string {
  if (!assistant.is_active) {
    return 'Inactive';
  }
  
  if ('is_new' in assistant && assistant.is_new) {
    return 'New';
  }
  
  return 'Active';
}

/**
 * Helper to format conversation count for display
 */
export function formatConversationCount(count: number): string {
  if (count === 0) {
    return 'No conversations';
  } else if (count === 1) {
    return '1 conversation';
  } else {
    return `${count} conversations`;
  }
}

/**
 * Helper to generate system prompt preview
 */
export function generateSystemPromptPreview(prompt: string, maxLength: number = 150): string {
  if (!prompt) {
    return 'No system prompt defined';
  }
  
  if (prompt.length <= maxLength) {
    return prompt;
  }
  
  return prompt.substring(0, maxLength - 3) + '...';
}

// =============================================================================
// EXPORT STATEMENT
// =============================================================================

// Export all types and utilities for use in other modules