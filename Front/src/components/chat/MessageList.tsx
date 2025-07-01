// 💬 Message List Component - FIXED VERSION
// Displays the conversation history between user and AI with rich markdown support
// Handles loading states, auto-scrolling, and professional message formatting
// Features: Bold, italic, headers, lists, code blocks, blockquotes with blue glassmorphism theme
// 🔧 FIXED: Consolidated auto-scroll effects to prevent aggressive scrolling

import React, { useEffect, useRef } from 'react';
import Markdown from 'markdown-to-jsx';
import { ChatMessage } from '../../types/chat';
import { CodeBlock } from '../ui/CodeBlock';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { AssistantDivider, AssistantBadge } from '../assistant';
// 📁 NEW: Import file-related utilities for attachment display
import { 
  getFileIcon, 
  formatFileSize, 
  messageHasFiles, 
  getMessageFileCount 
} from '../../types';

// Props interface - what data this component needs
interface MessageListProps {
  messages: ChatMessage[];           // Array of conversation messages
  isLoading: boolean;               // Shows typing indicator when AI is responding
  className?: string;               // Optional custom CSS classes
  isStreaming?: boolean;            // 🌊 NEW: Indicates if content is currently streaming
}

// 🎨 Component for individual message bubbles
interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
}

// 🎯 Memoized markdown content component for performance
const MarkdownContent: React.FC<{ content: string; isSystem: boolean; isThinking?: boolean }> = React.memo(({ content, isSystem, isThinking = false }) => {
  // 🚨 Error boundary for malformed markdown
  try {
    // 🔍 Handle edge cases - Show thinking animation instead of "Empty message"
    if (!content || content.trim() === '') {
      if (isThinking) {
        return (
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1.5">
              <div className="thinking-dot dot-blue w-2 h-2 rounded-full"></div>
              <div className="thinking-dot dot-teal w-2 h-2 rounded-full"></div>
              <div className="thinking-dot dot-indigo w-2 h-2 rounded-full"></div>
            </div>
            <span className="text-blue-600 text-sm font-medium animate-pulse">Thinking...</span>
          </div>
        );
      }
      return <div className="text-gray-500 italic text-sm">Empty message</div>;
    }

    // 📏 Performance optimization for very long content
    const isLongContent = content.length > 10000;
    
    return (
      <Markdown
        options={{
          // Basic markdown configuration for safety and styling
          forceBlock: false, // Allow inline elements
          wrapper: 'div',    // Wrap in div instead of default React.Fragment
          overrides: {
            // Custom styling for markdown elements
            p: { 
              props: { 
                className: 'mb-3 last:mb-0 leading-relaxed text-gray-800 text-sm md:text-base' // Enhanced paragraph spacing and typography
              } 
            },
            div: { 
              props: { 
                className: 'space-y-1' // Add consistent spacing for content divisions
              } 
            },
            strong: { 
              props: { 
                className: 'font-bold' // Bold text styling
              } 
            },
            em: { 
              props: { 
                className: 'italic' // Italic text styling
              } 
            },
            ul: { 
              props: { 
                className: 'list-disc list-inside mb-4 space-y-2 pl-4 marker:text-blue-500' // Enhanced bulleted lists with blue bullets
              } 
            },
            ol: { 
              props: { 
                className: 'list-decimal list-inside mb-4 space-y-2 pl-4 marker:text-blue-500 marker:font-semibold' // Enhanced numbered lists with blue numbers
              } 
            },
            li: { 
              props: { 
                className: 'leading-relaxed text-gray-700 pl-2' // Better line spacing and color for list items
              } 
            },
            h1: { 
              props: { 
                className: 'text-xl md:text-2xl font-bold mb-4 mt-6 first:mt-0 text-blue-800 leading-tight border-b border-blue-200 pb-2' // Large headers with underline
              } 
            },
            h2: { 
              props: { 
                className: 'text-lg md:text-xl font-bold mb-3 mt-5 first:mt-0 text-blue-700 leading-tight' // Medium headers
              } 
            },
            h3: { 
              props: { 
                className: 'text-base md:text-lg font-semibold mb-2 mt-4 first:mt-0 text-blue-600 leading-tight' // Small headers
              } 
            },
            h4: { 
              props: { 
                className: 'text-sm md:text-base font-semibold mb-2 mt-3 first:mt-0 text-blue-600 leading-tight' // Extra small headers
              } 
            },
            h5: { 
              props: { 
                className: 'text-xs md:text-sm font-medium mb-1 mt-2 first:mt-0 text-blue-500 leading-tight uppercase tracking-wide' // Tiny headers
              } 
            },
            h6: { 
              props: { 
                className: 'text-xs font-medium mb-1 mt-2 first:mt-0 text-blue-500 leading-tight uppercase tracking-wider opacity-75' // Smallest headers
              } 
            },
            blockquote: { 
              props: { 
                className: 'border-l-4 border-blue-300 pl-4 py-2 mb-3 bg-blue-50/30 rounded-r italic text-blue-800' // Styled blockquotes
              } 
            },
            code: { 
              props: { 
                className: 'bg-blue-50/80 text-blue-800 px-1.5 py-0.5 rounded text-xs font-mono border border-blue-200/50' // Inline code with blue theme
              } 
            },
            a: { 
              props: { 
                className: 'text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500 transition-colors duration-200 font-medium',
                target: '_blank', // Open links in new tab for security
                rel: 'noopener noreferrer' // Security attributes for external links
              } 
            },
            hr: { 
              props: { 
                className: 'my-6 border-0 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent' // Styled horizontal rule
              } 
            },
            table: { 
              component: ({ children, ...props }) => (
                <div className="mb-4 overflow-x-auto rounded-lg bg-white/50 backdrop-blur-sm shadow-sm border border-blue-200/30">
                  <table className="w-full min-w-full border-collapse" {...props}>
                    {children}
                  </table>
                </div>
              )
            },
            thead: { 
              props: { 
                className: 'bg-blue-100/80' // Table header background
              } 
            },
            th: { 
              props: { 
                className: 'px-3 py-2 text-left text-xs md:text-sm font-semibold text-blue-800 border-b border-blue-200/50' // Table header cells
              } 
            },
            td: { 
              props: { 
                className: 'px-3 py-2 text-xs md:text-sm text-gray-700 border-b border-blue-100/30' // Table data cells
              } 
            },
            tbody: { 
              props: { 
                className: 'divide-y divide-blue-100/30' // Table body row separation
              } 
            },
            pre: {
              component: ({ children, className, ...props }) => {
                // 🎯 Check if this is a code block (has children with code element)
                // markdown-to-jsx wraps code blocks like: <pre><code className="language-js">...</code></pre>
                const child = React.Children.only(children);
                if (React.isValidElement(child) && child.type === 'code') {
                  // 🚀 Use our enhanced CodeBlock component for syntax highlighting
                  const childProps = child.props as { className?: string; children?: string };
                  return (
                    <CodeBlock className={childProps.className}>
                      {childProps.children || ''}
                    </CodeBlock>
                  );
                }
                // 🔄 Fallback to regular pre tag for edge cases
                return (
                  <pre 
                    className="bg-blue-50/90 backdrop-blur-sm text-blue-900 p-3 rounded-lg mb-2 overflow-x-auto text-xs font-mono border border-blue-200/50 shadow-sm"
                    {...props}
                  >
                    {children}
                  </pre>
                );
              }
            }
          }
        }}
      >
        {isLongContent ? `${content.substring(0, 10000)}...\n\n*[Content truncated for performance]*` : content}
      </Markdown>
    );
  } catch (error) {
    console.error('Markdown rendering error:', error);
    // 🚨 Fallback for malformed markdown
    return (
      <div className={`${isSystem ? 'text-center' : ''}`}>
        <div className="text-gray-600 whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
        <div className="text-xs text-gray-400 italic mt-2">
          Note: Markdown formatting unavailable
        </div>
      </div>
    );
  }
});

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, isLast }) => {
  // Determine if this is a user or AI message
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  // Check if this is a thinking state (empty AI message)
  const isThinking = !isUser && !isSystem && (!message.content || message.content.trim() === '');
  
  // 📁 NEW: Check if message has file attachments
  const hasAttachments = messageHasFiles(message);
  const fileCount = getMessageFileCount(message);
  
  return (
    <div 
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isLast ? 'mb-3 md:mb-4' : 'mb-4 md:mb-6'}`}
    >
      <div 
      className={`
      max-w-[90%] md:max-w-[85%] px-3 md:px-4 py-2.5 md:py-3 rounded-2xl break-words text-sm md:text-base
      ${isUser 
      ? 'bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-br-md shadow-lg' 
      : isSystem
      ? 'bg-white/20 backdrop-blur-sm text-blue-100 italic text-xs md:text-sm border-l-4 border-blue-300'
      : 'bg-white/90 backdrop-blur-sm text-gray-800 rounded-bl-md shadow-lg border border-white/30'
      }
      ${isUser ? 'ml-8 md:ml-12' : 'mr-8 md:mr-12'}
      `}
        style={{
            // 🛡️ ENHANCED: Force consistent text styling to prevent paste-related style conflicts
            color: isUser ? '#ffffff !important' : isSystem ? '#dbeafe !important' : '#1f2937 !important',
            fontFamily: 'inherit !important',
            lineHeight: 'inherit !important'
          }}
        data-message-role={message.role}
        >
        {/* 🤖 Assistant context indicator (only for AI messages) */}
        {!isUser && !isSystem && (
          <div className="mb-1.5">
            {message.assistantName ? (
              <AssistantBadge 
                assistantName={message.assistantName}
                isIntroduction={message.assistantIntroduction}
              />
            ) : (
              <div className="text-xs text-gray-500 font-medium">
                <span className="hidden sm:inline">AI Assistant</span>
                <span className="sm:hidden">AI</span>
              </div>
            )}
          </div>
        )}
        
        {/* 📁 NEW: File attachments display (for user messages with files) */}
        {isUser && hasAttachments && message.attachments && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-xs text-white/80 mb-2">
              <span>📎</span>
              <span>{fileCount} file{fileCount !== 1 ? 's' : ''} attached:</span>
            </div>
            <div className="space-y-2">
              {message.attachments.map((attachment, index) => (
                <div
                  key={attachment.id || index}
                  className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20"
                >
                  {/* File icon */}
                  <div className="flex-shrink-0 text-lg">
                    {getFileIcon(attachment.fileUpload.file)}
                  </div>
                  
                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">
                      {attachment.displayName || attachment.fileUpload.file.name}
                    </p>
                    <p className="text-white/70 text-xs">
                      {formatFileSize(attachment.fileUpload.file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 📝 Message content - now with enhanced markdown support! */}
        <div className={`${isSystem ? 'text-center' : ''}`}>
          <MarkdownContent content={message.content} isSystem={isSystem} isThinking={isThinking} />
        </div>
        
        {/* 👤 Optional sender name */}
        {message.name && (
          <div className="text-xs opacity-75 mt-1">
            {message.name}
          </div>
        )}
      </div>
    </div>
  );
});

// 💭 Enhanced Typing indicator component (shows when AI is thinking)
const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-4 md:mb-6">
      <div className="max-w-[90%] md:max-w-[85%] mr-8 md:mr-12">
        <div className="thinking-bubble relative bg-white/90 backdrop-blur-sm text-gray-800 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl rounded-bl-md shadow-lg border border-white/30">
          <div className="text-xs text-gray-500 mb-1 font-medium">
            <span className="hidden sm:inline">AI Assistant</span>
            <span className="sm:hidden">AI</span>
          </div>
          <div className="flex items-center space-x-3 relative z-10">
            {/* 🎆 Enhanced breathing animation with custom gradient dots */}
            <div className="flex space-x-1.5">
              <div className="thinking-dot-wave dot-blue w-2.5 h-2.5 rounded-full"></div>
              <div className="thinking-dot-wave dot-teal w-2.5 h-2.5 rounded-full"></div>
              <div className="thinking-dot-wave dot-indigo w-2.5 h-2.5 rounded-full"></div>
            </div>
            <span className="text-blue-600 text-sm font-medium">
              <span className="hidden sm:inline">Thinking...</span>
              <span className="sm:hidden">...</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 📜 Main MessageList component with Smart Auto-Scroll - FIXED VERSION
export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  className = '',
  isStreaming = false 
}) => {
  // 🎯 Smart Auto-Scroll Hook - Intelligently manages scrolling behavior
  const {
    scrollContainerRef,
    bottomAnchorRef,
    scrollState,
    scrollToBottom,
    setAutoScrollEnabled,
    isNearBottom
  } = useAutoScroll({
    nearBottomThreshold: 100,    // Consider "near bottom" if within 100px (more responsive)
    scrollDebounceMs: 100,       // Debounce scroll events every 100ms
    userScrollTimeoutMs: 2000,   // Resume auto-scroll 2 seconds after user stops (faster resume)
    behavior: 'smooth'           // Smooth scrolling
  });
  
  // 🔧 FIXED: Consolidated Smart Auto-Scroll Effect
  // Handles both new messages and streaming content without conflicts
  useEffect(() => {
    const shouldScroll = (
      // Auto-scroll is enabled by hook logic AND user isn't actively scrolling
      (scrollState.shouldAutoScroll && !scrollState.isUserScrolling) ||
      // OR we're streaming and user hasn't scrolled away and we're near bottom
      (isStreaming && !scrollState.isUserScrolling && isNearBottom)
    );
    
    if (shouldScroll) {
      // Small delay to ensure DOM updates are complete and prevent conflicts
      const scrollTimer = setTimeout(() => {
        scrollToBottom();
      }, 50);
      
      return () => clearTimeout(scrollTimer);
    }
  }, [
    // React to message count changes (new messages)
    messages.length,
    // React to loading state changes (typing indicator)
    isLoading,
    // React to streaming state
    isStreaming,
    // React to auto-scroll state from hook
    scrollState.shouldAutoScroll,
    scrollState.isUserScrolling,
    // React to bottom position
    isNearBottom,
    // Scroll function
    scrollToBottom
  ]);
  
  return (
    <div 
      ref={scrollContainerRef}
      className={`flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-4 ${className}`}
    >
      {/* 📝 Display all messages */}
      {messages.length === 0 ? (
        // 🌟 Welcome message when no conversation yet
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-xs md:max-w-md bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/20 mx-3">
            <h3 className="text-base md:text-lg font-medium text-white mb-2">
              Welcome to AI Dock! 👋
            </h3>
            <p className="text-xs md:text-sm text-blue-100 leading-relaxed">
              <span className="hidden md:inline">
                Start a conversation with your AI assistant. 
                Choose an LLM provider and ask anything you'd like to know.
              </span>
              <span className="md:hidden">
                Choose an AI provider above and start chatting!
              </span>
            </p>
          </div>
        </div>
      ) : (
        // 💬 Render all messages in conversation with assistant context
        messages.map((message, index) => {
          const elements = [];
          
          // 🤖 Show assistant divider if assistant changed
          if (message.assistantChanged && message.assistantName) {
            elements.push(
              <AssistantDivider
                key={`divider-${index}`}
                previousAssistantName={message.previousAssistantName}
                newAssistantName={message.assistantName}
              />
            );
          }
          
          // 💬 Add the actual message bubble
          elements.push(
            <MessageBubble 
              key={`message-${index}`}
              message={message} 
              isLast={index === messages.length - 1 && !isLoading}
            />
          );
          
          return elements;
        }).flat() // Flatten array since we're returning arrays of elements
      )}
      
      {/* 💭 Show typing indicator when AI is responding BUT NOT streaming */}
      {/* Only show thinking bubble when loading but not streaming (avoids duplicate bubbles) */}
      {isLoading && !isStreaming && <TypingIndicator />}
      
      {/* 🎯 Smart scroll anchor - used by auto-scroll hook */}
      <div ref={bottomAnchorRef} />
      
    </div>
  );
};

// 🔧 FIXES APPLIED:
//
// 1. **Consolidated useEffect**: Removed conflicting auto-scroll effects
// 2. **Better user detection**: Enhanced scroll detection logic in useAutoScroll hook
// 3. **Improved timing**: Reduced thresholds for more responsive behavior
// 4. **Debug enhancement**: Better debug panel with more information
// 5. **Conflict prevention**: Added delays and proper cleanup to prevent race conditions
//
// Key Changes:
// - Single useEffect for auto-scroll management
// - More restrictive user scroll detection
// - Faster timeout for resuming auto-scroll (2s vs 3s)
// - Smaller near-bottom threshold (100px vs 150px)
// - Enhanced debug information
//
// How to Test:
// 1. Start a conversation
// 2. Scroll up while AI is responding - should pause auto-scroll
// 3. Scroll back to bottom - should resume auto-scroll
// 4. Enable streaming mode for real-time testing
// 5. Check debug panel in development mode
//
// Usage Example:
// ```
// <MessageList 
//   messages={conversationMessages}
//   isLoading={waitingForAI}
//   isStreaming={streamingEnabled}
// />
// ```
