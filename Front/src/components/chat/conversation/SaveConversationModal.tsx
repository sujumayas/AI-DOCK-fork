// AI Dock Save Conversation Modal
// Professional dialog for saving and renaming conversations

import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  X, 
  MessageSquare, 
  Edit3, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Lightbulb,
  Settings
} from 'lucide-react';
import { ChatMessage } from '../../../types/chat';
import { generateTitleFromMessages } from '../../../types/conversation';

interface SaveConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, autoGenerateTitle?: boolean) => Promise<void>;
  messages?: ChatMessage[];
  currentTitle?: string;
  mode: 'save' | 'rename';
  isLoading?: boolean;
  className?: string;
}

export const SaveConversationModal: React.FC<SaveConversationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  messages = [],
  currentTitle = '',
  mode,
  isLoading = false,
  className = ''
}) => {
  // State management
  const [title, setTitle] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedTitle, setSuggestedTitle] = useState('');
  
  // Refs for focus management
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Initialize modal state when opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
      
      if (mode === 'rename') {
        setTitle(currentTitle);
        setAutoGenerate(false);
      } else {
        // Generate suggested title for new conversations
        const suggested = messages.length > 0 ? generateTitleFromMessages(messages) : '';
        setSuggestedTitle(suggested);
        setTitle(suggested);
        setAutoGenerate(suggested.length > 0);
      }
      
      // Focus input after modal opens
      setTimeout(() => titleInputRef.current?.focus(), 100);
    } else {
      // Reset state when closed
      setTitle('');
      setAutoGenerate(false);
      setSuggestedTitle('');
    }
  }, [isOpen, mode, currentTitle, messages]);
  
  // Handle escape key and click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isSubmitting) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isSubmitting, onClose]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    const finalTitle = title.trim();
    
    // Validation
    if (!autoGenerate && !finalTitle) {
      setError('Please enter a conversation title');
      titleInputRef.current?.focus();
      return;
    }
    
    if (finalTitle.length > 255) {
      setError('Title must be less than 255 characters');
      titleInputRef.current?.focus();
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      await onSave(finalTitle, autoGenerate);
      
      // Modal will be closed by parent component on success
      
    } catch (error) {
      console.error('Failed to save conversation:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to save conversation. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle title suggestions
  const handleUseSuggestion = () => {
    setTitle(suggestedTitle);
    setAutoGenerate(false);
    titleInputRef.current?.focus();
  };
  
  // Generate new suggestion
  const handleGenerateNew = () => {
    if (messages.length > 0) {
      const newSuggestion = generateTitleFromMessages(messages);
      setSuggestedTitle(newSuggestion);
      setTitle(newSuggestion);
      setAutoGenerate(false);
      titleInputRef.current?.focus();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 transform transition-all duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {mode === 'save' ? (
              <div className="p-2 bg-blue-100 rounded-lg">
                <Save className="w-5 h-5 text-blue-600" />
              </div>
            ) : (
              <div className="p-2 bg-green-100 rounded-lg">
                <Edit3 className="w-5 h-5 text-green-600" />
              </div>
            )}
            
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {mode === 'save' ? 'Save Conversation' : 'Rename Conversation'}
              </h2>
              <p className="text-sm text-gray-600">
                {mode === 'save' 
                  ? 'Give your conversation a memorable name'
                  : 'Update the conversation title'
                }
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Auto-generate option (save mode only) */}
          {mode === 'save' && suggestedTitle && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e) => {
                    setAutoGenerate(e.target.checked);
                    if (e.target.checked) {
                      setTitle(suggestedTitle);
                    }
                  }}
                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      Auto-generate title
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Let AI create a title based on your conversation
                  </p>
                </div>
              </label>
            </div>
          )}
          
          {/* Title input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conversation Title
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setAutoGenerate(false);
                setError(null);
              }}
              placeholder={autoGenerate ? 'Auto-generated title will be used' : 'Enter conversation title...'}
              disabled={autoGenerate || isSubmitting}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              maxLength={255}
            />
            
            {/* Character count */}
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500">
                {title.length}/255 characters
              </span>
              
              {/* Title suggestions (save mode only) */}
              {mode === 'save' && suggestedTitle && !autoGenerate && (
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleUseSuggestion}
                    disabled={isSubmitting}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Use suggestion
                  </button>
                  {messages.length > 1 && (
                    <button
                      type="button"
                      onClick={handleGenerateNew}
                      disabled={isSubmitting}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      Generate new
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Conversation info (save mode only) */}
          {mode === 'save' && messages.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MessageSquare className="w-4 h-4" />
                <span>
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-400">•</span>
                <span>
                  {messages.filter(m => m.role === 'user').length} from you
                </span>
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting || (!autoGenerate && !title.trim())}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {mode === 'save' ? 'Saving...' : 'Updating...'}
                </>
              ) : (
                <>
                  {mode === 'save' ? (
                    <Save className="w-4 h-4 mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {mode === 'save' ? 'Save Conversation' : 'Update Title'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 🎯 SaveConversationModal Component Features:
//
// 1. **Dual Mode Operation**: 
//    - Save mode: Create new conversation with auto-generated titles
//    - Rename mode: Edit existing conversation titles
//    - Context-aware UI and messaging
//
// 2. **Smart Title Generation**: 
//    - Auto-generate titles from conversation content
//    - Manual title input with suggestions
//    - Character limit validation and feedback
//
// 3. **Professional UX**: 
//    - Modal overlay with backdrop blur
//    - Keyboard shortcuts (Enter to save, Escape to cancel)
//    - Focus management and accessibility
//    - Click-outside-to-close functionality
//
// 4. **Form Validation**: 
//    - Real-time validation feedback
//    - Character count display
//    - Error handling with clear messages
//
// 5. **Loading States**: 
//    - Disabled states during submission
//    - Loading spinners and feedback
//    - Prevents multiple submissions
//
// 6. **Conversation Context**: 
//    - Shows message count and metadata
//    - Smart suggestions based on content
//    - User-friendly conversation summary
//
// This component demonstrates:
// - Modal design patterns
// - Form handling and validation
// - Accessibility best practices
// - Loading state management
// - Advanced React patterns (refs, effects)
// - Professional UI/UX design
