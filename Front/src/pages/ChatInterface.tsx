// 💬 Chat Interface Page
// Main chat page that brings together all chat components
// Manages conversation state, LLM selection, and backend integration

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { chatService } from '../services/chatService';
import { useAuth } from '../hooks/useAuth';
import { 
  ChatMessage, 
  LLMConfigurationSummary, 
  ChatServiceError 
} from '../types/chat';
import { Settings, Zap, AlertCircle, CheckCircle, Loader2, Bug, Home } from 'lucide-react';
import { AuthDebugger } from '../utils/debugAuth';

export const ChatInterface: React.FC = () => {
  // 🧭 Navigation hook for routing
  const navigate = useNavigate();
  
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
  
  // 🏠 Navigate back to dashboard
  const handleBackToDashboard = () => {
    console.log('🏠 Navigating back to dashboard');
    navigate('/');
  };
  
  // 🎨 Get selected configuration details
  const selectedConfig = availableConfigs.find(c => c.id === selectedConfigId);
  
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600">
      {/* 🎛️ Header with LLM selection and controls - Glassmorphism */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20 px-3 md:px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 md:space-x-4">
            <h1 className="text-lg md:text-xl font-semibold text-white">
              AI Chat
            </h1>
            
            {/* 📊 Connection status indicator */}
            <div className="flex items-center space-x-2">
              {connectionStatus === 'checking' && (
                <div className="flex items-center text-blue-200 text-xs md:text-sm">
                  <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin mr-1" />
                  <span className="hidden sm:inline">Connecting...</span>
                  <span className="sm:hidden">...</span>
                </div>
              )}
              {connectionStatus === 'connected' && (
                <div className="flex items-center text-green-300 text-xs md:text-sm">
                  <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                  <span className="hidden sm:inline">Connected</span>
                  <span className="sm:hidden">✓</span>
                </div>
              )}
              {connectionStatus === 'error' && (
                <div className="flex items-center text-red-300 text-xs md:text-sm">
                  <AlertCircle className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                  <span className="hidden sm:inline">Connection Error</span>
                  <span className="sm:hidden">Error</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* 🎯 LLM Provider Selection */}
            {!configsLoading && availableConfigs.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                <label className="text-xs md:text-sm font-medium text-white whitespace-nowrap">
                  <span className="hidden sm:inline">AI Provider:</span>
                  <span className="sm:hidden">Provider:</span>
                </label>
                <select
                  value={selectedConfigId || ''}
                  onChange={(e) => handleConfigChange(Number(e.target.value))}
                  className="px-2 md:px-3 py-1.5 md:py-1 bg-white/90 backdrop-blur-sm border border-white/30 rounded-md text-xs md:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white min-w-0 max-w-[200px] md:max-w-none"
                >
                  {availableConfigs.map((config) => (
                    <option key={config.id} value={config.id} className="text-gray-700 bg-white">
                      {config.name} ({config.provider_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* 🏠 Back to Dashboard button */}
            <button
              onClick={handleBackToDashboard}
              className="px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm bg-white/20 hover:bg-white/30 text-white rounded-md transition-all duration-200 flex items-center backdrop-blur-sm touch-manipulation"
              title="Back to Dashboard"
            >
              <Home className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
              <span className="hidden md:inline ml-1">Dashboard</span>
            </button>
            
            {/* 🆕 New conversation button */}
            <button
              onClick={handleNewConversation}
              className="px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm bg-white/20 hover:bg-white/30 text-white rounded-md transition-all duration-200 backdrop-blur-sm touch-manipulation whitespace-nowrap"
              title="Start new conversation"
            >
              <span className="md:hidden">New</span>
              <span className="hidden md:inline">New Chat</span>
            </button>
            
            {/* 🔍 Debug button - temporary for troubleshooting */}
            <button
              onClick={() => AuthDebugger.runFullDebug()}
              className="px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 rounded-md transition-all duration-200 flex items-center backdrop-blur-sm touch-manipulation"
              title="Debug authentication (check console)"
            >
              <Bug className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
              <span className="hidden md:inline ml-1">Debug Auth</span>
            </button>
          </div>
        </div>
        
        {/* 💡 Current provider info */}
        {selectedConfig && (
          <div className="mt-2 text-xs md:text-sm text-blue-100">
            <div className="flex flex-wrap items-center gap-1 md:gap-2">
              <div className="flex items-center">
                <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1 text-yellow-300 flex-shrink-0" />
                <span className="whitespace-nowrap">Using <strong className="text-white">{selectedConfig.name}</strong></span>
              </div>
              <div className="flex items-center">
                <span className="whitespace-nowrap">with model <strong className="text-white">{selectedConfig.default_model}</strong></span>
              </div>
              {selectedConfig.estimated_cost_per_request && (
                <span className="text-blue-200 text-xs whitespace-nowrap">
                  (~${selectedConfig.estimated_cost_per_request.toFixed(4)}/req)
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 🚨 Error display with glassmorphism */}
      {error && (
        <div className="bg-red-500/20 backdrop-blur-sm border-l-4 border-red-300 p-3 md:p-4 mx-3 md:mx-4 mt-4 rounded-lg">
          <div className="flex items-start md:items-center gap-2">
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-200 flex-shrink-0 mt-0.5 md:mt-0" />
            <p className="text-red-100 text-xs md:text-sm flex-1 leading-relaxed">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-200 hover:text-red-100 text-lg md:text-xl font-bold flex-shrink-0 touch-manipulation p-1"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* 📋 Loading state for configurations */}
      {configsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-white" />
          <span className="text-white">Loading AI providers...</span>
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
          <div className="text-center max-w-md bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <Settings className="w-12 h-12 text-white/60 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              No AI Providers Available
            </h3>
            <p className="text-blue-100 text-sm mb-4">
              No LLM configurations are currently available for your account. 
              Please contact your administrator to set up AI providers.
            </p>
            <button
              onClick={loadAvailableConfigurations}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-md transition-all duration-200 shadow-lg hover:shadow-xl"
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
