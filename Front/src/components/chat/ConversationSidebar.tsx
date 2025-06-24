// AI Dock Conversation Sidebar
// UI component for managing saved conversations

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar,
  Clock,
  X,
  ChevronRight,
  ChevronDown,
  Loader2,
  Archive
} from 'lucide-react';
import { conversationService } from '../../services/conversationService';
import { 
  ConversationSummary, 
  ConversationListResponse,
  ConversationServiceError 
} from '../../types/conversation';

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: number) => void;
  onCreateNew: () => void;
  currentConversationId?: number;
  // 🔄 NEW: Reactive update support
  onConversationUpdate?: (conversationId: number, messageCount: number) => void;
  refreshTrigger?: number; // Increment this to trigger refresh
  // 🔄 NEW: Expose sidebar functions to parent for reactive updates
  onSidebarReady?: (updateFn: (id: number, count: number) => void, addFn: (conv: any) => void) => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onClose,
  onSelectConversation,
  onCreateNew,
  currentConversationId,
  onConversationUpdate,
  refreshTrigger,
  onSidebarReady
}) => {
  // State management
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConversationSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Load conversations on mount and when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);
  
  // 🔄 NEW: Reactive refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && isOpen) {
      console.log('🔄 Refreshing conversations due to trigger:', refreshTrigger);
      loadConversations();
    }
  }, [refreshTrigger, isOpen]);
  
  // Search conversations when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchConversations();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);
  
  // 🔄 ENHANCED: Update individual conversation message count with better state management
  const updateConversationMessageCount = useCallback((conversationId: number, newMessageCount: number) => {
    console.log('🔄 Updating message count for conversation', conversationId, 'to', newMessageCount);
    
    // Update main conversations list
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { 
            ...conv, 
            message_count: newMessageCount,
            // 🔧 FIXED: Also update the updated_at timestamp for reactive sorting
            updated_at: new Date().toISOString()
          }
        : conv
    ));
    
    // Update search results if they exist
    setSearchResults(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { 
            ...conv, 
            message_count: newMessageCount,
            updated_at: new Date().toISOString()
          }
        : conv
    ));
  }, []);
  
  // 🔄 NEW: Function to add new conversation to the list (when auto-saved)
  const addNewConversation = useCallback((newConversation: ConversationSummary) => {
    console.log('🔄 Adding new conversation to sidebar:', newConversation.id, newConversation.title);
    
    // Add to the beginning of the list (most recent first)
    setConversations(prev => {
      // Check if it already exists to avoid duplicates
      const exists = prev.some(conv => conv.id === newConversation.id);
      if (exists) {
        console.log('🔄 Conversation already exists, updating instead');
        return prev.map(conv => 
          conv.id === newConversation.id ? newConversation : conv
        );
      } else {
        return [newConversation, ...prev];
      }
    });
    
    // Also update total count
    setTotalCount(prev => prev + 1);
  }, []);
  
  // 🔄 NEW: Expose update and add functions to parent
  useEffect(() => {
    if (onSidebarReady) {
      // Pass our internal functions to the parent for reactive updates
      onSidebarReady(updateConversationMessageCount, addNewConversation);
      console.log('🔄 Sidebar functions exposed to parent for reactive updates');
    }
  }, [onSidebarReady, updateConversationMessageCount, addNewConversation]);
  
  // Load user's conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response: ConversationListResponse = await conversationService.getConversations({
        limit: 50,
        offset: 0
      });
      
      setConversations(response.conversations);
      setTotalCount(response.total_count);
      setHasMore(response.has_more);
      
    } catch (error) {
      console.error('❌ Failed to load conversations:', error);
      setError(
        error instanceof ConversationServiceError 
          ? error.message 
          : 'Failed to load conversations'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Search conversations
  const searchConversations = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      
      const results = await conversationService.searchConversations({
        query: searchQuery.trim(),
        limit: 20
      });
      
      setSearchResults(results);
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);
  
  // Handle conversation selection
  const handleSelectConversation = (conversationId: number) => {
    onSelectConversation(conversationId);
    // Don't close sidebar on mobile - let parent decide
  };
  
  // Handle conversation deletion
  const handleDeleteConversation = async (conversationId: number) => {
    try {
      await conversationService.deleteConversation(conversationId);
      
      // Remove from state
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setSearchResults(prev => prev.filter(c => c.id !== conversationId));
      setSelectedForDelete(null);
      
      console.log('✅ Conversation deleted successfully');
      
    } catch (error) {
      console.error('❌ Failed to delete conversation:', error);
      setError(
        error instanceof ConversationServiceError 
          ? error.message 
          : 'Failed to delete conversation'
      );
    }
  };
  
  // Handle title editing
  const handleEditTitle = async (conversationId: number) => {
    if (!newTitle.trim()) {
      setEditingTitle(null);
      return;
    }
    
    try {
      const updated = await conversationService.updateConversation(conversationId, {
        title: newTitle.trim()
      });
      
      // Update in state
      const updateConversation = (conv: ConversationSummary) => 
        conv.id === conversationId ? { ...conv, title: updated.title } : conv;
      
      setConversations(prev => prev.map(updateConversation));
      setSearchResults(prev => prev.map(updateConversation));
      
      setEditingTitle(null);
      setNewTitle('');
      
    } catch (error) {
      console.error('❌ Failed to update title:', error);
      setError(
        error instanceof ConversationServiceError 
          ? error.message 
          : 'Failed to update conversation title'
      );
    }
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  // Get conversations to display (search results or all)
  const displayConversations = searchQuery.trim() ? searchResults : conversations;
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto">
      {/* Mobile overlay */}
      <div 
        className="absolute inset-0 bg-black/50 lg:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar content */}
      <div className="absolute left-0 top-0 h-full w-80 bg-white/95 backdrop-blur-sm border-r border-white/20 shadow-2xl lg:relative lg:w-full lg:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <div className="flex items-center space-x-2">
            <Archive className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Conversations</h2>
            {totalCount > 0 && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                {totalCount}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onCreateNew}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Search box */}
        <div className="p-4 border-b border-white/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400 mx-4 mt-4 rounded">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-xs mt-1"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading conversations...</span>
            </div>
          ) : displayConversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              {searchQuery.trim() ? (
                <div>
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No conversations found</p>
                  <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                <div>
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No conversations yet</p>
                  <p className="text-gray-400 text-sm mt-1">Start chatting to save conversations</p>
                  <button
                    onClick={onCreateNew}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Start New Chat
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-2">
              {displayConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group relative mx-2 mb-1 rounded-lg transition-all duration-200 ${
                    currentConversationId === conversation.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {/* Conversation item */}
                  <div
                    onClick={() => handleSelectConversation(conversation.id)}
                    className="flex items-start p-3 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      {editingTitle === conversation.id ? (
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onBlur={() => handleEditTitle(conversation.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleEditTitle(conversation.id);
                            } else if (e.key === 'Escape') {
                              setEditingTitle(null);
                              setNewTitle('');
                            }
                          }}
                          className="w-full px-2 py-1 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h3 className="text-sm font-medium text-gray-800 truncate">
                          {conversation.title}
                        </h3>
                      )}
                      
                      {/* Metadata */}
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                        <div className="flex items-center">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {conversation.message_count} messages
                        </div>
                        
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {/* 🔧 FIXED: Using created_at for creation date display */}
                          {formatDate(conversation.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTitle(conversation.id);
                          setNewTitle(conversation.title);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Rename conversation"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedForDelete(conversation.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Delete confirmation */}
                  {selectedForDelete === conversation.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-lg border border-red-200 flex items-center justify-center">
                      <div className="text-center p-4">
                        <p className="text-sm text-gray-700 mb-3">Delete this conversation?</p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteConversation(conversation.id)}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setSelectedForDelete(null)}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {!isLoading && conversations.length > 0 && (
          <div className="p-4 border-t border-white/20 bg-gray-50/50">
            <p className="text-xs text-gray-500 text-center">
              {searchQuery.trim() ? (
                `${searchResults.length} search results`
              ) : (
                `${conversations.length} of ${totalCount} conversations`
              )}
            </p>
            
            {hasMore && !searchQuery.trim() && (
              <button
                onClick={loadConversations}
                className="w-full mt-2 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Load more conversations
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
