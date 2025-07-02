// 📁 Unified Sidebar Component - Modern Glassmorphism Design
// Toggles between Conversations, Project Folders, and Assistants with complete separation
// Folders are purely organizational and don't interfere with active chats

import React from 'react';
import { MessageSquare, Folder, Bot, X } from 'lucide-react';
import { ConversationSidebar } from '../ConversationSidebar';
import { ProjectFoldersSidebar } from './ProjectFoldersSidebar';
import { AssistantSidebar } from './AssistantSidebar';
import { ProjectSummary } from '../../../types/project';

type SidebarMode = 'conversations' | 'projects' | 'assistants';

interface UnifiedSidebarProps {
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  isOpen: boolean;
  onClose: () => void;
  
  // Conversation props
  onSelectConversation: (conversationId: number) => void;
  onCreateNewConversation: () => void;
  currentConversationId?: number;
  refreshTrigger?: number;
  onSidebarReady?: (updateFn: (id: number, count: number, backendData?: any) => void, addFn: (conv: any) => void) => void;
  isStreaming?: boolean;
  
  // 🔧 FIXED: Folder props (organizational only, no active chat interference)
  onFolderNavigate: (folderId: number | null, folderData: ProjectSummary | null) => void;
  onNewChatInFolder: (folderId: number | null, folderData: ProjectSummary | null) => void;
  onProjectChange: () => Promise<void>;
  onProjectUpdated: (projectId: number) => void;
  viewingFolderId: number | null;
  viewingFolderName: string;
  
  // 🤖 Assistant props
  onSelectAssistant?: (assistantId: number | null) => void;
  onCreateNewAssistant?: () => void;
  currentAssistantId?: number;
  onAssistantChange?: () => void;
  onAssistantUpdated?: (assistantId: number) => void;
}

export const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
  mode,
  onModeChange,
  isOpen,
  onClose,
  onSelectConversation,
  onCreateNewConversation,
  currentConversationId,
  refreshTrigger,
  onSidebarReady,
  isStreaming = false,
  onFolderNavigate,
  onNewChatInFolder,
  onProjectChange,
  onProjectUpdated,
  viewingFolderId,
  viewingFolderName,
  onSelectAssistant,
  onCreateNewAssistant,
  currentAssistantId,
  onAssistantChange,
  onAssistantUpdated
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-80">
      {/* Sidebar container with glassmorphism */}
      <div className="h-full w-full bg-white/5 backdrop-blur-lg border-r border-white/10 shadow-2xl flex flex-col">
        
        {/* Header with mode toggle */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center space-x-0.5 bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20">
            <button
              onClick={() => onModeChange('conversations')}
              className={`group flex items-center space-x-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-300 cursor-pointer select-none hover:px-3 hover:space-x-2 ${
                mode === 'conversations'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg font-semibold transform scale-105 px-3 space-x-2'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
              disabled={isStreaming}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span className={`transition-all duration-300 whitespace-nowrap ${
                mode === 'conversations' 
                  ? 'opacity-100 max-w-none' 
                  : 'opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-none overflow-hidden'
              }`}>
                Chats
              </span>
            </button>
            
            <button
              onClick={() => onModeChange('projects')}
              className={`group flex items-center space-x-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-300 cursor-pointer select-none hover:px-3 hover:space-x-2 ${
                mode === 'projects'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg font-semibold transform scale-105 px-3 space-x-2'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
              disabled={isStreaming}
            >
              <Folder className="w-3.5 h-3.5 flex-shrink-0" />
              <span className={`transition-all duration-300 whitespace-nowrap ${
                mode === 'projects' 
                  ? 'opacity-100 max-w-none' 
                  : 'opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-none overflow-hidden'
              }`}>
                Folders
              </span>
            </button>
            
            <button
              onClick={() => onModeChange('assistants')}
              className={`group flex items-center space-x-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-300 cursor-pointer select-none hover:px-3 hover:space-x-2 ${
                mode === 'assistants'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg font-semibold transform scale-105 px-3 space-x-2'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
              disabled={isStreaming}
            >
              <Bot className="w-3.5 h-3.5 flex-shrink-0" />
              <span className={`transition-all duration-300 whitespace-nowrap ${
                mode === 'assistants' 
                  ? 'opacity-100 max-w-none' 
                  : 'opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-none overflow-hidden'
              }`}>
                Assistants
              </span>
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/10 hover:scale-105 transform"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content area */}
        <div className="flex-1 min-h-0">
          {mode === 'conversations' ? (
            <ConversationSidebar
              isOpen={true}
              onClose={() => {}} // Don't close on internal actions
              onSelectConversation={onSelectConversation}
              onCreateNew={onCreateNewConversation}
              currentConversationId={currentConversationId}
              refreshTrigger={refreshTrigger}
              onSidebarReady={onSidebarReady}
              isStreaming={isStreaming}
              embedded={true}
            />
          ) : mode === 'projects' ? (
            <ProjectFoldersSidebar
              onFolderNavigate={onFolderNavigate}
              onNewChatInFolder={onNewChatInFolder}
              onProjectChange={onProjectChange}
              onProjectUpdated={onProjectUpdated}
              isStreaming={isStreaming}
              onSelectConversation={onSelectConversation}
              onCreateNewConversation={onCreateNewConversation}
              currentConversationId={currentConversationId}
              refreshTrigger={refreshTrigger}
              viewingFolderId={viewingFolderId}
              viewingFolderName={viewingFolderName}
            />
          ) : (
            <AssistantSidebar
              isOpen={true}
              onClose={() => {}} // Don't close on internal actions
              onSelectAssistant={onSelectAssistant || (() => {})}
              onCreateNew={onCreateNewAssistant || (() => {})}
              currentAssistantId={currentAssistantId}
              refreshTrigger={refreshTrigger}
              isStreaming={isStreaming}
              embedded={true}
              onAssistantChange={onAssistantChange}
              onAssistantUpdated={onAssistantUpdated}
            />
          )}
        </div>
        
        {/* Streaming indicator with glassmorphism */}
        {isStreaming && (
          <div className="mx-4 mb-4 p-3 bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 rounded-xl flex-shrink-0 shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-amber-300 rounded-full animate-pulse shadow-lg"></div>
              <p className="text-sm text-amber-100 font-medium">AI is responding...</p>
            </div>
            <p className="text-xs text-amber-200 mt-1">
              {mode === 'conversations' ? 'Chat switching disabled while streaming' : 
               mode === 'projects' ? 'Folder switching disabled while streaming' : 
               'Assistant switching disabled while streaming'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};