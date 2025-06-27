// 🎯 Model Selection Dropdown Component
// Intelligent model selection with filtering and grouping
// Extracted from ChatInterface.tsx for better modularity

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { UnifiedModelsResponse, UnifiedModelInfo } from '../../../services/chatService';

export interface ModelSelectorProps {
  unifiedModelsData: UnifiedModelsResponse | null;
  selectedModelId: string | null;
  showAllModels: boolean;
  modelsLoading: boolean;
  modelsError: string | null;
  groupedModels: { [provider: string]: UnifiedModelInfo[] } | null;
  onModelChange: (modelId: string) => void;
  isMobile: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  unifiedModelsData,
  selectedModelId,
  showAllModels,
  modelsLoading,
  modelsError,
  groupedModels,
  onModelChange,
  isMobile
}) => {
  // Get current model info
  const currentModelInfo = unifiedModelsData?.models.find(m => m.id === selectedModelId);
  
  // Don't render if models are loading
  if (modelsLoading) {
    return (
      <div className="flex items-center px-2 md:px-3 py-1.5 md:py-1 bg-white/90 backdrop-blur-sm border border-white/30 rounded-md text-xs md:text-sm text-gray-500 min-w-0">
        <Loader2 className="w-3 h-3 animate-spin mr-1" />
        <span>Loading models...</span>
      </div>
    );
  }
  
  // Show error state
  if (modelsError) {
    return (
      <div className="flex items-center px-2 md:px-3 py-1.5 md:py-1 bg-red-100 border border-red-300 rounded-md text-xs md:text-sm text-red-700 min-w-0">
        <AlertCircle className="w-3 h-3 mr-1" />
        <span>Failed to load</span>
      </div>
    );
  }
  
  // Don't render if no models available
  if (!unifiedModelsData || unifiedModelsData.models.length === 0) {
    return null;
  }
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
      <label className="text-xs md:text-sm font-medium text-white whitespace-nowrap">
        AI Model:
      </label>
      
      <div className="relative min-w-0">
        {/* Model Selection Dropdown */}
        <select
          value={selectedModelId || ''}
          onChange={(e) => onModelChange(e.target.value)}
          className="px-2 md:px-3 py-1.5 md:py-1 bg-white/90 backdrop-blur-sm border border-white/30 rounded-md text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white min-w-0 max-w-[280px] md:max-w-none pr-8"
          title={currentModelInfo ? 
            `${currentModelInfo.provider} • ${currentModelInfo.cost_tier} cost • Score: ${currentModelInfo.relevance_score || 'N/A'}/100` 
            : ''
          }
        >
          {/* Show All Toggle Option */}
          <optgroup label="📋 Model View Options">
            <option value="__toggle_filter__" className="font-medium text-blue-600 bg-blue-50">
              {showAllModels 
                ? `🔍 Show Fewer Models (${unifiedModelsData.original_total_models ? unifiedModelsData.original_total_models - unifiedModelsData.total_models : ''} hidden)`
                : `👁️ Show All Models (${unifiedModelsData.original_total_models ? unifiedModelsData.original_total_models - unifiedModelsData.total_models : ''} more)`
              }
            </option>
          </optgroup>
          
          {/* Current Models */}
          {groupedModels && Object.entries(groupedModels).map(([provider, models]) => (
            <optgroup key={provider} label={`${provider} Models`}>
              {models.map((model) => (
                <option key={model.id} value={model.id} className="text-gray-700 bg-white">
                  {model.display_name}
                  {model.is_default && ' (Default)'}
                  {model.is_recommended && ' ⭐'}
                  {model.cost_tier === 'high' && ' 💰'}
                  {model.cost_tier === 'medium' && ' 🟡'}
                  {model.cost_tier === 'low' && ' 🟢'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        
        {/* Visual indicator overlay for filtering status */}
        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <div className={`w-2 h-2 rounded-full ${
            showAllModels
              ? 'bg-orange-400'  // Orange for "show all"
              : 'bg-blue-400'    // Blue for "filtered"
          }`} title={showAllModels ? 'All models shown' : 'Filtered models shown'}></div>
        </div>
      </div>
    </div>
  );
};