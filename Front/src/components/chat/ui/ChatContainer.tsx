// 💬 Main Chat Interface Container (Refactored)
// Orchestrates all chat functionality using modular hooks and components
// Replaces the large ChatInterface.tsx with clean, maintainable architecture

import React, { useEffect, useCallback, useState } from 'react';
import { Settings, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MessageList } from '../MessageList';
import { MessageInput } from '../MessageInput';
import { UnifiedSidebar } from './UnifiedSidebar';
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
import { useSidebarState } from '../../../hooks/chat/useSidebarState';
import { useProjectManager } from '../../../hooks/chat/useProjectManager';
import { ProjectSelectorCard } from './ProjectSelectorCard';
import { DEFAULT_AUTO_SAVE_CONFIG, shouldAutoSave } from '../../../types/conversation';
import type { FileAttachment } from '../../../types/file';
import { projectService } from '../../../services/projectService';
import { assistantService } from '../../../services/assistantService';

export const ChatContainer: React.FC = () => {
  const { user } = useAuth();
  
  // 📱 Responsive layout state
  const { isMobile } = useResponsiveLayout();
  
  // 📁 Unified Sidebar state
  const {
    isOpen: showUnifiedSidebar,
    mode: sidebarMode,
    toggleSidebar,
    setSidebarOpen: setShowUnifiedSidebar,
    setSidebarMode,
    toggleMode: toggleSidebarMode
  } = useSidebarState('conversations', false);
  
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

    conversationRefreshTrigger,
    sidebarUpdateFunction,
    sidebarAddConversationFunction,
    handleAutoSaveConversation,
    handleSaveConversation,
    handleLoadConversation,
    handleNewConversation,

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
    
    // Close unified sidebar and open assistant manager
    setShowUnifiedSidebar(false);
    setShowAssistantManager(true);
    console.log('🎯 Opening assistant manager from selector card (unified sidebar closed)');
  }, [setShowAssistantManager, isStreaming]);

  // 🚫 Streaming-aware project selection wrapper
  const handleProjectSelectWithStreamingCheck = useCallback((projectId: number | null) => {
    // 🚫 Prevent project switching while streaming
    if (isStreaming) {
      console.log('🚫 Cannot switch projects while streaming is active');
      return;
    }
    
    handleProjectSelect(projectId);
  }, [handleProjectSelect, isStreaming]);

  const handleChangeProjectClickWithStreamingCheck = useCallback(() => {
    // 🚫 Prevent opening project manager while streaming
    if (isStreaming) {
      console.log('🚫 Cannot open project manager while streaming is active');
      return;
    }
    
    // Open unified sidebar in projects mode
    setSidebarMode('projects');
    setShowUnifiedSidebar(true);
    setShowAssistantManager(false);
    console.log('🎯 Opening unified sidebar in projects mode from selector card');
  }, [isStreaming]);
  
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

    // 🚫 Don't auto-save during conversation loading to prevent race conditions
    if (isLoadingConversation || conversationJustLoaded) {
      console.log('🚫 Skipping auto-save during conversation loading to prevent race conditions');
      return;
    }

    if (shouldTriggerAutoSave && !isStreaming) {
      // 🧠 Smart detection: Only trigger auto-save for genuine new messages
      const currentMessageCount = messages.length;
      const hasNewMessages = currentMessageCount > previousMessageCount;
      const conversationChanged = currentConversationId !== previousConversationId;

      if (hasNewMessages && !conversationChanged) {
        console.log('💾 Auto-save triggered: new messages detected', {
          currentCount: currentMessageCount,
          previousCount: previousMessageCount,
          conversationId: currentConversationId
        });

                 handleAutoSaveConversation(messages, {
           selectedConfigId: selectedConfigId || undefined,
           selectedModelId: selectedModelId || undefined,
           projectId: selectedProjectId || undefined
         });
      }

      // Update tracking variables for next comparison
      setPreviousMessageCount(currentMessageCount);
      setPreviousConversationId(currentConversationId);
    }
  }, [
    messages,
    isStreaming,
    handleAutoSaveConversation,
    selectedConfigId,
    selectedModelId,
    selectedProjectId,
    currentConversationId,
    previousMessageCount,
    previousConversationId,
    isLoadingConversation,
    conversationJustLoaded
  ]);

  // 💾 Conversation loading with streaming check
  const handleLoadSelectedConversation = useCallback(async (conversationId: number) => {
    // 🚫 Prevent conversation loading while streaming
    if (isStreaming) {
      console.log('🚫 Cannot load conversation while streaming is active');
      return;
    }

    try {
      setIsLoadingConversation(true);
      setConversationJustLoaded(true);
      
      console.log('💾 Loading conversation:', conversationId);
      const loadedMessages = await handleLoadConversation(conversationId);
      
      // Set tracking state for the loaded conversation
      setPreviousMessageCount(loadedMessages.length);
      setPreviousConversationId(conversationId);
      
      console.log('✅ Conversation loaded successfully with', loadedMessages.length, 'messages');
      
    } catch (error) {
      console.error('❌ Failed to load conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to load conversation');
    } finally {
      setIsLoadingConversation(false);
    }
  }, [isStreaming, handleLoadConversation, setError]);

  // 💾 Save current conversation
  const handleSaveCurrentConversation = useCallback(async () => {
    if (messages.length === 0) {
      setError('No messages to save');
      return;
    }

    try {
             await handleSaveConversation(messages, {
         selectedConfigId: selectedConfigId || undefined,
         selectedModelId: selectedModelId || undefined,
         projectId: selectedProjectId || undefined
       });
      console.log('✅ Conversation saved manually');
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to save conversation');
    }
  }, [messages, handleSaveConversation, selectedConfigId, selectedModelId, selectedProjectId, setError]);

  // ✉️ Enhanced message sending with auto-save integration
  const handleSendMessage = useCallback(async (
    content: string, 
    files?: FileAttachment[]
  ) => {
    try {
      await sendMessage(content, files);
      
      // Update message count for next auto-save comparison
      const newCount = messages.length + 2; // +1 for user message, +1 for assistant response
      setPreviousMessageCount(newCount);
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // Error handling is done in useChatState
    }
  }, [sendMessage, messages.length]);

  // 🤖 Assistant manager change handler
  const handleAssistantManagerChange = useCallback(async () => {
    await loadAvailableAssistants();
  }, [loadAvailableAssistants]);

  // 📂 Project selection helpers
  const handleProjectUpdated = useCallback(async (projectId: number) => {
    try {
      // Load the updated project
      const updatedProject = await projectService.getProject(projectId);
      
             // Generate a new introduction message for the updated project
       const introMessage = handleProjectIntroduction(updatedProject, selectedProject);
      addMessage(introMessage);
      
      console.log('✅ Added re-introduction message for updated project');
      
      // Refresh the available projects
      await loadAvailableProjects();
      
    } catch (error) {
      console.error('❌ Failed to generate introduction for updated project:', error);
    }
  }, [loadAvailableProjects, handleProjectIntroduction, selectedProject, addMessage]);

  // 🤖 Assistant updated handler  
  const handleAssistantUpdated = useCallback(async (assistantId: number) => {
    try {
             // Load the updated assistant data
       const updatedAssistant = await assistantService.getAssistant(assistantId);
      
      // Create assistant summary for introduction
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

  // ⌨️ Unified sidebar keyboard shortcuts
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

      // Ctrl/Cmd + B for conversations
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebarMode('conversations');
        toggleSidebar();
        setShowAssistantManager(false);
        console.log('⌨️ Toggled conversations via keyboard shortcut');
      }
      
      // Ctrl/Cmd + P for projects
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setSidebarMode('projects');
        toggleSidebar();
        setShowAssistantManager(false);
        console.log('⌨️ Toggled projects via keyboard shortcut');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, setShowAssistantManager]);
  
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-blue-950 overflow-hidden">
      
      {/* 📁 Unified Sidebar Toggle */}
      <button
        onClick={() => {
          const newState = !showUnifiedSidebar;
          // Close assistant manager when opening unified sidebar
          if (newState) {
            setShowAssistantManager(false);
          }
          setShowUnifiedSidebar(newState);
        }}
        disabled={isStreaming}
        className={`fixed top-1/2 translate-y-12 z-50 transition-all duration-300 ${
          showUnifiedSidebar ? 'left-80' : 'left-2'
        } bg-white/5 hover:bg-white/10 backdrop-blur-lg border border-white/10 rounded-full p-3 shadow-2xl hover:shadow-3xl group hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        title={`${showUnifiedSidebar ? 'Hide' : 'Show'} sidebar`}
        aria-label={`${showUnifiedSidebar ? 'Hide' : 'Show'} sidebar`}
      >
        {showUnifiedSidebar ? (
          <ChevronLeft className="w-4 h-4 text-white group-hover:text-blue-100 transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white group-hover:text-blue-100 transition-colors" />
        )}
      </button>
      
      {/* 📁 Unified Sidebar */}
      <UnifiedSidebar
        mode={sidebarMode}
        onModeChange={(mode) => {
          if (isStreaming) return;
          setSidebarMode(mode);
        }}
        isOpen={showUnifiedSidebar}
        onClose={() => setShowUnifiedSidebar(false)}
        onSelectConversation={handleLoadSelectedConversation}
        onCreateNewConversation={handleNewConversationClick}
        currentConversationId={currentConversationId || undefined}
        refreshTrigger={conversationRefreshTrigger}
        onSidebarReady={(updateFn, addFn) => {
          setSidebarFunctions(updateFn, addFn);
        }}
        isStreaming={isStreaming}
        selectedProjectId={selectedProjectId}
        onProjectSelect={handleProjectSelectWithStreamingCheck}
        onProjectChange={handleProjectChange}
        onProjectUpdated={handleProjectUpdated}
      />

      {/* 🤖 Assistant Manager */}
      {showAssistantManager && (
        <div className="fixed inset-y-0 right-0 w-96 z-40 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-600 shadow-xl transform transition-all duration-300 ease-in-out translate-x-0">
          <div className="h-full overflow-y-auto">
            
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
      {showAssistantManager && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 transition-opacity duration-300"
          onClick={() => {
            setShowAssistantManager(false);
          }}
        />
      )}
      
      {/* Main chat interface with sidebar-aware spacing */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
        showUnifiedSidebar ? 'ml-80' : 'ml-0'
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
          onOpenProjectManager={() => {
            // Open unified sidebar in projects mode
            setSidebarMode('projects');
            setShowUnifiedSidebar(true);
            setShowAssistantManager(false);
          }}
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