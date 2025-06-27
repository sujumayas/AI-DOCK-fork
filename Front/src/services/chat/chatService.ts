// 🎯 Main Chat Service
// Orchestrator that combines all modular chat services for backward compatibility

import { 
  ChatRequest, 
  ChatResponse,
  StreamingChatRequest,
  StreamingChatChunk,
  StreamingError,
  StreamingConnection,
  LLMConfigurationSummary,
  ConfigTestRequest,
  ConfigTestResponse,
  CostEstimateRequest,
  CostEstimateResponse,
  DynamicModelsResponse,
  ProcessedModelsData,
  UnifiedModelsResponse
} from '../../types/chat';

// Import all modular services
import { coreChatService } from './core';
import { streamingChatService } from './streaming';
import { configurationService } from './configuration';
import { costService } from './cost';
import { healthService } from './health';
import { modelsService, SmartProcessedModelsData, UnifiedModelInfo } from './models';
import { modelHelpers } from './modelHelpers';

/**
 * Main Chat Service - orchestrates all modular services
 * 🎓 Learning: Facade pattern for maintaining backward compatibility
 * while internally using modular architecture
 */
export class ChatService {

  // 💬 CORE CHAT OPERATIONS
  
  /**
   * Send a basic chat message
   * Delegates to CoreChatService
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    return coreChatService.sendMessage(request);
  }

  // 🌊 STREAMING OPERATIONS

  /**
   * Send message with real-time streaming response
   * Delegates to StreamingChatService
   */
  async streamMessage(
    request: StreamingChatRequest,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void
  ): Promise<StreamingConnection> {
    return streamingChatService.streamMessage(request, onChunk, onError, onComplete);
  }

  /**
   * Stream message with automatic fallback to regular chat
   * Delegates to StreamingChatService
   */
  async streamMessageWithFallback(
    request: StreamingChatRequest,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void,
    enableFallback: boolean = true
  ): Promise<StreamingConnection | ChatResponse> {
    return streamingChatService.streamMessageWithFallback(
      request, onChunk, onError, onComplete, enableFallback
    );
  }

  // 🎛️ CONFIGURATION MANAGEMENT

  /**
   * Get available LLM configurations
   * Delegates to ConfigurationService
   */
  async getAvailableConfigurations(): Promise<LLMConfigurationSummary[]> {
    return configurationService.getAvailableConfigurations();
  }

  /**
   * Test LLM configuration
   * Delegates to ConfigurationService
   */
  async testConfiguration(configId: number): Promise<ConfigTestResponse> {
    return configurationService.testConfiguration(configId);
  }

  // 💰 COST MANAGEMENT

  /**
   * Estimate cost for a chat request
   * Delegates to CostService
   */
  async estimateCost(request: CostEstimateRequest): Promise<CostEstimateResponse> {
    return costService.estimateCost(request);
  }

  // 🎯 MODEL MANAGEMENT

  /**
   * Get models for a specific configuration (legacy)
   * Delegates to ModelsService
   */
  async getAvailableModels(configId: number): Promise<string[]> {
    return modelsService.getAvailableModels(configId);
  }

  /**
   * Get real-time models from provider API
   * Delegates to ModelsService
   */
  async getDynamicModels(
    configId: number, 
    useCache: boolean = true,
    showAllModels: boolean = false
  ): Promise<DynamicModelsResponse> {
    return modelsService.getDynamicModels(configId, useCache, showAllModels);
  }

  /**
   * Get all models from all providers in unified format
   * Delegates to ModelsService
   */
  async getUnifiedModels(
    useCache: boolean = true,
    showAllModels: boolean = false,
    userRole: 'user' | 'admin' = 'user'
  ): Promise<UnifiedModelsResponse> {
    return modelsService.getUnifiedModels(useCache, showAllModels, userRole);
  }

  /**
   * Process models data (legacy)
   * Delegates to ModelsService
   */
  processModelsData(response: DynamicModelsResponse): ProcessedModelsData {
    return modelsService.processModelsData(response);
  }

  /**
   * Process models data with smart filtering
   * Delegates to ModelsService
   */
  processModelsDataSmart(
    response: DynamicModelsResponse, 
    filterConfig: any = {},
    includeDebug: boolean = false
  ): SmartProcessedModelsData {
    return modelsService.processModelsDataSmart(response, filterConfig, includeDebug);
  }

  /**
   * Get smart models with processing
   * Delegates to ModelsService
   */
  async getSmartModels(
    configId: number,
    userRole: 'user' | 'admin' = 'user',
    filterOptions: Partial<any> = {}
  ): Promise<SmartProcessedModelsData> {
    return modelsService.getSmartModels(configId, userRole, filterOptions);
  }

  // 🎨 MODEL DISPLAY HELPERS
  // Direct access to modelHelpers for backward compatibility

  /**
   * Get model display name
   * Delegates to ModelHelpers
   */
  getModelDisplayName(modelId: string): string {
    return modelHelpers.getModelDisplayName(modelId);
  }

  /**
   * Get model description
   * Delegates to ModelHelpers
   */
  getModelDescription(modelId: string): string {
    return modelHelpers.getModelDescription(modelId);
  }

  /**
   * Get model cost tier
   * Delegates to ModelHelpers
   */
  getModelCostTier(modelId: string): 'low' | 'medium' | 'high' {
    return modelHelpers.getModelCostTier(modelId);
  }

  /**
   * Get model capabilities
   * Delegates to ModelHelpers
   */
  getModelCapabilities(modelId: string): string[] {
    return modelHelpers.getModelCapabilities(modelId);
  }

  /**
   * Check if model is recommended
   * Delegates to ModelHelpers
   */
  isModelRecommended(modelId: string): boolean {
    return modelHelpers.isModelRecommended(modelId);
  }

  // 🏥 HEALTH MONITORING

  /**
   * Check service health
   * Delegates to HealthService
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    return healthService.healthCheck();
  }

  // 🛠️ UTILITY METHODS

  /**
   * Get API base URL
   * Delegates to CoreChatService
   */
  getApiBaseUrl(): string {
    return coreChatService.getApiBaseUrl();
  }

  /**
   * Get authenticated headers
   * Delegates to CoreChatService
   */
  getAuthHeaders(): Record<string, string> {
    return coreChatService.getAuthHeaders();
  }
}

// Export singleton instance following the same pattern as the original
export const chatService = new ChatService();

// 🎯 Backward Compatibility Notes:
//
// This orchestrator maintains 100% API compatibility with the original 
// chatService.ts while internally using the new modular architecture.
//
// Benefits achieved:
// ✅ All original functionality preserved
// ✅ Modular, maintainable code structure
// ✅ Each service has single responsibility
// ✅ Easy to test individual components
// ✅ Better separation of concerns
// ✅ No breaking changes for existing code
//
// Original usage still works exactly the same:
// ```
// import { chatService } from '@/services/chatService';
// const response = await chatService.sendMessage(request);
// ```
//
// New modular services can also be imported directly:
// ```
// import { streamingChatService } from '@/services/chat/streaming';
// import { modelsService } from '@/services/chat/models';
// ```
