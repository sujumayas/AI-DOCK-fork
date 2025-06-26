// 💬 Enhanced Chat Service with Smart Model Filtering
// This service handles all communication with our FastAPI chat endpoints
// It manages LLM interactions, configurations, and intelligent model filtering

import { 
  ChatRequest, 
  ChatResponse, 
  LLMConfigurationSummary, 
  ConfigTestRequest, 
  ConfigTestResponse,
  CostEstimateRequest,
  CostEstimateResponse,
  ChatServiceError,
  DynamicModelsResponse, // NEW
  ProcessedModelsData,   // NEW
  ModelInfo,             // NEW
  // 🌊 STREAMING IMPORTS: For real-time chat responses
  StreamingChatRequest,
  StreamingChatChunk,
  StreamingState,
  StreamingError,
  StreamingConnection
} from '../types/chat';
import { authService } from './authService';

// 🆕 UNIFIED MODELS TYPES: New single model list approach
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

// Configuration - using same base URL as auth service
const API_BASE_URL = 'http://localhost:8000';

/**
 * Enhanced processed models data with smart filtering capabilities
 * 🎓 Concept: Extending existing interfaces with smart features
 */
export interface SmartProcessedModelsData extends ProcessedModelsData {
  smartModels: ModelInfo[];           // Enhanced model info with smart filtering
  filteredCount: number;                   // How many models after filtering
  originalCount: number;                   // Total models from API
  recommendedCategories: {                 // Categorized recommendations
    flagship: ModelInfo[];
    efficient: ModelInfo[];
    specialized: ModelInfo[];
  };
  filterConfig: any;         // Configuration used for filtering
  debugInfo?: {                           // Optional debug information
    summary: any;
    excluded: string[];
    topModels: any[];
  };
}

class ChatService {
  
  // 💬 SEND CHAT MESSAGE: Main function to chat with LLMs
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
        throw new ChatServiceError(
          errorMessage, 
          response.status,
          this.getErrorType(response.status)
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
      console.error('❌ Chat service error:', error);
      
      if (error instanceof ChatServiceError) {
        throw error; // Re-throw our custom errors
      }
      
      // 🔍 DEBUG: Log more details about the error
      console.error('❌ Full error details:', {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        errorName: error instanceof Error ? error.name : 'Unknown'
      });
      
      // Convert network/unknown errors to ChatServiceError
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred while processing your chat message';
        
      throw new ChatServiceError(
        errorMessage,
        undefined,
        'NETWORK_ERROR'
      );
    }
  }

  // 🌊 STREAMING CHAT MESSAGE: Send message with real-time streaming response
  // 🎓 Learning: EventSource API for Server-Sent Events (SSE)
  async streamMessage(
    request: StreamingChatRequest,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void
  ): Promise<StreamingConnection> {
    try {
      console.log('🌊 Starting streaming chat message:', { 
        config_id: request.config_id, 
        messageCount: request.messages.length,
        url: `${API_BASE_URL}/chat/stream`
      });

      // Generate unique request ID for tracking
      const requestId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create streaming connection
      const connection = await this.createStreamingConnection(
        request,
        requestId,
        onChunk,
        onError,
        onComplete
      );

      return connection;
      
    } catch (error) {
      console.error('❌ Streaming setup error:', error);
      
      // Convert to structured streaming error
      const streamingError: StreamingError = {
        type: 'CONNECTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to start streaming',
        shouldFallback: true,  // Always allow fallback for connection errors
        retryable: false       // Setup errors are usually not retryable
      };
      
      onError(streamingError);
      
      // Return a dummy connection for cleanup
      return {
        eventSource: null,
        configId: request.config_id,
        requestId: 'failed',
        onChunk,
        onError,
        onComplete,
        close: () => {}
      };
    }
  }

  // 🔌 CREATE STREAMING CONNECTION: Set up EventSource for SSE
  // 🎓 Learning: EventSource automatically handles reconnection and parsing
  private async createStreamingConnection(
    request: StreamingChatRequest,
    requestId: string,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void
  ): Promise<StreamingConnection> {
    
    // 🔑 Build streaming URL with all request data as query parameters
    const streamUrl = new URL(`${API_BASE_URL}/chat/stream`);
    
    // 🔐 Get auth token (EventSource can't send custom headers)
    const authHeaders = authService.getAuthHeaders() as Record<string, string>;
    const authToken = authHeaders['Authorization']?.replace('Bearer ', '');
    
    if (!authToken) {
      throw new Error('No authentication token available for streaming');
    }
    
    // 📝 Set all required query parameters
    streamUrl.searchParams.set('request_id', requestId);
    streamUrl.searchParams.set('config_id', request.config_id.toString());
    streamUrl.searchParams.set('messages', JSON.stringify(request.messages));
    streamUrl.searchParams.set('token', authToken);
    
    // 🎛️ Optional parameters
    if (request.model) {
      streamUrl.searchParams.set('model', request.model);
    }
    if (request.temperature !== undefined) {
      streamUrl.searchParams.set('temperature', request.temperature.toString());
    }
    if (request.max_tokens !== undefined) {
      streamUrl.searchParams.set('max_tokens', request.max_tokens.toString());
    }
    if (request.stream_delay_ms !== undefined) {
      streamUrl.searchParams.set('stream_delay_ms', request.stream_delay_ms.toString());
    }
    if (request.include_usage_in_stream !== undefined) {
      streamUrl.searchParams.set('include_usage_in_stream', request.include_usage_in_stream.toString());
    }
    
    // 📁 FIXED: Include file attachment IDs for file upload support
    if (request.file_attachment_ids && request.file_attachment_ids.length > 0) {
      streamUrl.searchParams.set('file_attachment_ids', JSON.stringify(request.file_attachment_ids));
      console.log('📁 Including file attachments in stream:', request.file_attachment_ids);
    }
    
    console.log('🌊 Creating EventSource connection to:', streamUrl.toString().replace(authToken, 'TOKEN_HIDDEN'));
    
    // 📡 Set up EventSource for the stream
    let eventSource: EventSource | null = null;
    let accumulatedContent = '';
    let receivedChunks: StreamingChatChunk[] = [];
    
    try {
      // 🚀 Create EventSource connection with all data in URL
      eventSource = new EventSource(streamUrl.toString());
      
      // 📡 Handle incoming streaming chunks
      eventSource.onmessage = (event) => {
        try {
          // Handle completion and error markers
          if (event.data === '[DONE]') {
            console.log('✅ Streaming complete marker received');
            return; // Final response will be sent via last chunk
          }
          
          if (event.data === '[ERROR]') {
            console.error('❌ Streaming error marker received');
            const streamingError: StreamingError = {
              type: 'SERVER_ERROR',
              message: 'Server reported streaming error',
              shouldFallback: true,
              retryable: false
            };
            eventSource?.close();
            onError(streamingError);
            return;
          }
          
          const chunk = this.parseStreamingChunk(event.data);
          
          console.log('📡 Received streaming chunk:', {
            chunkId: chunk.chunk_id,
            contentLength: chunk.content.length,
            isFinal: chunk.is_final
          });
          
          // Accumulate content
          accumulatedContent += chunk.content;
          receivedChunks.push(chunk);
          
          // Call chunk handler
          onChunk(chunk);
          
          // Check if this is the final chunk
          if (chunk.is_final) {
            console.log('✅ Final chunk received, building complete response');
            
            // Build final ChatResponse from accumulated data
            const finalResponse: ChatResponse = {
              content: accumulatedContent,
              model: chunk.model || 'unknown',
              provider: chunk.provider || 'unknown',
              usage: chunk.usage || {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0
              },
              cost: chunk.cost,
              response_time_ms: chunk.response_time_ms,
              timestamp: chunk.timestamp || new Date().toISOString()
            };
            
            // Close connection and notify completion
            eventSource?.close();
            onComplete(finalResponse);
          }
          
        } catch (parseError) {
          console.error('❌ Error parsing streaming chunk:', parseError);
          
          // 🚨 ENHANCED: Better error categorization based on error type
          let streamingError: StreamingError;
          
          if (parseError instanceof Error && parseError.message.includes('Backend error:')) {
            // This is a backend error (like quota exceeded)
            const errorMessage = parseError.message.replace('Backend error: ', '');
            
            streamingError = {
              type: errorMessage.toLowerCase().includes('quota') ? 'QUOTA_EXCEEDED' : 'SERVER_ERROR',
              message: errorMessage,
              shouldFallback: false, // Don't fallback for quota errors
              retryable: false
            };
          } else {
            // This is a parsing error
            streamingError = {
              type: 'PARSE_ERROR',
              message: 'Failed to parse streaming response',
              shouldFallback: true,
              retryable: false
            };
          }
          
          // 📧 ENHANCED: Always ensure connection is closed on error
          eventSource?.close();
          onError(streamingError);
        }
      };
      
      // 🚨 Handle connection errors
      eventSource.onerror = (error) => {
        console.error('❌ EventSource error:', error);
        
        const streamingError: StreamingError = {
          type: 'CONNECTION_ERROR',
          message: 'Streaming connection failed',
          shouldFallback: true,
          retryable: true
        };
        
        eventSource?.close();
        onError(streamingError);
      };
      
      // 🔌 Handle connection open
      eventSource.onopen = () => {
        console.log('🔌 SSE connection established successfully');
      };
      
    } catch (eventSourceError) {
      console.error('❌ Failed to create EventSource:', eventSourceError);
      throw eventSourceError;
    }
    
    // Return connection interface
    const connection: StreamingConnection = {
      eventSource,
      configId: request.config_id,
      requestId,
      onChunk,
      onError,
      onComplete,
      close: () => {
        console.log('🔌 Closing streaming connection:', requestId);
        eventSource?.close();
      }
    };
    
    return connection;
  }

  // 🔧 PARSE STREAMING CHUNK: Convert SSE data to structured chunk with error handling
  // 🎓 Learning: SSE sends data as strings, we need to parse JSON and handle both content and error responses
  private parseStreamingChunk(data: string): StreamingChatChunk {
    try {
      // SSE data format is typically JSON
      const parsed = JSON.parse(data);
      
      // 🚨 ENHANCED: Check for error responses first
      if (parsed.error === true || parsed.error_type || parsed.error_message) {
        console.error('❌ Streaming error received from backend:', {
          errorType: parsed.error_type,
          errorMessage: parsed.error_message,
          chunkIndex: parsed.chunk_index
        });
        
        // Throw a specific error that will be handled by the error handler
        throw new Error(`Backend error: ${parsed.error_type}: ${parsed.error_message}`);
      }
      
      // 🔍 ENHANCED: Better validation for content chunks
      if (typeof parsed.content !== 'string' && parsed.content !== null && parsed.content !== undefined) {
        console.warn('⚠️ Invalid content type in chunk:', typeof parsed.content, parsed);
        throw new Error('Invalid chunk: content field must be string, null, or undefined');
      }
      
      return {
        content: parsed.content || '',
        chunk_id: parsed.chunk_id,
        is_final: parsed.is_final === true,
        model: parsed.model,
        provider: parsed.provider,
        usage: parsed.usage,
        cost: parsed.cost,
        response_time_ms: parsed.response_time_ms,
        timestamp: parsed.timestamp
      };
      
    } catch (error) {
      console.error('❌ Failed to parse streaming chunk:', { data, error });
      
      // Re-throw parsing errors so they can be handled by the error handler
      throw error;
    }
  }

  // 🛡️ STREAMING FALLBACK: Automatically fall back to regular chat when streaming fails
  // 🎓 Learning: Graceful degradation - always provide a working experience
  async streamMessageWithFallback(
    request: StreamingChatRequest,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void,
    enableFallback: boolean = true
  ): Promise<StreamingConnection | ChatResponse> {
    
    try {
      // Attempt streaming first
      const connection = await this.streamMessage(request, onChunk, onError, (finalResponse) => {
        console.log('✅ Streaming completed successfully');
        onComplete(finalResponse);
      });
      
      return connection;
      
    } catch (streamingError) {
      console.log('⚠️ Streaming failed, checking fallback options:', { enableFallback, error: streamingError });
      
      if (!enableFallback) {
        throw streamingError;
      }
      
      // Fallback to regular chat
      console.log('🔄 Falling back to regular chat');
      
      try {
        const regularResponse = await this.sendMessage(request);
        
        console.log('✅ Fallback successful, simulating streaming');
        
        // Simulate streaming for consistent UX
        await this.simulateStreamingFromResponse(regularResponse, onChunk, onComplete);
        
        return regularResponse;
        
      } catch (fallbackError) {
        console.error('❌ Both streaming and fallback failed:', fallbackError);
        
        const streamingErrorObj: StreamingError = {
          type: 'SERVER_ERROR',
          message: 'Both streaming and regular chat failed',
          shouldFallback: false,
          retryable: true
        };
        
        onError(streamingErrorObj);
        throw fallbackError;
      }
    }
  }

  // 🎭 SIMULATE STREAMING: Convert regular response to streaming chunks for consistent UX
  // 🎓 Learning: Progressive disclosure - show content gradually even from instant responses
  private async simulateStreamingFromResponse(
    response: ChatResponse,
    onChunk: (chunk: StreamingChatChunk) => void,
    onComplete: (finalResponse: ChatResponse) => void
  ): Promise<void> {
    const content = response.content;
    const words = content.split(' ');
    const chunkSize = Math.max(1, Math.floor(words.length / 10)); // ~10 chunks
    
    console.log('🎭 Simulating streaming:', { 
      totalWords: words.length, 
      chunkSize,
      estimatedChunks: Math.ceil(words.length / chunkSize)
    });
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkContent = chunkWords.join(' ') + (i + chunkSize < words.length ? ' ' : '');
      const isLast = i + chunkSize >= words.length;
      
      const chunk: StreamingChatChunk = {
        content: chunkContent,
        chunk_id: Math.floor(i / chunkSize),
        is_final: isLast,
        ...(isLast && {
          model: response.model,
          provider: response.provider,
          usage: response.usage,
          cost: response.cost,
          response_time_ms: response.response_time_ms,
          timestamp: response.timestamp
        })
      };
      
      onChunk(chunk);
      
      // Small delay to simulate typing
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    onComplete(response);
  }

  // 🎛️ GET AVAILABLE CONFIGURATIONS: Fetch LLM providers user can access
  async getAvailableConfigurations(): Promise<LLMConfigurationSummary[]> {
    try {
      console.log('📋 Fetching available LLM configurations...');
      
      const response = await fetch(`${API_BASE_URL}/chat/configurations`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Failed to fetch configurations',
          response.status
        );
      }

      const configurations: LLMConfigurationSummary[] = await response.json();
      
      console.log('📋 Available configurations:', configurations.map(c => ({
        id: c.id,
        name: c.name,
        provider: c.provider
      })));
      
      return configurations;
      
    } catch (error) {
      console.error('❌ Error fetching configurations:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Failed to fetch configurations'
      );
    }
  }

  // 🧪 TEST CONFIGURATION: Check if an LLM provider is working
  async testConfiguration(configId: number): Promise<ConfigTestResponse> {
    try {
      console.log('🧪 Testing configuration:', configId);
      
      const request: ConfigTestRequest = { config_id: configId };
      
      const response = await fetch(`${API_BASE_URL}/chat/test-configuration`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Configuration test failed',
          response.status
        );
      }

      const testResult: ConfigTestResponse = await response.json();
      
      console.log('🧪 Test result:', testResult);
      
      return testResult;
      
    } catch (error) {
      console.error('❌ Configuration test error:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Configuration test failed'
      );
    }
  }

  // 💰 ESTIMATE COST: Get cost estimate before sending expensive requests
  async estimateCost(request: CostEstimateRequest): Promise<CostEstimateResponse> {
    try {
      console.log('💰 Estimating cost for:', { 
        config_id: request.config_id,
        messageCount: request.messages.length 
      });
      
      const response = await fetch(`${API_BASE_URL}/chat/estimate-cost`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Cost estimation failed',
          response.status
        );
      }

      const costEstimate: CostEstimateResponse = await response.json();
      
      console.log('💰 Cost estimate:', costEstimate);
      
      return costEstimate;
      
    } catch (error) {
      console.error('❌ Cost estimation error:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Cost estimation failed'
      );
    }
  }

  // 🎯 GET AVAILABLE MODELS: Get models for a specific configuration (legacy)
  async getAvailableModels(configId: number): Promise<string[]> {
    try {
      console.log('🎯 Fetching models for configuration:', configId);
      
      const response = await fetch(`${API_BASE_URL}/chat/models/${configId}`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Failed to fetch available models',
          response.status
        );
      }

      const models: string[] = await response.json();
      
      console.log('🎯 Available models:', models);
      
      return models;
      
    } catch (error) {
      console.error('❌ Error fetching models:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Failed to fetch models'
      );
    }
  }

  // 🆕 GET DYNAMIC MODELS: Get real-time models from provider API
  async getDynamicModels(
    configId: number, 
    useCache: boolean = true,
    showAllModels: boolean = false  // 🆕 NEW: Admin flag to bypass filtering
  ): Promise<DynamicModelsResponse> {
    try {
      console.log('🔥 Fetching dynamic models for configuration:', configId, { useCache, showAllModels });
      
      const url = `${API_BASE_URL}/chat/models/${configId}/dynamic?use_cache=${useCache}&show_all_models=${showAllModels}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Failed to fetch dynamic models',
          response.status
        );
      }

      const dynamicModels: DynamicModelsResponse = await response.json();
      
      console.log('🔥 Dynamic models received:', {
        provider: dynamicModels.provider,
        modelCount: dynamicModels.models.length,
        cached: dynamicModels.cached,
        defaultModel: dynamicModels.default_model,
        hasError: !!dynamicModels.error
      });
      
      return dynamicModels;
      
    } catch (error) {
      console.error('❌ Error fetching dynamic models:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Failed to fetch dynamic models'
      );
    }
  }

  // 🧠 SMART PROCESS MODELS DATA: Enhanced model processing with intelligent filtering
  processModelsDataSmart(
    response: DynamicModelsResponse, 
    filterConfig: any = {},
    includeDebug: boolean = false
  ): SmartProcessedModelsData {
    console.log('🧠 Processing models with smart filtering:', {
      originalModelCount: response.models.length,
      provider: response.provider,
      filterConfig
    });

    // Apply smart filtering to the raw model IDs
    const smartModels = response.models.map(modelId => ({
      id: modelId,
      displayName: this.getModelDisplayName(modelId),
      description: this.getModelDescription(modelId),
      costTier: this.getModelCostTier(modelId),
      capabilities: this.getModelCapabilities(modelId),
      isRecommended: this.isModelRecommended(modelId),
      isDefault: modelId === response.default_model
    }));

    // Set default model flag
    smartModels.forEach(model => {
      model.isDefault = model.id === response.default_model;
    });

    // Get categorized recommendations
    const recommendedCategories = {
      flagship: smartModels.filter(model => model.isRecommended),
      efficient: smartModels.filter(model => !model.isRecommended && model.isDefault),
      specialized: smartModels.filter(model => !model.isRecommended && !model.isDefault)
    };

    // Generate debug info if requested
    let debugInfo;
    if (includeDebug) {
      debugInfo = {
        summary: 'Debug info generated',
        excluded: [],
        topModels: smartModels.slice(0, 5)
      };
    }

    const result: SmartProcessedModelsData = {
      // Legacy format for backward compatibility
      models: smartModels,
      defaultModel: response.default_model,
      provider: response.provider,
      cached: response.cached,
      fetchedAt: new Date(response.fetched_at),
      expiresAt: response.cache_expires_at ? new Date(response.cache_expires_at) : undefined,
      configId: response.config_id,
      configName: response.config_name,
      hasError: !!response.error,
      errorMessage: response.error,
      isFallback: !!response.fallback,

      // Smart filtering enhancements
      smartModels,
      filteredCount: smartModels.length,
      originalCount: response.models.length,
      recommendedCategories,
      filterConfig,
      debugInfo
    };

    console.log('🧠 Smart processing complete:', {
      originalCount: result.originalCount,
      filteredCount: result.filteredCount,
      flagshipModels: result.recommendedCategories.flagship.length,
      efficientModels: result.recommendedCategories.efficient.length,
      specializedModels: result.recommendedCategories.specialized.length
    });

    return result;
  }

  // 🎨 LEGACY PROCESS MODELS DATA: Original processing for backward compatibility
  processModelsData(response: DynamicModelsResponse): ProcessedModelsData {
    const models: ModelInfo[] = response.models.map(modelId => ({
      id: modelId,
      displayName: this.getModelDisplayName(modelId),
      description: this.getModelDescription(modelId),
      costTier: this.getModelCostTier(modelId),
      capabilities: this.getModelCapabilities(modelId),
      isRecommended: this.isModelRecommended(modelId),
      isDefault: modelId === response.default_model
    }));

    return {
      models,
      defaultModel: response.default_model,
      provider: response.provider,
      cached: response.cached,
      fetchedAt: new Date(response.fetched_at),
      expiresAt: response.cache_expires_at ? new Date(response.cache_expires_at) : undefined,
      configId: response.config_id,
      configName: response.config_name,
      hasError: !!response.error,
      errorMessage: response.error,
      isFallback: !!response.fallback
    };
  }

  // 🆕 GET SMART MODELS: Convenience method that combines fetching and smart processing
  async getSmartModels(
    configId: number,
    userRole: 'user' | 'admin' = 'user',
    filterOptions: Partial<any> = {}
  ): Promise<SmartProcessedModelsData> {
    // Build filter configuration
    const filterConfig: any = {
      showAllModels: userRole === 'admin' && filterOptions.showAllModels,
      includeExperimental: userRole === 'admin' && filterOptions.includeExperimental,
      includeLegacy: userRole === 'admin' && filterOptions.includeLegacy,
      maxResults: filterOptions.maxResults ?? (userRole === 'admin' ? 50 : 20),
      sortBy: filterOptions.sortBy ?? 'relevance',
      userRole,
      ...filterOptions
    };

    // Fetch models from backend
    const dynamicModelsResponse = await this.getDynamicModels(
      configId, 
      true, // Use cache
      filterConfig.showAllModels // Pass admin flag to backend
    );

    // Apply smart processing
    return this.processModelsDataSmart(
      dynamicModelsResponse, 
      filterConfig,
      userRole === 'admin' // Include debug info for admins
    );
  }

  // 🆕 GET UNIFIED MODELS: Get all models from all providers in a single list
  // 🎯 This replaces the provider + model selection with a unified approach
  async getUnifiedModels(
    useCache: boolean = true,
    showAllModels: boolean = false,  // Admin flag to bypass filtering
    userRole: 'user' | 'admin' = 'user'
  ): Promise<UnifiedModelsResponse> {
    try {
      console.log('🆕 Fetching unified models from all providers:', { useCache, showAllModels, userRole });
      
      const url = `${API_BASE_URL}/chat/all-models?use_cache=${useCache}&show_all_models=${showAllModels}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Failed to fetch unified models',
          response.status
        );
      }

      const unifiedModels: UnifiedModelsResponse = await response.json();
      
      console.log('🆕 Unified models received:', {
        totalModels: unifiedModels.total_models,
        totalConfigs: unifiedModels.total_configs,
        providers: unifiedModels.providers,
        defaultModel: unifiedModels.default_model_id,
        filteringApplied: unifiedModels.filtering_applied,
        originalCount: unifiedModels.original_total_models
      });
      
      return unifiedModels;
      
    } catch (error) {
      console.error('❌ Error fetching unified models:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Failed to fetch unified models'
      );
    }
  }

  // 🎭 MODEL DISPLAY HELPERS: Convert model IDs to user-friendly names
  
  private getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      // OpenAI Models
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-4': 'GPT-4',
      'gpt-4-0613': 'GPT-4 (June 2023)',
      'gpt-4-32k': 'GPT-4 32K',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
      'gpt-3.5-turbo-0613': 'GPT-3.5 Turbo (June 2023)',
      
      // Claude Models
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
      'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet'
    };
    
    return displayNames[modelId] || modelId;
  }
  
  private getModelDescription(modelId: string): string {
    const descriptions: Record<string, string> = {
      'gpt-4-turbo': 'Latest GPT-4 with improved performance and lower cost',
      'gpt-4': 'Most capable model, best for complex tasks',
      'gpt-3.5-turbo': 'Fast and efficient, great for most conversations',
      'claude-3-opus-20240229': 'Most powerful Claude model for complex tasks',
      'claude-3-sonnet-20240229': 'Balanced performance and speed',
      'claude-3-haiku-20240307': 'Fastest Claude model for quick responses'
    };
    
    return descriptions[modelId] || 'Advanced language model';
  }
  
  private getModelCostTier(modelId: string): 'low' | 'medium' | 'high' {
    if (modelId.includes('gpt-4') || modelId.includes('opus')) {
      return 'high';
    } else if (modelId.includes('turbo') || modelId.includes('sonnet')) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  private getModelCapabilities(modelId: string): string[] {
    const capabilities: Record<string, string[]> = {
      'gpt-4-turbo': ['reasoning', 'analysis', 'coding', 'creative-writing'],
      'gpt-4': ['reasoning', 'analysis', 'coding', 'creative-writing'],
      'gpt-3.5-turbo': ['conversation', 'writing', 'basic-coding'],
      'claude-3-opus-20240229': ['reasoning', 'analysis', 'coding', 'research'],
      'claude-3-sonnet-20240229': ['conversation', 'writing', 'analysis'],
      'claude-3-haiku-20240307': ['conversation', 'quick-responses']
    };
    
    return capabilities[modelId] || ['conversation'];
  }
  
  private isModelRecommended(modelId: string): boolean {
    // Mark certain models as recommended for different use cases
    const recommended = [
      'gpt-4-turbo',
      'gpt-3.5-turbo', 
      'claude-3-sonnet-20240229'
    ];
    
    return recommended.includes(modelId);
  }

  // 🏥 HEALTH CHECK: Verify chat service is working
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/health`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      return await response.json();
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Health check failed'
      );
    }
  }

  // 🛠️ HELPER: Determine error type from HTTP status code
  private getErrorType(statusCode: number): string {
    switch (statusCode) {
      case 400: return 'INVALID_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 429: return 'QUOTA_EXCEEDED';
      case 502: return 'PROVIDER_ERROR';
      case 500: return 'SERVER_ERROR';
      default: return 'UNKNOWN_ERROR';
    }
  }
}

// Export singleton instance following the same pattern as authService
export const chatService = new ChatService();

// 🎯 Enhanced Chat Service Features:
//
// 1. **Smart Model Filtering**: 
//    - Automatically filters out deprecated/irrelevant models
//    - Intelligent scoring and ranking system
//    - Admin controls to bypass filtering
//
// 2. **Backward Compatibility**: 
//    - Original processModelsData() still works
//    - New processModelsDataSmart() with enhanced features
//    - Convenience method getSmartModels() combines everything
//
// 3. **User Role Support**:
//    - Different filtering for users vs admins
//    - Debug information available for admins
//    - Configurable result limits by role
//
// 4. **Enhanced Model Information**:
//    - Categorized recommendations (flagship, efficient, specialized)
//    - Relevance scoring with explanations
//    - Better display names and descriptions
//
// Usage Examples:
// ```
// // For regular users - smart filtered models
// const smartData = await chatService.getSmartModels(configId, 'user');
// console.log('Recommended models:', smartData.recommendedCategories.flagship);
//
// // For admins - full control with debug info
// const adminData = await chatService.getSmartModels(configId, 'admin', {
//   showAllModels: true,
//   includeExperimental: true,
//   sortBy: 'name'
// });
// console.log('Debug info:', adminData.debugInfo);
//
// // Legacy compatibility
// const legacyData = chatService.processModelsData(response);
// ```
