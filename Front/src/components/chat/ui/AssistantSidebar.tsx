// 🤖 Assistant Sidebar Component - Glassmorphism Design
// Modern sidebar for managing custom AI assistants with complete CRUD functionality
// Follows the same design patterns as ProjectFoldersSidebar and ConversationSidebar

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Bot, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye,
  EyeOff,
  MessageSquare,
  Settings,
  MoreHorizontal, 
  Star,
  Archive,
  Clock,
  Calendar,
  Loader2,
  Sparkles,
  X,
  User,
  Zap
} from 'lucide-react';
import { AssistantSummary, Assistant } from '../../../types/assistant';
import { assistantService } from '../../../services/assistantService';
import { CreateAssistantModal } from '../../assistant/CreateAssistantModal';
import { EditAssistantModal } from '../../assistant/EditAssistantModal';
import { formatConversationTimestamp } from '../../../utils/chatHelpers';

interface AssistantSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAssistant: (assistantId: number | null) => void;
  onCreateNew: () => void;
  currentAssistantId?: number;
  refreshTrigger?: number;
  isStreaming?: boolean;
  embedded?: boolean;
  onAssistantChange?: () => void;
  onAssistantUpdated?: (assistantId: number) => void;
}

export const AssistantSidebar: React.FC<AssistantSidebarProps> = ({
  isOpen,
  onClose,
  onSelectAssistant,
  onCreateNew,
  currentAssistantId,
  refreshTrigger,
  isStreaming = false,
  embedded = false,
  onAssistantChange,
  onAssistantUpdated
}) => {
  // State management
  const [assistants, setAssistants] = useState<AssistantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AssistantSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<number | null>(null);
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Load assistants on mount and when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadAssistants();
    }
  }, [isOpen]);

  // Reactive refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && isOpen) {
      console.log('🔄 Refreshing assistants due to trigger:', refreshTrigger);
      loadAssistants();
    }
  }, [refreshTrigger, isOpen]);

  // Search assistants when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchAssistants();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Debug dropdown state changes
  useEffect(() => {
    console.log('📄 Dropdown state changed:', { dropdownOpen, selectedForDelete });
  }, [dropdownOpen, selectedForDelete]);

  // Calculate dropdown position when dropdown opens
  const calculateDropdownPosition = useCallback((buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const containerRect = buttonElement.closest('.flex.flex-col')?.getBoundingClientRect();
    
    if (containerRect) {
      // Position relative to the sidebar container
      return {
        top: rect.bottom - containerRect.top + 5,
        right: containerRect.right - rect.left - rect.width
      };
    }
    
    // Fallback to fixed positioning
    return {
      top: rect.bottom + 5,
      right: window.innerWidth - rect.right
    };
  }, []);

  // Load assistants from API
  const loadAssistants = useCallback(async (append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      const offset = append ? assistants.length : 0;
      
      const response = await assistantService.getAssistants({
        limit: 50,
        offset,
        sort_by: 'updated_at',
        sort_order: 'desc',
        include_inactive: true
      });
      
      if (append) {
        setAssistants(prev => [...prev, ...response.assistants]);
      } else {
        setAssistants(response.assistants);
      }
      
      setTotalCount(response.total_count);
      setHasMore(response.has_more);
      
    } catch (error: any) {
      console.error('❌ Failed to load assistants:', error);
      setError(error.message || 'Failed to load assistants');
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [assistants.length]);

  // Search assistants
  const searchAssistants = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      
      const results = await assistantService.searchAssistants(searchQuery.trim(), 20);
      
      setSearchResults(results);
      
    } catch (error: any) {
      console.error('❌ Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle assistant selection
  const handleSelectAssistant = (assistantId: number | null) => {
    if (isStreaming) {
      console.log('🚫 Cannot switch assistants while AI is streaming a response');
      return;
    }
    
    onSelectAssistant(assistantId);
  };

  // Handle assistant deletion
  const handleDeleteAssistant = async (assistantId: number) => {
    try {
      await assistantService.deleteAssistant(assistantId);
      
      // Remove from state
      setAssistants(prev => prev.filter(a => a.id !== assistantId));
      setSearchResults(prev => prev.filter(a => a.id !== assistantId));
      setSelectedForDelete(null);
      
      if (onAssistantChange) {
        onAssistantChange();
      }
      
      console.log('✅ Assistant deleted successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to delete assistant:', error);
      setError(error.message || 'Failed to delete assistant');
    }
  };

  // Handle editing assistant
  const handleEditAssistant = async (assistant: AssistantSummary) => {
    if (isStreaming) {
      console.log('🚫 Cannot edit assistant while streaming is active');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Fetch full assistant data for editing
      const fullAssistant = await assistantService.getAssistant(assistant.id);
      setEditingAssistant(fullAssistant);
      setShowEditModal(true);
      setDropdownOpen(null);
      
    } catch (error: any) {
      console.error('❌ Failed to load assistant for editing:', error);
      setError(error.message || 'Failed to load assistant for editing');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle toggle active status
  const handleToggleActive = async (assistantId: number, currentStatus: boolean) => {
    try {
      await assistantService.updateAssistant(assistantId, {
        is_active: !currentStatus
      });
      
      // Update in state
      const updateAssistant = (a: AssistantSummary) => 
        a.id === assistantId ? { ...a, is_active: !currentStatus } : a;
      
      setAssistants(prev => prev.map(updateAssistant));
      setSearchResults(prev => prev.map(updateAssistant));
      setDropdownOpen(null);
      
      if (onAssistantUpdated) {
        onAssistantUpdated(assistantId);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to toggle assistant status:', error);
      setError(error.message || 'Failed to update assistant status');
    }
  };

  // Handle scroll for infinite loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    if (isNearBottom && hasMore && !isLoadingMore && !isLoading && !searchQuery.trim()) {
      console.log('🔄 Loading more assistants due to scroll');
      loadAssistants(true);
    }
  }, [hasMore, isLoadingMore, isLoading, searchQuery, loadAssistants]);

  // Group assistants by status for better organization
  const groupAssistantsByStatus = useCallback((assistants: AssistantSummary[]) => {
    const groups = {
      active: [] as AssistantSummary[],
      inactive: [] as AssistantSummary[]
    };

    // Sort assistants by updated date (most recent first)
    const sortedAssistants = [...assistants].sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    sortedAssistants.forEach(assistant => {
      if (assistant.is_active) {
        groups.active.push(assistant);
      } else {
        groups.inactive.push(assistant);
      }
    });

    return groups;
  }, []);

  // Get assistants to display (search results or all)
  const displayAssistants = searchQuery.trim() ? searchResults : assistants;
  const groupedAssistants = !searchQuery.trim() ? groupAssistantsByStatus(displayAssistants) : null;

  // Render assistant item
  const renderAssistantItem = (assistant: AssistantSummary) => (
    <div
      key={assistant.id}
      className={`group relative mx-2 mb-2 rounded-xl transition-all duration-200 ${
        currentAssistantId === assistant.id
          ? 'bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 shadow-lg'
          : isStreaming
          ? 'bg-white/5 backdrop-blur-sm border border-white/10 opacity-60'
          : 'hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:shadow-lg hover:scale-[1.02] transform'
      }`}
    >
      {/* Assistant item */}
      <div
        onClick={() => handleSelectAssistant(assistant.id)}
        className={`flex items-start p-3 transition-colors ${
          isStreaming 
            ? 'cursor-not-allowed' 
            : 'cursor-pointer'
        }`}
        title={isStreaming ? 'Cannot switch assistants while AI is responding' : 'Select this assistant'}
      >
        {/* Assistant icon */}
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl mr-3 backdrop-blur-sm border shadow-md ${
          currentAssistantId === assistant.id
            ? 'bg-blue-500/30 border-blue-400/40 text-blue-100'
            : assistant.is_active
            ? 'bg-green-500/20 border-green-400/30 text-green-200'
            : 'bg-gray-500/20 border-gray-400/30 text-gray-300'
        }`}>
          <Bot className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name and status */}
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-white truncate">
              {assistant.name}
            </h3>
            {!assistant.is_active && (
              <span className="px-2 py-1 text-xs bg-gray-500/20 backdrop-blur-sm border border-gray-400/30 text-gray-300 rounded-full">
                Inactive
              </span>
            )}
            {assistant.is_new && (
              <Sparkles className="w-3 h-3 text-yellow-400" />
            )}
          </div>
          
          {/* Description */}
          {assistant.description && (
            <p className="text-xs text-blue-300 truncate mt-1">
              {assistant.description}
            </p>
          )}
          
          {/* Metadata */}
          <div className="flex items-center space-x-3 mt-2 text-xs text-blue-300">
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatConversationTimestamp(assistant.created_at)}
            </div>
          </div>
        </div>
        
        {/* Actions dropdown */}
        {!isStreaming && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newState = dropdownOpen === assistant.id ? null : assistant.id;
                console.log('🔴 Three-dot button clicked for assistant:', assistant.id, 'new state:', newState);
                
                if (newState) {
                  // Calculate position when opening dropdown
                  const position = calculateDropdownPosition(e.currentTarget);
                  setDropdownPosition(position);
                } else {
                  setDropdownPosition(null);
                }
                
                setDropdownOpen(newState);
              }}
              className="p-2 text-blue-300 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 transform cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* Delete confirmation */}
      {selectedForDelete === assistant.id && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-lg rounded-xl border border-red-400/30 flex items-center justify-center shadow-2xl">
          <div className="text-center p-4">
            <p className="text-sm text-white font-medium mb-4">Delete "{assistant.name}"?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => handleDeleteAssistant(assistant.id)}
                className="px-4 py-2 bg-red-500/80 backdrop-blur-sm border border-red-400/50 text-white text-xs rounded-lg hover:bg-red-400/80 transition-all duration-200 font-medium shadow-lg"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedForDelete(null)}
                className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-blue-200 text-xs rounded-lg hover:bg-white/20 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render status group section
  const renderStatusGroup = (title: string, assistants: AssistantSummary[], icon: React.ReactNode) => {
    if (assistants.length === 0) return null;
    
    return (
      <div key={title} className="mb-6">
        <div className="sticky top-0 z-10 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {icon}
              <h3 className="text-xs font-semibold text-blue-200 uppercase tracking-wide">
                {title}
              </h3>
            </div>
            <span className="text-xs text-blue-300 bg-white/10 backdrop-blur-sm border border-white/20 px-2 py-1 rounded-full">
              {assistants.length}
            </span>
          </div>
        </div>
        <div className="py-1">
          {assistants.map(renderAssistantItem)}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  // Content shared between embedded and standalone modes
  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-lg shadow-md">
            <Bot className="w-4 h-4 text-blue-200" />
          </div>
          <h2 className="text-lg font-semibold text-white">Assistants</h2>
          {totalCount > 0 && (
            <span className="px-2 py-1 text-xs bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-200 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={isStreaming ? undefined : () => setShowCreateModal(true)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isStreaming
                ? 'text-blue-400 cursor-not-allowed opacity-50'
                : 'text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:scale-105 transform'
            }`}
            title={isStreaming ? 'Cannot create assistant while AI is responding' : 'Create new assistant'}
            disabled={isStreaming}
          >
            <Plus className="w-4 h-4" />
          </button>
          {!embedded && (
            <button
              onClick={onClose}
              className="p-2 text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg transition-all duration-200 hover:scale-105 transform"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Search box */}
      <div className="p-4 border-b border-white/10 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-300" />
          <input
            type="text"
            placeholder="Search assistants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 text-sm text-white placeholder-blue-300 transition-all duration-200"
          />
          
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-blue-300" />
          )}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-500/20 backdrop-blur-sm border border-red-400/30 mx-4 mt-4 rounded-xl flex-shrink-0">
          <p className="text-red-200 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-100 text-xs mt-1 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Streaming notice */}
      {isStreaming && (
        <div className="mx-4 mb-2 p-3 bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 rounded-xl flex-shrink-0 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-amber-300 rounded-full animate-pulse shadow-lg"></div>
            <p className="text-sm text-amber-100 font-medium">AI is responding...</p>
          </div>
          <p className="text-xs text-amber-200 mt-1">
            Assistant switching is disabled while streaming
          </p>
        </div>
      )}
      
      {/* Assistant list */}
      <div 
        className="flex-1 overflow-y-auto min-h-0 scroll-smooth conversation-scrollbar"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-300" />
            <span className="ml-2 text-blue-200">Loading assistants...</span>
          </div>
        ) : displayAssistants.length === 0 ? (
          <div className="text-center py-8 px-4">
            {searchQuery.trim() ? (
              <div>
                <div className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg mx-auto mb-4">
                  <Search className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-white font-medium">No assistants found</p>
                <p className="text-blue-300 text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg mx-auto mb-4">
                  <Bot className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-white font-medium">No assistants yet</p>
                <p className="text-blue-300 text-sm mt-1">Create your first AI assistant</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-medium"
                >
                  Create First Assistant
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2">
            {/* Default/No Assistant Option */}
            {!searchQuery.trim() && (
              <div
                onClick={() => handleSelectAssistant(null)}
                className={`group relative mx-2 mb-4 rounded-xl transition-all duration-200 cursor-pointer ${
                  currentAssistantId === null
                    ? 'bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 shadow-lg'
                    : isStreaming
                    ? 'bg-white/5 backdrop-blur-sm border border-white/10 opacity-60'
                    : 'hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:shadow-lg hover:scale-[1.02] transform'
                }`}
                title={isStreaming ? 'Cannot switch to default chat while AI is responding' : 'Use default AI assistant'}
              >
                <div className="flex items-center p-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl mr-3 backdrop-blur-sm border shadow-md ${
                    currentAssistantId === null
                      ? 'bg-blue-500/30 border-blue-400/40 text-blue-100'
                      : 'bg-gray-500/20 border-gray-400/30 text-gray-300'
                  }`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">Default Chat</h3>
                    <p className="text-xs text-blue-300 mt-1">Standard AI assistant</p>
                  </div>
                  {currentAssistantId === null && (
                    <div className="w-4 h-4 rounded-full bg-green-400 shadow-lg"></div>
                  )}
                </div>
              </div>
            )}
            
            {/* Custom Assistants */}
            {groupedAssistants ? (
              <>
                {/* Render status-grouped assistants */}
                {renderStatusGroup('Active Assistants', groupedAssistants.active, <Eye className="w-4 h-4 text-green-400" />)}
                {renderStatusGroup('Inactive Assistants', groupedAssistants.inactive, <EyeOff className="w-4 h-4 text-gray-400" />)}
              </>
            ) : (
              /* Fallback: render search results without grouping */
              displayAssistants.map(renderAssistantItem)
            )}
            
            {/* Infinite scroll loading indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                <span className="ml-2 text-sm text-blue-200">Loading more...</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      {!isLoading && assistants.length > 0 && (
        <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-lg flex-shrink-0">
          <p className="text-xs text-blue-300 text-center">
            {searchQuery.trim() ? (
              `${searchResults.length} search results`
            ) : (
              `${assistants.length} of ${totalCount} assistants`
            )}
          </p>
          
          {hasMore && !searchQuery.trim() && !isLoadingMore && (
            <button
              onClick={() => loadAssistants(true)}
              className="w-full mt-3 px-4 py-2 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 font-medium"
            >
              Load more assistants
            </button>
          )}
        </div>
      )}
    </>
  );

  // Render dropdown menu outside scrollable container
  const renderDropdownMenu = () => {
    if (!dropdownOpen || !dropdownPosition) return null;

    const selectedAssistant = assistants.find(a => a.id === dropdownOpen);
    if (!selectedAssistant) return null;

    return (
      <div 
        className="fixed w-48 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-gray-200 z-[9999]"
        style={{ 
          top: `${dropdownPosition.top}px`,
          right: `${dropdownPosition.right}px`,
          minHeight: '80px',
          pointerEvents: 'auto'
        }}
      >
        <div className="py-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🔧 Edit button clicked for assistant:', selectedAssistant.id);
              handleEditAssistant(selectedAssistant);
              setDropdownOpen(null);
              setDropdownPosition(null);
            }}
            className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Assistant
          </button>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🗑️ Delete button clicked for assistant:', selectedAssistant.id);
              setSelectedForDelete(selectedAssistant.id);
              setDropdownOpen(null);
              setDropdownPosition(null);
            }}
            className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Assistant
          </button>
        </div>
      </div>
    );
  };

  // Embedded mode - render content without fixed positioning
  if (embedded) {
    return (
      <div className="h-full w-full flex flex-col">
        {content}
        
        {/* Dropdown menu rendered outside scrollable container */}
        {renderDropdownMenu()}
        
        {/* Modals */}
        <CreateAssistantModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onAssistantCreated={() => {
            loadAssistants();
            if (onAssistantChange) {
              onAssistantChange();
            }
          }}
        />

        {editingAssistant && (
          <EditAssistantModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingAssistant(null);
            }}
            assistant={editingAssistant}
            onAssistantUpdated={() => {
              loadAssistants();
              if (onAssistantUpdated && editingAssistant) {
                onAssistantUpdated(editingAssistant.id);
              }
            }}
          />
        )}

        {/* Click outside to close dropdown */}
        {dropdownOpen && (
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => {
              console.log('🔒 Closing dropdown due to outside click');
              setDropdownOpen(null);
              setDropdownPosition(null);
            }}
          />
        )}
      </div>
    );
  }

  // Standalone mode - render with fixed positioning and background
  return (
    <div className="fixed inset-y-0 left-0 z-50 w-80">
      <div className="h-full w-full bg-white/5 backdrop-blur-lg border-r border-white/10 shadow-2xl flex flex-col">
        {content}
      </div>
      
      {/* Dropdown menu rendered outside sidebar container */}
      {renderDropdownMenu()}
      
      {/* Modals */}
      <CreateAssistantModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onAssistantCreated={() => {
          loadAssistants();
          if (onAssistantChange) {
            onAssistantChange();
          }
        }}
      />

      {editingAssistant && (
        <EditAssistantModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingAssistant(null);
          }}
          assistant={editingAssistant}
          onAssistantUpdated={() => {
            loadAssistants();
            if (onAssistantUpdated && editingAssistant) {
              onAssistantUpdated(editingAssistant.id);
            }
          }}
        />
      )}

      {/* Click outside to close dropdown */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => {
            console.log('🔒 Closing dropdown due to outside click');
            setDropdownOpen(null);
            setDropdownPosition(null);
          }}
        />
      )}
    </div>
  );
}; 