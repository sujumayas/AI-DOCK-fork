// 📁 Project Folders Sidebar - Simplified Version
// Shows project folders as simple containers with default assistants
// Replaces the complex project manager with a folder-based approach

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
  Search
} from 'lucide-react';
import { ProjectSummary, ProjectCreateRequest, ProjectUpdateRequest } from '../../../types/project';
import { projectService } from '../../../services/projectService';
import { CreateProjectFolderModal } from './CreateProjectFolderModal';
import { EditProjectFolderModal } from './EditProjectFolderModal';

interface ProjectFoldersSidebarProps {
  selectedProjectId: number | null;
  onProjectSelect: (projectId: number | null) => void;
  onProjectChange: () => Promise<void>;
  onProjectUpdated: (projectId: number) => void;
  isStreaming: boolean;
  onSelectConversation?: (conversationId: number) => void;
  onCreateNewConversation?: () => void;
  currentConversationId?: number;
}

export const ProjectFoldersSidebar: React.FC<ProjectFoldersSidebarProps> = ({
  selectedProjectId,
  onProjectSelect,
  onProjectChange,
  onProjectUpdated,
  isStreaming,
  onSelectConversation,
  onCreateNewConversation
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

  // Handle folder selection
  const handleFolderSelect = (folderId: number | null) => {
    if (isStreaming) return;
    
    onProjectSelect(folderId);
    setDropdownOpen(null);
  };

  // Handle creating new conversation in folder
  const handleNewConversationInFolder = (folderId: number | null) => {
    if (isStreaming) return;
    
    // Select the folder first
    onProjectSelect(folderId);
    
    // Then create new conversation
    if (onCreateNewConversation) {
      onCreateNewConversation();
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
      
      // If the deleted folder was selected, clear selection
      if (selectedProjectId === folderId) {
        onProjectSelect(null);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  // Render folder item
  const renderFolderItem = (folder: ProjectSummary) => (
    <div
      key={folder.id}
      className={`group relative mx-2 mb-1 rounded-lg transition-all duration-200 ${
        selectedProjectId === folder.id
          ? 'bg-blue-50 border border-blue-200'
          : isStreaming
          ? 'bg-gray-50 border border-gray-200 opacity-60'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div
        onClick={() => handleFolderSelect(folder.id)}
        className={`flex items-center p-3 transition-colors ${
          isStreaming ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        title={isStreaming ? 'Cannot switch folders while AI is responding' : ''}
      >
        {/* Folder icon */}
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg mr-3 ${
          selectedProjectId === folder.id
            ? 'bg-blue-100 text-blue-600'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {folder.icon ? (
            <span className="text-sm">{folder.icon}</span>
          ) : selectedProjectId === folder.id ? (
            <FolderOpen className="w-4 h-4" />
          ) : (
            <Folder className="w-4 h-4" />
          )}
        </div>

        {/* Folder info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-800 truncate">
              {folder.name}
            </h3>
            {folder.is_favorited && (
              <Star className="w-3 h-3 text-yellow-400 fill-current" />
            )}
            {folder.has_default_assistant && (
              <Bot className="w-3 h-3 text-blue-500" title={`Default: ${folder.default_assistant_name}`} />
            )}
          </div>

          {folder.description && (
            <p className="text-xs text-gray-500 truncate mt-1">
              {folder.description}
            </p>
          )}

          <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
            <div className="flex items-center">
              <MessageSquare className="w-3 h-3 mr-1" />
              {folder.conversation_count} chats
            </div>
            {folder.has_default_assistant && (
              <div className="flex items-center">
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
              className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen === folder.id && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => handleNewConversationInFolder(folder.id)}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Chat in Folder
                  </button>
                  
                  <button
                    onClick={() => handleEditFolder(folder)}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Folder
                  </button>
                  
                  <button
                    onClick={() => handleToggleFavorite(folder.id)}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Star className={`w-4 h-4 mr-2 ${folder.is_favorited ? 'fill-current text-yellow-400' : ''}`} />
                    {folder.is_favorited ? 'Remove Favorite' : 'Add Favorite'}
                  </button>
                  
                  <button
                    onClick={() => handleArchiveFolder(folder.id)}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </button>
                  
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Folder className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Folders</h2>
            {activeFolders.length > 0 && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                {activeFolders.length}
              </span>
            )}
          </div>
          
          {!isStreaming && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Create new folder"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading folders...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadFolders}
              className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="py-2">
            {/* All Conversations option */}
            <div className="mx-2 mb-3">
              <button
                onClick={() => handleFolderSelect(null)}
                disabled={isStreaming}
                className={`w-full p-3 rounded-lg transition-all duration-200 ${
                  selectedProjectId === null
                    ? 'bg-blue-50 border border-blue-200'
                    : isStreaming
                    ? 'bg-gray-50 border border-gray-200 opacity-60'
                    : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-medium text-gray-900">All Conversations</h4>
                    <p className="text-xs text-gray-500">View all chats across folders</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Active folders */}
            {activeFolders.length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Active Folders
                </div>
                {activeFolders.map(renderFolderItem)}
              </div>
            )}

            {/* Archived folders */}
            {archivedFolders.length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Archived
                </div>
                {archivedFolders.map(renderFolderItem)}
              </div>
            )}

            {/* Empty state */}
            {activeFolders.length === 0 && archivedFolders.length === 0 && (
              <div className="text-center py-8 px-4">
                <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No folders yet</p>
                <p className="text-gray-400 text-sm mt-1">Create folders to organize your conversations</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          onProjectSelect(folderId);
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
            onProjectChange();
            loadFolders();
          }}
          onFolderDeleted={(folderId) => {
            if (selectedProjectId === folderId) {
              onProjectSelect(null);
            }
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