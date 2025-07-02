// 🎯 Model Selection and Filtering Hook
// Manages AI model selection, filtering, and provider integration
// Extracted from ChatInterface.tsx for better modularity

import { useState, useEffect, useMemo, useCallback } from 'react';
import { chatService, UnifiedModelsResponse, UnifiedModelInfo } from '../../services/chatService';
import { ChatServiceError } from '../../types/chat';
import { useAuth } from '../useAuth';

// Filter function for classic models
const filterClassicModels = (models: UnifiedModelInfo[]): UnifiedModelInfo[] => {
  const allowedIds = [
    // Claude 4 Models (latest generation) - ALIASES ONLY
    'claude-opus-4-0',           // Most capable, auto-updates
    'claude-sonnet-4-0',         // High performance, auto-updates
    
    // Claude 3.7 Models (extended thinking) - ALIAS ONLY
    'claude-3-7-sonnet-latest',  // Extended thinking, auto-updates
    
    // Claude 3.5 Models - ONLY HAIKU (removing Sonnet from essentials)
    'claude-3-5-haiku-latest',   // Fast responses, auto-updates
    
    // OpenAI Models (keeping current selection)
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-4-0125-preview',
    'gpt-4-1106-preview',
    
    // Google Models
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];
  
  return models.filter(model => allowedIds.includes(model.id));
};

export interface ModelSelectionState {
  // Model data
  unifiedModelsData: UnifiedModelsResponse | null;
  selectedModelId: string | null;
  selectedConfigId: number | null;
  currentModelInfo: UnifiedModelInfo | null;
  
  // UI state
  showAllModels: boolean;
  modelsLoading: boolean;
  modelsError: string | null;
  connectionStatus: 'checking' | 'connected' | 'error';
  
  // Derived data
  groupedModels: { [provider: string]: UnifiedModelInfo[] } | null;
  selectedConfig: {
    id: number;
    name: string;
    provider: string;
    provider_name: string;
  } | null;
}

export interface ModelSelectionActions {
  loadUnifiedModels: () => Promise<void>;
  handleModelChange: (modelId: string) => void;
  toggleShowAllModels: () => void;
  setError: (error: string | null) => void;
}

export interface ModelSelectionReturn extends ModelSelectionState, ModelSelectionActions {}

export const useModelSelection = (): ModelSelectionReturn => {
  const { user } = useAuth();
  
  // 🆕 Model selection state
  const [unifiedModelsData, setUnifiedModelsData] = useState<UnifiedModelsResponse | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // 🎮 Filtering controls
  const [showAllModels, setShowAllModels] = useState(false);
  
  // 🆕 Load unified models from all providers
  const loadUnifiedModels = useCallback(async () => {
    try {
      setModelsLoading(true);
      setModelsError(null);
      setConnectionStatus('checking');
      
      console.log('🆕 Loading unified models from all providers...');
      console.log('DEBUG: showAllModels =', showAllModels);
      
      const unifiedData = await chatService.getUnifiedModels(
        true, // Use cache
        showAllModels, // Show all models or filtered
        user && 'is_admin' in user && (user as any).is_admin ? 'admin' : 'user'
      );
      
      console.log('DEBUG: unifiedModelsData.total_models =', unifiedData.total_models, 'original_total_models =', unifiedData.original_total_models);
      
      if (unifiedData.total_models === 0) {
        setModelsError('No AI models available. Please contact your administrator.');
        setConnectionStatus('error');
        return;
      }
      
      setUnifiedModelsData(unifiedData);
      setConnectionStatus('connected');
      
      // Auto-select default model if none selected or current selection is invalid
      if (!selectedModelId || !unifiedData.models.find(m => m.id === selectedModelId)) {
        // Use our custom default model logic to prioritize aliases
        const defaultModel = getDefaultModel(unifiedData.models);
        
        if (defaultModel) {
          setSelectedModelId(defaultModel.id);
          setSelectedConfigId(defaultModel.config_id);
          console.log('🎯 Auto-selected default model:', defaultModel.id, 'from config:', defaultModel.config_id);
        } else {
          // Fallback to backend's suggestion if our logic fails
          const defaultModelId = unifiedData.default_model_id || unifiedData.models[0]?.id;
          const defaultConfigId = unifiedData.default_config_id || unifiedData.models[0]?.config_id;
          
          if (defaultModelId && defaultConfigId) {
            setSelectedModelId(defaultModelId);
            setSelectedConfigId(defaultConfigId);
            console.log('🎯 Fallback to backend default model:', defaultModelId, 'from config:', defaultConfigId);
          }
        }
      }
      
      console.log('✅ Unified models loaded successfully:', {
        totalModels: unifiedData.total_models,
        totalConfigs: unifiedData.total_configs,
        providers: unifiedData.providers,
        filteringApplied: unifiedData.filtering_applied,
        originalCount: unifiedData.original_total_models
      });
      
    } catch (error) {
      console.error('❌ Failed to load unified models:', error);
      
      if (error instanceof ChatServiceError) {
        setModelsError(`Failed to load AI models: ${error.message}`);
      } else {
        setModelsError('Unable to connect to chat service. Please try again later.');
      }
      setConnectionStatus('error');
    } finally {
      setModelsLoading(false);
    }
  }, [showAllModels, user]);
  
  // 🆕 Handle unified model selection change
  const handleModelChange = useCallback((modelId: string) => {
    // 🎯 Special case: Handle the toggle filter option
    if (modelId === '__toggle_filter__') {
      setShowAllModels(prev => !prev);
      console.log('🔄 Toggled model filter from dropdown:', !showAllModels ? 'show all' : 'filter');
      return;
    }
    
    // Regular model selection
    const selectedModel = unifiedModelsData?.models.find(m => m.id === modelId);
    if (selectedModel) {
      setSelectedModelId(modelId);
      setSelectedConfigId(selectedModel.config_id);
      setModelsError(null);
      console.log('🎯 Switched to model:', modelId, 'from', selectedModel.provider, '(config:', selectedModel.config_id, ')');
    }
  }, [unifiedModelsData, showAllModels]);
  
  // Toggle show all models
  const toggleShowAllModels = useCallback(() => {
    setShowAllModels(prev => !prev);
  }, []);
  
  // Set error
  const setError = useCallback((error: string | null) => {
    setModelsError(error);
  }, []);
  
  // 🆕 Load unified models when component mounts or filter settings change
  useEffect(() => {
    loadUnifiedModels();
  }, [loadUnifiedModels]);
  
  // Update selected config ID when model selection changes
  useEffect(() => {
    if (selectedModelId && unifiedModelsData) {
      const selectedModel = unifiedModelsData.models.find(m => m.id === selectedModelId);
      if (selectedModel && selectedModel.config_id !== selectedConfigId) {
        setSelectedConfigId(selectedModel.config_id);
        console.log('🎯 Config ID updated to:', selectedModel.config_id, 'for model:', selectedModelId);
      }
    }
  }, [selectedModelId, unifiedModelsData, selectedConfigId]);
  
  // 🆕 Get current model information
  const currentModelInfo = useMemo(() => {
    if (!unifiedModelsData || !selectedModelId) return null;
    return unifiedModelsData.models.find(m => m.id === selectedModelId) || null;
  }, [unifiedModelsData, selectedModelId]);
  
  // Get current config info derived from selected model
  const selectedConfig = useMemo(() => {
    if (!currentModelInfo) return null;
    return {
      id: currentModelInfo.config_id,
      name: currentModelInfo.config_name,
      provider: currentModelInfo.provider,
      provider_name: currentModelInfo.provider
    };
  }, [currentModelInfo]);
  
  // 🎯 Group unified models by provider for better UX
  const groupedModels = useMemo(() => {
    if (!unifiedModelsData) return null;
    let models: UnifiedModelInfo[] = unifiedModelsData.models;
    if (!showAllModels) {
      models = filterClassicModels(models);
    }
    // Group models by provider
    const providerGroups: { [provider: string]: UnifiedModelInfo[] } = {};
    models.forEach((model: UnifiedModelInfo) => {
      if (!providerGroups[model.provider]) {
        providerGroups[model.provider] = [];
      }
      providerGroups[model.provider].push(model);
    });
    // Sort models within each provider by relevance and recommendation
    Object.keys(providerGroups).forEach((provider: string) => {
      providerGroups[provider].sort((a: UnifiedModelInfo, b: UnifiedModelInfo) => {
        // Recommended models first
        if (a.is_recommended && !b.is_recommended) return -1;
        if (!a.is_recommended && b.is_recommended) return 1;
        // Higher relevance score first
        const aScore = a.relevance_score || 0;
        const bScore = b.relevance_score || 0;
        if (aScore !== bScore) return bScore - aScore;
        // Alphabetical fallback
        return a.display_name.localeCompare(b.display_name);
      });
    });
    return providerGroups;
  }, [unifiedModelsData, showAllModels]);
  
  const getDefaultModel = useCallback((models: UnifiedModelInfo[]): UnifiedModelInfo | null => {
    if (!models || models.length === 0) return null;
    
    // Priority order for default model selection
    const priorityModels = [
      'claude-opus-4-0',           // Latest Claude Opus 4 (auto-updates)
      'claude-sonnet-4-0',         // Latest Claude Sonnet 4 (auto-updates)
      'claude-3-7-sonnet-latest',  // Extended thinking (auto-updates)
      'gpt-4o',                    // OpenAI flagship
      'gpt-4-turbo',              // OpenAI turbo
      'claude-3-5-haiku-latest'    // Fast Claude model (auto-updates)
    ];
    
    // Find first available priority model
    for (const modelId of priorityModels) {
      const found = models.find(m => m.id === modelId);
      if (found) return found;
    }
    
    // Fallback to first model in list
    return models[0];
  }, []);
  
  return {
    // State
    unifiedModelsData,
    selectedModelId,
    selectedConfigId,
    currentModelInfo,
    showAllModels,
    modelsLoading,
    modelsError,
    connectionStatus,
    groupedModels,
    selectedConfig,
    
    // Actions
    loadUnifiedModels,
    handleModelChange,
    toggleShowAllModels,
    setError
  };
};