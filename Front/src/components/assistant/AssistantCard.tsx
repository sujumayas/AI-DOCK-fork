// AI Dock Assistant Card Component
// Displays individual assistant information with action buttons
// Part of the Custom Assistants feature implementation

import React, { useState } from 'react';
import { 
  Bot, 
  Edit3, 
  Trash2, 
  MessageSquare, 
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Settings,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { 
  AssistantSummary, 
  formatAssistantStatus, 
  formatConversationCount,
  generateSystemPromptPreview 
} from '../../types/assistant';

/**
 * Props interface for AssistantCard component
 * 
 * 🎓 LEARNING: Component Props Interface
 * ====================================
 * Props interfaces define what data a component needs to function.
 * This creates a clear contract between parent and child components.
 * TypeScript ensures we pass the right data and helps with autocomplete.
 */
interface AssistantCardProps {
  /** The assistant data to display */
  assistant: AssistantSummary;
  
  /** Called when user clicks to chat with this assistant */
  onStartChat: (assistantId: number) => void;
  
  /** Called when user wants to edit the assistant */
  onEdit: (assistant: AssistantSummary) => void;
  
  /** Called when user wants to delete the assistant */
  onDelete: (assistant: AssistantSummary) => void;
  
  /** Called when user wants to view full details */
  onViewDetails: (assistant: AssistantSummary) => void;
  
  /** Whether this card is currently selected/active */
  isSelected?: boolean;
  
  /** Whether any async operation is running for this assistant */
  isLoading?: boolean;
  
  /** Custom CSS classes for styling */
  className?: string;
}

/**
 * AssistantCard - Individual assistant display component
 * 
 * 🎓 LEARNING: Component Architecture
 * ==================================
 * This component follows the "presentation component" pattern:
 * - Receives data via props (no direct API calls)
 * - Emits events via callback props
 * - Focuses on UI rendering and user interaction
 * - Parent component handles business logic and state management
 * 
 * Benefits:
 * - Reusable across different contexts
 * - Easy to test (just pass props)
 * - Clear separation of concerns
 * - Predictable behavior
 */
export const AssistantCard: React.FC<AssistantCardProps> = ({
  assistant,
  onStartChat,
  onEdit,
  onDelete,
  onViewDetails,
  isSelected = false,
  isLoading = false,
  className = ''
}) => {
  // Local state for UI interactions
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Handle delete confirmation
   * 
   * 🎓 LEARNING: User Experience Patterns
   * ===================================
   * Destructive actions (like delete) should:
   * - Show confirmation before executing
   * - Provide visual feedback during operation
   * - Give clear success/error messages
   * - Allow cancellation when possible
   */
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(assistant);
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Format date for display
   * 
   * 🎓 LEARNING: Date Formatting
   * ===========================
   * Convert ISO date strings to user-friendly formats.
   * This helper makes dates more readable and consistent.
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  /**
   * Get status styling based on assistant state
   * 
   * 🎓 LEARNING: Dynamic Styling
   * ===========================
   * Functions that return CSS classes based on data state.
   * This keeps styling logic organized and reusable.
   */
  const getStatusBadgeStyles = () => {
    if (!assistant.is_active) {
      return 'bg-gray-100 text-gray-600 border-gray-200';
    }
    
    if (assistant.is_new) {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  /**
   * Get card border styling based on selection state
   */
  const getCardBorderStyles = () => {
    if (isSelected) {
      return 'border-blue-300 bg-blue-50/50';
    }
    
    if (!assistant.is_active) {
      return 'border-gray-200 bg-gray-50/30';
    }
    
    return 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/30';
  };

  return (
    <div 
      className={`
        relative p-6 rounded-xl border-2 transition-all duration-200 backdrop-blur-sm
        ${getCardBorderStyles()}
        ${isLoading || isDeleting ? 'opacity-60 pointer-events-none' : ''}
        ${className}
      `}
    >
      {/* Loading overlay */}
      {(isLoading || isDeleting) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl z-10">
          <div className="flex items-center space-x-2 text-blue-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">
              {isDeleting ? 'Deleting...' : 'Loading...'}
            </span>
          </div>
        </div>
      )}

      {/* Header: Name and Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          {/* Assistant name */}
          <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
            {assistant.name}
          </h3>
          
          {/* Description */}
          {assistant.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {assistant.description}
            </p>
          )}
        </div>
        
        {/* Status badge */}
        <div className={`
          px-2 py-1 text-xs font-medium border rounded-full whitespace-nowrap
          ${getStatusBadgeStyles()}
        `}>
          {formatAssistantStatus(assistant)}
        </div>
      </div>

      {/* System Prompt Preview */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">System Prompt</span>
          <button
            onClick={() => setShowFullPrompt(!showFullPrompt)}
            className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700"
          >
            {showFullPrompt ? (
              <>
                <EyeOff className="w-3 h-3" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                <span>Show full</span>
              </>
            )}
          </button>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3 border">
          <p className={`text-sm text-gray-700 ${showFullPrompt ? '' : 'line-clamp-3'}`}>
            {showFullPrompt 
              ? assistant.system_prompt_preview 
              : generateSystemPromptPreview(assistant.system_prompt_preview, 120)
            }
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          {/* Conversation count */}
          <div className="flex items-center space-x-1">
            <MessageSquare className="w-3 h-3" />
            <span>{formatConversationCount(assistant.conversation_count)}</span>
          </div>
          
          {/* Creation date */}
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3" />
            <span>Created {formatDate(assistant.created_at)}</span>
          </div>
        </div>
        
        {/* Assistant ID (for debugging/support) */}
        <span className="text-gray-400">ID: {assistant.id}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-3">
        {/* Primary action: Start Chat */}
        <button
          onClick={() => onStartChat(assistant.id)}
          disabled={!assistant.is_active}
          className={`
            flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg 
            text-sm font-medium transition-all duration-200
            ${assistant.is_active 
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <Bot className="w-4 h-4" />
          <span>Start Chat</span>
          <ChevronRight className="w-3 h-3" />
        </button>
        
        {/* Secondary actions */}
        <div className="flex items-center space-x-1">
          {/* View details */}
          <button
            onClick={() => onViewDetails(assistant)}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View full details"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          {/* Edit assistant */}
          <button
            onClick={() => onEdit(assistant)}
            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Edit assistant"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          
          {/* Delete assistant */}
          <button
            onClick={() => setIsDeleting(true)}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete assistant"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl border-2 border-red-200 flex items-center justify-center z-20">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Assistant?
            </h4>
            
            <p className="text-sm text-gray-600 mb-6 max-w-xs">
              This will permanently delete "{assistant.name}" and all its conversations. 
              This action cannot be undone.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setIsDeleting(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 🎓 LEARNING SUMMARY: AssistantCard Component
 * ==========================================
 * 
 * **Key Concepts Demonstrated:**
 * 
 * 1. **Component Props Pattern**
 *    - Clear interface defining what data component needs
 *    - Callback props for event handling
 *    - Optional props with defaults
 * 
 * 2. **State Management**
 *    - Local state for UI-only concerns (showFullPrompt, isDeleting)
 *    - Props for shared/business state (assistant data, loading states)
 * 
 * 3. **User Experience Design**
 *    - Confirmation for destructive actions
 *    - Loading states with visual feedback
 *    - Disabled states for invalid actions
 *    - Hover effects and transitions
 * 
 * 4. **Accessibility Considerations**
 *    - Semantic HTML structure
 *    - Meaningful button titles/tooltips
 *    - Keyboard-friendly interactions
 *    - Screen reader compatible content
 * 
 * 5. **Responsive Design**
 *    - Flexbox layouts that adapt to screen size
 *    - Truncated text that doesn't break layout
 *    - Touch-friendly button sizes
 * 
 * **Best Practices Applied:**
 * - Consistent spacing and typography
 * - Meaningful error states
 * - Progressive disclosure (show/hide prompt)
 * - Clear visual hierarchy
 * - Consistent color scheme
 * 
 * **Integration Points:**
 * - Uses assistant types from types/assistant.ts
 * - Integrates with parent components via props
 * - Ready for use in lists, grids, or detailed views
 */
