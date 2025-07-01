// 📁 Unified Sidebar Component
// Toggles between Conversations and Project Folders with mutual exclusion
// Replaces the previous right-side project panel with a left-side folder system

import React from 'react';
import { MessageSquare, Folder, X } from 'lucide-react';
import { ConversationSidebar } from '../ConversationSidebar';
import { ProjectFoldersSidebar } from './ProjectFoldersSidebar';

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
  
  // Project props
  selectedProjectId: number | null;
  onProjectSelect: (projectId: number | null) => void;
  onProjectChange: () => Promise<void>;
  onProjectUpdated: (projectId: number) => void;
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
  selectedProjectId,
  onProjectSelect,
  onProjectChange,
  onProjectUpdated
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-80">
      {/* Sidebar container */}
      <div className="h-full w-full bg-white/95 backdrop-blur-sm border-r border-white/20 shadow-2xl flex flex-col">
        
        {/* Header with mode toggle */}
        <div className="flex items-center justify-between p-4 border-b border-white/20 flex-shrink-0">
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onModeChange('conversations')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer select-none ${
                mode === 'conversations'
                  ? 'bg-blue-500 text-white shadow-md font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              disabled={isStreaming}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chats</span>
            </button>
            
            <button
              onClick={() => onModeChange('projects')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer select-none ${
                mode === 'projects'
                  ? 'bg-green-500 text-white shadow-md font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              disabled={isStreaming}
            >
              <Folder className="w-4 h-4" />
              <span>Folders</span>
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
              selectedProjectId={selectedProjectId}
              onProjectSelect={onProjectSelect}
              onProjectChange={onProjectChange}
              onProjectUpdated={onProjectUpdated}
              isStreaming={isStreaming}
              onSelectConversation={onSelectConversation}
              onCreateNewConversation={onCreateNewConversation}
              currentConversationId={currentConversationId}
            />
          )}
        </div>
        
        {/* Streaming indicator */}
        {isStreaming && (
          <div className="mx-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
              <p className="text-sm text-amber-800 font-medium">AI is responding...</p>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              {mode === 'conversations' ? 'Chat switching disabled while streaming' : 'Folder switching disabled while streaming'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 