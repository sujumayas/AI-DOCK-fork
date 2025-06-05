// ✍️ Message Input Component
// Handles user input for chat messages
// Features: multi-line support, send button, keyboard shortcuts, character counting

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

// Props interface - what this component needs from parent
interface MessageInputProps {
  onSendMessage: (message: string) => void;  // Function to call when sending a message
  isLoading: boolean;                        // Disable input while AI is responding
  placeholder?: string;                      // Customize placeholder text
  disabled?: boolean;                        // Allow parent to disable input
  className?: string;                        // Optional custom styles
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isLoading,
  placeholder = "Type your message here...",
  disabled = false,
  className = ''
}) => {
  // 📝 State for the current message being typed
  const [message, setMessage] = useState('');
  
  // 🎯 Reference to the textarea for focus management
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 📐 Auto-resize textarea as user types
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to recalculate
      textarea.style.height = 'auto';
      // Set height to scroll height (content height)
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; // Max 120px height
    }
  };
  
  // 🔄 Adjust height whenever message content changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);
  
  // ✅ Handle sending the message
  const handleSend = () => {
    // Don't send empty messages or when disabled
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading || disabled) {
      return;
    }
    
    // Send the message to parent component
    onSendMessage(trimmedMessage);
    
    // Clear the input field
    setMessage('');
    
    // Reset textarea height
    setTimeout(() => {
      adjustTextareaHeight();
    }, 0);
  };
  
  // ⌨️ Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter (but allow Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent adding a new line
      handleSend();
    }
  };
  
  // 📊 Calculate character count and check limits
  const characterCount = message.length;
  const characterLimit = 4000; // Reasonable limit for most LLMs
  const isNearLimit = characterCount > characterLimit * 0.8; // Warn at 80%
  const isOverLimit = characterCount > characterLimit;
  
  // 🎨 Determine if send button should be enabled
  const canSend = message.trim().length > 0 && !isLoading && !disabled && !isOverLimit;
  
  return (
    <div className={`border-t bg-white ${className}`}>
      <div className="p-4">
        {/* 📊 Character counter (only show when approaching limit) */}
        {isNearLimit && (
          <div className={`text-xs mb-2 text-right ${isOverLimit ? 'text-red-500' : 'text-amber-500'}`}>
            {characterCount}/{characterLimit} characters
            {isOverLimit && ' (too long)'}
          </div>
        )}
        
        <div className="flex items-end space-x-3">
          {/* ✍️ Message input textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading || disabled}
              className={`
                w-full px-4 py-3 border border-gray-300 rounded-lg resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-50 disabled:cursor-not-allowed
                ${isOverLimit ? 'border-red-300 focus:ring-red-500' : ''}
                transition-colors duration-200
              `}
              style={{ 
                minHeight: '44px',
                maxHeight: '120px'
              }}
              rows={1}
            />
            
            {/* 💡 Keyboard shortcut hint */}
            <div className="absolute bottom-1 right-2 text-xs text-gray-400 pointer-events-none">
              {isLoading ? 'Please wait...' : 'Enter to send, Shift+Enter for new line'}
            </div>
          </div>
          
          {/* 📤 Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`
              p-3 rounded-lg transition-all duration-200 flex items-center justify-center
              ${canSend
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
              min-w-[44px] h-[44px]
            `}
            title={canSend ? 'Send message (Enter)' : 'Type a message to send'}
          >
            {isLoading ? (
              // 🔄 Loading spinner when AI is responding
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              // 📤 Send icon
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* ℹ️ Help text for new users */}
        {message.length === 0 && !isLoading && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            💡 Pro tip: You can use <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Shift + Enter</kbd> to add line breaks
          </div>
        )}
      </div>
    </div>
  );
};

// 🎯 How this component works:
//
// 1. **Auto-resizing Textarea**: Grows and shrinks based on content
//    - Starts at 1 line, expands up to 120px max height
//    - Automatically adjusts when user types or deletes
//
// 2. **Keyboard Shortcuts**: 
//    - Enter: Send message
//    - Shift+Enter: Add new line
//    - Prevents sending empty messages
//
// 3. **Character Limiting**:
//    - Warns user when approaching 4000 character limit
//    - Prevents sending overly long messages
//    - Shows real-time character count
//
// 4. **Loading States**:
//    - Disables input when AI is responding
//    - Shows loading spinner on send button
//    - Clear visual feedback for user
//
// 5. **Accessibility**:
//    - Proper keyboard navigation
//    - Screen reader friendly
//    - Clear visual states and feedback
//
// 6. **UX Enhancements**:
//    - Helpful placeholder text
//    - Keyboard shortcut hints
//    - Pro tips for new users
//    - Smooth transitions and animations
//
// Usage Example:
// ```
// <MessageInput
//   onSendMessage={(message) => handleNewMessage(message)}
//   isLoading={waitingForResponse}
//   placeholder="Ask me anything..."
// />
// ```
