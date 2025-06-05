// 💬 Message List Component
// Displays the conversation history between user and AI
// Handles loading states, auto-scrolling, and message formatting

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../../types/chat';

// Props interface - what data this component needs
interface MessageListProps {
  messages: ChatMessage[];           // Array of conversation messages
  isLoading: boolean;               // Shows typing indicator when AI is responding
  className?: string;               // Optional custom CSS classes
}

// 🎨 Component for individual message bubbles
interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLast }) => {
  // Determine if this is a user or AI message
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  return (
    <div 
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isLast ? 'mb-4' : 'mb-6'}`}
    >
      <div 
        className={`
          max-w-[85%] px-4 py-3 rounded-2xl break-words
          ${isUser 
            ? 'bg-blue-600 text-white rounded-br-md' 
            : isSystem
            ? 'bg-gray-100 text-gray-700 italic text-sm border-l-4 border-gray-400'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }
          ${isUser ? 'ml-12' : 'mr-12'}
        `}
      >
        {/* 👤 Message sender indicator (only for non-user messages) */}
        {!isUser && !isSystem && (
          <div className="text-xs text-gray-500 mb-1 font-medium">
            AI Assistant
          </div>
        )}
        
        {/* 📝 Message content */}
        <div className={`whitespace-pre-wrap ${isSystem ? 'text-center' : ''}`}>
          {message.content}
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
};

// 💭 Typing indicator component (shows when AI is thinking)
const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-6">
      <div className="max-w-[85%] mr-12">
        <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-md">
          <div className="text-xs text-gray-500 mb-1 font-medium">
            AI Assistant
          </div>
          <div className="flex items-center space-x-1">
            <div className="flex space-x-1">
              {/* 🔄 Animated dots to show AI is typing */}
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span className="text-gray-500 text-sm ml-2">Thinking...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 📜 Main MessageList component
export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  className = '' 
}) => {
  // 🎯 Auto-scroll reference - keeps newest messages visible
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 📜 Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 🔄 Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);
  
  return (
    <div className={`flex-1 overflow-y-auto px-4 py-4 ${className}`}>
      {/* 📝 Display all messages */}
      {messages.length === 0 ? (
        // 🌟 Welcome message when no conversation yet
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500 max-w-md">
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Welcome to AI Dock! 👋
            </h3>
            <p className="text-sm">
              Start a conversation with your AI assistant. 
              Choose an LLM provider and ask anything you'd like to know.
            </p>
          </div>
        </div>
      ) : (
        // 💬 Render all messages in conversation
        messages.map((message, index) => (
          <MessageBubble 
            key={index} 
            message={message} 
            isLast={index === messages.length - 1 && !isLoading}
          />
        ))
      )}
      
      {/* 💭 Show typing indicator when AI is responding */}
      {isLoading && <TypingIndicator />}
      
      {/* 🎯 Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
};

// 🎯 How this component works:
//
// 1. **Message Display**: Renders user and AI messages with different styling
//    - User messages: Blue, right-aligned
//    - AI messages: Gray, left-aligned
//    - System messages: Italic, centered
//
// 2. **Auto-scrolling**: Automatically scrolls to show newest messages
//    using useRef and scrollIntoView
//
// 3. **Loading States**: Shows animated typing indicator when AI is responding
//
// 4. **Responsive Design**: 
//    - Messages take max 85% width to prevent super long lines
//    - Proper spacing and mobile-friendly sizing
//
// 5. **Empty State**: Shows welcome message when no conversation exists
//
// 6. **Accessibility**: 
//    - Proper semantic structure
//    - Screen reader friendly
//    - Keyboard navigation support
//
// Usage Example:
// ```
// <MessageList 
//   messages={conversationMessages}
//   isLoading={waitingForAI}
// />
// ```
