// 📁 Unified Sidebar Component - Modern Glassmorphism Design
// Toggles between Conversations and Project Folders with complete separation
// Folders are purely organizational and don't interfere with active chats

import React from 'react';
import { MessageSquare, Folder, X } from 'lucide-react';
import { ConversationSidebar } from '../ConversationSidebar';
import { ProjectFoldersSidebar } from './ProjectFoldersSidebar';
import { ProjectSummary } from '../../../types/project';

type SidebarMode = 'conversations' | 'projects';

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
  viewingFolderName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-80">
      {/* Sidebar container with glassmorphism */}
      <div className="h-full w-full bg-white/5 backdrop-blur-lg border-r border-white/10 shadow-2xl flex flex-col">
        
        {/* Header with mode toggle */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center space-x-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20">
            <button
              onClick={() => onModeChange('conversations')}
              className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer select-none ${
                mode === 'conversations'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg font-semibold transform scale-105'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
              disabled={isStreaming}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chats</span>
            </button>
            
            <button
              onClick={() => onModeChange('projects')}
              className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer select-none ${
                mode === 'projects'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg font-semibold transform scale-105'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
              disabled={isStreaming}
            >
              <Folder className="w-4 h-4" />
              <span>Folders</span>
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
          ) : (
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
              {mode === 'conversations' ? 'Chat switching disabled while streaming' : 'Folder switching disabled while streaming'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};