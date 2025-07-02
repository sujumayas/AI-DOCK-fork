// 🎯 Model Selection and Filtering Hook
// Manages AI model selection, filtering, and provider integration
// Extracted from ChatInterface.tsx for better modularity

import { useState, useEffect, useMemo, useCallback } from 'react';
import { chatService, UnifiedModelsResponse, UnifiedModelInfo } from '../../services/chatService';
import { ChatServiceError } from '../../types/chat';
import { useAuth } from '../useAuth';

// Filter function for classic models
function filterClassicModels(models: UnifiedModelInfo[]): UnifiedModelInfo[] {
  const allowedIds = [
    // GPT-4o models
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4o-mini-2024-07-18',
    'gpt-4o-2024-05-13',
    'gpt-4o-2024-08-06',
    'gpt-4o-2024-11-20',
    
    // GPT-4 Turbo models
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-4-turbo-2024-04-09',
    'gpt-4-0125-preview',
    'gpt-4-1106-preview',
    
    // GPT-4 classic models
    'gpt-4',
    'gpt-4-0613',
    'gpt-4-0314',
    'gpt-4-32k',
    'gpt-4-32k-0613',
    'gpt-4-32k-0314',
    
    // GPT-3.5 models
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo-0613',
    'gpt-3.5-turbo-0301',
    'gpt-3.5-turbo-16k-0613',
    
    // ChatGPT models
    'chatgpt-4o-latest',
  ];
  return models.filter((model: UnifiedModelInfo) => 
    allowedIds.includes(model.id) || allowedIds.includes(model.display_name)
  );
}

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
        const defaultModelId = unifiedData.default_model_id || unifiedData.models[0]?.id;
        const defaultConfigId = unifiedData.default_config_id || unifiedData.models[0]?.config_id;
        
        if (defaultModelId && defaultConfigId) {
          setSelectedModelId(defaultModelId);
          setSelectedConfigId(defaultConfigId);
          console.log('🎯 Auto-selected default model:', defaultModelId, 'from config:', defaultConfigId);
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