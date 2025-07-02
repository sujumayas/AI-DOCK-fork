/**
 * Folder Context Hook
 * 
 * Manages folder context separately from active chat context.
 * Folders are purely organizational - they only affect NEW chat creation,
 * never existing/active conversations.
 * 
 * Key Principles:
 * - Folder navigation is independent from active chat sessions
 * - Folder context only applies to NEW chat creation
 * - Folders organize saved conversations, don't modify active chats
 */

import { useState, useCallback } from 'react';
import { ProjectSummary } from '../../types/project';

interface FolderContextState {
  // Current folder being viewed in sidebar (organizational only)
  viewingFolderId: number | null;
  viewingFolder: ProjectSummary | null;
  
  // Folder context for new chat creation (only affects new chats)
  folderForNewChat: number | null;
  folderForNewChatData: ProjectSummary | null;
}

export const useFolderContext = () => {
  const [state, setState] = useState<FolderContextState>({
    viewingFolderId: null,
    viewingFolder: null,
    folderForNewChat: null,
    folderForNewChatData: null
  });
  
  /**
   * Navigate to a folder in the sidebar (organizational view only)
   * This does NOT affect any active chat session
   */
  const setViewingFolder = useCallback((folderId: number | null, folderData: ProjectSummary | null = null) => {
    setState(prev => ({
      ...prev,
      viewingFolderId: folderId,
      viewingFolder: folderData
    }));
    
    console.log('📁 Folder navigation (organizational only):', {
      folderId,
      folderName: folderData?.name,
      note: 'This does not affect active chat sessions'
    });
  }, []);
  
  /**
   * Set folder context for NEW chat creation
   * This will be used when creating a new chat to:
   * 1. Save the new chat to this folder
   * 2. Activate the folder's default assistant
   */
  const setFolderForNewChat = useCallback((folderId: number | null, folderData: ProjectSummary | null = null) => {
    setState(prev => ({
      ...prev,
      folderForNewChat: folderId,
      folderForNewChatData: folderData
    }));
    
    console.log('🆕 Folder context set for new chat creation:', {
      folderId,
      folderName: folderData?.name,
      defaultAssistant: folderData?.default_assistant_name,
      note: 'This will only affect NEW chats, not existing conversations'
    });
  }, []);
  
  /**
   * Clear all folder context
   * Usually called after a new chat is created or when starting fresh
   */
  const clearFolderContext = useCallback(() => {
    setState({
      viewingFolderId: null,
      viewingFolder: null,
      folderForNewChat: null,
      folderForNewChatData: null
    });
    
    console.log('🧹 Cleared all folder context');
  }, []);
  
  /**
   * Clear only the new chat folder context
   * Called after successfully creating a new chat
   */
  const clearNewChatFolderContext = useCallback(() => {
    setState(prev => ({
      ...prev,
      folderForNewChat: null,
      folderForNewChatData: null
    }));
    
    console.log('🧹 Cleared new chat folder context (keeping organizational view)');
  }, []);
  
  /**
   * Get the default assistant ID for the current new chat folder
   */
  const getNewChatFolderDefaultAssistantId = useCallback((): number | null => {
    return state.folderForNewChatData?.default_assistant_id || null;
  }, [state.folderForNewChatData]);
  
  /**
   * Check if we're currently viewing a specific folder
   */
  const isViewingFolder = useCallback((folderId: number): boolean => {
    return state.viewingFolderId === folderId;
  }, [state.viewingFolderId]);
  
  /**
   * Check if we have folder context set for new chat creation
   */
  const hasNewChatFolderContext = useCallback((): boolean => {
    return state.folderForNewChat !== null;
  }, [state.folderForNewChat]);
  
  return {
    // Current state
    ...state,
    
    // Navigation actions (organizational only)
    setViewingFolder,
    isViewingFolder,
    
    // New chat context actions
    setFolderForNewChat,
    clearNewChatFolderContext,
    getNewChatFolderDefaultAssistantId,
    hasNewChatFolderContext,
    
    // General actions
    clearFolderContext
  };
};