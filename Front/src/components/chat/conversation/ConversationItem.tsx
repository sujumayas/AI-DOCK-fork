// AI Dock Conversation Item Component
// Individual conversation display with edit, delete, and selection functionality

import React, { useState } from 'react';
import { 
  MessageSquare, 
  Clock, 
  Edit3, 
  Trash2, 
  Check, 
  X,
  ChevronRight 
} from 'lucide-react';
import { ConversationSummary } from '../../../types/conversation';
import { formatConversationTimestamp } from '../../../utils/chatHelpers';

interface ConversationItemProps {
  conversation: ConversationSummary;
  isSelected?: boolean;
  isCurrentConversation?: boolean;
  onSelect: (conversationId: number) => void;
  onEdit: (conversationId: number, newTitle: string) => Promise<void>;
  onDelete: (conversationId: number) => Promise<void>;
  className?: string;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  isCurrentConversation,
  onSelect,
  onEdit,
  onDelete,
  className = ''
}) => {
  // State for inline editing
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  

  
  // Handle title editing
  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(conversation.title);
  };
  
  const handleSaveEdit = async () => {
    if (!editTitle.trim() || editTitle.trim() === conversation.title) {
      setIsEditing(false);
      return;
    }
    
    try {
      setIsSaving(true);
      await onEdit(conversation.id, editTitle.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save title:', error);
      // Reset to original title on error
      setEditTitle(conversation.title);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(conversation.title);
  };
  
  // Handle deletion
  const handleStartDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
  };
  
  const handleConfirmDelete = async () => {
    try {
      await onDelete(conversation.id);
      setIsDeleting(false);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setIsDeleting(false);
    }
  };
  
  const handleCancelDelete = () => {
    setIsDeleting(false);
  };
  
  // Handle conversation selection
  const handleSelect = () => {
    if (!isEditing && !isDeleting) {
      onSelect(conversation.id);
    }
  };
  
  return (
    <div
      className={`
        group relative mx-2 mb-1 rounded-lg transition-all duration-200 cursor-pointer
        ${isCurrentConversation
          ? 'bg-blue-50 border border-blue-200 shadow-sm'
          : isSelected
          ? 'bg-gray-50 border border-gray-200'
          : 'hover:bg-gray-50 border border-transparent hover:border-gray-200'
        }
        ${className}
      `}
      onClick={handleSelect}
    >
      {/* Delete confirmation overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-lg border border-red-200 flex items-center justify-center z-10">
          <div className="text-center p-4">
            <p className="text-sm text-gray-700 mb-3 font-medium">
              Delete "{conversation.title}"?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              This action cannot be undone.
            </p>
            <div className="flex space-x-2 justify-center">
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main conversation content */}
      <div className="flex items-start p-3">
        <div className="flex-1 min-w-0">
          {/* Title section */}
          <div className="flex items-center space-x-2 mb-1">
            {isEditing ? (
              <div className="flex items-center space-x-2 flex-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  className="flex-1 px-2 py-1 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="Conversation title"
                  autoFocus
                  disabled={isSaving}
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                  title="Save"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="p-1 text-gray-500 hover:bg-gray-50 rounded disabled:opacity-50"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-medium text-gray-800 truncate flex-1">
                  {conversation.title}
                </h3>
                {isCurrentConversation && (
                  <div className="flex items-center text-blue-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                    <span className="text-xs font-medium">Current</span>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Metadata section */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            <div className="flex items-center">
              <MessageSquare className="w-3 h-3 mr-1 flex-shrink-0" />
              <span>
                {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
              <span 
                title={`Last message: ${conversation.last_message_at || 'Unknown'} | Updated: ${conversation.updated_at || 'Unknown'}`}
              >
                {formatConversationTimestamp(conversation.last_message_at || conversation.updated_at)}
              </span>
            </div>
            
            {conversation.model_used && (
              <div className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-medium">
                {conversation.model_used}
              </div>
            )}
            
            {/* Debug info - only show in development and when timestamps differ significantly */}
            {process.env.NODE_ENV === 'development' && 
             conversation.last_message_at && 
             conversation.updated_at && 
             conversation.last_message_at !== conversation.updated_at && (
              <div className="text-xs text-orange-500 bg-orange-50 px-1 py-0.5 rounded" title="Debug: Timestamps differ">
                Using: {conversation.last_message_at ? 'last_message_at' : 'updated_at'}
              </div>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        {!isEditing && !isDeleting && (
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            <button
              onClick={handleStartEdit}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Rename conversation"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={handleStartDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            
            <ChevronRight className="w-4 h-4 text-gray-300 ml-1" />
          </div>
        )}
        
        {/* Loading indicator for save operation */}
        {isSaving && (
          <div className="flex items-center ml-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};

// 🎯 ConversationItem Component Features:
//
// 1. **Interactive Display**: 
//    - Clean, modern card design with hover effects
//    - Current conversation highlighting
//    - Professional typography and spacing
//
// 2. **Inline Editing**: 
//    - Click-to-edit conversation titles
//    - Keyboard shortcuts (Enter to save, Escape to cancel)
//    - Visual feedback during save operations
//
// 3. **Delete Confirmation**: 
//    - Safe deletion with confirmation overlay
//    - Clear warning about permanent action
//    - Easy cancel option
//
// 4. **Rich Metadata**: 
//    - Message count, last updated time
//    - Model used indicator
//    - Smart date formatting (relative time)
//
// 5. **Responsive Design**: 
//    - Mobile-friendly touch targets
//    - Flexible layout that adapts to content
//    - Smooth animations and transitions
//
// This component demonstrates:
// - Component state management
// - Event handling and propagation
// - Conditional rendering patterns
// - Professional UI/UX design
// - TypeScript prop interface design
