// 💬 Main Chat Interface Container (Refactored)
// Orchestrates all chat functionality using modular hooks and components
// Replaces the large ChatInterface.tsx with clean, maintainable architecture

import React, { useEffect, useCallback } from 'react';
import { Settings, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MessageList } from '../MessageList';
import { MessageInput } from '../MessageInput';
import { ConversationSidebar } from '../ConversationSidebar';
import { EmbeddedAssistantManager } from '../EmbeddedAssistantManager';
import { AssistantSelectorCard } from '../AssistantSelectorCard';
import { AssistantSuggestions } from '../AssistantSuggestions';
import { ChatHeader } from './ChatHeader';
import { ErrorDisplay } from './ErrorDisplay';
import { useChatState } from '../../../hooks/chat/useChatState';
import { useModelSelection } from '../../../hooks/chat/useModelSelection';
import { useAssistantManager } from '../../../hooks/chat/useAssistantManager';
import { useConversationManager } from '../../../hooks/chat/useConversationManager';
import { useResponsiveLayout } from '../../../hooks/chat/useResponsiveLayout';
import { useAuth } from '../../../hooks/useAuth';
import { DEFAULT_AUTO_SAVE_CONFIG, shouldAutoSave } from '../../../types/conversation';
import type { FileAttachment } from '../../../types/file';

export const ChatContainer: React.FC = () => {
  const { user } = useAuth();
  
  // 📱 Responsive layout state
  const { isMobile } = useResponsiveLayout();
  
  // 🎯 Model selection management
  const {
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
    handleModelChange,
    setError: setModelError
  } = useModelSelection();
  
  // 🤖 Assistant management
  const {
    availableAssistants,
    selectedAssistantId,
    selectedAssistant,
    assistantsLoading,
    assistantsError,
    showAssistantManager,
    handleAssistantSelect,
    handleAssistantChange,
    setShowAssistantManager,
    clearAssistantFromUrl
  } = useAssistantManager((message) => {
    // Handle assistant messages
    addMessage(message);
  });
  
  // 💾 Conversation management
  const {
    currentConversationId,
    conversationTitle,
    isSavingConversation,
    lastAutoSaveMessageCount,
    autoSaveFailedAt,
    showConversationSidebar,
    conversationRefreshTrigger,
    sidebarUpdateFunction,
    sidebarAddConversationFunction,
    handleAutoSaveConversation,
    handleSaveConversation,
    handleLoadConversation,
    handleNewConversation,
    setShowConversationSidebar,
    setSidebarFunctions,
    handleAddConversationToSidebar
  } = useConversationManager(
    (error) => setError(error), // onError
    (messages) => {
      // onConversationLoad
      setMessages(messages);
      setError(null);
      clearAssistantFromUrl();
    },
    () => {
      // onConversationClear
      clearChat();
      clearAssistantFromUrl();
    }
  );
  
  // 💬 Chat state management
  const {
    messages,
    isLoading,
    error,
    isStreaming,
    accumulatedContent,
    streamingHasError,
    streamingError,
    connectionState,
    sendMessage,
    clearChat,
    addMessage,
    updateLastMessage,
    setError,
    handleCancelStreaming
  } = useChatState({
    selectedConfigId,
    selectedModelId,
    selectedAssistantId,
    selectedAssistant,
    currentConversationId
  });
  
  // Helper to set messages (needed for conversation loading)
  const setMessages = useCallback((newMessages: any[]) => {
    clearChat();
    newMessages.forEach(message => addMessage(message));
  }, [clearChat, addMessage]);
  
  // ⚡ Update messages as content streams in
  useEffect(() => {
    if (isStreaming && accumulatedContent && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        updateLastMessage(accumulatedContent);
      }
    }
  }, [accumulatedContent, isStreaming, messages.length, updateLastMessage]);
  
  // 💾 Auto-save logic
  useEffect(() => {
    const shouldTriggerAutoSave = shouldAutoSave(
      messages,
      DEFAULT_AUTO_SAVE_CONFIG.triggerAfterMessages
    );
    
    if (
      shouldTriggerAutoSave && 
      !currentConversationId && 
      messages.length > lastAutoSaveMessageCount &&
      !isSavingConversation &&
      autoSaveFailedAt !== messages.length
    ) {
      handleAutoSaveConversation(messages, { selectedConfigId, selectedModelId });
    }
  }, [
    messages, 
    currentConversationId, 
    lastAutoSaveMessageCount, 
    isSavingConversation, 
    autoSaveFailedAt,
    handleAutoSaveConversation,
    selectedConfigId,
    selectedModelId
  ]);
  
  // 🔄 Update sidebar message count
  useEffect(() => {
    if (currentConversationId && sidebarUpdateFunction && messages.length > 0) {
      sidebarUpdateFunction(currentConversationId, messages.length);
    }
  }, [messages.length, currentConversationId, sidebarUpdateFunction]);
  
  // 📤 Handle sending messages
  const handleSendMessage = useCallback(async (content: string, attachments?: FileAttachment[]) => {
    await sendMessage(content, attachments);
  }, [sendMessage]);
  
  // 💾 Handle saving conversation
  const handleSaveCurrentConversation = useCallback(async () => {
    await handleSaveConversation(messages, { selectedConfigId, selectedModelId });
  }, [handleSaveConversation, messages, selectedConfigId, selectedModelId]);
  
  // 📖 Handle loading conversation
  const handleLoadSelectedConversation = useCallback(async (conversationId: number) => {
    const loadedMessages = await handleLoadConversation(conversationId);
    // Messages are set via the conversation manager callback
  }, [handleLoadConversation]);
  
  // 🤖 Handle assistant manager changes
  const handleAssistantManagerChange = useCallback(() => {
    // This will be called when assistants are created/edited/deleted
    console.log('🔄 Assistant list updated from embedded manager');
  }, []);
  
  // 🎯 Handle change assistant button click
  const handleChangeAssistantClick = useCallback(() => {
    setShowAssistantManager(true);
    console.log('🎯 Opening assistant manager from selector card');
  }, [setShowAssistantManager]);
  
  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600 overflow-hidden">
      {/* 🎯 Sidebar Toggle Button */}
      <button
        onClick={() => setShowConversationSidebar(!showConversationSidebar)}
        className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ${
          showConversationSidebar 
            ? 'left-2 lg:left-[420px]'
            : 'left-2'
        } bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full p-3 shadow-lg hover:shadow-xl group hover:scale-105 transform`}
        title={showConversationSidebar ? 'Hide conversation history' : 'Show conversation history'}
      >
        {showConversationSidebar ? (
          <ChevronLeft className="w-4 h-4 text-white group-hover:text-blue-100 transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white group-hover:text-blue-100 transition-colors" />
        )}
      </button>
      
      {/* 💾 Conversation Sidebar */}
      <ConversationSidebar
        isOpen={showConversationSidebar}
        onClose={() => setShowConversationSidebar(false)}
        onSelectConversation={handleLoadSelectedConversation}
        onCreateNew={handleNewConversation}
        currentConversationId={currentConversationId || undefined}
        onConversationUpdate={() => {}}
        refreshTrigger={conversationRefreshTrigger}
        onSidebarReady={(updateFn, addFn) => {
          setSidebarFunctions(updateFn, addFn);
        }}
      />
      
      {/* 🤖 Assistant Manager */}
      {showAssistantManager && (
        <div className={`fixed z-40 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-600 shadow-xl transform transition-all duration-300 ease-in-out ${
          isMobile 
            ? `inset-x-0 bottom-0 h-96 rounded-t-xl ${
                showAssistantManager ? 'translate-y-0' : 'translate-y-full'
              }`
            : `inset-y-0 right-0 w-96 ${
                showAssistantManager ? 'translate-x-0' : 'translate-x-full'
              }`
        }`}>
          <div className="h-full overflow-y-auto">
            {isMobile && (
              <div className="flex justify-center py-3 bg-white/10">
                <div className="w-12 h-1 bg-white/30 rounded-full"></div>
              </div>
            )}
            
            <EmbeddedAssistantManager
              selectedAssistantId={selectedAssistantId}
              onAssistantSelect={handleAssistantSelect}
              onAssistantChange={handleAssistantManagerChange}
              className="h-full border-0 rounded-none bg-transparent"
            />
          </div>
        </div>
      )}
      
      {/* 🎭 Backdrop */}
      {showAssistantManager && (
        <div 
          className={`fixed inset-0 z-30 transition-opacity duration-300 ${
            isMobile ? 'bg-black/60' : 'bg-black/50'
          }`}
          onClick={() => setShowAssistantManager(false)}
        />
      )}
      
      {/* Main chat interface */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 🎛️ Header */}
        <ChatHeader
          unifiedModelsData={unifiedModelsData}
          selectedModelId={selectedModelId}
          currentModelInfo={currentModelInfo}
          showAllModels={showAllModels}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          connectionStatus={connectionStatus}
          groupedModels={groupedModels}
          onModelChange={handleModelChange}
          selectedAssistant={selectedAssistant}
          messages={messages}
          currentConversationId={currentConversationId}
          conversationTitle={conversationTitle}
          isSavingConversation={isSavingConversation}
          onSaveConversation={handleSaveCurrentConversation}
          onNewConversation={handleNewConversation}
          isStreaming={isStreaming}
          streamingHasError={streamingHasError}
          streamingError={streamingError}
          connectionState={connectionState}
          isMobile={isMobile}
        />
        
        {/* 🚨 Error Display */}
        <ErrorDisplay
          error={error}
          onDismissError={() => setError(null)}
          streamingHasError={streamingHasError}
          streamingError={streamingError}
          onDismissStreamingError={() => {
            console.log('🧹 User dismissed streaming error');
          }}
          onContactAdmin={() => {
            window.open('mailto:admin@company.com?subject=AI%20Usage%20Quota%20Exceeded', '_blank');
          }}
        />
        
        {/* 📋 Loading state for models */}
        {modelsLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2 text-white" />
            <span className="text-white">Loading AI models...</span>
          </div>
        )}
        
        {/* 💬 Chat content */}
        {!modelsLoading && unifiedModelsData && unifiedModelsData.models.length > 0 && (
          <>
            {/* 🤖 Assistant suggestions */}
            {!selectedAssistantId && messages.length === 0 && availableAssistants.length > 0 && (
              <AssistantSuggestions
                suggestions={availableAssistants}
                onSelect={handleAssistantSelect}
                onDismiss={() => console.log('✨ Assistant suggestions dismissed by user')}
                maxSuggestions={4}
                showOnlyOnce={true}
              />
            )}
            
            {/* 📜 Message list */}
            <MessageList 
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              className="flex-1"
            />
            
            {/* 🤖 Assistant selector */}
            <AssistantSelectorCard
              selectedAssistant={selectedAssistant}
              onChangeClick={handleChangeAssistantClick}
            />
            
            {/* ✍️ Message input */}
            <MessageInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isStreaming={isStreaming}
              onCancel={handleCancelStreaming}
              disabled={!selectedConfigId || connectionStatus === 'error' || modelsLoading}
              placeholder={
                !selectedConfigId 
                  ? "Select an AI model to start chatting..."
                  : modelsLoading
                  ? "Loading AI models..."
                  : modelsError
                  ? "Model loading failed - using default model"
                  : selectedAssistant && currentModelInfo
                  ? `Chatting with ${selectedAssistant.name} via ${currentModelInfo.display_name}...`
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
                onClick={() => window.location.reload()}
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