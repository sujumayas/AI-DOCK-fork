// ✍️ Enhanced Message Input Component
// Handles user input for chat messages with file upload support
// Features: multi-line support, send button, keyboard shortcuts, character counting, file attachments
// 🛡️ PASTE PROTECTION: Sanitizes pasted content to prevent styling conflicts

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X, Paperclip, Upload, FileText } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { FileAttachment } from './FileAttachment';
import { 
  FileUpload as FileUploadType,
  FileAttachment as FileAttachmentType,
  FileError,
  createFileUpload,
  generateFileId
} from '../../types/file';

// Props interface - what this component needs from parent
interface MessageInputProps {
  onSendMessage: (message: string, attachments?: FileAttachmentType[]) => void;  // Function to call when sending a message
  isLoading: boolean;                        // Disable input while AI is responding
  isStreaming?: boolean;                     // NEW: Shows if AI is currently streaming a response
  onCancel?: () => void;                     // NEW: Function to call when user wants to cancel streaming
  placeholder?: string;                      // Customize placeholder text
  disabled?: boolean;                        // Allow parent to disable input
  className?: string;                        // Optional custom styles
  
  // 📁 NEW: File upload props
  allowFileUpload?: boolean;                 // Enable file upload functionality
  maxFiles?: number;                         // Maximum files per message
  onFileUploadError?: (error: FileError) => void; // Handle file upload errors
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isLoading,
  isStreaming = false,        // NEW: Default to false if not provided
  onCancel,                   // NEW: Cancel handler (optional)
  placeholder = "Type your message here...",
  disabled = false,
  className = '',
  
  // 📁 NEW: File upload props with defaults
  allowFileUpload = true,
  maxFiles = 5,
  onFileUploadError
}) => {
  // 📝 State for the current message being typed
  const [message, setMessage] = useState('');
  
  // 🎯 Reference to the textarea for focus management
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 📁 NEW: File upload state
  const [attachments, setAttachments] = useState<FileAttachmentType[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [fileUploadsInProgress, setFileUploadsInProgress] = useState<FileUploadType[]>([]);
  
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
  
  // ✅ Handle sending the message (enhanced with file attachments)
  const handleSend = () => {
    // Check if we have content to send (message or files)
    const trimmedMessage = message.trim();
    const hasAttachments = attachments.length > 0;
    const hasUploadsInProgress = fileUploadsInProgress.some(upload => 
      upload.status === 'uploading' || upload.status === 'processing'
    );
    
    console.log('🔍 DEBUG - Pre-send state check:', {
      trimmedMessage: trimmedMessage.substring(0, 50) + '...',
      attachmentsCount: attachments.length,
      uploadsInProgressCount: fileUploadsInProgress.length,
      hasUploadsInProgress,
      isLoading,
      disabled,
      attachmentDetails: attachments.map(a => ({
        id: a.id,
        uploadedFileId: a.fileUpload.uploadedFileId,
        fileName: a.fileUpload.file.name,
        status: a.fileUpload.status
      }))
    });
    
    // Don't send if:
    // - No message and no attachments
    // - Currently loading/streaming
    // - Component is disabled
    // - Files are still uploading
    if ((!trimmedMessage && !hasAttachments) || isLoading || disabled || hasUploadsInProgress) {
      console.log('❌ Send blocked:', {
        noContent: !trimmedMessage && !hasAttachments,
        isLoading,
        disabled,
        hasUploadsInProgress
      });
      return;
    }
    
    console.log('📤 Sending message with attachments:', {
      messageLength: trimmedMessage.length,
      attachmentCount: attachments.length,
      attachments: attachments.map(a => ({
        fileName: a.fileUpload.file.name,
        uploadedFileId: a.fileUpload.uploadedFileId,
        hasServerID: !!a.fileUpload.uploadedFileId
      }))
    });
    
    // Send the message with attachments to parent component
    onSendMessage(trimmedMessage, attachments.length > 0 ? attachments : undefined);
    
    // Clear the input field and attachments
    setMessage('');
    setAttachments([]);
    setFileUploadsInProgress([]);
    setShowFileUpload(false);
    
    // Reset textarea height
    setTimeout(() => {
      adjustTextareaHeight();
    }, 0);
  };
  
  // 🛑 NEW: Handle canceling streaming response
  const handleCancel = () => {
    // Only allow canceling if we're streaming and have a cancel function
    if (isStreaming && onCancel) {
      console.log('🛑 User requested to cancel streaming response');
      onCancel();
    }
  };
  
  // ⌨️ Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send message on Enter (but allow Shift+Enter for new lines)
    // Only allow sending if not currently streaming
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent adding a new line
      
      if (!isStreaming) {
        // Normal send behavior when not streaming
        handleSend();
      }
      // Note: We don't handle cancel with Enter key for safety
      // User must click the cancel button explicitly
    }
  };
  
  // 📋 SUPER-ENHANCED: Handle paste events with aggressive style stripping
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Prevent the default paste behavior completely
    e.preventDefault();
    
    // Get the pasted content as plain text (strips all formatting)
    const pastedText = e.clipboardData.getData('text/plain');
    
    // Additional cleaning: remove any potential invisible characters or formatting
    const cleanedText = pastedText
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .replace(/[\u00A0]/g, ' ') // Replace non-breaking spaces with regular spaces
      .normalize('NFC'); // Normalize unicode characters
    
    // Get current cursor position in textarea
    const textarea = e.target as HTMLTextAreaElement;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    
    // Insert the sanitized plain text at cursor position
    const newMessage = message.substring(0, startPos) + cleanedText + message.substring(endPos);
    
    // Update the message state
    setMessage(newMessage);
    
    // 🛡️ SUPER-ENHANCED: Aggressive style enforcement after paste
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = startPos + cleanedText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
        
        // Force consistent styling with high specificity
        textareaRef.current.style.cssText = `
          color: #1f2937 !important;
          background-color: rgba(255, 255, 255, 0.9) !important;
          font-family: inherit !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          text-decoration: none !important;
        `;
        
        // Triple-check: Ensure the value matches our cleaned version
        if (textareaRef.current.value !== newMessage) {
          textareaRef.current.value = newMessage;
          setMessage(newMessage);
          console.warn('🔧 Had to force-correct textarea value after paste');
        }
        
        // Remove any potential contenteditable attributes
        textareaRef.current.removeAttribute('contenteditable');
        
        // Force re-render of the component to ensure styling sticks
        textareaRef.current.blur();
        textareaRef.current.focus();
      }
    }, 0);
    
    console.log('📋 Content super-sanitized:', {
      originalLength: pastedText.length,
      cleanedLength: cleanedText.length,
      newMessageLength: newMessage.length,
      hadInvisibleChars: pastedText.length !== cleanedText.length,
      sanitized: true
    });
  };
  
  // 📊 Calculate character count and check limits
  const characterCount = message.length;
  const characterLimit = 4000; // Reasonable limit for most LLMs
  const isNearLimit = characterCount > characterLimit * 0.8; // Warn at 80%
  const isOverLimit = characterCount > characterLimit;
  
  // 📁 NEW: File upload handlers
  const handleFilesAdded = (newUploads: FileUploadType[]) => {
    console.log('📁 Files added to message input:', newUploads.length);
    setFileUploadsInProgress(prev => [...prev, ...newUploads]);
  };
  
  const handleFileUploadComplete = (completedUpload: FileUploadType) => {
    // 🔍 DEBUG: Check if file ID is being set correctly
    console.log('🔍 DEBUG - File Upload Completed:', {
      fileId: completedUpload.id,
      fileName: completedUpload.file.name,
      uploadedFileId: completedUpload.uploadedFileId, // THIS IS CRITICAL
      uploadedFileIdType: typeof completedUpload.uploadedFileId,
      status: completedUpload.status,
      hasUploadedFileId: !!completedUpload.uploadedFileId
    });
    
    // Check if uploadedFileId is missing
    if (!completedUpload.uploadedFileId) {
      console.error('❌ ISSUE FOUND: uploadedFileId is missing from completed upload!');
      console.log('This means the file upload API response is not setting the ID correctly');
    }
    
    // Create attachment object
    const attachment: FileAttachmentType = {
      id: generateFileId(),
      fileUpload: completedUpload,
      isVisible: true,
      isProcessed: true,
      downloadCount: 0,
      createdAt: new Date()
    };
    
    console.log('📎 Creating attachment:', {
      attachmentId: attachment.id,
      uploadedFileId: attachment.fileUpload.uploadedFileId,
      fileName: attachment.fileUpload.file.name
    });
    
    // Update attachments state
    setAttachments(prev => {
      const newAttachments = [...prev, attachment];
      console.log('📎 Updated attachments array:', {
        previousCount: prev.length,
        newCount: newAttachments.length,
        attachmentIds: newAttachments.map(a => ({
          id: a.id,
          uploadedFileId: a.fileUpload.uploadedFileId,
          fileName: a.fileUpload.file.name
        }))
      });
      return newAttachments;
    });
    
    // Remove from uploads in progress
    setFileUploadsInProgress(prev => prev.filter(upload => upload.id !== completedUpload.id));
  };
  
  const handleFileUploadError = (error: FileError) => {
    console.error('❌ File upload error:', error);
    
    // Remove failed upload from progress
    if (error.fileId) {
      setFileUploadsInProgress(prev => prev.filter(upload => upload.id !== error.fileId));
    }
    
    // Notify parent if handler provided
    if (onFileUploadError) {
      onFileUploadError(error);
    }
  };
  
  const handleFileRemoved = (fileId: string) => {
    console.log('🗑️ File removed from message input:', fileId);
    setFileUploadsInProgress(prev => prev.filter(upload => upload.id !== fileId));
    setAttachments(prev => prev.filter(attachment => attachment.fileUpload.id !== fileId));
  };
  
  const handleAttachmentRemoved = (attachmentId: string) => {
    console.log('🗑️ Attachment removed from message input:', attachmentId);
    setAttachments(prev => prev.filter(attachment => attachment.id !== attachmentId));
  };
  
  const toggleFileUpload = () => {
    console.log('📎 DEBUG - Toggle file upload clicked:', {
      allowFileUpload,
      disabled,
      currentShowFileUpload: showFileUpload,
      willShow: !showFileUpload
    });
    if (!allowFileUpload || disabled) return;
    setShowFileUpload(prev => !prev);
  };
  
  // 🎨 NEW: Determine button state and behavior (enhanced for file uploads)
  const hasContent = message.trim().length > 0 || attachments.length > 0;
  const hasUploadsInProgress = fileUploadsInProgress.some(upload => 
    upload.status === 'uploading' || upload.status === 'processing'
  );
  const canSend = hasContent && !isLoading && !disabled && !isOverLimit && !hasUploadsInProgress;
  const showCancelButton = isStreaming; // Show cancel when streaming
  const canCancel = isStreaming && onCancel; // Can cancel if streaming and handler provided
  
  return (
    <div className={`border-t border-white/20 bg-white/10 backdrop-blur-sm ${className}`}>
      {/* 📁 NEW: File Upload Zone (when enabled) */}
      {allowFileUpload && showFileUpload && (
        <div className="border-b border-white/20 p-3 md:p-4">
          <FileUpload
            isVisible={true}
            onFilesAdded={handleFilesAdded}
            onFileRemoved={handleFileRemoved}
            onUploadComplete={handleFileUploadComplete}
            onUploadError={handleFileUploadError}
            maxFiles={maxFiles}
            compact={window.innerWidth < 768}
            disabled={disabled || isLoading}
          />
        </div>
      )}
      
      {/* 📎 NEW: Current Attachments Display */}
      {(attachments.length > 0 || fileUploadsInProgress.length > 0) && (
        <div className="border-b border-white/20 p-3 md:p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
            <FileText className="w-4 h-4" />
            <span>
              {attachments.length > 0 && `${attachments.length} file(s) attached`}
              {attachments.length > 0 && fileUploadsInProgress.length > 0 && ' • '}
              {fileUploadsInProgress.length > 0 && `${fileUploadsInProgress.length} uploading...`}
            </span>
          </div>
          
          
          {/* Show uploads in progress */}
          {fileUploadsInProgress.map(upload => {
            // Create temporary attachment for display
            const tempAttachment: FileAttachmentType = {
              id: upload.id,
              fileUpload: upload,
              isVisible: true,
              isProcessed: false,
              downloadCount: 0,
              createdAt: new Date()
            };
            
            return (
              <FileAttachment
                key={upload.id}
                attachment={tempAttachment}
                onRemove={handleFileRemoved}
                showDownload={false}
                showPreview={false}
                compact={window.innerWidth < 768}
                className="bg-blue-500/10 border-blue-400/30"
              />
            );
          })}
        </div>
      )}
      
      <div className="p-3 md:p-4">
        {/* 📊 Character counter (only show when approaching limit) */}
        {isNearLimit && (
          <div className={`text-xs mb-2 text-right ${isOverLimit ? 'text-red-300' : 'text-yellow-300'}`}>
            <span className="hidden sm:inline">{characterCount}/{characterLimit} characters</span>
            <span className="sm:hidden">{characterCount}/{characterLimit}</span>
            {isOverLimit && <span className="block sm:inline"> (too long)</span>}
          </div>
        )}
        
        <div className="flex items-end gap-2 md:gap-3">
          {/* 📎 NEW: File upload button */}
          {allowFileUpload && (
            <button
              onClick={toggleFileUpload}
              disabled={disabled || isLoading}
              className={`
                p-2.5 md:p-3 rounded-lg transition-all duration-200 flex items-center justify-center touch-manipulation
                ${
                  disabled || isLoading
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : showFileUpload
                    ? 'bg-blue-500/30 text-blue-200 hover:bg-blue-500/40'
                    : 'bg-white/20 text-white/70 hover:bg-white/30 hover:text-white'
                }
                min-w-[40px] md:min-w-[44px] h-[40px] md:h-[44px]
              `}
              title={showFileUpload ? 'Hide file upload' : 'Attach files'}
            >
              {showFileUpload ? (
                <X className="w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </button>
          )}
          
          {/* ✍️ Message input textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={isLoading || disabled}
              className={`
                message-input-textarea
                w-full px-3 md:px-4 py-2.5 md:py-3 bg-white/90 backdrop-blur-sm border border-white/30 rounded-lg resize-none text-sm md:text-base
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white
                disabled:bg-white/50 disabled:cursor-not-allowed disabled:text-gray-500
                ${isOverLimit ? 'border-red-300 focus:ring-red-400' : ''}
                transition-all duration-200 shadow-sm hover:shadow-md touch-manipulation
                [&::placeholder]:text-gray-500 [&::-webkit-input-placeholder]:text-gray-500 [&::-moz-placeholder]:text-gray-500
              `}
              style={{ 
                minHeight: '40px',
                maxHeight: '100px',
                // 🛡️ ENHANCED: Force text styling with high specificity
                color: '#1f2937 !important',
                fontFamily: 'inherit !important',
                fontSize: 'inherit !important', 
                fontWeight: 'normal !important',
                textDecoration: 'none !important',
                caretColor: '#1f2937' // Ensure cursor color matches
              }}
              rows={1}
            />
            
            {/* 💡 Dynamic keyboard shortcut hint */}
            <div className="absolute bottom-1 right-2 text-xs text-gray-500 pointer-events-none">
              {hasUploadsInProgress ? (
                // Show upload status
                <span className="text-blue-500">Uploading files...</span>
              ) : isStreaming ? (
                // Show streaming status
                'AI is responding...'
              ) : isLoading ? (
                // Show loading status
                'Please wait...'
              ) : (
                // Show normal keyboard shortcuts
                <>
                  <span className="hidden md:inline">Enter to send, Shift+Enter for new line</span>
                  <span className="md:hidden">Enter → send</span>
                </>
              )}
            </div>
          </div>
          
          {/* 🔍 DEBUG: Button state check */}
          {console.log('🔍 DEBUG - Send button state:', {
            hasUploadsInProgress,
            canSend,
            showCancelButton,
            uploadsInProgressCount: fileUploadsInProgress.length,
            uploadsInProgressDetails: fileUploadsInProgress.map(u => ({
              id: u.id,
              fileName: u.file.name,
              status: u.status
            })),
            buttonWillBeDisabled: !canSend
          })}
          
          {/* 📤 Send/Cancel Button with Conditional Rendering */}
          {showCancelButton ? (
            // 🛑 CANCEL BUTTON: Show when streaming
            <button
              onClick={handleCancel}
              disabled={!canCancel}
              className={`
                p-2.5 md:p-3 rounded-lg transition-all duration-200 flex items-center justify-center touch-manipulation
                ${
                  canCancel
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95'
                    : 'bg-white/20 text-white/40 cursor-not-allowed backdrop-blur-sm'
                }
                min-w-[40px] md:min-w-[44px] h-[40px] md:h-[44px]
              `}
              title={canCancel ? 'Cancel streaming response' : 'Cannot cancel'}
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          ) : (
            // 📤 SEND BUTTON: Show when not streaming
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`
                p-2.5 md:p-3 rounded-lg transition-all duration-200 flex items-center justify-center touch-manipulation
                ${
                  canSend
                    ? 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 active:from-blue-700 active:to-teal-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95'
                    : 'bg-white/20 text-white/40 cursor-not-allowed backdrop-blur-sm'
                }
                min-w-[40px] md:min-w-[44px] h-[40px] md:h-[44px]
              `}
              title={canSend ? 'Send message (Enter)' : 'Type a message to send'}
            >
              {isLoading ? (
                // 🔄 Loading spinner when AI is responding
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
              ) : (
                // 📤 Send icon
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </button>
          )}
        </div>
        
        {/* ℹ️ Enhanced help text for new users - updated for streaming and file uploads */}
        {message.length === 0 && !isLoading && !isStreaming && attachments.length === 0 && (
          <div className="mt-2 text-xs text-blue-200 text-center">
            <span className="hidden md:inline">
              💡 Pro tip: You can use <kbd className="px-1 py-0.5 bg-white/20 backdrop-blur-sm rounded text-xs text-white">Shift + Enter</kbd> to add line breaks
              {allowFileUpload && <span> or <kbd className="px-1 py-0.5 bg-white/20 backdrop-blur-sm rounded text-xs text-white">📎</kbd> to attach files</span>}
            </span>
            <span className="md:hidden">
              💡 Tap to type{allowFileUpload && ' or 📎 for files'}, then tap send
            </span>
          </div>
        )}
        
        {/* 🛑 NEW: Streaming help text */}
        {isStreaming && (
          <div className="mt-2 text-xs text-orange-200 text-center">
            <span className="hidden md:inline">
              🌊 AI is streaming response in real-time. Click the red ❌ button to cancel.
            </span>
            <span className="md:hidden">
              🌊 Streaming... Tap ❌ to cancel
            </span>
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
// 7. **🛡️ PASTE PROTECTION** (NEW):
//    - Sanitizes pasted content to prevent styling conflicts
//    - Strips all formatting from pasted text (fonts, colors, etc.)
//    - Maintains cursor position after paste
//    - Forces consistent text color via inline styles
//    - Prevents external styles from affecting textarea appearance
//
//    **Why this matters**: When users paste content from websites, documents,
//    or styled sources, that content can carry inline styles like `color: black`
//    that override your app's CSS. This causes inconsistent text appearance.
//
//    **How it works**: 
//    1. Intercept paste events with `onPaste` handler
//    2. Extract only plain text using `clipboardData.getData('text/plain')`
//    3. Insert sanitized text at cursor position
//    4. Use inline `style` attribute to force consistent colors
//    5. Log the sanitization for debugging
//
// Usage Example:
// ```
// <MessageInput
//   onSendMessage={(message) => handleNewMessage(message)}
//   isLoading={waitingForResponse}
//   placeholder="Ask me anything..."
// />
// ```
