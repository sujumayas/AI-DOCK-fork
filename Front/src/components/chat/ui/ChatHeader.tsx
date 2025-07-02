// 🎛️ Chat Interface Header Component
// Shows model selection, project info, assistant info, and conversation controls

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Zap, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Home, 
  Bot,
  Archive,
  Save,
  Folder
} from 'lucide-react';
import { UnifiedModelsResponse, UnifiedModelInfo } from '../../../services/chatService';
import { AssistantSummary } from '../../../types/assistant';
import { ProjectSummary } from '../../../types/project';
import { getShortProviderName } from '../../../utils/llmUtils';
import { ModelSelector } from './ModelSelector';
import { StatusIndicators } from './StatusIndicators';

export interface ChatHeaderProps {
  // Model selection
  unifiedModelsData: UnifiedModelsResponse | null;
  selectedModelId: string | null;
  currentModelInfo: UnifiedModelInfo | null;
  showAllModels: boolean;
  modelsLoading: boolean;
  modelsError: string | null;
  connectionStatus: 'checking' | 'connected' | 'error';
  groupedModels: { [provider: string]: UnifiedModelInfo[] } | null;
  onModelChange: (modelId: string) => void;
  
  // Assistant and project state
  selectedAssistant: AssistantSummary | null;
  selectedProject: ProjectSummary | null;
  onOpenProjectManager?: () => void;
  
  // Conversation state
  messages: any[];
  currentConversationId: number | null;
  conversationTitle: string | null;
  isSavingConversation: boolean;
  onSaveConversation: () => void;
  onNewConversation: () => void;
  
  // Streaming state
  isStreaming: boolean;
  streamingHasError: boolean;
  streamingError: any;
  connectionState: string;
  
  // UI state
  isMobile: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  unifiedModelsData,
  selectedModelId,
  currentModelInfo,
  showAllModels,
  modelsLoading,
  modelsError,
  connectionStatus,
  groupedModels,
  onModelChange,
  selectedAssistant,
  selectedProject,
  onOpenProjectManager,
  messages,
  currentConversationId,
  conversationTitle,
  isSavingConversation,
  onSaveConversation,
  onNewConversation,
  isStreaming,
  streamingHasError,
  streamingError,
  connectionState,
  isMobile
}) => {
  const navigate = useNavigate();
  
  // 🏠 Navigate back to dashboard
  const handleBackToDashboard = () => {
    console.log('🏠 Navigating back to dashboard');
    navigate('/');
  };
  
  // Get current config info
  const selectedConfig = currentModelInfo ? {
    id: currentModelInfo.config_id,
    name: currentModelInfo.config_name,
    provider: currentModelInfo.provider,
    provider_name: currentModelInfo.provider
  } : null;
  
  return (
    <div className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 md:px-6 py-4 sticky top-0 z-50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center space-x-2 md:space-x-4">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            {selectedAssistant 
              ? `Chat with ${selectedAssistant.name}` 
              : 'AI Chat'
            }
          </h1>
          
          {/* 📊 Connection status indicator */}
          <StatusIndicators 
            connectionStatus={connectionStatus}
            isMobile={isMobile}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* 🆕 Model Selection */}
          <ModelSelector
            unifiedModelsData={unifiedModelsData}
            selectedModelId={selectedModelId}
            showAllModels={showAllModels}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            groupedModels={groupedModels}
            onModelChange={onModelChange}
            isMobile={isMobile}
          />
          
          {/* 📂 Projects button */}
          {onOpenProjectManager && (
            <button
              onClick={onOpenProjectManager}
              disabled={isStreaming}
              className="px-3 md:px-4 py-2 text-sm bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded-lg transition-all duration-300 flex items-center backdrop-blur-lg touch-manipulation disabled:opacity-50 hover:scale-105"
              title="Manage Projects"
            >
              <Folder className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
              <span className="hidden md:inline ml-1">Projects</span>
            </button>
          )}

          {/* 💾 Save Conversation button */}
          {messages.length > 0 && !currentConversationId && (
            <button
              onClick={onSaveConversation}
              disabled={isSavingConversation}
              className="px-3 md:px-4 py-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg transition-all duration-300 flex items-center backdrop-blur-lg touch-manipulation disabled:opacity-50 hover:scale-105"
              title="Save Conversation"
            >
              {isSavingConversation ? (
                <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
              ) : (
                <Save className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
              )}
              <span className="hidden md:inline ml-1">
                {isSavingConversation ? 'Saving...' : 'Save'}
              </span>
            </button>
          )}
          
          {/* 🏠 Back to Dashboard button */}
          <button
            onClick={handleBackToDashboard}
            className="px-3 md:px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-300 flex items-center backdrop-blur-lg touch-manipulation hover:scale-105"
            title="Back to Dashboard"
          >
            <Home className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
            <span className="hidden md:inline ml-1">Dashboard</span>
          </button>
          
          {/* 📂 Project indicator - REMOVED per requirements: folder context only in sidebar */}
          
          {/* 🤖 Assistant indicator */}
          {selectedAssistant && (
            <div className="flex items-center px-2 md:px-3 py-1.5 md:py-1 bg-purple-500/20 backdrop-blur-sm border border-purple-300/30 rounded-md text-xs md:text-sm text-purple-100 min-w-0">
              <Bot className="w-3 h-3 md:w-4 md:h-4 mr-1 flex-shrink-0" />
              <span className="whitespace-nowrap">
                {selectedAssistant.name}
              </span>
            </div>
          )}
          
          {/* 🆕 New conversation button */}
          <button
            onClick={onNewConversation}
            className="px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm bg-white/20 hover:bg-white/30 text-white rounded-md transition-all duration-200 backdrop-blur-sm touch-manipulation whitespace-nowrap"
            title="Start new conversation"
          >
            <span className="md:hidden">New</span>
            <span className="hidden md:inline">New Chat</span>
          </button>
        </div>
      </div>
      
      {/* 💡 Enhanced model info with smart details */}
      {selectedConfig && currentModelInfo && (
        <div className="mt-2 text-xs md:text-sm text-blue-100">
          <div className="flex flex-wrap items-center gap-1 md:gap-2">
            {/* 📂 Project info - REMOVED per requirements: folder context only in sidebar */}
            
            {/* 🤖 Assistant info */}
            {selectedAssistant && (
              <div className="flex items-center">
                <Bot className="w-3 h-3 md:w-4 md:h-4 mr-1 text-purple-300 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  Assistant: <strong className="text-purple-200">{selectedAssistant.name}</strong>
                </span>
                <span className="mx-1 text-blue-300">•</span>
              </div>
            )}
            
            <div className="flex items-center">
              <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1 text-yellow-300 flex-shrink-0" />
              <span className="whitespace-nowrap">
                Model: <strong className="text-white">{currentModelInfo.display_name}</strong>
              </span>
            </div>
            <div className="flex items-center">
              <span className="whitespace-nowrap">
                via <strong className="text-blue-200">{getShortProviderName(selectedConfig.provider_name)}</strong>
              </span>
            </div>
            
            {/* Model details - simplified without scores and cost tiers */}
            <div className="flex items-center gap-1">
              {currentModelInfo.is_recommended && (
                <span className="text-yellow-300 text-xs" title="Recommended model">
                  ⭐
                </span>
              )}
              {/* Relevance score and cost tier removed for cleaner UI */}
            </div>
            
            {/* Filtering status */}

            
            {/* Conversation status */}
            {currentConversationId && conversationTitle && (
              <div className="flex items-center gap-1">
                <Archive className="w-3 h-3 text-blue-300" />
                <span className="text-blue-200 text-xs">
                  Saved: {conversationTitle.length > 20 ? conversationTitle.substring(0, 20) + '...' : conversationTitle}
                </span>
              </div>
            )}
            
            {/* Auto-save status */}
            {isSavingConversation && (
              <div className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 text-green-300 animate-spin" />
                <span className="text-green-300 text-xs">Auto-saving...</span>
              </div>
            )}
            
            {/* Streaming status */}
            {isStreaming && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300 text-xs">Streaming response...</span>
              </div>
            )}
            
            {streamingHasError && streamingError && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span className="text-red-300 text-xs">Stream error: {streamingError.type}</span>
                {streamingError.shouldFallback && (
                  <span className="text-yellow-300 text-xs">(using fallback)</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Streaming connection status */}
      {(isStreaming || streamingHasError) && (
        <div className="mt-1 text-xs text-white/60">
          Connection: <span className={`${
            connectionState === 'connected' ? 'text-green-300' :
            connectionState === 'connecting' ? 'text-yellow-300' :
            connectionState === 'error' ? 'text-red-300' :
            'text-gray-300'
          }`}>
            {connectionState}
          </span>
          <span className="ml-2">
            Mode: <span className="text-green-300">Live Streaming</span>
          </span>
        </div>
      )}
    </div>
  );
};