// 🔥 Models Service
// Model fetching, processing, and smart filtering functionality

import { 
  DynamicModelsResponse, 
  ProcessedModelsData, 
  ModelInfo,
  UnifiedModelsResponse,
  UnifiedModelInfo
} from '../../types/chat';
import { coreChatService } from './core';
import { modelHelpers } from './modelHelpers';
import { createChatServiceError, logChatError } from './errors';

// 🆕 UNIFIED MODELS TYPES: Now imported from types/chat.ts
// Re-export for backward compatibility
export type { UnifiedModelInfo } from '../../types/chat';

// Enhanced processed models data with smart filtering capabilities
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

/**
 * Models Service - handles model discovery, processing, and smart filtering
 * 🎓 Learning: Complex model management with intelligent filtering
 */
export class ModelsService {

  /**
   * Get models for a specific configuration (legacy)
   * 🎯 Simple model list for backward compatibility
   */
  async getAvailableModels(configId: number): Promise<string[]> {
    try {
      console.log('🎯 Fetching models for configuration:', configId);
      
      const response = await fetch(`${coreChatService.getApiBaseUrl()}/chat/models/${configId}`, {
        method: 'GET',
        headers: coreChatService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw createChatServiceError(
          errorData.detail || 'Failed to fetch available models',
          errorData.detail || 'Failed to fetch available models',
          response.status
        );
      }

      const models: string[] = await response.json();
      
      console.log('🎯 Available models:', models);
      
      return models;
      
    } catch (error) {
      logChatError('Error fetching models', error, { configId });
      
      throw createChatServiceError(
        error,
        'Failed to fetch models'
      );
    }
  }

  /**
   * Get real-time models from provider API
   * 🔥 Dynamic model discovery with caching
   */
  async getDynamicModels(
    configId: number, 
    useCache: boolean = true,
    showAllModels: boolean = false  // Admin flag to bypass filtering
  ): Promise<DynamicModelsResponse> {
    try {
      console.log('🔥 Fetching dynamic models for configuration:', configId, { useCache, showAllModels });
      
      const url = `${coreChatService.getApiBaseUrl()}/chat/models/${configId}/dynamic?use_cache=${useCache}&show_all_models=${showAllModels}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: coreChatService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw createChatServiceError(
          errorData.detail || 'Failed to fetch dynamic models',
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
      logChatError('Error fetching dynamic models', error, { configId, useCache, showAllModels });
      
      throw createChatServiceError(
        error,
        'Failed to fetch dynamic models'
      );
    }
  }

  /**
   * Get all models from all providers in a single list
   * 🆕 Unified approach replacing provider + model selection
   */
  async getUnifiedModels(
    useCache: boolean = true,
    showAllModels: boolean = false,  // Admin flag to bypass filtering
    userRole: 'user' | 'admin' = 'user'
  ): Promise<UnifiedModelsResponse> {
    try {
      console.log('🆕 Fetching unified models from all providers:', { useCache, showAllModels, userRole });
      
      const url = `${coreChatService.getApiBaseUrl()}/chat/all-models?use_cache=${useCache}&show_all_models=${showAllModels}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: coreChatService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw createChatServiceError(
          errorData.detail || 'Failed to fetch unified models',
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
      logChatError('Error fetching unified models', error, { useCache, showAllModels, userRole });
      
      throw createChatServiceError(
        error,
        'Failed to fetch unified models'
      );
    }
  }

  /**
   * Legacy model processing for backward compatibility
   * 🎨 Convert raw model data to structured format
   */
  processModelsData(response: DynamicModelsResponse): ProcessedModelsData {
    const models: ModelInfo[] = response.models.map(modelId => ({
      id: modelId,
      displayName: modelHelpers.getModelDisplayName(modelId),
      description: modelHelpers.getModelDescription(modelId),
      costTier: modelHelpers.getModelCostTier(modelId),
      capabilities: modelHelpers.getModelCapabilities(modelId),
      isRecommended: modelHelpers.isModelRecommended(modelId),
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

  /**
   * Enhanced model processing with intelligent filtering
   * 🧠 Smart filtering with categorization and scoring
   */
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
      displayName: modelHelpers.getModelDisplayName(modelId),
      description: modelHelpers.getModelDescription(modelId),
      costTier: modelHelpers.getModelCostTier(modelId),
      capabilities: modelHelpers.getModelCapabilities(modelId),
      isRecommended: modelHelpers.isModelRecommended(modelId),
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

  /**
   * Convenience method that combines fetching and smart processing
   * 🆕 One-stop method for getting processed models with smart filtering
   */
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
}

// Export singleton instance
export const modelsService = new ModelsService();
