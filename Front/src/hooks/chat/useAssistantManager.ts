// 🤖 Assistant Selection and Management Hook
// Manages custom AI assistants, selection, and URL parameter integration
// Extracted from ChatInterface.tsx for better modularity

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { assistantService } from '../../services/assistantService';
import { AssistantSummary, AssistantServiceError } from '../../types/assistant';
import { ChatMessage } from '../../types/chat';

export interface AssistantManagerState {
  // Assistant data
  availableAssistants: AssistantSummary[];
  selectedAssistantId: number | null;
  selectedAssistant: AssistantSummary | null;
  
  // UI state
  assistantsLoading: boolean;
  assistantsError: string | null;
  showAssistantManager: boolean;
}

export interface AssistantManagerActions {
  loadAvailableAssistants: (isUpdate?: boolean) => Promise<void>;
  handleAssistantSelect: (assistantId: number | null) => void;
  handleAssistantChange: (assistantId: string) => void;
  handleAssistantIntroduction: (assistant: AssistantSummary, previousAssistant: AssistantSummary | null) => ChatMessage;
  setShowAssistantManager: (show: boolean) => void;
  clearAssistantFromUrl: () => void;
}

export interface AssistantManagerReturn extends AssistantManagerState, AssistantManagerActions {}

export const useAssistantManager = (
  onAssistantMessage?: (message: ChatMessage) => void
): AssistantManagerReturn => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // 🤖 Assistant selection state
  const [availableAssistants, setAvailableAssistants] = useState<AssistantSummary[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<number | null>(null);
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantSummary | null>(null);
  const [assistantsLoading, setAssistantsLoading] = useState(false);
  const [assistantsError, setAssistantsError] = useState<string | null>(null);
  const [showAssistantManager, setShowAssistantManager] = useState(false);
  
  // 🔧 Flag to prevent automatic introduction during manual updates
  const [isManualUpdate, setIsManualUpdate] = useState(false);
  
  // 🤖 Load available assistants
  const loadAvailableAssistants = useCallback(async (isUpdate = false) => {
    try {
      setAssistantsLoading(true);
      setAssistantsError(null);
      
      // 🔧 Set manual update flag to prevent automatic intro messages
      if (isUpdate) {
        setIsManualUpdate(true);
      }
      
      console.log('🤖 Loading available assistants...', isUpdate ? '(update)' : '(initial)');
      
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
      
      // 🔧 Clear manual update flag after a short delay
      if (isUpdate) {
        setTimeout(() => setIsManualUpdate(false), 100);
      }
    }
  }, []);
  
  // 📖 URL parameter handling for direct assistant selection
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
  
  // 🤖 Update selected assistant when ID changes
  useEffect(() => {
    if (selectedAssistantId && availableAssistants.length > 0) {
      const assistant = availableAssistants.find(a => a.id === selectedAssistantId);
      if (assistant && assistant !== selectedAssistant) {
        const previousAssistant = selectedAssistant;
        setSelectedAssistant(assistant);
        console.log('🤖 Selected assistant updated:', {
          id: assistant.id,
          name: assistant.name,
          systemPromptPreview: assistant.system_prompt_preview,
          isManualUpdate
        });
        
        // 🔧 Only generate introduction message if this is not a manual update
        if (!isManualUpdate) {
          // Generate introduction message
          const introMessage = handleAssistantIntroduction(assistant, previousAssistant);
          if (onAssistantMessage) {
            onAssistantMessage(introMessage);
          }
        } else {
          console.log('🔧 Skipping automatic introduction during manual update');
        }
      }
    } else if (!selectedAssistantId && selectedAssistant) {
      // Generate deselection message (only if not a manual update)
      if (!isManualUpdate) {
        const dividerMessage: ChatMessage = {
          role: 'system',
          content: `Switched back to default AI chat`,
          assistantChanged: true,
          previousAssistantName: selectedAssistant.name
        };
        
        if (onAssistantMessage) {
          onAssistantMessage(dividerMessage);
        }
      }
      
      setSelectedAssistant(null);
    }
  }, [selectedAssistantId, availableAssistants, selectedAssistant, onAssistantMessage, isManualUpdate]);
  
  // Load assistants when component mounts
  useEffect(() => {
    loadAvailableAssistants();
  }, [loadAvailableAssistants]);
  
  // 🤖 Handle assistant selection
  const handleAssistantSelect = useCallback((assistantId: number | null) => {
    setSelectedAssistantId(assistantId);
    
    const newSearchParams = new URLSearchParams(searchParams);
    if (assistantId) {
      newSearchParams.set('assistant', assistantId.toString());
    } else {
      newSearchParams.delete('assistant');
    }
    setSearchParams(newSearchParams, { replace: true });
    
    console.log('🤖 Assistant selected:', assistantId);
  }, [searchParams, setSearchParams]);
  
  // 🤖 Handle assistant change (for backward compatibility with dropdown)
  const handleAssistantChange = useCallback((assistantId: string) => {
    if (assistantId === '') {
      // Clear assistant selection
      handleAssistantSelect(null);
    } else if (assistantId === '__manage__') {
      // Open embedded assistant manager
      setShowAssistantManager(true);
    } else {
      // Select assistant
      const id = parseInt(assistantId, 10);
      if (!isNaN(id)) {
        handleAssistantSelect(id);
      }
    }
  }, [handleAssistantSelect]);
  
  // 🤖 Generate assistant introduction message
  const handleAssistantIntroduction = useCallback((
    assistant: AssistantSummary, 
    previousAssistant: AssistantSummary | null
  ): ChatMessage => {
    const introMessage: ChatMessage = {
      role: 'assistant',
      content: `Hello! I'm **${assistant.name}**, your AI assistant.\n\n${assistant.description || assistant.system_prompt_preview || 'I\'m here to help you with your questions.'}\n\nHow can I assist you today?`,
      assistantId: assistant.id,
      assistantName: assistant.name,
      assistantIntroduction: true,
      assistantChanged: !!previousAssistant,
      previousAssistantName: previousAssistant?.name
    };
    
    console.log('🤖 Generated assistant introduction:', {
      assistantName: assistant.name,
      isSwitch: !!previousAssistant,
      previousAssistant: previousAssistant?.name
    });
    
    return introMessage;
  }, []);
  
  // 🧹 Clear assistant from URL
  const clearAssistantFromUrl = useCallback(() => {
    if (searchParams.has('assistant')) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('assistant');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  return {
    // State
    availableAssistants,
    selectedAssistantId,
    selectedAssistant,
    assistantsLoading,
    assistantsError,
    showAssistantManager,
    
    // Actions
    loadAvailableAssistants,
    handleAssistantSelect,
    handleAssistantChange,
    handleAssistantIntroduction,
    setShowAssistantManager,
    clearAssistantFromUrl
  };
};