// 📁 Project Folders Sidebar - FIXED VERSION
// Pure organizational folders that don't interfere with active chats
// Folders only organize saved conversations and set context for NEW chat creation

import React, { useEffect, useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  Plus, 
  MoreHorizontal, 
  Settings, 
  Archive, 
  Trash2, 
  Star,
  Bot,
  MessageSquare,
  Loader2,
  Search,
  ArrowLeft
} from 'lucide-react';
import { ProjectSummary, ProjectCreateRequest, ProjectUpdateRequest } from '../../../types/project';
import { projectService } from '../../../services/projectService';
import { CreateProjectFolderModal } from './CreateProjectFolderModal';
import { EditProjectFolderModal } from './EditProjectFolderModal';
import { ProjectConversationList } from './ProjectConversationList';

interface ProjectFoldersSidebarProps {
  // 🔧 FIXED: Remove selectedProjectId - folders don't affect active chat
  onFolderNavigate: (folderId: number | null, folderData: ProjectSummary | null) => void;
  onNewChatInFolder: (folderId: number | null, folderData: ProjectSummary | null) => void;
  onProjectChange: () => Promise<void>;
  onProjectUpdated: (projectId: number) => void;
  isStreaming: boolean;
  onSelectConversation?: (conversationId: number) => void;
  onCreateNewConversation?: () => void;
  currentConversationId?: number;
  refreshTrigger?: number;
  
  // 🆕 NEW: Viewing state for pure organizational navigation
  viewingFolderId: number | null;
  viewingFolderName: string;
}

export const ProjectFoldersSidebar: React.FC<ProjectFoldersSidebarProps> = ({
  onFolderNavigate,
  onNewChatInFolder,
  onProjectChange,
  onProjectUpdated,
  isStreaming,
  onSelectConversation,
  onCreateNewConversation,
  currentConversationId,
  refreshTrigger,
  viewingFolderId,
  viewingFolderName
}) => {
  // State
  const [folders, setFolders] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectSummary | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  // Load folders
  const loadFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.getProjects();
      setFolders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  // Load folders on mount
  useEffect(() => {
    loadFolders();
  }, []);

  // 🔧 FIXED: Pure folder navigation - no impact on active chat
  const handleFolderSelect = (folderId: number | null) => {
    if (isStreaming) return;
    
    if (folderId === null) {
      // Navigate back to folders list view
      onFolderNavigate(null, null);
    } else {
      // Navigate to folder view (organizational only)
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        onFolderNavigate(folderId, folder);
        console.log('📁 Navigating to folder (organizational only):', {
          name: folder.name,
          id: folder.id,
          note: 'This does NOT affect any active chat session'
        });
      }
    }
    setDropdownOpen(null);
  };
  
  // 🔧 FIXED: Handle going back to folder list view
  const handleBackToFolders = () => {
    onFolderNavigate(null, null);
  };

  // 🆕 NEW: Separate handler for creating new chat in folder
  const handleNewConversationInFolder = (folderId: number | null) => {
    if (isStreaming) return;
    
    const folder = folderId ? folders.find(f => f.id === folderId) || null : null;
    
    console.log('🆕 Creating new chat in folder:', {
      folderId,
      folderName: folder?.name,
      defaultAssistant: folder?.default_assistant_name,
      note: 'This will create a NEW chat tab and set folder context'
    });
    
    // Set folder context for the new chat
    onNewChatInFolder(folderId, folder);
    
    // Create new conversation with the folder context
    if (onCreateNewConversation) {
      onCreateNewConversation();
    }
  };
  
  // 🆕 NEW: Handle new conversation in currently viewed folder
  const handleNewConversationInCurrentFolder = () => {
    if (isStreaming) return;
    
    if (viewingFolderId) {
      handleNewConversationInFolder(viewingFolderId);
    }
  };

  // Filter folders based on search
  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (folder.description && folder.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeFolders = filteredFolders.filter(f => !f.is_archived);
  const archivedFolders = filteredFolders.filter(f => f.is_archived);

  // Handle folder actions
  const handleEditFolder = (folder: ProjectSummary) => {
    setEditingFolder(folder);
    setShowEditModal(true);
    setDropdownOpen(null);
  };

  const handleToggleFavorite = async (folderId: number) => {
    try {
      await projectService.toggleFavorite(folderId);
      await loadFolders();
      setDropdownOpen(null);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleArchiveFolder = async (folderId: number) => {
    try {
      await projectService.archiveProject(folderId);
      await loadFolders();
      setDropdownOpen(null);
    } catch (error) {
      console.error('Failed to archive folder:', error);
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    try {
      await projectService.deleteProject(folderId);
      await loadFolders();
      setDropdownOpen(null);
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  // Render folder item
  const renderFolderItem = (folder: ProjectSummary) => (
    <div
      key={folder.id}
      className={`group relative mx-2 mb-2 rounded-xl transition-all duration-200 ${
        viewingFolderId === folder.id
          ? 'bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 shadow-lg'
          : isStreaming
          ? 'bg-white/5 backdrop-blur-sm border border-white/10 opacity-60'
          : 'hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:shadow-lg hover:scale-[1.02] transform'
      }`}
    >
      <div
        onClick={() => handleFolderSelect(folder.id)}
        className={`flex items-center p-3 transition-colors ${
          isStreaming ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        title={isStreaming ? 'Cannot switch folders while AI is responding' : 'View folder contents'}
      >
        {/* Folder icon */}
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl mr-3 backdrop-blur-sm border shadow-md ${
          viewingFolderId === folder.id
            ? 'bg-blue-500/30 border-blue-400/40 text-blue-100'
            : 'bg-white/10 border-white/20 text-blue-200'
        }`}>
          {folder.icon ? (
            <span className="text-sm">{folder.icon}</span>
          ) : viewingFolderId === folder.id ? (
            <FolderOpen className="w-5 h-5" />
          ) : (
            <Folder className="w-5 h-5" />
          )}
        </div>

        {/* Folder info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-white truncate">
              {folder.name}
            </h3>
            {folder.is_favorited && (
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
            )}
            {folder.has_default_assistant && (
              <div 
                className="flex items-center px-2 py-1 rounded-full bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-200 text-xs" 
                title={`New chats in this folder will use ${folder.default_assistant_name}`}
              >
                <Bot className="w-3 h-3 mr-1" />
                <span className="truncate max-w-[100px]">{folder.default_assistant_name}</span>
              </div>
            )}
          </div>

          {folder.description && (
            <p className="text-xs text-blue-300 truncate mt-1">
              {folder.description}
            </p>
          )}

          <div className="flex items-center space-x-3 mt-2 text-xs text-blue-400">
            <div className="flex items-center">
              <MessageSquare className="w-3 h-3 mr-1" />
              {folder.conversation_count} chats
            </div>
            {folder.has_default_assistant && (
              <div className="flex items-center text-blue-300">
                <Bot className="w-3 h-3 mr-1" />
                {folder.default_assistant_name}
              </div>
            )}
          </div>
        </div>

        {/* Actions dropdown */}
        {!isStreaming && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(dropdownOpen === folder.id ? null : folder.id);
              }}
              className="p-2 text-blue-300 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 transform"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen === folder.id && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 z-10">
                <div className="py-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewConversationInFolder(folder.id);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Chat in Folder
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditFolder(folder);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Folder
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(folder.id);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Star className={`w-4 h-4 mr-2 ${folder.is_favorited ? 'fill-current text-yellow-400' : ''}`} />
                    {folder.is_favorited ? 'Remove from Favorites' : 'Add to Favorites'}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveFolder(folder.id);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {folder.is_archived ? 'Unarchive' : 'Archive'}
                  </button>
                  
                  <div className="border-t border-white/20 my-1"></div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder.id);
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Folder
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // If viewing a specific folder, show its conversation list
  if (viewingFolderId) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with back button */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToFolders}
                className="p-2 text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg transition-all duration-200 hover:scale-105 transform"
                title="Back to folders"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-lg shadow-md">
                <FolderOpen className="w-4 h-4 text-blue-200" />
              </div>
              <h2 className="text-lg font-semibold text-white">{viewingFolderName}</h2>
            </div>
            
            {!isStreaming && (
              <button
                onClick={handleNewConversationInCurrentFolder}
                className="p-2 text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg transition-all duration-200 hover:scale-105 transform"
                title="New conversation in this folder"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Folder conversation list */}
        <div className="flex-1 overflow-hidden">
          <ProjectConversationList
            projectId={viewingFolderId}
            projectName={viewingFolderName}
            currentConversationId={currentConversationId}
            onSelectConversation={onSelectConversation}
            onNewConversation={handleNewConversationInCurrentFolder}
            isStreaming={isStreaming}
            refreshTrigger={refreshTrigger}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  // Otherwise show folder list
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-lg shadow-md">
              <Folder className="w-4 h-4 text-blue-200" />
            </div>
            <h2 className="text-lg font-semibold text-white">Folders</h2>
            {activeFolders.length > 0 && (
              <span className="px-2 py-1 text-xs bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-200 rounded-full">
                {activeFolders.length}
              </span>
            )}
          </div>
          
          {!isStreaming && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg transition-all duration-200 hover:scale-105 transform"
              title="Create new folder"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-300" />
          <input
            type="text"
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 text-sm text-white placeholder-blue-300 transition-all duration-200"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-300" />
            <span className="ml-2 text-blue-200">Loading folders...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={loadFolders}
              className="mt-3 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="py-2">

            {/* Active folders */}
            {activeFolders.length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-blue-300 uppercase tracking-wide">
                  Active Folders
                </div>
                {activeFolders.map(renderFolderItem)}
              </div>
            )}

            {/* Archived folders */}
            {archivedFolders.length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-blue-300 uppercase tracking-wide">
                  Archived
                </div>
                {archivedFolders.map(renderFolderItem)}
              </div>
            )}

            {/* Empty state */}
            {activeFolders.length === 0 && archivedFolders.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg mx-auto mb-4">
                  <Folder className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-white font-medium">No folders yet</p>
                <p className="text-blue-300 text-sm mt-1">Create folders to organize your conversations</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-medium"
                >
                  Create First Folder
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateProjectFolderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onFolderCreated={(folderId) => {
          // Set context for new chat in the created folder
          const newFolder = folders.find(f => f.id === folderId) || null;
          if (newFolder) {
            onNewChatInFolder(folderId, newFolder);
          }
          onProjectChange();
          loadFolders();
        }}
      />

      {editingFolder && (
        <EditProjectFolderModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingFolder(null);
          }}
          folder={editingFolder}
          onFolderUpdated={(folderId) => {
            onProjectUpdated(folderId);
            loadFolders();
          }}
          onFolderDeleted={(folderId) => {
            onProjectChange();
            loadFolders();
          }}
        />
      )}

      {/* Click outside to close dropdown */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setDropdownOpen(null)}
        />
      )}
    </div>
  );
};