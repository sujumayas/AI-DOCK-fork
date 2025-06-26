// 💬 Enhanced Chat Interface with Smart Model Filtering
// Main chat page with intelligent model selection and admin controls
// Manages conversation state, smart LLM filtering, and backend integration

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { EmbeddedAssistantManager } from '../components/chat/EmbeddedAssistantManager';
import { AssistantSelectorCard } from '../components/chat/AssistantSelectorCard';
import { AssistantSuggestions } from '../components/chat/AssistantSuggestions';
import { QuotaErrorDisplay } from '../components/chat/QuotaErrorDisplay';
import { chatService, UnifiedModelsResponse, UnifiedModelInfo } from '../services/chatService';
import { conversationService } from '../services/conversationService';
import { useAuth } from '../hooks/useAuth';
import { 
  ChatMessage, 
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
import { assistantService } from '../services/assistantService';
import { AssistantSummary, AssistantServiceError } from '../types/assistant';
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
  Bot,           // 🤖 NEW: Assistant selector icon
  Archive,  // 💾 Conversation archive icon
  Save,      // 💾 Save conversation icon
  ChevronLeft,  // 🎯 NEW: Navigation arrow for history
  ChevronRight, // 🎯 NEW: Navigation arrow for opening sidebar
  Menu         // 🎯 NEW: Menu/hamburger icon
} from 'lucide-react';

import { sortConfigsByModel, getCleanModelName, getShortProviderName } from '../utils/llmUtils';

// Add a filter function for classic models
function filterClassicModels(models: UnifiedModelInfo[]): UnifiedModelInfo[] {
  // Only allow GPT-4o, GPT-4 Turbo, and GPT-3.5
  const allowedIds = [
    'gpt-4o',        // ✅ Fixed: Added missing GPT-4o (the actual default model)
    'gpt-4o-mini',
    "gpt-o4-mini",
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ];
  return models.filter((model: UnifiedModelInfo) => allowedIds.includes(model.id) || allowedIds.includes(model.display_name));
}

export const ChatInterface: React.FC = () => {
  // 🧭 Navigation hook for routing
  const navigate = useNavigate();
  
  // 🔐 Authentication state
  const { user } = useAuth();
  
  // 💬 Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 📱 RESPONSIVE STATE: Track screen size for mobile vs desktop layout
  const [isMobile, setIsMobile] = useState(false);
  
  // 💾 CONVERSATION SAVE/LOAD STATE
  const [showConversationSidebar, setShowConversationSidebar] = useState(false);
  
  // 🤖 EMBEDDED ASSISTANT MANAGEMENT STATE
  const [showAssistantManager, setShowAssistantManager] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [lastAutoSaveMessageCount, setLastAutoSaveMessageCount] = useState(0);
  const [autoSaveFailedAt, setAutoSaveFailedAt] = useState<number | null>(null); // 🔧 Track auto-save failures
  
  // 🔄 ENHANCED: Reactive updates for conversation sidebar with better callback system
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = useState(0);
  const [sidebarUpdateFunction, setSidebarUpdateFunction] = useState<((id: number, count: number) => void) | null>(null);
  const [sidebarAddConversationFunction, setSidebarAddConversationFunction] = useState<((conv: any) => void) | null>(null);
  
  // 🔄 ENHANCED: Update message count in real-time when messages change
  useEffect(() => {
    if (currentConversationId && sidebarUpdateFunction && messages.length > 0) {
      // Update the message count in the sidebar for the current conversation
      sidebarUpdateFunction(currentConversationId, messages.length);
      console.log('🔄 Updated message count for conversation', currentConversationId, 'to', messages.length);
    }
  }, [messages.length, currentConversationId, sidebarUpdateFunction]);
  
  // 🔄 ENHANCED: Handle conversation updates from sidebar
  const handleConversationUpdate = useCallback((conversationId: number, messageCount: number) => {
    console.log('🔄 Received conversation update:', conversationId, messageCount);
    // This callback can be used for future enhancements
    // For now, the sidebar manages its own state updates
  }, []);
  
  // 🔄 NEW: Handle adding new conversations to sidebar
  const handleAddConversationToSidebar = useCallback((conversation: any) => {
    if (sidebarAddConversationFunction) {
      sidebarAddConversationFunction(conversation);
      console.log('🔄 Added conversation to sidebar:', conversation.id);
    }
  }, [sidebarAddConversationFunction]);
  
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
  
  // 🤖 ASSISTANT SELECTION STATE: Custom assistants integration
  const [availableAssistants, setAvailableAssistants] = useState<AssistantSummary[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<number | null>(null);
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantSummary | null>(null);
  const [assistantsLoading, setAssistantsLoading] = useState(false);
  const [assistantsError, setAssistantsError] = useState<string | null>(null);
  
  // 🎮 Smart filtering controls
  const [showAllModels, setShowAllModels] = useState(false);
  
  // 🆕 Load unified models when component mounts or filter settings change
  useEffect(() => {
    loadUnifiedModels();
  }, [showAllModels]);
  
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

  // �� URL PARAMETER HANDLING: Support ?assistant=id for direct assistant selection
  const [searchParams, setSearchParams] = useSearchParams();
  
  useEffect(() => {
    const assistantParam = searchParams.get('assistant');
    if (assistantParam) {
      const assistantId = parseInt(assistantParam, 10);
      if (!isNaN(assistantId) && assistantId !== selectedAssistantId) {
        setSelectedAssistantId(assistantId);
        console.log('🎯 Assistant selected from URL:', assistantId);
      }
    }
  }, [searchParams, selectedAssistantId]);
  
  // 🤖 LOAD AVAILABLE ASSISTANTS: Fetch user's assistants for selection
  const loadAvailableAssistants = async () => {
    try {
      setAssistantsLoading(true);
      setAssistantsError(null);
      
      console.log('🤖 Loading available assistants...');
      
      const assistantsResponse = await assistantService.getActiveAssistants(50);
      
      setAvailableAssistants(assistantsResponse);
      
      console.log('✅ Assistants loaded:', {
        count: assistantsResponse.length,
        assistants: assistantsResponse.map(a => ({ id: a.id, name: a.name }))
      });
      
    } catch (error) {
      console.error('❌ Failed to load assistants:', error);
      setAssistantsError(
        error instanceof AssistantServiceError 
          ? error.message 
          : 'Failed to load assistants'
      );
    } finally {
      setAssistantsLoading(false);
    }
  };
  
  // Load assistants when component mounts
  useEffect(() => {
    loadAvailableAssistants();
  }, []);
  
  // 📱 RESPONSIVE SCREEN SIZE DETECTION: Handle mobile vs desktop layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkScreenSize();
    
    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // 🤖 UPDATE SELECTED ASSISTANT: When assistant ID changes, update assistant data
  useEffect(() => {
    if (selectedAssistantId && availableAssistants.length > 0) {
      const assistant = availableAssistants.find(a => a.id === selectedAssistantId);
      if (assistant && assistant !== selectedAssistant) {
        const previousAssistant = selectedAssistant;
        setSelectedAssistant(assistant);
        console.log('🤖 Selected assistant updated:', {
          id: assistant.id,
          name: assistant.name,
          systemPromptPreview: assistant.system_prompt_preview
        });
        // Immediately switch assistant and add introduction message (no confirmation)
        handleAssistantIntroduction(assistant, previousAssistant);
      }
    } else if (!selectedAssistantId) {
      // Clear assistant when none selected
      if (selectedAssistant && messages.length > 0) {
        // Add a message indicating return to default chat
        const dividerMessage: ChatMessage = {
          role: 'system',
          content: `Switched back to default AI chat`,
          assistantChanged: true,
          previousAssistantName: selectedAssistant.name
        };
        setMessages(prev => [...prev, dividerMessage]);
      }
      setSelectedAssistant(null);
    }
  }, [selectedAssistantId, availableAssistants, selectedAssistant, messages.length]);
  
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
  
  // 🤖 ASSISTANT INTRODUCTION HANDLER: Add introduction message when assistant is selected
  const handleAssistantIntroduction = (assistant: AssistantSummary, previousAssistant: AssistantSummary | null) => {
    const introMessage: ChatMessage = {
      role: 'assistant',
      content: `Hello! I'm **${assistant.name}**, your AI assistant.\n\n${assistant.description || assistant.system_prompt_preview || 'I\'m here to help you with your questions.'}\n\nHow can I assist you today?`,
      assistantId: assistant.id,
      assistantName: assistant.name,
      assistantIntroduction: true,
      assistantChanged: !!previousAssistant,
      previousAssistantName: previousAssistant?.name
    };
    
    setMessages(prev => [...prev, introMessage]);
    
    console.log('🤖 Added assistant introduction:', {
      assistantName: assistant.name,
      isSwitch: !!previousAssistant,
      previousAssistant: previousAssistant?.name
    });
  };
  
  // 🆕 Fetch unified models from all providers
  const loadUnifiedModels = async () => {
    try {
      setModelsLoading(true);
      setError(null);
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
      
      // 🤖 ASSISTANT SYSTEM PROMPT: Inject assistant's system prompt if selected
      let messagesWithSystemPrompt = [userMessage];
      if (selectedAssistant) {
        // Add assistant's system prompt as the first message
        const systemMessage: ChatMessage = {
          role: 'system',
          content: selectedAssistant.system_prompt_preview // We use preview here, full prompt would come from backend
        };
        messagesWithSystemPrompt = [systemMessage, ...messages, userMessage];
        
        console.log('🤖 Using assistant system prompt:', {
          assistantName: selectedAssistant.name,
          systemPromptLength: selectedAssistant.system_prompt_preview.length
        });
      } else {
        messagesWithSystemPrompt = [...messages, userMessage];
      }
      
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
        messages: messagesWithSystemPrompt, // Use messages with system prompt
        model: selectedModelId || undefined,
        // 📁 Include file attachments in streaming request
        file_attachment_ids: fileAttachmentIds,
        // 🤖 Include assistant context for backend processing
        assistant_id: selectedAssistantId || undefined,
        // 🔄 FIXED: Include conversation_id so backend can save messages to existing conversation
        conversation_id: currentConversationId || undefined
      };
      
      const streamingSuccess = await streamMessage(
        streamingRequest,
        (finalResponse: ChatResponse) => {
          console.log('✅ Streaming completed:', { 
            provider: finalResponse.provider,
            model: finalResponse.model,
            tokens: finalResponse.usage.total_tokens
          });
          
          // Replace placeholder with final response (including assistant context)
          const finalMessage: ChatMessage = {
            role: 'assistant',
            content: finalResponse.content,
            assistantId: selectedAssistantId || undefined,
            assistantName: selectedAssistant?.name || undefined
          };
          
          setMessages(prev => [
            ...prev.slice(0, -1),
            finalMessage
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
      // 🤖 ASSISTANT SYSTEM PROMPT: Inject assistant's system prompt if selected
      let messagesWithSystemPrompt = updatedMessages;
      if (selectedAssistant) {
        // Add assistant's system prompt as the first message
        const systemMessage: ChatMessage = {
          role: 'system',
          content: selectedAssistant.system_prompt_preview // We use preview here, full prompt would come from backend
        };
        messagesWithSystemPrompt = [systemMessage, ...messages, ...updatedMessages.slice(-1)];
      }
      
      // 🤖 Send to LLM service with selected model
      const response = await chatService.sendMessage({
        config_id: selectedConfigId!,
        messages: messagesWithSystemPrompt, // Use messages with system prompt
        model: selectedModelId || undefined,
        // 📁 Include file attachments in regular request
        file_attachment_ids: fileAttachmentIds,
        // 🤖 Include assistant context for backend processing
        assistant_id: selectedAssistantId || undefined,
        // 🔄 FIXED: Include conversation_id so backend can save messages to existing conversation
        conversation_id: currentConversationId || undefined
      });
      
      // 🤖 Add AI response to conversation (including assistant context)
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
        assistantId: selectedAssistantId || undefined,
        assistantName: selectedAssistant?.name || undefined
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
      setShowAllModels((prev) => !prev);
      console.log('🔄 Toggled model filter from dropdown:', !showAllModels ? 'show all' : 'filter');
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
    
    // Clear assistant selection from URL when starting new conversation
    if (searchParams.has('assistant')) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('assistant');
      setSearchParams(newSearchParams, { replace: true });
    }
    
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
      
      // 🔄 ENHANCED: Add conversation to sidebar immediately (more reactive)
      if (sidebarAddConversationFunction) {
        // Create a ConversationSummary object for the sidebar
        const conversationSummary = {
          id: savedConversation.id,
          title: savedConversation.title,
          message_count: messages.length,
          created_at: savedConversation.created_at || new Date().toISOString(),
          updated_at: savedConversation.updated_at || new Date().toISOString()
        };
        handleAddConversationToSidebar(conversationSummary);
      } else {
        // Fallback to refresh trigger if add function not available
        setConversationRefreshTrigger(prev => prev + 1);
      }
      
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
        
        // 🔄 ENHANCED: Add conversation to sidebar immediately (more reactive)
        if (sidebarAddConversationFunction) {
          const conversationSummary = {
            id: savedConversation.id,
            title: savedConversation.title,
            message_count: messages.length,
            created_at: savedConversation.created_at || new Date().toISOString(),
            updated_at: savedConversation.updated_at || new Date().toISOString()
          };
          handleAddConversationToSidebar(conversationSummary);
        } else {
          // Fallback to refresh trigger if add function not available
          setConversationRefreshTrigger(prev => prev + 1);
        }
        
        // 🔄 NEW: Auto-update message count in sidebar since we now have a conversation ID
        if (sidebarUpdateFunction) {
          sidebarUpdateFunction(savedConversation.id, messages.length);
        }
        
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
      
      // Clear assistant selection when loading existing conversation
      if (selectedAssistantId) {
        setSelectedAssistantId(null);
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('assistant');
        setSearchParams(newSearchParams, { replace: true });
      }
      
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
  
  // 🤖 Handle assistant selection from embedded manager
  const handleAssistantSelectFromManager = useCallback((assistantId: number | null) => {
    setSelectedAssistantId(assistantId);
    
    const newSearchParams = new URLSearchParams(searchParams);
    if (assistantId) {
      newSearchParams.set('assistant', assistantId.toString());
    } else {
      newSearchParams.delete('assistant');
    }
    setSearchParams(newSearchParams, { replace: true });
    
    console.log('🤖 Assistant selected from embedded manager:', assistantId);
  }, [searchParams, setSearchParams]);
  
  // 🤖 Handle assistant changes (create/edit/delete)
  const handleAssistantManagerChange = useCallback(() => {
    // Reload available assistants when they change
    loadAvailableAssistants();
    console.log('🔄 Assistant list updated from embedded manager');
  }, []);
  
  // 🎯 Handle "Change Assistant" button click from AssistantSelectorCard
  const handleChangeAssistantClick = () => {
    // Open the assistant manager sidebar
    setShowAssistantManager(true);
    console.log('🎯 Opening assistant manager from selector card');
  };
  
  // 🤖 Handle assistant selection (for backward compatibility with dropdown)
  const handleAssistantChange = (assistantId: string) => {
    if (assistantId === '') {
      // Clear assistant selection
      handleAssistantSelectFromManager(null);
    } else if (assistantId === '__manage__') {
      // Open embedded assistant manager instead of navigating
      setShowAssistantManager(true);
    } else {
      // Select assistant
      const id = parseInt(assistantId, 10);
      if (!isNaN(id)) {
        handleAssistantSelectFromManager(id);
      }
    }
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
        onConversationUpdate={handleConversationUpdate}
        refreshTrigger={conversationRefreshTrigger}
        onSidebarReady={(updateFn, addFn) => {
          setSidebarUpdateFunction(() => updateFn);
          setSidebarAddConversationFunction(() => addFn);
          console.log('🔄 Connected sidebar functions for reactive updates');
        }}
      />
      
      {/* 🤖 RESPONSIVE EMBEDDED ASSISTANT MANAGER */}
      {showAssistantManager && (
        <div className={`fixed z-40 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-600 shadow-xl transform transition-all duration-300 ease-in-out ${
          isMobile 
            ? // 📱 MOBILE: Bottom sheet that slides up from bottom
              `inset-x-0 bottom-0 h-96 rounded-t-xl ${
                showAssistantManager ? 'translate-y-0' : 'translate-y-full'
              }`
            : // 🖥️ DESKTOP: Right sidebar that slides from right  
              `inset-y-0 right-0 w-96 ${
                showAssistantManager ? 'translate-x-0' : 'translate-x-full'
              }`
        }`}>
          <div className="h-full overflow-y-auto">
            {/* 📱 MOBILE: Add a drag handle for bottom sheet UX */}
            {isMobile && (
              <div className="flex justify-center py-3 bg-white/10">
                <div className="w-12 h-1 bg-white/30 rounded-full"></div>
              </div>
            )}
            
            <EmbeddedAssistantManager
              selectedAssistantId={selectedAssistantId}
              onAssistantSelect={handleAssistantSelectFromManager}
              onAssistantChange={handleAssistantManagerChange}
              className="h-full border-0 rounded-none bg-transparent"
            />
          </div>
        </div>
      )}
      
      {/* 🎭 RESPONSIVE BACKDROP: Different behavior for mobile vs desktop */}
      {showAssistantManager && (
        <div 
          className={`fixed inset-0 z-30 transition-opacity duration-300 ${
            isMobile 
              ? 'bg-black/60' // Darker backdrop on mobile for bottom sheet
              : 'bg-black/50' // Standard backdrop on desktop
          }`}
          onClick={() => setShowAssistantManager(false)}
          // 📱 MOBILE: Add touch-friendly close area (tap above bottom sheet to close)
          style={isMobile ? { 
            paddingBottom: '24rem', // Don't close when tapping the sheet area
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)'
          } : {}}
        />
      )}
      
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
                        {showAllModels 
                          ? `🔍 Show Fewer Models (${unifiedModelsData && unifiedModelsData.original_total_models ? unifiedModelsData.original_total_models - unifiedModelsData.total_models : ''} hidden)`
                          : `👁️ Show All Models (${unifiedModelsData && unifiedModelsData.original_total_models ? unifiedModelsData.original_total_models - unifiedModelsData.total_models : ''} more)`
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
            
            {/* 🤖 ASSISTANT INDICATOR: Simple visual indicator for selected assistant */}
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
              {/* 🤖 ASSISTANT INFO: Show selected assistant info */}
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
                    showAllModels
                        ? 'bg-orange-500/20 text-orange-200'
                        : 'bg-blue-500/20 text-blue-200'
                  }`} title={
                    unifiedModelsData
                        ? showAllModels
                          ? `All models shown: ${unifiedModelsData.total_models} models from ${unifiedModelsData.providers.length} providers`
                          : `Smart filtered: ${unifiedModelsData.total_models} recommended models${unifiedModelsData.original_total_models ? ` of ${unifiedModelsData.original_total_models} total` : ''}`
                        : ''
                  }>
                    {showAllModels ? '🔍' : '✨'} {unifiedModelsData ? unifiedModelsData.total_models : ''}{unifiedModelsData && unifiedModelsData.original_total_models ? `/${unifiedModelsData.original_total_models}` : ''}
                  </span>
                  
                  {/* Filtering mode indicator */}
                  <span className={`text-xs ${
                    showAllModels
                        ? 'text-orange-300'
                        : 'text-green-300'
                  }`} title={
                    showAllModels
                        ? 'All models mode - showing experimental, legacy, and deprecated models'
                        : 'Smart filter mode - showing recommended and relevant models only'
                  }>
                    {showAllModels ? 'Complete' : 'Filtered'}
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
              
              {/* 🤖 ASSISTANT SYSTEM PROMPT PREVIEW: Show when assistant is selected */}
              {selectedAssistant && (
                <span className="text-purple-200 text-xs" title={selectedAssistant.system_prompt_preview}>
                  • Custom prompt active
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
      </div>
      
      {/* 🚨 Enhanced Error Display with Streaming Error Support */}
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
      
      {/* 🚨 Enhanced Streaming Error Display with Quota Support */}
      {streamingHasError && streamingError && (
        <div className="mt-4">
          {streamingError.type === 'QUOTA_EXCEEDED' ? (
            <QuotaErrorDisplay
              error={streamingError}
              onDismiss={() => {
                // Reset streaming state to clear the error
                // Note: This will be handled by the streaming hook's cleanup
                console.log('🧹 User dismissed quota error');
              }}
              onContactAdmin={() => {
                // Open admin contact - you can customize this
                window.open('mailto:admin@company.com?subject=AI%20Usage%20Quota%20Exceeded', '_blank');
              }}
            />
          ) : (
            // Generic streaming error display
            <div className="bg-orange-500/20 backdrop-blur-sm border-l-4 border-orange-300 p-3 md:p-4 mx-3 md:mx-4 rounded-lg">
              <div className="flex items-start md:items-center gap-2">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-200 flex-shrink-0 mt-0.5 md:mt-0" />
                <div className="flex-1">
                  <p className="text-orange-100 text-xs md:text-sm font-medium mb-1">
                    Streaming Error: {streamingError.type}
                  </p>
                  <p className="text-orange-200 text-xs leading-relaxed">
                    {streamingError.message}
                  </p>
                  {streamingError.shouldFallback && (
                    <p className="text-orange-300 text-xs mt-1">
                      ℹ️ Automatically falling back to regular chat...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
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
          {/* 🤖 ASSISTANT SUGGESTIONS: Show when no assistant selected and no conversation started */}
          {!selectedAssistantId && messages.length === 0 && availableAssistants.length > 0 && (
            <AssistantSuggestions
              suggestions={availableAssistants}
              onSelect={handleAssistantSelectFromManager}
              onDismiss={() => console.log('✨ Assistant suggestions dismissed by user')}
              maxSuggestions={4}
              showOnlyOnce={true}
            />
          )}
          
          {/* 📜 Message list with Smart Auto-Scroll */}
          <MessageList 
            messages={messages}
            isLoading={isLoading}
            isStreaming={isStreaming}
            className="flex-1"
          />
          {/* End Message List */}
          
          {/* 🤖 ASSISTANT SELECTOR CARD: Visual card above message input */}
          <AssistantSelectorCard
            selectedAssistant={selectedAssistant}
            onChangeClick={handleChangeAssistantClick}
          />
          
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
// - Custom assistant integration
// - URL parameter handling
// - Seamless feature integration
