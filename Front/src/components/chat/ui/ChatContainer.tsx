// 💬 Main Chat Interface Container (Refactored)
// Orchestrates all chat functionality using modular hooks and components
// Replaces the large ChatInterface.tsx with clean, maintainable architecture

import React, { useEffect, useCallback, useState } from 'react';
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
import { useProjectManager } from '../../../hooks/chat/useProjectManager';
import { ProjectSelectorCard } from './ProjectSelectorCard';
import { ProjectManager } from '../ProjectManager';
import { DEFAULT_AUTO_SAVE_CONFIG, shouldAutoSave } from '../../../types/conversation';
import type { FileAttachment } from '../../../types/file';
import { projectService } from '../../../services/projectService';

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
  
  // 📂 Project management
  const {
    availableProjects,
    selectedProjectId,
    selectedProject,
    projectsLoading,
    projectsError,
    showProjectManager,
    handleProjectSelect,
    handleProjectChange,
    handleProjectIntroduction,
    setShowProjectManager,
    clearProjectFromUrl,
    loadAvailableProjects
  } = useProjectManager((message) => {
    // Handle project messages
    addMessage(message);
  });

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
    handleAssistantIntroduction,
    setShowAssistantManager,
    clearAssistantFromUrl,
    loadAvailableAssistants
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
    selectedProjectId,
    selectedProject,
    currentConversationId
  });
  
  // Helper to set messages (needed for conversation loading)
  const setMessages = useCallback((newMessages: any[]) => {
    clearChat();
    newMessages.forEach(message => addMessage(message));
  }, [clearChat, addMessage]);
  
  // 🚫 Streaming-aware assistant selection wrappers
  const handleAssistantSelectWithStreamingCheck = useCallback((assistantId: number | null) => {
    // 🚫 Prevent assistant switching while streaming
    if (isStreaming) {
      console.log('🚫 Cannot switch assistants while streaming is active');
      return;
    }
    
    handleAssistantSelect(assistantId);
  }, [handleAssistantSelect, isStreaming]);

  const handleChangeAssistantClickWithStreamingCheck = useCallback(() => {
    // 🚫 Prevent opening assistant manager while streaming
    if (isStreaming) {
      console.log('🚫 Cannot open assistant manager while streaming is active');
      return;
    }
    
    setShowAssistantManager(true);
    console.log('🎯 Opening assistant manager from selector card');
  }, [setShowAssistantManager, isStreaming]);
  
  // ⚡ Update messages as content streams in
  useEffect(() => {
    if (isStreaming && accumulatedContent && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        updateLastMessage(accumulatedContent);
      }
    }
  }, [accumulatedContent, isStreaming, messages.length, updateLastMessage]);
  
  // 🔄 Track previous message count to detect new messages vs loaded messages
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [previousConversationId, setPreviousConversationId] = useState<number | null>(null);
  const [conversationJustLoaded, setConversationJustLoaded] = useState(false);

  // 💾 Auto-save logic - ENHANCED with race condition prevention
  useEffect(() => {
    const shouldTriggerAutoSave = shouldAutoSave(
      messages,
      DEFAULT_AUTO_SAVE_CONFIG.triggerAfterMessages
    );
    
    console.log('🔍 Auto-save check:', {
      shouldTriggerAutoSave,
      currentConversationId,
      messagesLength: messages.length,
      lastAutoSaveMessageCount,
      isSavingConversation,
      autoSaveFailedAt,
      isStreaming,
      isLoadingConversation,
      conversationJustLoaded
    });
    
    // 🔧 ENHANCED: More comprehensive checks to prevent unnecessary saves
    if (
      shouldTriggerAutoSave && 
      messages.length > lastAutoSaveMessageCount &&
      !isSavingConversation &&
      !isStreaming && // Don't auto-save while streaming
      !isLoadingConversation && // 🔧 FIX: Don't auto-save while loading conversation
      !conversationJustLoaded && // 🔧 FIX: Don't auto-save immediately after loading
      autoSaveFailedAt !== messages.length
    ) {
      console.log('🚀 Triggering auto-save for conversation', currentConversationId ? `(existing: ${currentConversationId})` : '(new)');
      handleAutoSaveConversation(messages, { 
        selectedConfigId: selectedConfigId || undefined, 
        selectedModelId: selectedModelId || undefined,
        projectId: selectedProjectId || undefined
      });
    } else if (shouldTriggerAutoSave && isSavingConversation) {
      console.log('🔄 Auto-save already in progress, skipping trigger');
    } else if (shouldTriggerAutoSave && isStreaming) {
      console.log('🌊 Streaming in progress, deferring auto-save');
    } else if (shouldTriggerAutoSave && isLoadingConversation) {
      console.log('📖 Conversation loading in progress, skipping auto-save to prevent duplicate saves');
    } else if (shouldTriggerAutoSave && conversationJustLoaded) {
      console.log('📖 Conversation just loaded, skipping auto-save to allow state to settle');
    } else if (messages.length <= lastAutoSaveMessageCount) {
      console.log('🔄 No new messages since last auto-save, skipping');
    }
  }, [
    messages, 
    currentConversationId, 
    lastAutoSaveMessageCount, 
    isSavingConversation, 
    autoSaveFailedAt,
    isStreaming,
    isLoadingConversation,
    conversationJustLoaded,
    handleAutoSaveConversation,
    selectedConfigId,
    selectedModelId
  ]);
  
  // 🔄 Update sidebar message count only when messages are sent (not loaded)
  useEffect(() => {
    console.log('🔄 Sidebar update check:', {
      currentConversationId,
      sidebarUpdateFunction: !!sidebarUpdateFunction,
      messagesLength: messages.length,
      isLoadingConversation,
      previousMessageCount,
      previousConversationId
    });
    
    if (currentConversationId && sidebarUpdateFunction && messages.length > 0) {
      // Case 1: New message sent (message count increased)
      const isNewMessage = !isLoadingConversation && 
                          messages.length > previousMessageCount && 
                          previousMessageCount > 0;
      
      // Case 2: Conversation just got auto-saved (conversation ID appeared)
      const isNewlySaved = previousConversationId === null && 
                          currentConversationId !== null && 
                          messages.length > 1; // Has actual conversation content
      
      console.log('🔄 Update conditions:', {
        isNewMessage,
        isNewlySaved,
        willUpdate: isNewMessage || isNewlySaved
      });
      
      if (isNewMessage || isNewlySaved) {
        console.log('🔄 Updating conversation position:', 
          isNewMessage ? 'new message' : 'newly saved');
        // 🔧 CRITICAL FIX: Don't update sidebar without backend timestamp data
        // This prevents "Just now" timestamps from appearing incorrectly
        // The auto-save process will handle updating the sidebar with proper backend timestamps
        console.log('🔄 Skipping direct sidebar update - letting auto-save handle timestamp updates properly');
        // Note: The conversation manager's auto-save will call sidebar update with proper backend data
      }
      
      setPreviousMessageCount(messages.length);
      setPreviousConversationId(currentConversationId);
    }
  }, [messages.length, currentConversationId, sidebarUpdateFunction, isLoadingConversation, previousMessageCount, previousConversationId]);
  
  // 📂 Handle project selection with streaming check
  const handleProjectSelectWithStreamingCheck = useCallback((projectId: number | null) => {
    // 🚫 Prevent project switching while streaming
    if (isStreaming) {
      console.log('🚫 Cannot switch projects while streaming is active');
      return;
    }

    handleProjectSelect(projectId);
  }, [handleProjectSelect, isStreaming]);

  // 📂 Handle opening project manager
  const handleChangeProjectClickWithStreamingCheck = useCallback(() => {
    // 🚫 Prevent opening project manager while streaming
    if (isStreaming) {
      console.log('🚫 Cannot open project manager while streaming is active');
      return;
    }

    setShowProjectManager(true);
    console.log('🎯 Opening project manager from selector card');
  }, [setShowProjectManager, isStreaming]);

  // 📤 Handle sending messages
  const handleSendMessage = useCallback(async (content: string, attachments?: FileAttachment[]) => {
    await sendMessage(content, attachments);
  }, [sendMessage]);
  
  // 💾 Handle saving conversation
  const handleSaveCurrentConversation = useCallback(async () => {
    await handleSaveConversation(messages, { 
      selectedConfigId: selectedConfigId || undefined, 
      selectedModelId: selectedModelId || undefined,
      projectId: selectedProjectId || undefined
    });
  }, [handleSaveConversation, messages, selectedConfigId, selectedModelId]);
  
  // 📖 Handle loading conversation
  const handleLoadSelectedConversation = useCallback(async (conversationId: number) => {
    // 🚫 Prevent conversation switching while streaming
    if (isStreaming) {
      console.log('🚫 Cannot switch conversations while streaming is active');
      return;
    }
    
    setIsLoadingConversation(true);
    try {
      const loadedMessages = await handleLoadConversation(conversationId);
      // Messages are set via the conversation manager callback
      // Reset message count tracking for the loaded conversation
      setPreviousMessageCount(loadedMessages.length);
      setPreviousConversationId(conversationId);
      setConversationJustLoaded(true);
    } finally {
      setIsLoadingConversation(false);
    }
  }, [handleLoadConversation, isStreaming]);
  
  // 🤖 Handle assistant manager changes
  const handleAssistantManagerChange = useCallback(() => {
    // This will be called when assistants are created/edited/deleted
    console.log('🔄 Assistant list updated from embedded manager');
    // Refresh available assistants to reflect any changes
    loadAvailableAssistants();
  }, [loadAvailableAssistants]);
  
  // 📂 Handle project update with re-introduction
  const handleProjectUpdated = useCallback(async (projectId: number) => {
    console.log('📂 Project updated, generating new introduction:', projectId);
    
    try {
      // Get fresh project data from the service
      const updatedProject = await projectService.getProject(projectId);
      
      // Generate a new introduction message for the updated project
      const introMessage = handleProjectIntroduction(updatedProject, selectedProject);
      addMessage(introMessage);
      
      console.log('✅ Added re-introduction message for updated project');
      
      // Refresh the available projects to get the updated data
      await loadAvailableProjects(true);
      
    } catch (error) {
      console.error('❌ Failed to generate introduction for updated project:', error);
    }
  }, [loadAvailableProjects, handleProjectIntroduction, selectedProject, addMessage]);

  // 🤖 Handle assistant update with re-introduction
  const handleAssistantUpdated = useCallback(async (assistantId: number) => {
    console.log('🤖 Assistant updated, generating new introduction:', assistantId);
    
    try {
      // Get fresh assistant data from the service
      const { assistantService } = await import('../../../services/assistantService');
      const updatedAssistant = await assistantService.getAssistant(assistantId);
      
      // Convert to summary format for introduction message
      const assistantSummary = {
        id: updatedAssistant.id,
        name: updatedAssistant.name,
        description: updatedAssistant.description,
        system_prompt_preview: updatedAssistant.system_prompt_preview,
        is_active: updatedAssistant.is_active,
        conversation_count: updatedAssistant.conversation_count,
        created_at: updatedAssistant.created_at,
        is_new: updatedAssistant.is_new
      };
      
      // Generate a new introduction message for the updated assistant
      const introMessage = handleAssistantIntroduction(assistantSummary, selectedAssistant);
      addMessage(introMessage);
      
      console.log('✅ Added re-introduction message for updated assistant');
      
      // Refresh the available assistants to get the updated data
      // 🔧 Do this AFTER generating the intro message to avoid duplicate messages
      // Pass true to indicate this is an update, preventing automatic intro messages
      await loadAvailableAssistants(true);
      
    } catch (error) {
      console.error('❌ Failed to generate introduction for updated assistant:', error);
    }
  }, [loadAvailableAssistants, handleAssistantIntroduction, selectedAssistant, addMessage]);
  
  // 🆕 Handle new conversation with streaming check
  const handleNewConversationClick = useCallback(() => {
    // 🚫 Prevent new conversation while streaming
    if (isStreaming) {
      console.log('🚫 Cannot create new conversation while streaming is active');
      return;
    }
    
    handleNewConversation();
    // Reset tracking state for new conversation
    setPreviousMessageCount(0);
    setPreviousConversationId(null);
    setConversationJustLoaded(false);
  }, [handleNewConversation, isStreaming]);
  
  // 🔧 FIX: Reset the "just loaded" flag after a short delay to allow normal auto-save
  useEffect(() => {
    if (conversationJustLoaded) {
      const timeout = setTimeout(() => {
        console.log('🔄 Resetting conversation just loaded flag - auto-save can resume');
        setConversationJustLoaded(false);
      }, 1000); // Wait 1 second after loading before allowing auto-save

      return () => clearTimeout(timeout);
    }
  }, [conversationJustLoaded]);

  // ⌨️ Projects manager keyboard shortcut (Ctrl/Cmd + P)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as Element).closest('[contenteditable="true"]')
      ) {
        return;
      }

      // Prevent shortcuts during streaming
      if (isStreaming) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setShowProjectManager(prev => !prev);
        console.log('⌨️ Toggled project manager via keyboard shortcut');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming]);
  
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-blue-950 overflow-hidden">
      
      {/* 🎯 Conversation Sidebar Toggle */}
      <button
        onClick={() => setShowConversationSidebar(!showConversationSidebar)}
        disabled={isStreaming}
        className={`fixed top-1/2 translate-y-12 z-50 transition-all duration-300 ${
          showConversationSidebar && !isMobile
            ? 'left-[324px]'
            : 'left-2'
        } bg-white/5 hover:bg-white/10 backdrop-blur-lg border border-white/10 rounded-full p-3 shadow-2xl hover:shadow-3xl group hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        title={`${showConversationSidebar ? 'Hide' : 'Show'} conversation history`}
        aria-label={`${showConversationSidebar ? 'Hide' : 'Show'} conversation history`}
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
        onCreateNew={handleNewConversationClick}
        currentConversationId={currentConversationId || undefined}
        onConversationUpdate={() => {}}
        refreshTrigger={conversationRefreshTrigger}
        onSidebarReady={(updateFn, addFn) => {
          setSidebarFunctions(updateFn, addFn);
        }}
        isStreaming={isStreaming}
      />
      
      {/* 📂 Project Manager */}
      {showProjectManager && (
        <div className={`fixed z-50 bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-600 shadow-xl transform transition-all duration-300 ease-in-out ${
          isMobile 
            ? `inset-x-0 bottom-0 h-96 rounded-t-xl ${
                showProjectManager ? 'translate-y-0' : 'translate-y-full'
              }`
            : `inset-y-0 right-0 w-96 ${
                showProjectManager ? 'translate-x-0' : 'translate-x-full'
              }`
        }`}>
          <div className="h-full overflow-y-auto">
            {isMobile && (
              <div className="flex justify-center py-3 bg-white/10">
                <div className="w-12 h-1 bg-white/30 rounded-full"></div>
              </div>
            )}
            
            <ProjectManager
              selectedProjectId={selectedProject?.id || null}
              onProjectSelect={handleProjectSelectWithStreamingCheck}
              onProjectChange={handleProjectChange}
              onProjectUpdated={handleProjectUpdated}
              isStreaming={isStreaming}
              className="h-full border-0 rounded-none bg-transparent"
              currentConversationId={currentConversationId || undefined}
              onSelectConversation={handleLoadSelectedConversation}
              onNewConversation={handleNewConversationClick}
            />
          </div>
        </div>
      )}

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
              onAssistantSelect={handleAssistantSelectWithStreamingCheck}
              onAssistantChange={handleAssistantManagerChange}
              onAssistantUpdated={handleAssistantUpdated}
              isStreaming={isStreaming}
              className="h-full border-0 rounded-none bg-transparent"
            />
          </div>
        </div>
      )}
      
      {/* 🎭 Backdrop */}
      {(showAssistantManager || showProjectManager) && (
        <div 
          className={`fixed inset-0 z-30 transition-opacity duration-300 ${
            isMobile ? 'bg-black/60' : 'bg-black/50'
          }`}
          onClick={() => {
            setShowAssistantManager(false);
            setShowProjectManager(false);
          }}
        />
      )}
      
      {/* Main chat interface with sidebar-aware spacing */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
        showConversationSidebar && !isMobile ? 'lg:ml-80' : 'ml-0'
      }`}>
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
          selectedProject={selectedProject}
          onOpenProjectManager={() => setShowProjectManager(true)}
          messages={messages}
          currentConversationId={currentConversationId}
          conversationTitle={conversationTitle}
          isSavingConversation={isSavingConversation}
          onSaveConversation={handleSaveCurrentConversation}
          onNewConversation={handleNewConversationClick}
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
                onSelect={handleAssistantSelectWithStreamingCheck}
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
            
            {/* 📂 Project selector */}
            <ProjectSelectorCard
              selectedProject={selectedProject}
              onChangeClick={handleChangeProjectClickWithStreamingCheck}
              isStreaming={isStreaming}
            />
            
            {/* 🤖 Assistant selector */}
            <AssistantSelectorCard
              selectedAssistant={selectedAssistant}
              onChangeClick={handleChangeAssistantClickWithStreamingCheck}
              isStreaming={isStreaming}
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