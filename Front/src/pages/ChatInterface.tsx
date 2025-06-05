// 💬 Chat Interface Page
// Main chat page that brings together all chat components
// Manages conversation state, LLM selection, and backend integration

import React, { useState, useEffect } from 'react';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { chatService } from '../services/chatService';
import { useAuth } from '../hooks/useAuth';
import { 
  ChatMessage, 
  LLMConfigurationSummary, 
  ChatServiceError 
} from '../types/chat';
import { Settings, Zap, AlertCircle, CheckCircle, Loader2, Bug } from 'lucide-react';
import { AuthDebugger } from '../utils/debugAuth';

export const ChatInterface: React.FC = () => {
  // 🔐 Authentication state
  const { user } = useAuth();
  
  // 💬 Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 🎛️ LLM configuration state
  const [availableConfigs, setAvailableConfigs] = useState<LLMConfigurationSummary[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [configsLoading, setConfigsLoading] = useState(true);
  
  // 🚨 Error handling state
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // 🚀 Load available LLM configurations when component mounts
  useEffect(() => {
    loadAvailableConfigurations();
  }, []);
  
  // 📋 Fetch available LLM providers from backend
  const loadAvailableConfigurations = async () => {
    try {
      setConfigsLoading(true);
      setError(null);
      setConnectionStatus('checking');
      
      console.log('🔄 Loading available LLM configurations...');
      
      const configs = await chatService.getAvailableConfigurations();
      
      if (configs.length === 0) {
        setError('No LLM configurations available. Please contact your administrator.');
        setConnectionStatus('error');
        return;
      }
      
      setAvailableConfigs(configs);
      setConnectionStatus('connected');
      
      // 🎯 Auto-select the first available configuration
      const defaultConfig = configs.find(c => c.is_active) || configs[0];
      setSelectedConfigId(defaultConfig.id);
      
      console.log('✅ Configurations loaded successfully:', configs.length);
      
    } catch (error) {
      console.error('❌ Failed to load configurations:', error);
      
      if (error instanceof ChatServiceError) {
        setError(`Failed to load LLM configurations: ${error.message}`);
      } else {
        setError('Unable to connect to chat service. Please try again later.');
      }
      setConnectionStatus('error');
    } finally {
      setConfigsLoading(false);
    }
  };
  
  // 📤 Handle sending a new message
  const handleSendMessage = async (content: string) => {
    if (!selectedConfigId) {
      setError('Please select an LLM provider first.');
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);
      
      // 👤 Add user message to conversation immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: content
      };
      
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      
      console.log('📤 Sending message to LLM:', { 
        config_id: selectedConfigId, 
        content: content.substring(0, 50) + '...' 
      });
      
      // 🤖 Send to LLM service
      const response = await chatService.sendMessage({
        config_id: selectedConfigId,
        messages: updatedMessages
      });
      
      // 🤖 Add AI response to conversation
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response.content
      };
      
      setMessages([...updatedMessages, aiMessage]);
      
      console.log('✅ Received AI response:', { 
        provider: response.provider,
        model: response.model,
        tokens: response.usage.total_tokens
      });
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      let errorMessage = 'Failed to send message. Please try again.';
      
      if (error instanceof ChatServiceError) {
        switch (error.errorType) {
          case 'QUOTA_EXCEEDED':
            errorMessage = 'Usage quota exceeded. Please contact your administrator.';
            break;
          case 'PROVIDER_ERROR':
            errorMessage = 'AI provider is currently unavailable. Please try a different provider.';
            break;
          case 'UNAUTHORIZED':
            errorMessage = 'Your session has expired. Please log in again.';
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 🔄 Handle LLM provider selection change
  const handleConfigChange = (configId: number) => {
    setSelectedConfigId(configId);
    setError(null);
    console.log('🎯 Switched to configuration:', configId);
  };
  
  // 🆕 Start a new conversation
  const handleNewConversation = () => {
    setMessages([]);
    setError(null);
    console.log('🆕 Started new conversation');
  };
  
  // 🎨 Get selected configuration details
  const selectedConfig = availableConfigs.find(c => c.id === selectedConfigId);
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 🎛️ Header with LLM selection and controls */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              AI Chat
            </h1>
            
            {/* 📊 Connection status indicator */}
            <div className="flex items-center space-x-2">
              {connectionStatus === 'checking' && (
                <div className="flex items-center text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Connecting...
                </div>
              )}
              {connectionStatus === 'connected' && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Connected
                </div>
              )}
              {connectionStatus === 'error' && (
                <div className="flex items-center text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Connection Error
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* 🎯 LLM Provider Selection */}
            {!configsLoading && availableConfigs.length > 0 && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  AI Provider:
                </label>
                <select
                  value={selectedConfigId || ''}
                  onChange={(e) => handleConfigChange(Number(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name} ({config.provider_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* 🆕 New conversation button */}
            <button
              onClick={handleNewConversation}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              title="Start new conversation"
            >
              New Chat
            </button>
            
            {/* 🔍 Debug button - temporary for troubleshooting */}
            <button
              onClick={() => AuthDebugger.runFullDebug()}
              className="px-3 py-1 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-md transition-colors flex items-center"
              title="Debug authentication (check console)"
            >
              <Bug className="w-3 h-3 mr-1" />
              Debug Auth
            </button>
          </div>
        </div>
        
        {/* 💡 Current provider info */}
        {selectedConfig && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="inline-flex items-center">
              <Zap className="w-4 h-4 mr-1" />
              Using <strong className="mx-1">{selectedConfig.name}</strong> 
              with model <strong>{selectedConfig.default_model}</strong>
              {selectedConfig.estimated_cost_per_request && (
                <span className="ml-2 text-gray-500">
                  (~${selectedConfig.estimated_cost_per_request.toFixed(4)} per request)
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      
      {/* 🚨 Error display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-red-700 text-sm">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* 📋 Loading state for configurations */}
      {configsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-gray-600">Loading AI providers...</span>
        </div>
      )}
      
      {/* 💬 Main chat area */}
      {!configsLoading && availableConfigs.length > 0 && (
        <>
          {/* 📜 Message list */}
          <MessageList 
            messages={messages}
            isLoading={isLoading}
            className="flex-1"
          />
          
          {/* ✍️ Message input */}
          <MessageInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            disabled={!selectedConfigId || connectionStatus === 'error'}
            placeholder={
              selectedConfigId 
                ? "Type your message here..." 
                : "Select an AI provider to start chatting..."
            }
          />
        </>
      )}
      
      {/* 🚫 No configurations available */}
      {!configsLoading && availableConfigs.length === 0 && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center max-w-md">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              No AI Providers Available
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              No LLM configurations are currently available for your account. 
              Please contact your administrator to set up AI providers.
            </p>
            <button
              onClick={loadAvailableConfigurations}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 🎯 How this chat interface works:
//
// 1. **Configuration Management**: 
//    - Loads available LLM providers on mount
//    - Auto-selects first available provider
//    - Allows switching between providers
//
// 2. **Conversation Management**:
//    - Maintains message history in local state
//    - Immediately shows user messages
//    - Adds AI responses when received
//
// 3. **Error Handling**:
//    - Graceful handling of network errors
//    - User-friendly error messages
//    - Different error types (quota, provider, auth)
//
// 4. **Loading States**:
//    - Configuration loading spinner
//    - Message sending indicators
//    - Connection status display
//
// 5. **User Experience**:
//    - Provider selection in header
//    - New conversation button
//    - Cost estimation display
//    - Responsive design
//
// This is the main page users will interact with for all their AI conversations!
