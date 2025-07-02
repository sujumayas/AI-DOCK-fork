// AI Dock Chat Types
// TypeScript interfaces for real-time chat functionality
// This file contains ONLY chat-specific types

// =============================================================================
// CORE CHAT MESSAGE TYPES
// =============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
  
  // 📁 File attachment support
  attachments?: import('./file').FileAttachment[];
  hasFiles?: boolean;                    // Quick flag for messages with files
  fileCount?: number;                    // Number of attached files
  
  // 🤖 Assistant and project context support
  assistantId?: number;                  // Which assistant generated this message (for AI responses)
  assistantName?: string;                // Assistant name for display
  assistantIntroduction?: boolean;       // True if this is an assistant introduction message
  assistantChanged?: boolean;            // True if assistant changed before this message
  previousAssistantName?: string;        // Name of previous assistant (for change dividers)
  
  // 🗂️ NEW: Project context support
  projectId?: number;                    // Project context for this message
  projectName?: string;                  // Project name for display
  projectChanged?: boolean;              // True if project changed before this message
  previousProjectName?: string;          // Name of previous project (for change dividers)
}

export interface ChatRequest {
  config_id: number;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  
  // 📁 NEW: File attachment support (matches backend schema)
  file_attachment_ids?: number[];        // List of uploaded file IDs to include as context
  
  // 🤖 Assistant and project integration
  assistant_id?: number;                 // Custom assistant ID for system prompt injection
  project_id?: number;                   // Project context ID for system prompt injection
  
  // 🔄 Conversation tracking support
  conversation_id?: number;              // Existing conversation ID to save messages to
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  cost?: number;
  response_time_ms?: number;
  timestamp: string;
  
  // Model validation information (for dynamic models)
  model_requested?: string;
  model_changed?: boolean;
  model_change_reason?: string;
}

// =============================================================================
// LLM CONFIGURATION TYPES
// =============================================================================

export interface LLMConfigurationSummary {
  id: number;
  name: string;
  provider: string;
  provider_name: string;
  default_model: string;
  is_active: boolean;
  is_public: boolean;
  priority: number;
  estimated_cost_per_request?: number;
}

// =============================================================================
// DYNAMIC MODELS (OpenAI API Integration)
// =============================================================================

export interface DynamicModelsResponse {
  models: string[];
  default_model: string;
  provider: string;
  cached: boolean;
  fetched_at: string;
  cache_expires_at?: string;
  config_id: number;
  config_name: string;
  
  // Metadata fields
  total_models_available?: number;
  filtered_models_count?: number;
  filtering_applied?: boolean;
  chat_models_available?: number;
  error?: string;
  fallback?: boolean;
  note?: string;
  
  // Model filtering metadata
  filter_metadata?: {
    total_raw_models: number;
    total_filtered_models: number;
    filter_level: string;
    models_by_category?: Record<string, number>;
    filtered_out_count: number;
    filtering_applied: boolean;
  };
}

// =============================================================================
// UNIFIED MODELS (All Providers Combined)
// =============================================================================

export interface UnifiedModelInfo {
  id: string;
  display_name: string;
  provider: string;
  config_id: number;
  config_name: string;
  is_default: boolean;
  cost_tier: 'low' | 'medium' | 'high';
  capabilities: string[];
  is_recommended: boolean;
  relevance_score?: number;
}

export interface UnifiedModelsResponse {
  models: UnifiedModelInfo[];
  total_models: number;
  total_configs: number;
  default_model_id?: string;
  default_config_id?: number;
  cached: boolean;
  providers: string[];
  filtering_applied: boolean;
  original_total_models?: number;
}

export interface ProcessedModelsData {
  models: ModelInfo[];
  defaultModel: string;
  provider: string;
  cached: boolean;
  fetchedAt: Date;
  expiresAt?: Date;
  configId: number;
  configName: string;
  hasError: boolean;
  errorMessage?: string;
  isFallback: boolean;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  description?: string;
  costTier?: 'low' | 'medium' | 'high';
  capabilities?: string[];
  isRecommended?: boolean;
  isDefault?: boolean;
}

// =============================================================================
// TESTING AND COST ESTIMATION
// =============================================================================

export interface ConfigTestRequest {
  config_id: number;
}

export interface ConfigTestResponse {
  success: boolean;
  message: string;
  response_time_ms?: number;
  model?: string;
  cost?: number;
  error_type?: string;
}

export interface CostEstimateRequest {
  config_id: number;
  messages: ChatMessage[];
  model?: string;
  max_tokens?: number;
}

export interface CostEstimateResponse {
  estimated_cost?: number;
  has_cost_tracking: boolean;
  message: string;
}

// =============================================================================
// STREAMING CHAT (Server-Sent Events)
// =============================================================================

export interface StreamingChatRequest extends ChatRequest {
  // 📁 File attachments are inherited from ChatRequest
  // file_attachment_ids?: number[]; (inherited)
  
  // 🤖 Assistant integration is inherited from ChatRequest
  // assistant_id?: number; (inherited)
  
  stream_timeout?: number;  // Optional timeout for streaming connection
  stream_delay_ms?: number; // Optional delay between chunks for testing
  include_usage_in_stream?: boolean; // Include token usage in streaming chunks
}

export interface StreamingChatChunk {
  content: string;           // Partial content in this chunk
  chunk_id?: number;         // Sequential chunk identifier
  is_final?: boolean;        // True if this is the last chunk
  
  // Metadata (usually only in final chunk)
  model?: string;
  provider?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  cost?: number;
  response_time_ms?: number;
  timestamp?: string;
}

export interface StreamingState {
  isStreaming: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  accumulatedContent: string;     // Built up from chunks
  receivedChunks: StreamingChatChunk[];
  error?: StreamingError;
  startTime?: Date;
  lastChunkTime?: Date;
}

export interface StreamingError {
  type: 'CONNECTION_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'QUOTA_EXCEEDED' | 'CONFIGURATION_ERROR' | 'SERVER_ERROR' | 'PARSE_ERROR';
  message: string;
  shouldFallback: boolean;      // Whether to fallback to regular chat
  retryable: boolean;          // Whether this error can be retried
}

export interface StreamingConnection {
  eventSource: EventSource | null;
  configId: number;
  requestId: string;           // Unique ID for this request
  conversationId?: number;     // Link streaming to conversation
  onChunk: (chunk: StreamingChatChunk) => void;
  onError: (error: StreamingError) => void;
  onComplete: (finalResponse: ChatResponse) => void;
  close: () => void;
  
  // Conversation integration for streaming
  autoSave?: boolean;          // Whether to auto-save this conversation
  messageIndex?: number;       // Position in conversation
}

// =============================================================================
// CHAT UI STATE TYPES
// =============================================================================

export interface ChatUIState {
  // Current conversation state
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
  
  // Configuration state
  selectedConfigId?: number;
  selectedModel?: string;
  availableConfigs: LLMConfigurationSummary[];
  
  // Model selection state
  availableModels: ModelInfo[];
  isLoadingModels: boolean;
  modelError?: string;
  
  // Streaming state
  streaming: StreamingState;
  
  // UI preferences
  sidebarOpen: boolean;
  showModelSelector: boolean;
  autoSaveEnabled: boolean;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export interface ChatNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;              // Auto-dismiss after milliseconds
  actions?: {
    label: string;
    action: () => void;
  }[];
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorType?: string
  ) {
    super(message);
    this.name = 'ChatServiceError';
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if a chat session has unsaved changes
 */
export function hasUnsavedChanges(messages: ChatMessage[]): boolean {
  // Logic to determine if messages need saving
  return messages.length > 0 && messages.some(msg => msg.role === 'assistant');
}

/**
 * Check if streaming is supported for a configuration
 */
export function supportsStreaming(config: LLMConfigurationSummary): boolean {
  // Currently, streaming is supported for OpenAI and Anthropic
  return ['openai', 'anthropic'].includes(config.provider.toLowerCase());
}

/**
 * Check if a model supports certain capabilities
 */
export function modelSupportsCapability(model: ModelInfo, capability: string): boolean {
  return model.capabilities?.includes(capability) ?? false;
}

/**
 * 📁 NEW: Check if a chat message has file attachments
 */
export function messageHasFiles(message: ChatMessage): boolean {
  return !!(message.attachments && message.attachments.length > 0);
}

/**
 * 📁 NEW: Get total file count for a message
 */
export function getMessageFileCount(message: ChatMessage): number {
  return message.attachments?.length ?? 0;
}

/**
 * 📁 NEW: Check if any message in a conversation has files
 */
export function conversationHasFiles(messages: ChatMessage[]): boolean {
  return messages.some(msg => messageHasFiles(msg));
}

/**
 * 📁 NEW: Get total file count across all messages
 */
export function getTotalFileCount(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => total + getMessageFileCount(msg), 0);
}

/**
 * 📁 NEW: Create a chat message with file attachments
 */
export function createChatMessageWithFiles(
  role: ChatMessageRole,
  content: string,
  attachments?: import('./file').FileAttachment[]
): ChatMessage {
  const message: ChatMessage = {
    role,
    content
  };
  
  if (attachments && attachments.length > 0) {
    message.attachments = attachments;
    message.hasFiles = true;
    message.fileCount = attachments.length;
  }
  
  return message;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatProvider = 'openai' | 'anthropic' | 'azure-openai' | 'google' | 'mistral';
export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error' | 'complete';

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_CHAT_MESSAGES = 100;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 2000;
export const STREAMING_TIMEOUT = 30000; // 30 seconds
export const MODEL_CACHE_DURATION = 3600000; // 1 hour in milliseconds
