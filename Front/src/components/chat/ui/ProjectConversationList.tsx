// 📂 Project Conversation List Component
// Shows conversations within a specific project with management capabilities

import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Plus, 
  Search, 
  MessageSquare, 
  Clock, 
  SortAsc, 
  SortDesc,
  // Calendar,
  Hash,
  X,
  Loader2
} from 'lucide-react';
import { conversationService } from '../../../services/conversationService';
import { ConversationSummary } from '../../../types/conversation';
import { formatConversationTimestamp } from '../../../utils/chatHelpers';

type SortOption = 'updated_at' | 'created_at' | 'title' | 'message_count';
type SortDirection = 'asc' | 'desc';

interface ProjectConversationListProps {
  projectId: number;
  projectName: string;
  currentConversationId?: number;
  onSelectConversation?: (conversationId: number) => void;
  onNewConversation?: () => void;
  isStreaming: boolean;
  className?: string;
}

export const ProjectConversationList: React.FC<ProjectConversationListProps> = ({
  projectId,
  projectName,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isStreaming,
  className = ''
}) => {
  // State
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Load conversations for this project
  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the new project-specific endpoint
      const projectConversations = await conversationService.getProjectConversations(projectId);
      setConversations(projectConversations);
    } catch (err: any) {
      setError(err.message || 'Failed to load project conversations');
    } finally {
      setLoading(false);
    }
  };

  // Load conversations on mount and when project changes
  useEffect(() => {
    loadConversations();
  }, [projectId]);

  // Filter and sort conversations
  useEffect(() => {
    let filtered = [...conversations];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
             filtered = filtered.filter(conv => 
         conv.title.toLowerCase().includes(query) ||
         ((conv as any).preview && (conv as any).preview.toLowerCase().includes(query))
       );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'message_count':
          aValue = a.message_count || 0;
          bValue = b.message_count || 0;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'updated_at':
        default:
          aValue = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
          bValue = new Date(b.last_message_at || b.updated_at || b.created_at).getTime();
          break;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredConversations(filtered);
  }, [conversations, searchQuery, sortBy, sortDirection]);

  // Handle sort change
  const handleSortChange = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  };

  return (
    <div 
      className={`bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(16,185,129,0.08) 100%)',
      }}
    >
      {/* Glassmorphism background effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-emerald-500/5 rounded-2xl pointer-events-none" />
      
      <div className="relative">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg shadow-md">
                <FolderOpen className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white truncate">{projectName}</h3>
                <p className="text-xs text-white/60">{filteredConversations.length} conversations</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleSortChange(sortBy)}
                className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200"
                title={`Sort by ${sortBy} (${sortDirection})`}
              >
                {sortDirection === 'asc' ? (
                  <SortAsc className="w-4 h-4" />
                ) : (
                  <SortDesc className="w-4 h-4" />
                )}
              </button>
              {!isStreaming && onNewConversation && (
                <button
                  onClick={onNewConversation}
                  className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:scale-105"
                  title="New conversation in this project"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400/50 transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-white/60" />
                <span className="text-sm text-white/60">Loading conversations...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <p className="text-sm text-red-300 mb-2">{error}</p>
              <button
                onClick={loadConversations}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && filteredConversations.length === 0 && (
            <div className="p-8 text-center">
              {searchQuery ? (
                <div>
                  <Search className="w-8 h-8 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60 text-sm">No conversations found</p>
                  <p className="text-white/40 text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                <div>
                  <MessageSquare className="w-8 h-8 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60 text-sm">No conversations yet</p>
                  <p className="text-white/40 text-xs mt-1">Start chatting to create conversations</p>
                  {onNewConversation && (
                    <button
                      onClick={onNewConversation}
                      className="mt-3 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
                    >
                      Start New Chat
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && !error && filteredConversations.length > 0 && (
            <div className="p-2 space-y-1">
              {filteredConversations.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation?.(conversation.id)}
                  disabled={isStreaming}
                  className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                    currentConversationId === conversation.id
                      ? 'bg-white/20 border border-white/30 shadow-md'
                      : 'hover:bg-white/10 border border-transparent'
                  } ${isStreaming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-lg mt-1">
                      <MessageSquare className="w-3 h-3 text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate text-sm">
                        {conversation.title}
                      </h4>
                                             {(conversation as any).preview && (
                         <p className="text-xs text-white/50 truncate mt-1">
                           {(conversation as any).preview}
                         </p>
                       )}
                      <div className="flex items-center space-x-3 mt-2 text-xs text-white/40">
                        <div className="flex items-center space-x-1">
                          <Hash className="w-3 h-3" />
                          <span>{conversation.message_count} msgs</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatConversationTimestamp(conversation.last_message_at || conversation.updated_at || conversation.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with sort options */}
        <div className="p-3 border-t border-white/10 bg-white/5">
          <div className="flex items-center space-x-2 text-xs text-white/60">
            <span>Sort by:</span>
            {(['updated_at', 'created_at', 'title', 'message_count'] as SortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => handleSortChange(option)}
                className={`px-2 py-1 rounded transition-colors ${
                  sortBy === option 
                    ? 'bg-teal-500/30 text-teal-200 border border-teal-400/40' 
                    : 'hover:bg-white/10 text-white/60'
                }`}
              >
                {option.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 