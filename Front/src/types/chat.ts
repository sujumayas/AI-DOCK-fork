// AI Dock Chat Types
// These match our backend API schemas for type safety

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

export interface ChatRequest {
  config_id: number;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
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
}

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

// Frontend-specific types for chat UI
export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  config_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface ChatUIState {
  conversations: ChatConversation[];
  activeConversationId?: string;
  isLoading: boolean;
  error?: string;
  selectedConfigId?: number;
}

// Chat service error types
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
