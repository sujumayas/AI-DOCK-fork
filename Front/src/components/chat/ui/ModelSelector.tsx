// 🎯 Model Selection Component - Modern Glassmorphism Design
// Intelligent model selection with filtering, grouping, and enhanced UX
// Enhanced with modern styling patterns matching the app's glassmorphism theme

import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Loader2, ChevronDown, Zap, Brain, Star, Check, Filter } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get current model info
  const currentModelInfo = unifiedModelsData?.models.find(m => m.id === selectedModelId);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle visibility state for animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow close animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle dropdown toggle with animation
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Handle model selection
  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  // Don't render if models are loading
  if (modelsLoading) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-white/90 font-medium">Loading AI models...</span>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (modelsError) {
    return (
      <div className="bg-red-500/10 backdrop-blur-md border border-red-400/30 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <div className="text-red-300 font-medium">Failed to load models</div>
            <div className="text-red-400/70 text-sm">Please try refreshing the page</div>
          </div>
        </div>
      </div>
    );
  }
  
  // Don't render if no models available
  if (!unifiedModelsData || unifiedModelsData.models.length === 0) {
    return null;
  }

  // Get cost tier icon and color - REMOVED FOR CLEANER UI
  const getCostTierDisplay = (costTier: string) => {
    // Simplified - no cost tier labels shown
    return null;
  };

  const costDisplay = null; // Removed cost tier display

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Compact Model Selector Button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center space-x-3 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all duration-300 group min-w-[240px]"
      >
        {/* Model Icon */}
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        
        {/* Model Info */}
        <div className="flex-1 text-left min-w-0">
          {currentModelInfo ? (
            <>
              <div className="flex items-center space-x-2">
                <span className="text-white font-medium truncate">
                  {currentModelInfo.display_name}
                </span>
                {currentModelInfo.is_recommended && (
                  <Star className="w-3 h-3 text-yellow-400 fill-current flex-shrink-0" />
                )}
                {currentModelInfo.is_default && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded border border-blue-400/30 flex-shrink-0">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 text-xs">
                <span className="text-white/70">{currentModelInfo.provider}</span>
                {/* Cost tier display removed for cleaner UI */}
              </div>
            </>
          ) : (
            <span className="text-white/80">Select a model...</span>
          )}
        </div>
        
        {/* Dropdown Arrow */}
        <ChevronDown className={`w-4 h-4 text-white/60 group-hover:text-white/80 transition-all duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <div 
        className={`absolute top-full left-0 right-0 mt-2 bg-gray-900/80 backdrop-blur-3xl border border-white/30 rounded-2xl shadow-2xl z-50 overflow-hidden transform transition-all duration-300 ease-out ${
          isOpen 
            ? 'opacity-100 scale-y-100 translate-y-0' 
            : 'opacity-0 scale-y-0 -translate-y-2'
        }`}
        style={{
          transformOrigin: 'top center',
          maxHeight: isOpen ? '320px' : '0px'
        }}
      >
        {isVisible && (
          <div className="overflow-y-auto max-h-80 model-selector-dropdown">
            {/* Filter Toggle Option */}
            <div className="p-2 border-b border-white/20">
              <button
                onClick={() => handleModelSelect('__toggle_filter__')}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-white/15 transition-all duration-200 group/item"
              >
                <div className="w-8 h-8 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <Filter className="w-4 h-4 text-blue-300" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-medium text-sm">
                    {showAllModels ? 'Show Essential Models' : 'Show All Models'}
                  </div>
                </div>
              </button>
            </div>

            {/* Model Groups */}
            {groupedModels && Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider} className="p-2">
                {/* Provider Header */}
                <div className="px-3 py-2 text-xs font-semibold text-white/70 uppercase tracking-wider">
                  🤖 {provider} Models
                </div>
                
                {/* Models */}
                {models.map((model) => {
                  const isSelected = selectedModelId === model.id;
                  
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200 group/item ${
                        isSelected 
                          ? 'bg-blue-500/30 border border-blue-400/50' 
                          : 'hover:bg-white/15 border border-transparent'
                      }`}
                    >
                      {/* Model Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected 
                          ? 'bg-blue-500/40' 
                          : 'bg-white/10 group-hover/item:bg-white/15'
                      }`}>
                        {isSelected ? (
                          <Check className="w-4 h-4 text-blue-200" />
                        ) : (
                          <Zap className="w-4 h-4 text-white/80" />
                        )}
                      </div>
                      
                      {/* Model Info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${isSelected ? 'text-blue-100' : 'text-white'}`}>
                            {model.display_name}
                          </span>
                          {model.is_recommended && (
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          )}
                          {model.is_default && (
                            <span className="px-1.5 py-0.5 bg-blue-500/30 text-blue-200 text-xs rounded border border-blue-400/40">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-xs">
                          <span className={`${isSelected ? 'text-blue-200/80' : 'text-white/80'}`}>
                            {provider}
                          </span>
                          {/* Cost tier and relevance score removed for cleaner UI */}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};