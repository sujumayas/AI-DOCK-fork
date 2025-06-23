// Embedded Assistant Management Component
// Compact assistant management panel for integration into chat interface
// Provides create, edit, delete functionality without leaving the chat

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye,
  MessageSquare,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  X
} from 'lucide-react';
import { assistantService } from '../../services/assistantService';
import { CreateAssistantModal } from '../assistant/CreateAssistantModal';
import { EditAssistantModal } from '../assistant/EditAssistantModal';
import { 
  AssistantSummary, 
  AssistantServiceError,
  ASSISTANT_API_DEFAULTS 
} from '../../types/assistant';

interface EmbeddedAssistantManagerProps {
  selectedAssistantId: number | null;
  onAssistantSelect: (assistantId: number | null) => void;
  onAssistantChange: () => void; // Callback when assistants are modified
  className?: string;
}

interface EmbeddedManagerState {
  assistants: AssistantSummary[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  isExpanded: boolean;
}

/**
 * EmbeddedAssistantManager - Compact assistant management for chat interface
 * 
 * 🎓 LEARNING: Embedded Component Design
 * =====================================
 * This component demonstrates how to take complex page-level functionality
 * and create a compact, embeddable version suitable for integration.
 * 
 * Key Design Principles:
 * - Compact but functional interface
 * - Collapsible/expandable for space efficiency
 * - Maintains full CRUD functionality
 * - Seamless integration with parent components
 * - Responsive design for different screen sizes
 */
export const EmbeddedAssistantManager: React.FC<EmbeddedAssistantManagerProps> = ({
  selectedAssistantId,
  onAssistantSelect,
  onAssistantChange,
  className = ''
}) => {
  // Component state
  const [state, setState] = useState<EmbeddedManagerState>({
    assistants: [],
    isLoading: true,
    error: null,
    searchQuery: '',
    statusFilter: 'all',
    isExpanded: true  // 🔧 FIX: Start expanded so Create button is accessible
  });

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [assistantToEdit, setAssistantToEdit] = useState<AssistantSummary | null>(null);

  /**
   * Load assistants from API
   */
  const loadAssistants = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await assistantService.getAssistants({
        limit: 50, // Get more for embedded view
        offset: 0,
        search: state.searchQuery || undefined,
        status_filter: state.statusFilter === 'all' ? undefined : state.statusFilter,
        sort_by: 'updated_at',
        sort_order: 'desc',
        include_inactive: true
      });

      setState(prev => ({
        ...prev,
        assistants: response.assistants,
        isLoading: false
      }));

    } catch (error) {
      console.error('❌ Failed to load assistants:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof AssistantServiceError 
          ? error.message 
          : 'Failed to load assistants',
        isLoading: false
      }));
    }
  }, [state.searchQuery, state.statusFilter]);

  // Load assistants when component mounts or filters change
  useEffect(() => {
    loadAssistants();
  }, [loadAssistants]);

  /**
   * Handle assistant selection
   */
  const handleSelectAssistant = useCallback((assistant: AssistantSummary | null) => {
    const assistantId = assistant?.id || null;
    onAssistantSelect(assistantId);
    
    // Collapse the panel after selection on mobile
    if (window.innerWidth < 768) {
      setState(prev => ({ ...prev, isExpanded: false }));
    }
  }, [onAssistantSelect]);

  /**
   * Handle creating a new assistant
   * 
   * 🎓 LEARNING: Event Handler Best Practices
   * =========================================
   * - Use useCallback for performance optimization
   * - Keep handlers simple and focused
   * - Avoid logging in production code
   */
  const handleCreateAssistant = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  /**
   * Handle editing an assistant
   */
  const handleEditAssistant = useCallback((assistant: AssistantSummary) => {
    setAssistantToEdit(assistant);
    setIsEditModalOpen(true);
  }, []);

  /**
   * Handle deleting an assistant
   */
  const handleDeleteAssistant = useCallback(async (assistant: AssistantSummary) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${assistant.name}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      await assistantService.deleteAssistant(assistant.id);

      // Remove from local state
      setState(prev => ({
        ...prev,
        assistants: prev.assistants.filter(a => a.id !== assistant.id),
        isLoading: false
      }));

      // If deleted assistant was selected, clear selection
      if (selectedAssistantId === assistant.id) {
        handleSelectAssistant(null);
      }

      // Notify parent of changes
      onAssistantChange();

      console.log('✅ Assistant deleted successfully:', assistant.name);

    } catch (error) {
      console.error('❌ Failed to delete assistant:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof AssistantServiceError 
          ? error.message 
          : 'Failed to delete assistant',
        isLoading: false
      }));
    }
  }, [selectedAssistantId, handleSelectAssistant, onAssistantChange]);

  /**
   * Handle successful assistant creation
   */
  const handleAssistantCreated = useCallback(() => {
    setIsCreateModalOpen(false);
    loadAssistants();
    onAssistantChange();
  }, [loadAssistants, onAssistantChange]);

  /**
   * Handle successful assistant update
   */
  const handleAssistantUpdated = useCallback(() => {
    setIsEditModalOpen(false);
    setAssistantToEdit(null);
    loadAssistants();
    onAssistantChange();
  }, [loadAssistants, onAssistantChange]);

  /**
   * Toggle expanded state
   */
  const toggleExpanded = useCallback(() => {
    setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  }, []);

  /**
   * Filter assistants based on search and status
   */
  const filteredAssistants = state.assistants.filter(assistant => {
    const matchesSearch = !state.searchQuery || 
      assistant.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      assistant.description?.toLowerCase().includes(state.searchQuery.toLowerCase());
    
    const matchesStatus = state.statusFilter === 'all' || 
      (state.statusFilter === 'active' && assistant.is_active) ||
      (state.statusFilter === 'inactive' && !assistant.is_active);
    
    return matchesSearch && matchesStatus;
  });

  // Get statistics
  const stats = {
    total: state.assistants.length,
    active: state.assistants.filter(a => a.is_active).length,
    conversations: state.assistants.reduce((sum, a) => sum + a.conversation_count, 0)
  };

  return (
    <div className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg flex flex-col h-full ${className}`}>
      {/* Header - Always Visible */}
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bot className="w-5 h-5 text-white" />
            <div>
              <h3 className="font-medium text-white">Custom Assistants</h3>
              <p className="text-xs text-blue-100">
                {stats.total} assistants • {stats.active} active
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Create button */}
            <button
              onClick={handleCreateAssistant}
              className="px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium rounded-md transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
              title="Create new assistant"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Create</span>
            </button>
            
            {/* Expand/collapse button */}
            <button
              onClick={toggleExpanded}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
              title={state.isExpanded ? 'Collapse panel' : 'Expand panel'}
            >
              {state.isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      {state.isExpanded && (
        <div className="p-4 flex flex-col flex-1 space-y-4">
          {/* Search and Filters */}
          <div className="space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assistants..."
                value={state.searchQuery}
                onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-white/90 border border-white/30 rounded-md text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Status filter */}
            <select
              value={state.statusFilter}
              onChange={(e) => setState(prev => ({ 
                ...prev, 
                statusFilter: e.target.value as 'all' | 'active' | 'inactive' 
              }))}
              className="w-full px-3 py-2 bg-white/90 border border-white/30 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Assistants</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Error display */}
          {state.error && (
            <div className="bg-red-500/20 border border-red-300/30 rounded-md p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-200 flex-shrink-0 mt-0.5" />
                <p className="text-red-100 text-sm">{state.error}</p>
                <button
                  onClick={() => setState(prev => ({ ...prev, error: null }))}
                  className="text-red-200 hover:text-red-100 ml-auto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {state.isLoading && (
            <div className="text-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-200 mx-auto mb-2" />
              <p className="text-blue-100 text-sm">Loading assistants...</p>
            </div>
          )}

          {/* Assistant List */}
          {!state.isLoading && (
            <div className="space-y-2 flex-1 overflow-y-auto">
              {/* Default/No Assistant Option */}
              <div
                onClick={() => handleSelectAssistant(null)}
                className={`p-3 rounded-md border cursor-pointer transition-all ${
                  selectedAssistantId === null
                    ? 'bg-blue-500/20 border-blue-300/30 text-white'
                    : 'bg-white/90 border-white/30 text-gray-700 hover:bg-white hover:border-blue-300/30'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-500/20 rounded-md flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Default Chat</h4>
                    <p className="text-xs opacity-70">Standard AI assistant</p>
                  </div>
                  {selectedAssistantId === null && (
                    <CheckCircle className="w-4 h-4 text-blue-300" />
                  )}
                </div>
              </div>

              {/* Custom Assistants */}
              {filteredAssistants.length === 0 ? (
                <div className="text-center py-6">
                  {state.searchQuery ? (
                    <div>
                      <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No assistants match your search</p>
                    </div>
                  ) : (
                    <div>
                      <Sparkles className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm mb-3">No custom assistants yet</p>
                      <button
                        onClick={handleCreateAssistant}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded-md text-sm transition-colors"
                      >
                        Create your first assistant
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredAssistants.map((assistant) => (
                  <div
                    key={assistant.id}
                    className={`p-3 rounded-md border transition-all ${
                      selectedAssistantId === assistant.id
                        ? 'bg-blue-500/20 border-blue-300/30 text-white'
                        : 'bg-white/90 border-white/30 text-gray-700 hover:bg-white hover:border-blue-300/30'
                    }`}
                  >
                    {/* Assistant Info */}
                    <div
                      onClick={() => handleSelectAssistant(assistant)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                          assistant.is_active 
                            ? 'bg-blue-500/20 text-blue-600' 
                            : 'bg-gray-500/20 text-gray-500'
                        }`}>
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-sm truncate">{assistant.name}</h4>
                            {!assistant.is_active && (
                              <span className="text-xs bg-gray-500/20 text-gray-500 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                            {selectedAssistantId === assistant.id && (
                              <CheckCircle className="w-4 h-4 text-blue-300 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs opacity-70 truncate mt-1">
                            {assistant.description || 'No description'}
                          </p>
                          <div className="flex items-center space-x-3 mt-2 text-xs opacity-60">
                            <span className="flex items-center space-x-1">
                              <MessageSquare className="w-3 h-3" />
                              <span>{assistant.conversation_count}</span>
                            </span>
                            <span>
                              Updated {new Date(assistant.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-1 mt-3 pt-2 border-t border-gray-200/30">
                      <button
                        onClick={() => handleEditAssistant(assistant)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 rounded transition-colors"
                        title="Edit assistant"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAssistant(assistant)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50/50 rounded transition-colors"
                        title="Delete assistant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateAssistantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAssistantCreated={handleAssistantCreated}
      />
      
      <EditAssistantModal
        isOpen={isEditModalOpen}
        assistant={assistantToEdit}
        onClose={() => setIsEditModalOpen(false)}
        onAssistantUpdated={handleAssistantUpdated}
      />
    </div>
  );
};

/**
 * 🎓 LEARNING SUMMARY: Embedded Component Design
 * =============================================
 * 
 * **Key Design Principles Applied:**
 * 
 * 1. **Space Efficiency**
 *    - Collapsible interface to save screen space
 *    - Compact card-based layout
 *    - Scrollable content areas for long lists
 * 
 * 2. **Functional Completeness**
 *    - Full CRUD operations (Create, Read, Update, Delete)
 *    - Search and filtering capabilities
 *    - Status indicators and feedback
 * 
 * 3. **Seamless Integration**
 *    - Props-based communication with parent
 *    - Callback system for state synchronization
 *    - Responsive design for different contexts
 * 
 * 4. **User Experience**
 *    - Clear visual selection states
 *    - Intuitive action buttons
 *    - Loading and error states
 *    - Mobile-friendly interactions
 * 
 * 5. **Component Architecture**
 *    - Reusable and configurable
 *    - Proper state management
 *    - Event-driven communication
 *    - Modal integration for complex operations
 * 
 * **Benefits of This Approach:**
 * - Users never leave the chat interface
 * - Immediate feedback when assistants change
 * - Consistent design with parent component
 * - Scalable to different integration contexts
 */
