// 💬 Enhanced Chat Interface with Smart Model Filtering
// Main chat page with intelligent model selection and admin controls
// Manages conversation state, smart LLM filtering, and backend integration

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { chatService, SmartProcessedModelsData, UnifiedModelsResponse, UnifiedModelInfo } from '../services/chatService';
import { conversationService } from '../services/conversationService';
import { useAuth } from '../hooks/useAuth';
import { 
  ChatMessage, 
  LLMConfigurationSummary, 
  ChatServiceError,
  StreamingChatRequest,
  ChatResponse
} from '../types/chat';
import { 
  ConversationDetail,
  ConversationServiceError,
  DEFAULT_AUTO_SAVE_CONFIG,
  shouldAutoSave
} from '../types/conversation';
import { SmartFilterConfig } from '../utils/smartModelFilter';
import { useStreamingChat } from '../utils/streamingStateManager'; // 🌊 NEW: Streaming hook
import { 
  Settings, 
  Zap, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Home, 
  Filter,
  BarChart3,
  Lightbulb,

  Archive,  // 💾 Conversation archive icon
  Save,      // 💾 Save conversation icon
  ChevronLeft,  // 🎯 NEW: Navigation arrow for history
  ChevronRight, // 🎯 NEW: Navigation arrow for opening sidebar
  Menu         // 🎯 NEW: Menu/hamburger icon
} from 'lucide-react';

import { sortConfigsByModel, getCleanModelName, getShortProviderName } from '../utils/llmUtils';

export const ChatInterface: React.FC = () => {
  // 🧭 Navigation hook for routing
  const navigate = useNavigate();
  
  // 🔐 Authentication state
  const { user } = useAuth();
  
  // 💬 Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 💾 CONVERSATION SAVE/LOAD STATE
  const [showConversationSidebar, setShowConversationSidebar] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [lastAutoSaveMessageCount, setLastAutoSaveMessageCount] = useState(0);
  const [autoSaveFailedAt, setAutoSaveFailedAt] = useState<number | null>(null); // 🔧 Track auto-save failures
  
  // 🌊 STREAMING STATE: Always-on streaming functionality
  const {
    accumulatedContent,
    isStreaming,
    streamMessage,
    hasError: streamingHasError,
    error: streamingError,
    connectionState,
    stopStreaming
  } = useStreamingChat();
  
  // 🆕 UNIFIED MODELS STATE: Single model list approach (replaces provider + model)
  const [unifiedModelsData, setUnifiedModelsData] = useState<UnifiedModelsResponse | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null); // Derived from selected model
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  
  // 🚨 Error handling state
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // 🎮 Smart filtering controls
  const [showSmartControls, setShowSmartControls] = useState(false);
  const [smartFilterConfig, setSmartFilterConfig] = useState<SmartFilterConfig>({
    showAllModels: false,
    includeExperimental: false,
    includeLegacy: false,
    maxResults: 15,
    sortBy: 'relevance',
    userRole: user?.is_admin ? 'admin' : 'user'
  });
  
  // 🆕 Load unified models when component mounts or filter settings change
  useEffect(() => {
    loadUnifiedModels();
  }, [smartFilterConfig]);
  
  // Update selected config ID when model selection changes
  useEffect(() => {
    if (selectedModelId && unifiedModelsData) {
      const selectedModel = unifiedModelsData.models.find(m => m.id === selectedModelId);
      if (selectedModel && selectedModel.config_id !== selectedConfigId) {
        setSelectedConfigId(selectedModel.config_id);
        console.log('🎯 Config ID updated to:', selectedModel.config_id, 'for model:', selectedModelId);
      }
    }
  }, [selectedModelId, unifiedModelsData]);

  // Update user role when user changes
  useEffect(() => {
    setSmartFilterConfig(prev => ({
      ...prev,
      userRole: user?.is_admin ? 'admin' : 'user'
    }));
  }, [user?.is_admin]);
  
  // 🌊 REAL-TIME STREAMING UPDATE: Update messages as content streams in
  useEffect(() => {
    if (isStreaming && accumulatedContent && messages.length > 0) {
      // Update the last message (AI response) with accumulated streaming content
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { ...lastMessage, content: accumulatedContent }
        ]);
      }
    }
  }, [accumulatedContent, isStreaming, messages.length]);
  
  // 🆕 Fetch unified models from all providers
  const loadUnifiedModels = async () => {
    try {
      setModelsLoading(true);
      setError(null);
      setConnectionStatus('checking');
      
      console.log('🆕 Loading unified models from all providers...');
      
      const unifiedData = await chatService.getUnifiedModels(
        true, // Use cache
        smartFilterConfig.showAllModels, // Admin flag
        smartFilterConfig.userRole
      );
      
      if (unifiedData.total_models === 0) {
        setError('No AI models available. Please contact your administrator.');
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
        setError(`Failed to load AI models: ${error.message}`);
      } else {
        setError('Unable to connect to chat service. Please try again later.');
      }
      setConnectionStatus('error');
    } finally {
      setModelsLoading(false);
    }
  };
  

  // 📤 Handle sending a new message (Enhanced with streaming support and file attachments)
  const handleSendMessage = async (content: string, attachments?: import('../types/file').FileAttachment[]) => {
    if (!selectedConfigId) {
      setError('Please select an LLM provider first.');
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);
      


    

      // 🔍 DEBUG: Log attachments BEFORE processing
  console.log('🔍 DEBUG - Chat Message Attachments (RAW):', {
    attachmentsReceived: !!attachments,
    attachmentCount: attachments?.length || 0,
    attachments: attachments?.map(att => ({
      id: att.id,
      fileName: att.fileUpload.file.name,
      uploadedFileId: att.fileUpload.uploadedFileId,
      uploadedFileIdType: typeof att.fileUpload.uploadedFileId,
      status: att.fileUpload.status
    }))
  });

  // Extract file attachment IDs
    const fileAttachmentIds = attachments?.map(attachment => {
    const backendFileId = attachment.fileUpload.uploadedFileId;
    const parsedId = backendFileId ? parseInt(backendFileId, 10) : undefined;
    
    // 🔍 DEBUG: Log each file ID extraction
    console.log('🔍 DEBUG - File ID Extraction:', {
      fileName: attachment.fileUpload.file.name,
      rawUploadedFileId: backendFileId,
      rawType: typeof backendFileId,
      parsedId: parsedId,
      isValidNumber: !isNaN(parsedId || NaN),
      willBeIncluded: parsedId !== undefined && !isNaN(parsedId)
    });
    
    return parsedId;


    
  }).filter(id => id !== undefined && !isNaN(id)) as number[] | undefined;

  // 🔍 DEBUG: Log final file attachment IDs
  console.log('🔍 DEBUG - Final File Attachment IDs:', {
    originalAttachmentCount: attachments?.length || 0,
    finalIdCount: fileAttachmentIds?.length || 0,
    fileAttachmentIds: fileAttachmentIds,
    issue: (attachments?.length || 0) > 0 && (!fileAttachmentIds || fileAttachmentIds.length === 0) 
      ? 'FILE IDs NOT EXTRACTED - Check uploadedFileId assignment'
      : null
  });
      
      // 👤 Add user message to conversation immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: content
      };
      
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      
      console.log('📤 Sending message:', { 
        config_id: selectedConfigId, 
        content: content.substring(0, 50) + '...',
        model: selectedModelId,
        fileAttachments: fileAttachmentIds?.length || 0
      });
      
      // 🌊 STREAMING: Always use streaming mode with fallback
      console.log('🌊 Using streaming response...');
      
      // Add streaming placeholder for AI response
      const streamingPlaceholder: ChatMessage = {
        role: 'assistant',
        content: '' // Will be updated by streaming effect
      };
      setMessages([...updatedMessages, streamingPlaceholder]);
      
      const streamingRequest: StreamingChatRequest = {
        config_id: selectedConfigId,
        messages: updatedMessages,
        model: selectedModelId || undefined,
        // 📁 Include file attachments in streaming request
        file_attachment_ids: fileAttachmentIds
      };
      
      const streamingSuccess = await streamMessage(
        streamingRequest,
        (finalResponse: ChatResponse) => {
          console.log('✅ Streaming completed:', { 
            provider: finalResponse.provider,
            model: finalResponse.model,
            tokens: finalResponse.usage.total_tokens
          });
          
          // Replace placeholder with final response
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: finalResponse.content }
          ]);
          
          setIsLoading(false);
        }
      );
      
      if (streamingSuccess) {
        console.log('🌊 Streaming initiated successfully');
        return; // Exit early - completion handler will finish
      } else {
        console.log('⚠️ Streaming failed, falling back to regular chat');
        // Remove the placeholder and continue with regular chat
        setMessages(updatedMessages);
        await sendRegularMessage(updatedMessages, fileAttachmentIds);
      }
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      let errorMessage = 'Failed to send message. Please try again.';
      
      if (error instanceof ChatServiceError) {
        switch (error.errorType) {
          case 'QUOTA_EXCEEDED':
            errorMessage = 'Usage quota exceeded. Please contact your administrator.';
            break;
          case 'PROVIDER_ERROR':
            errorMessage = 'AI provider is currently unavailable. Please try a different provider.';
            break;
          case 'UNAUTHORIZED':
            errorMessage = 'Your session has expired. Please log in again.';
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };
  
  // 🔄 REGULAR MESSAGE HELPER: Extracted regular chat logic (FIXED: Added fileAttachmentIds parameter)
  const sendRegularMessage = async (updatedMessages: ChatMessage[], fileAttachmentIds?: number[]) => {
    try {
      // 🤖 Send to LLM service with selected model
      const response = await chatService.sendMessage({
        config_id: selectedConfigId!,
        messages: updatedMessages,
        model: selectedModelId || undefined,
        // 📁 Include file attachments in regular request
        file_attachment_ids: fileAttachmentIds
      });
      
      // 🤖 Add AI response to conversation
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response.content
      };
      
      setMessages([...updatedMessages, aiMessage]);
      
      console.log('✅ Received AI response:', { 
        provider: response.provider,
        model: response.model,
        tokens: response.usage.total_tokens
      });
      
    } finally {
      setIsLoading(false);
    }
  };
  
  // 🆕 Handle unified model selection change (with integrated toggle support)
  const handleModelChange = (modelId: string) => {
    // 🎯 Special case: Handle the toggle filter option
    if (modelId === '__toggle_filter__') {
      // Toggle the filter and keep the current model selected
      handleFilterConfigChange({ showAllModels: !smartFilterConfig.showAllModels });
      console.log('🔄 Toggled model filter from dropdown:', !smartFilterConfig.showAllModels ? 'show all' : 'filter');
      return;
    }
    
    // Regular model selection
    const selectedModel = unifiedModelsData?.models.find(m => m.id === modelId);
    if (selectedModel) {
      setSelectedModelId(modelId);
      setSelectedConfigId(selectedModel.config_id);
      setError(null);
      console.log('🎯 Switched to model:', modelId, 'from', selectedModel.provider, '(config:', selectedModel.config_id, ')');
    }
  };

  // 🎮 Handle smart filter configuration changes
  const handleFilterConfigChange = (updates: Partial<SmartFilterConfig>) => {
    setSmartFilterConfig(prev => ({ ...prev, ...updates }));
    console.log('🎮 Updated filter config:', updates);
  };
  
  // 🛑 NEW: Enhanced cancel handler that resets all states
  // 📝 LEARNING: This fixes the "loading spinner stuck" bug!
  // When streaming is canceled, we need to reset BOTH streaming AND loading states
  const handleCancelStreaming = () => {
    console.log('🛑 User canceled streaming response - resetting all states');
    
    // 1. Stop the streaming first
    stopStreaming();
    
    // 2. CRITICAL: Reset loading state so button returns to Send
    // Without this, the loading spinner stays visible forever!
    setIsLoading(false);
    
    // 3. Optional: Clear any errors that might have occurred
    setError(null);
  };
  
  // 🆕 Start a new conversation
  const handleNewConversation = () => {
    setMessages([]);
    setError(null);
    setCurrentConversationId(null);
    setConversationTitle(null);
    setLastAutoSaveMessageCount(0);
    setAutoSaveFailedAt(null); // 🔧 Reset auto-save failure tracking
    console.log('🆕 Started new conversation');
  };
  
  // 💾 AUTO-SAVE LOGIC: Check if we should auto-save after new messages
  useEffect(() => {
    const shouldTriggerAutoSave = shouldAutoSave(
      messages,
      DEFAULT_AUTO_SAVE_CONFIG.triggerAfterMessages
    );
    
    // Only auto-save if:
    // 1. We have enough messages
    // 2. We haven't saved this conversation yet
    // 3. Message count increased since last save
    // 4. Not currently saving
    // 5. 🔧 NEW: Auto-save didn't fail at this message count
    if (
      shouldTriggerAutoSave && 
      !currentConversationId && 
      messages.length > lastAutoSaveMessageCount &&
      !isSavingConversation &&
      autoSaveFailedAt !== messages.length // 🔧 Prevent retry if save failed at this count
    ) {
      handleAutoSaveConversation();
    }
  }, [messages.length, currentConversationId, lastAutoSaveMessageCount, isSavingConversation, autoSaveFailedAt]);
  
  // 💾 Auto-save current conversation
  const handleAutoSaveConversation = async () => {
    if (messages.length < DEFAULT_AUTO_SAVE_CONFIG.triggerAfterMessages) {
      return;
    }
    
    try {
      setIsSavingConversation(true);
      console.log('💾 Auto-saving conversation with', messages.length, 'messages');
      
      const savedConversation = await conversationService.saveCurrentChat(
        messages,
        undefined, // Auto-generate title
        selectedConfigId || undefined,
        selectedModelId || undefined
      );
      
      setCurrentConversationId(savedConversation.id);
      setConversationTitle(savedConversation.title);
      setLastAutoSaveMessageCount(messages.length);
      setAutoSaveFailedAt(null); // 🔧 Clear failure tracking on success
      
      console.log('✅ Conversation auto-saved:', savedConversation.id);
      
    } catch (error) {
      console.error('❌ Failed to auto-save conversation:', error);
      setAutoSaveFailedAt(messages.length); // 🔧 Track failure at this message count
      // Don't show error to user for auto-save failures, but log for debugging
      console.warn('🚫 Auto-save blocked for message count:', messages.length);
    } finally {
      setIsSavingConversation(false);
    }
  };
  
  // 💾 Manually save current conversation
  const handleSaveConversation = async () => {
    if (messages.length === 0) {
      setError('No messages to save');
      return;
    }
    
    try {
      setIsSavingConversation(true);
      console.log('💾 Manually saving conversation');
      
      if (currentConversationId) {
        // Add new messages to existing conversation
        // For now, we'll just show success since the conversation is already saved
        console.log('✅ Conversation already saved:', currentConversationId);
      } else {
        // Save as new conversation
        const savedConversation = await conversationService.saveCurrentChat(
          messages,
          undefined, // Auto-generate title
          selectedConfigId || undefined,
          selectedModelId || undefined
        );
        
        setCurrentConversationId(savedConversation.id);
        setConversationTitle(savedConversation.title);
        setLastAutoSaveMessageCount(messages.length);
        setAutoSaveFailedAt(null); // 🔧 Clear failure tracking on successful manual save
        
        console.log('✅ Conversation saved:', savedConversation.id);
      }
      
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
      setError(
        error instanceof ConversationServiceError 
          ? error.message 
          : 'Failed to save conversation'
      );
    } finally {
      setIsSavingConversation(false);
    }
  };
  
  // 📖 Load a conversation from sidebar
  const handleLoadConversation = async (conversationId: number) => {
    try {
      console.log('📖 Loading conversation:', conversationId);
      
      const chatMessages = await conversationService.loadConversationAsChat(conversationId);
      
      setMessages(chatMessages);
      setCurrentConversationId(conversationId);
      setLastAutoSaveMessageCount(chatMessages.length);
      setAutoSaveFailedAt(null); // 🔧 Reset auto-save tracking when loading conversation
      setError(null);
      
      // Close sidebar on mobile
      if (window.innerWidth < 1024) {
        setShowConversationSidebar(false);
      }
      
      console.log('✅ Conversation loaded:', chatMessages.length, 'messages');
      
    } catch (error) {
      console.error('❌ Failed to load conversation:', error);
      setError(
        error instanceof ConversationServiceError 
          ? error.message 
          : 'Failed to load conversation'
      );
    }
  };
  
  // 🏠 Navigate back to dashboard
  const handleBackToDashboard = () => {
    console.log('🏠 Navigating back to dashboard');
    navigate('/');
  };
  
  // 🆕 Get current model and config information from unified data
  const currentModelInfo = useMemo(() => {
    if (!unifiedModelsData || !selectedModelId) return null;
    return unifiedModelsData.models.find(m => m.id === selectedModelId);
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
    
    // Group models by provider
    const providerGroups: { [provider: string]: UnifiedModelInfo[] } = {};
    
    unifiedModelsData.models.forEach(model => {
      if (!providerGroups[model.provider]) {
        providerGroups[model.provider] = [];
      }
      providerGroups[model.provider].push(model);
    });
    
    // Sort models within each provider by relevance and recommendation
    Object.keys(providerGroups).forEach(provider => {
      providerGroups[provider].sort((a, b) => {
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
  }, [unifiedModelsData]);
  
  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600 overflow-hidden">
      {/* 🎯 LEFT-SIDE SIDEBAR TOGGLE: ChatGPT-style navigation with responsive positioning */}
      <button
        onClick={() => setShowConversationSidebar(!showConversationSidebar)}
        className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ${
          showConversationSidebar 
            ? 'left-2 lg:left-[420px]'  // Mobile: stay at edge (overlay), Desktop: position outside sidebar
            : 'left-2'                  // Always at screen edge when closed
        } bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full p-3 shadow-lg hover:shadow-xl group hover:scale-105 transform`}
        title={showConversationSidebar ? 'Hide conversation history' : 'Show conversation history'}
      >
        {showConversationSidebar ? (
          <ChevronLeft className="w-4 h-4 text-white group-hover:text-blue-100 transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white group-hover:text-blue-100 transition-colors" />
        )}
      </button>
      
      {/* 💾 CONVERSATION SIDEBAR */}
      <ConversationSidebar
        isOpen={showConversationSidebar}
        onClose={() => setShowConversationSidebar(false)}
        onSelectConversation={handleLoadConversation}
        onCreateNew={handleNewConversation}
        currentConversationId={currentConversationId || undefined}
      />
      
      {/* Main chat interface */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* 🎛️ Header with smart LLM selection and controls */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 px-3 md:px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 md:space-x-4">
            <h1 className="text-lg md:text-xl font-semibold text-white">
              AI Chat
            </h1>
            
            {/* 📊 Connection status indicator */}
            <div className="flex items-center space-x-2">
              {connectionStatus === 'checking' && (
                <div className="flex items-center text-blue-200 text-xs md:text-sm">
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin mr-1" />
                  <span className="hidden sm:inline">Connecting...</span>
                  <span className="sm:hidden">...</span>
                </div>
              )}
              {connectionStatus === 'connected' && (
                <div className="flex items-center text-green-300 text-xs md:text-sm">
                  <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                  <span className="hidden sm:inline">Connected</span>
                  <span className="sm:hidden">✓</span>
                </div>
              )}
              {connectionStatus === 'error' && (
                <div className="flex items-center text-red-300 text-xs md:text-sm">
                  <AlertCircle className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                  <span className="hidden sm:inline">Connection Error</span>
                  <span className="sm:hidden">Error</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* 🆕 UNIFIED MODEL SELECTION: Single dropdown with integrated show all toggle */}
            {!modelsLoading && unifiedModelsData && unifiedModelsData.models.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                <label className="text-xs md:text-sm font-medium text-white whitespace-nowrap">
                  AI Model:
                </label>
                
                <div className="relative min-w-0">
                  {/* Model Selection Dropdown */}
                  <select
                    value={selectedModelId || ''}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="px-2 md:px-3 py-1.5 md:py-1 bg-white/90 backdrop-blur-sm border border-white/30 rounded-md text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white min-w-0 max-w-[280px] md:max-w-none pr-8"
                    title={currentModelInfo ? `${currentModelInfo.provider} • ${currentModelInfo.cost_tier} cost • Score: ${currentModelInfo.relevance_score || 'N/A'}/100` : ''}
                  >
                    {/* 🎯 SHOW ALL TOGGLE OPTION - Now inside the dropdown! */}
                    <optgroup label="📋 Model View Options">
                      <option value="__toggle_filter__" className="font-medium text-blue-600 bg-blue-50">
                        {smartFilterConfig.showAllModels 
                          ? `🔍 Switch to Filtered View (${unifiedModelsData.original_total_models ? unifiedModelsData.original_total_models - unifiedModelsData.total_models : 'fewer'} models hidden)`
                          : `👁️ Show All Models (${unifiedModelsData.original_total_models ? unifiedModelsData.original_total_models - unifiedModelsData.total_models : 'more'} additional models)`
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
                      smartFilterConfig.showAllModels
                        ? 'bg-orange-400'  // Orange for "show all"
                        : 'bg-blue-400'    // Blue for "filtered"
                    }`} title={smartFilterConfig.showAllModels ? 'All models shown' : 'Filtered models shown'}></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* 📎 Loading state for models */}
            {modelsLoading && (
              <div className="flex items-center px-2 md:px-3 py-1.5 md:py-1 bg-white/90 backdrop-blur-sm border border-white/30 rounded-md text-xs md:text-sm text-gray-500 min-w-0">
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                <span>Loading models...</span>
              </div>
            )}
            
            {/* 😨 Error state for models */}
            {modelsError && (
              <div className="flex items-center px-2 md:px-3 py-1.5 md:py-1 bg-red-100 border border-red-300 rounded-md text-xs md:text-sm text-red-700 min-w-0">
                <AlertCircle className="w-3 h-3 mr-1" />
                <span>Failed to load</span>
              </div>
            )}

            {/* 🎮 Advanced Controls Button (Admin Only) - Now for advanced options only */}
            {user?.is_admin && unifiedModelsData && (
              <button
                onClick={() => setShowSmartControls(!showSmartControls)}
                className="px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 rounded-md transition-all duration-200 flex items-center backdrop-blur-sm touch-manipulation"
                title="Advanced Filter Controls"
              >
                <Settings className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                <span className="hidden md:inline ml-1">Advanced</span>
              </button>
            )}
            

            
            {/* 💾 Save Conversation button */}
            {messages.length > 0 && !currentConversationId && (
              <button
                onClick={handleSaveConversation}
                disabled={isSavingConversation}
                className="px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm bg-green-500/20 hover:bg-green-500/30 text-green-100 rounded-md transition-all duration-200 flex items-center backdrop-blur-sm touch-manipulation disabled:opacity-50"
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
              className="px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm bg-white/20 hover:bg-white/30 text-white rounded-md transition-all duration-200 flex items-center backdrop-blur-sm touch-manipulation"
              title="Back to Dashboard"
            >
              <Home className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
              <span className="hidden md:inline ml-1">Dashboard</span>
            </button>
            
            {/* 🆕 New conversation button */}
            <button
              onClick={handleNewConversation}
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
              <div className="flex items-center">
                <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1 text-yellow-300 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  Using <strong className="text-white">{currentModelInfo.displayName}</strong>
                </span>
              </div>
              <div className="flex items-center">
                <span className="whitespace-nowrap">
                  via <strong className="text-blue-200">{getShortProviderName(selectedConfig.provider_name)}</strong>
                </span>
              </div>
              
              {/* 🧠 Smart model details */}
              <div className="flex items-center gap-1">
                <span className="text-green-300 text-xs" title={`Relevance Score: ${currentModelInfo.relevance_score || 'N/A'}/100`}>
                  🧠 {currentModelInfo.relevance_score || 'N/A'}/100
                </span>
                {currentModelInfo.is_recommended && (
                  <span className="text-yellow-300 text-xs" title="Recommended model">
                    ⭐
                  </span>
                )}
                <span className={`text-xs px-1 rounded ${
                  currentModelInfo.cost_tier === 'high' ? 'bg-red-500/20 text-red-200' :
                  currentModelInfo.cost_tier === 'medium' ? 'bg-yellow-500/20 text-yellow-200' :
                  'bg-green-500/20 text-green-200'
                }`} title="Cost tier">
                  {currentModelInfo.cost_tier}
                </span>
              </div>
              
              {/* 🎯 Enhanced filtering status with clear indicators */}
              {unifiedModelsData && (
                <div className="flex items-center gap-1">
                  {/* Model count with filtering indicator */}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    smartFilterConfig.showAllModels 
                      ? 'bg-orange-500/20 text-orange-200'
                      : 'bg-blue-500/20 text-blue-200'
                  }`} title={
                    smartFilterConfig.showAllModels
                      ? `All models shown: ${unifiedModelsData.total_models} models from ${unifiedModelsData.providers.length} providers`
                      : `Smart filtered: ${unifiedModelsData.total_models} recommended models${unifiedModelsData.original_total_models ? ` of ${unifiedModelsData.original_total_models} total` : ''}`
                  }>
                    {smartFilterConfig.showAllModels ? '🔍' : '✨'} {unifiedModelsData.total_models}{unifiedModelsData.original_total_models ? `/${unifiedModelsData.original_total_models}` : ''}
                  </span>
                  
                  {/* Filtering mode indicator */}
                  <span className={`text-xs ${
                    smartFilterConfig.showAllModels 
                      ? 'text-orange-300'
                      : 'text-green-300'
                  }`} title={
                    smartFilterConfig.showAllModels
                      ? 'All models mode - showing experimental, legacy, and deprecated models'
                      : 'Smart filter mode - showing recommended and relevant models only'
                  }>
                    {smartFilterConfig.showAllModels ? 'Complete' : 'Filtered'}
                  </span>
                  
                  {/* Cache status */}
                  {unifiedModelsData.cached ? (
                    <span className="text-green-300 text-xs" title="Models loaded from cache">
                      📋 Cached
                    </span>
                  ) : (
                    <span className="text-blue-300 text-xs" title="Models fetched live from API">
                      🔥 Live
                    </span>
                  )}
                </div>
              )}
              
              {/* Model capabilities */}
              {currentModelInfo.capabilities && currentModelInfo.capabilities.length > 0 && (
                <span className="text-blue-200 text-xs">
                  • {currentModelInfo.capabilities.slice(0, 2).join(', ')}
                </span>
              )}
              
              {/* 💾 CONVERSATION STATUS: Show current conversation info */}
              {currentConversationId && conversationTitle && (
                <div className="flex items-center gap-1">
                  <Archive className="w-3 h-3 text-blue-300" />
                  <span className="text-blue-200 text-xs">
                    Saved: {conversationTitle.length > 20 ? conversationTitle.substring(0, 20) + '...' : conversationTitle}
                  </span>
                </div>
              )}
              
              {/* 💾 AUTO-SAVE STATUS: Show when auto-saving */}
              {isSavingConversation && (
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 text-green-300 animate-spin" />
                  <span className="text-green-300 text-xs">Auto-saving...</span>
                </div>
              )}
              
              {/* 🌊 STREAMING STATUS: Show streaming state */}
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
        
        {/* 🌊 STREAMING CONNECTION STATUS: Additional debug info for development */}
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

        {/* 🎮 Smart Filter Controls Panel (Admin Only) */}
        {user?.is_admin && showSmartControls && unifiedModelsData && (
          <div className="mt-3 p-3 bg-black/20 backdrop-blur-sm border border-white/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-white flex items-center">
                <Settings className="w-4 h-4 mr-1" />
                Advanced Filter Controls
              </h4>
              <button
                onClick={() => setShowSmartControls(false)}
                className="text-white/60 hover:text-white text-lg"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Advanced Filter Options */}
              <div className="space-y-2">
                <div className="text-white font-medium mb-1">Advanced Options:</div>
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={smartFilterConfig.includeExperimental}
                    onChange={(e) => handleFilterConfigChange({ includeExperimental: e.target.checked })}
                    className="mr-2"
                  />
                  Include experimental
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={smartFilterConfig.includeLegacy}
                    onChange={(e) => handleFilterConfigChange({ includeLegacy: e.target.checked })}
                    className="mr-2"
                  />
                  Include legacy models
                </label>
                <div className="text-white/60 text-xs mt-1">
                  💡 Use "{smartFilterConfig.showAllModels ? 'Filter' : 'All Models'}" button above for basic filtering
                </div>
              </div>
              
              {/* Sort & Limit Options */}
              <div className="space-y-2">
                <div className="text-white font-medium mb-1">Sort & Limits:</div>
                <label className="text-white block">
                  Sort by:
                  <select
                    value={smartFilterConfig.sortBy}
                    onChange={(e) => handleFilterConfigChange({ sortBy: e.target.value as any })}
                    className="ml-2 px-2 py-1 bg-white/90 text-gray-700 rounded text-xs"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="name">Name</option>
                    <option value="cost">Cost</option>
                  </select>
                </label>
                <label className="text-white block">
                  Max results:
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={smartFilterConfig.maxResults}
                    onChange={(e) => handleFilterConfigChange({ maxResults: parseInt(e.target.value) || 20 })}
                    className="ml-2 px-2 py-1 bg-white/90 text-gray-700 rounded text-xs w-16"
                  />
                </label>
                <div className="text-white/60 text-xs mt-1">
                  Current: {smartFilterConfig.showAllModels ? 'All' : 'Filtered'} mode
                </div>
              </div>
              
              {/* Debug Info */}
              <div className="space-y-1 text-white">
                <div className="font-medium mb-1">System Debug:</div>
                <div>Total Models: {unifiedModelsData.total_models}</div>
                <div>Total Configs: {unifiedModelsData.total_configs}</div>
                <div>Providers: {unifiedModelsData.providers.join(', ')}</div>
                {unifiedModelsData.original_total_models && (
                  <div>Excluded: {unifiedModelsData.original_total_models - unifiedModelsData.total_models} models</div>
                )}
                <div className="text-white/60 text-xs mt-2">
                  Status: {smartFilterConfig.showAllModels ? '🔍 Complete View' : '✨ Smart Filtered'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 🚨 Error display with glassmorphism */}
      {error && (
        <div className="bg-red-500/20 backdrop-blur-sm border-l-4 border-red-300 p-3 md:p-4 mx-3 md:mx-4 mt-4 rounded-lg">
          <div className="flex items-start md:items-center gap-2">
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-200 flex-shrink-0 mt-0.5 md:mt-0" />
            <p className="text-red-100 text-xs md:text-sm flex-1 leading-relaxed">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-200 hover:text-red-100 text-lg md:text-xl font-bold flex-shrink-0 touch-manipulation p-1"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* 📋 Loading state for models */}
      {modelsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-white" />
          <span className="text-white">Loading AI models...</span>
        </div>
      )}
      
      {/* 💬 Main chat area */}
      {!modelsLoading && unifiedModelsData && unifiedModelsData.models.length > 0 && (
        <>
          {/* 📜 Message list with Smart Auto-Scroll */}
          <MessageList 
            messages={messages}
            isLoading={isLoading}
            isStreaming={isStreaming}
            className="flex-1"
          />
          {/* End Message List */}
          
          {/* ✍️ Message input with streaming cancel support */}
          <MessageInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isStreaming={isStreaming}          // NEW: Pass streaming state
            onCancel={handleCancelStreaming}   // NEW: Pass ENHANCED cancel handler
            disabled={!selectedConfigId || connectionStatus === 'error' || modelsLoading}
            placeholder={
              !selectedConfigId 
                ? "Select an AI model to start chatting..."
                : modelsLoading
                ? "Loading AI models..."
                : modelsError
                ? "Model loading failed - using default model"
                : currentModelInfo
                ? `Chatting with ${currentModelInfo.display_name} - streaming enabled...`
                : "Type your message here..."
            }
          />
        </>
      )}
      
      {/* 🚫 No models available */}
      {!modelsLoading && (!unifiedModelsData || unifiedModelsData.models.length === 0) && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center max-w-md bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <Settings className="w-12 h-12 text-white/60 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              No AI Models Available
            </h3>
            <p className="text-blue-100 text-sm mb-4">
              No AI models are currently available for your account. 
              Please contact your administrator to set up AI providers.
            </p>
            <button
              onClick={loadUnifiedModels}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-md transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// 🎯 Enhanced Chat Interface Features:
//
// 1. **Smart Model Filtering**: 
//    - Automatically filters out deprecated/irrelevant models
//    - Intelligent categorization (flagship, efficient, specialized)
//    - Relevance scoring display in UI
//
// 2. **Admin Controls**: 
//    - Smart filter controls panel for admins
//    - Debug information and statistics
//    - Override options for power users
//
// 3. **Enhanced UX**: 
//    - Grouped dropdown with model categories
//    - Model information in tooltips and status bar
//    - Visual indicators for cost tier and recommendations
//
// 4. **Performance Optimized**:
//    - Uses useMemo for expensive calculations
//    - Smart caching with visual indicators
//    - Efficient re-rendering patterns
//
// 5. **Educational Elements**:
//    - Clear relevance scoring
//    - Model capability indicators
//    - Filter statistics and debug info
//
// This enhanced interface demonstrates advanced React patterns:
// - Complex state management
// - Performance optimization
// - Role-based UI rendering
// - Real-time data processing
// - Professional admin tools
