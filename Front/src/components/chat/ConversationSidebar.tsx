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
  Loader2,
  Archive
} from 'lucide-react';
import { conversationService } from '../../services/conversationService';
import { 
  ConversationSummary, 
  ConversationListResponse,
  ConversationServiceError 
} from '../../types/conversation';
import { formatConversationTimestamp } from '../../utils/chatHelpers';

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
  onSidebarReady?: (updateFn: (id: number, count: number, backendData?: Partial<ConversationSummary>) => void, addFn: (conv: any) => void) => void;
  // 🌊 NEW: Streaming state to prevent conversation switching during streaming
  isStreaming?: boolean;
  // 🆕 NEW: Embedded mode for use within UnifiedSidebar
  embedded?: boolean;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onClose,
  onSelectConversation,
  onCreateNew,
  currentConversationId,
  refreshTrigger,
  onSidebarReady,
  isStreaming = false,
  embedded = false
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
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
  
  // 🔄 Update conversation message count only (without changing position)
  const updateConversationMessageCount = useCallback((conversationId: number, newMessageCount: number) => {
    console.log('🔄 Updating message count for conversation', conversationId, 'to', newMessageCount);
    
    const updateConversation = (conv: ConversationSummary) => 
      conv.id === conversationId 
        ? { 
            ...conv, 
            message_count: newMessageCount
            // Don't update updated_at here - only when messages are actually sent
          }
        : conv;
    
    // Update main conversations list without resorting
    setConversations(prev => prev.map(updateConversation));
    
    // Update search results if they exist
    setSearchResults(prev => prev.map(updateConversation));
  }, []);

  // 🔄 Move conversation to top when a new message is sent
  // Updated to work with backend-provided timestamps instead of local management
  const moveConversationToTop = useCallback((conversationId: number, newMessageCount: number, backendData?: Partial<ConversationSummary>) => {
    console.log('🔄 Moving conversation to top due to new message:', conversationId, { 
      newMessageCount, 
      backendData,
      hasBackendTimestamps: !!(backendData?.last_message_at || backendData?.updated_at)
    });
    
    const updateConversation = (conv: ConversationSummary) => {
      if (conv.id !== conversationId) return conv;
      
      // 🔧 CRITICAL FIX: Only update timestamps if we have fresh backend data
      // NEVER set current timestamps unless we have explicit backend data
      const updatedConv = { 
        ...conv, 
        message_count: newMessageCount,
        // 🚨 IMPORTANT: Only update timestamps if we have fresh backend data
        // This prevents "Just now" timestamps when we don't have actual backend updates
        ...(backendData?.last_message_at && {
          last_message_at: backendData.last_message_at
        }),
        ...(backendData?.updated_at && {
          updated_at: backendData.updated_at
        })
      };
      
      console.log('🔄 Updated conversation data:', {
        id: conversationId,
        oldLastMessage: conv.last_message_at,
        newLastMessage: updatedConv.last_message_at,
        oldUpdated: conv.updated_at,
        newUpdated: updatedConv.updated_at,
        messageCount: newMessageCount,
        timestampsChanged: conv.last_message_at !== updatedConv.last_message_at || conv.updated_at !== updatedConv.updated_at,
        backendDataReceived: !!backendData
      });
      
      return updatedConv;
    };
    
    // Update main conversations list and resort by recency
    setConversations(prev => {
      const updated = prev.map(updateConversation);
      // Sort by last_message_at first, then updated_at, then created_at to maintain recency order
      return updated.sort((a, b) => {
        const dateA = new Date(a.last_message_at || a.updated_at || a.created_at);
        const dateB = new Date(b.last_message_at || b.updated_at || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
    });
    
    // Update search results if they exist
    setSearchResults(prev => prev.map(updateConversation));
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
      // Use moveConversationToTop for actual message updates (which should move to top)
      onSidebarReady(moveConversationToTop, addNewConversation);
      console.log('🔄 Sidebar functions exposed to parent for reactive updates');
    }
  }, [onSidebarReady, moveConversationToTop, addNewConversation]);
  
  // Load user's conversations
  const loadConversations = useCallback(async (append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      const offset = append ? conversations.length : 0;
      
      const response: ConversationListResponse = await conversationService.getConversations({
        limit: 50,
        offset
      });
      
      if (append) {
        setConversations(prev => [...prev, ...response.conversations]);
      } else {
        setConversations(response.conversations);
      }
      
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
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [conversations.length]);
  
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
    // 🚫 Prevent conversation switching while streaming
    if (isStreaming) {
      console.log('🚫 Cannot switch conversations while AI is streaming a response');
      // Could optionally show a toast notification here
      return;
    }
    
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
  

  
  // Handle scroll for infinite loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // Load when 100px from bottom
    
    if (isNearBottom && hasMore && !isLoadingMore && !isLoading && !searchQuery.trim()) {
      console.log('🔄 Loading more conversations due to scroll');
      loadConversations(true);
    }
  }, [hasMore, isLoadingMore, isLoading, searchQuery, loadConversations]);

  // Group conversations by time periods for better organization
  const groupConversationsByTime = useCallback((conversations: ConversationSummary[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups = {
      today: [] as ConversationSummary[],
      yesterday: [] as ConversationSummary[],
      thisWeek: [] as ConversationSummary[],
      thisMonth: [] as ConversationSummary[],
      older: [] as ConversationSummary[]
    };

    // 🔧 FIX: Sort conversations by last_message_at (most recent first) for accurate timestamp ordering
    const sortedConversations = [...conversations].sort((a, b) => {
      const dateA = new Date(a.last_message_at || a.updated_at || a.created_at);
      const dateB = new Date(b.last_message_at || b.updated_at || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    sortedConversations.forEach(conversation => {
      // 🔧 FIX: Use last_message_at for grouping to show conversations in the right time buckets
      const conversationDate = new Date(conversation.last_message_at || conversation.updated_at || conversation.created_at);
      
      if (conversationDate >= today) {
        groups.today.push(conversation);
      } else if (conversationDate >= yesterday) {
        groups.yesterday.push(conversation);
      } else if (conversationDate >= thisWeek) {
        groups.thisWeek.push(conversation);
      } else if (conversationDate >= thisMonth) {
        groups.thisMonth.push(conversation);
      } else {
        groups.older.push(conversation);
      }
    });

    return groups;
  }, []);

  // Get conversations to display (search results or all)
  const displayConversations = searchQuery.trim() ? searchResults : conversations;
  const groupedConversations = !searchQuery.trim() ? groupConversationsByTime(displayConversations) : null;

  // Render a conversation item
  const renderConversationItem = (conversation: ConversationSummary) => (
    <div
      key={conversation.id}
      className={`group relative mx-2 mb-2 rounded-xl transition-all duration-200 ${
        currentConversationId === conversation.id
          ? 'bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 shadow-lg'
          : isStreaming
          ? 'bg-white/5 backdrop-blur-sm border border-white/10 opacity-60'
          : 'hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 hover:shadow-lg hover:scale-[1.02] transform'
      }`}
    >
      {/* Conversation item */}
      <div
        onClick={() => handleSelectConversation(conversation.id)}
        className={`flex items-start p-3 transition-colors ${
          isStreaming 
            ? 'cursor-not-allowed' 
            : 'cursor-pointer'
        }`}
        title={isStreaming ? 'Cannot switch conversations while AI is responding' : ''}
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
              className="w-full px-3 py-2 text-sm font-medium bg-white/10 backdrop-blur-sm border border-blue-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-white placeholder-blue-300"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 className="text-sm font-medium text-white truncate">
              {conversation.title}
            </h3>
          )}
          
          {/* Metadata */}
          <div className="flex items-center space-x-3 mt-2 text-[11px] text-blue-300">
            <div className="flex items-center">
              <MessageSquare className="w-3 h-3 mr-1" />
              {conversation.message_count} messages
            </div>
            
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatConversationTimestamp(conversation.last_message_at || conversation.updated_at || conversation.created_at)}
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingTitle(conversation.id);
              setNewTitle(conversation.title);
            }}
            className="p-1.5 text-blue-300 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg transition-all duration-200 hover:scale-110 transform"
            title="Rename conversation"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedForDelete(conversation.id);
            }}
            className="p-1.5 text-blue-300 hover:text-red-200 hover:bg-red-500/20 backdrop-blur-sm border border-white/10 hover:border-red-400/30 rounded-lg transition-all duration-200 hover:scale-110 transform"
            title="Delete conversation"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {/* Delete confirmation */}
      {selectedForDelete === conversation.id && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-lg rounded-xl border border-red-400/30 flex items-center justify-center shadow-2xl">
          <div className="text-center p-4">
            <p className="text-sm text-white font-medium mb-4">Delete this conversation?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => handleDeleteConversation(conversation.id)}
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

  // Render a time group section
  const renderTimeGroup = (title: string, conversations: ConversationSummary[]) => {
    if (conversations.length === 0) return null;
    
    return (
      <div key={title} className="mb-6">
        <div className="sticky top-0 z-10 px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-blue-200 uppercase tracking-wide">
                {title}
              </h3>
              <span className="text-xs text-blue-300 bg-white/10 backdrop-blur-sm border border-white/20 px-2 py-1 rounded-full">
                {conversations.length}
              </span>
          </div>
        </div>
        <div className="py-1">
          {conversations.map(renderConversationItem)}
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
            <MessageSquare className="w-4 h-4 text-blue-200" />
          </div>
          <h2 className="text-lg font-semibold text-white">Conversations</h2>
          {totalCount > 0 && (
            <span className="px-2 py-1 text-xs bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-200 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={isStreaming ? undefined : onCreateNew}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isStreaming
                ? 'text-blue-400 cursor-not-allowed opacity-50'
                : 'text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:scale-105 transform'
            }`}
            title={isStreaming ? 'Cannot create new conversation while AI is responding' : 'New conversation'}
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
            placeholder="Search conversations..."
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
      
      {/* 🌊 Streaming notice */}
      {isStreaming && (
        <div className="mx-4 mb-2 p-3 bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 rounded-xl flex-shrink-0 shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-amber-300 rounded-full animate-pulse shadow-lg"></div>
            <p className="text-sm text-amber-100 font-medium">AI is responding...</p>
          </div>
          <p className="text-xs text-amber-200 mt-1">
            Conversation switching is disabled while streaming
          </p>
        </div>
      )}
      
      {/* Conversation list */}
      <div 
        className="flex-1 overflow-y-auto min-h-0 scroll-smooth conversation-scrollbar"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-300" />
            <span className="ml-2 text-blue-200">Loading conversations...</span>
          </div>
        ) : displayConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            {searchQuery.trim() ? (
              <div>
                <div className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg mx-auto mb-4">
                  <Search className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-white font-medium">No conversations found</p>
                <p className="text-blue-300 text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-white font-medium">No conversations yet</p>
                <p className="text-blue-300 text-sm mt-1">Start chatting to save conversations</p>
                <button
                  onClick={onCreateNew}
                  className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-medium"
                >
                  Start New Chat
                </button>
              </div>
            )}
          </div>
        ) : groupedConversations ? (
          <div className="py-2">
            {/* Render time-grouped conversations */}
            {renderTimeGroup('Today', groupedConversations.today)}
            {renderTimeGroup('Yesterday', groupedConversations.yesterday)}
            {renderTimeGroup('This Week', groupedConversations.thisWeek)}
            {renderTimeGroup('This Month', groupedConversations.thisMonth)}
            {renderTimeGroup('Older', groupedConversations.older)}
            
            {/* Infinite scroll loading indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                <span className="ml-2 text-sm text-blue-200">Loading more...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2">
            {/* Fallback: render search results without grouping */}
            {displayConversations.map(renderConversationItem)}
          </div>
        )}
      </div>
      
      {/* Footer */}
      {!isLoading && conversations.length > 0 && (
        <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-lg flex-shrink-0">
          <p className="text-xs text-blue-300 text-center">
            {searchQuery.trim() ? (
              `${searchResults.length} search results`
            ) : (
              `${conversations.length} of ${totalCount} conversations`
            )}
          </p>
          
          {hasMore && !searchQuery.trim() && !isLoadingMore && (
            <button
              onClick={() => loadConversations(true)}
              className="w-full mt-3 px-4 py-2 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 font-medium"
            >
              Load more conversations
            </button>
          )}
        </div>
      )}
    </>
  );

  // Embedded mode - render content without fixed positioning
  if (embedded) {
    return <div className="h-full w-full flex flex-col">{content}</div>;
  }

  // Standalone mode - render with fixed positioning and background
  return (
    <div className="fixed inset-y-0 left-0 z-50 w-80">
      <div className="h-full w-full bg-white/5 backdrop-blur-lg border-r border-white/10 shadow-2xl flex flex-col">
        {content}
      </div>
    </div>
  );
};
