// AI Dock Conversation List Component
// Reusable conversation list with search, filtering, and pagination

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Calendar,
  SortAsc,
  SortDesc,
  Loader2,
  X,
  RefreshCw
} from 'lucide-react';
import { ConversationSummary } from '../../../types/conversation';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: ConversationSummary[];
  currentConversationId?: number;
  isLoading?: boolean;
  onSelectConversation: (conversationId: number) => void;
  onEditConversation: (conversationId: number, newTitle: string) => Promise<void>;
  onDeleteConversation: (conversationId: number) => Promise<void>;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
  
  // Search and filtering props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  enableSearch?: boolean;
  enableFilters?: boolean;
}

type SortOption = 'updated_at' | 'created_at' | 'title' | 'message_count';
type SortDirection = 'asc' | 'desc';

interface FilterOptions {
  modelFilter?: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  messageCountMin?: number;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
  isLoading = false,
  onSelectConversation,
  onEditConversation,
  onDeleteConversation,
  onRefresh,
  onLoadMore,
  hasMore = false,
  className = '',
  searchQuery = '',
  onSearchChange,
  enableSearch = true,
  enableFilters = true
}) => {
  // Local state for search and filtering
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: 'all'
  });
  
  // Sync local search with parent
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);
  
  // Handle search input
  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };
  
  // Clear search
  const handleClearSearch = () => {
    setLocalSearchQuery('');
    if (onSearchChange) {
      onSearchChange('');
    }
  };
  
  // Filter conversations based on criteria
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];
    
    // Apply search filter
    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.title.toLowerCase().includes(query)
      );
    }
    
    // Apply model filter
    if (filters.modelFilter) {
      filtered = filtered.filter(conv => 
        conv.model_used?.toLowerCase().includes(filters.modelFilter!.toLowerCase())
      );
    }
    
    // Apply date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(conv => 
        new Date(conv.updated_at) >= cutoffDate
      );
    }
    
    // Apply message count filter
    if (filters.messageCountMin) {
      filtered = filtered.filter(conv => 
        conv.message_count >= filters.messageCountMin!
      );
    }
    
    return filtered;
  }, [conversations, localSearchQuery, filters]);
  
  // Sort conversations
  const sortedConversations = useMemo(() => {
    const sorted = [...filteredConversations];
    
    sorted.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'message_count':
          aValue = a.message_count;
          bValue = b.message_count;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'updated_at':
        default:
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredConversations, sortBy, sortDirection]);
  
  // Get unique models for filter dropdown
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    conversations.forEach(conv => {
      if (conv.model_used) {
        models.add(conv.model_used);
      }
    });
    return Array.from(models).sort();
  }, [conversations]);
  
  // Handle sort change
  const handleSortChange = (newSortBy: SortOption) => {
    if (newSortBy === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc'); // Default to descending for new sort
    }
  };
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search and filter controls */}
      {(enableSearch || enableFilters) && (
        <div className="p-4 border-b border-gray-200 space-y-3">
          {/* Search box */}
          {enableSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={localSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {localSearchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          
          {/* Filter and sort controls */}
          {enableFilters && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
                    showFilters 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filters
                </button>
                
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                )}
              </div>
              
              {/* Sort controls */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as SortOption)}
                  className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="updated_at">Last Updated</option>
                  <option value="created_at">Created</option>
                  <option value="title">Title</option>
                  <option value="message_count">Messages</option>
                </select>
                
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          
          {/* Extended filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
              {/* Model filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <select
                  value={filters.modelFilter || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    modelFilter: e.target.value || undefined 
                  }))}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All models</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
              
              {/* Date range filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <select
                  value={filters.dateRange || 'all'}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    dateRange: e.target.value as any
                  }))}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">Last week</option>
                  <option value="month">Last month</option>
                </select>
              </div>
              
              {/* Message count filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Messages
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Any"
                  value={filters.messageCountMin || ''}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    messageCountMin: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Results summary */}
      {!isLoading && (
        <div className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100">
          {localSearchQuery || Object.values(filters).some(f => f && f !== 'all') ? (
            <span>
              {sortedConversations.length} of {conversations.length} conversations
              {localSearchQuery && ` matching "${localSearchQuery}"`}
            </span>
          ) : (
            <span>{conversations.length} conversations</span>
          )}
        </div>
      )}
      
      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Loading conversations...</span>
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            {localSearchQuery || Object.values(filters).some(f => f && f !== 'all') ? (
              <div>
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No conversations found</p>
                <p className="text-gray-400 text-sm mt-1">
                  Try adjusting your search or filters
                </p>
                <button
                  onClick={() => {
                    handleClearSearch();
                    setFilters({ dateRange: 'all' });
                  }}
                  className="mt-3 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div>
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No conversations yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Start chatting to see your conversations here
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2">
            {sortedConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isCurrentConversation={currentConversationId === conversation.id}
                onSelect={onSelectConversation}
                onEdit={onEditConversation}
                onDelete={onDeleteConversation}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Load more button */}
      {hasMore && !isLoading && onLoadMore && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLoadMore}
            className="w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Load more conversations
          </button>
        </div>
      )}
    </div>
  );
};

// 🎯 ConversationList Component Features:
//
// 1. **Advanced Search & Filtering**: 
//    - Real-time search with clear functionality
//    - Model-based filtering
//    - Date range filtering (today, week, month)
//    - Message count filtering
//
// 2. **Flexible Sorting**: 
//    - Sort by date, title, or message count
//    - Ascending/descending toggle
//    - Visual sort direction indicators
//
// 3. **Professional UI**: 
//    - Collapsible filter panel
//    - Results summary
//    - Loading states and empty states
//    - Responsive grid layout
//
// 4. **Reusable Architecture**: 
//    - Configurable search/filter features
//    - Callback-based event handling
//    - Composable with ConversationItem
//
// 5. **Performance Optimized**: 
//    - useMemo for expensive filtering/sorting
//    - Minimal re-renders
//    - Efficient state management
//
// This component demonstrates:
// - Advanced React hooks (useMemo, useEffect)
// - Complex state management
// - Data manipulation and filtering
// - Professional UI/UX patterns
// - Component composition
