// 🧪 Streaming Test Component
// Simple test interface to verify streaming functionality before integrating with main chat

import React, { useState } from 'react';
import { useStreamingChat } from '../utils/streamingStateManager';
import { StreamingChatRequest, ChatResponse } from '../types/chat';

const StreamingTestPage: React.FC = () => {
  const [testMessage, setTestMessage] = useState('Hello, can you tell me a short story?');
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const {
    accumulatedContent,
    isStreaming,
    connectionState,
    error,
    streamMessage,
    stopStreaming,
    retryStreaming,
    hasError,
    canRetry,
    chunksReceived,
    streamingDuration
  } = useStreamingChat();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]); // Keep last 20 logs
  };

  const handleStartStream = async () => {
    addLog('Starting streaming test...');
    
    const request: StreamingChatRequest = {
      config_id: 1, // Use first available configuration
      messages: [
        { role: 'user', content: testMessage }
      ]
    };

    const success = await streamMessage(request, (finalResponse) => {
      addLog(`Streaming completed! Total content: ${finalResponse.content.length} chars`);
      setLastResponse(finalResponse);
    });

    if (success) {
      addLog('Streaming started successfully');
    } else {
      addLog('Failed to start streaming');
    }
  };

  const handleStopStream = () => {
    addLog('Manually stopping stream');
    stopStreaming();
  };

  const handleRetry = async () => {
    if (lastResponse) {
      addLog('Retrying last request...');
      const request: StreamingChatRequest = {
        config_id: 1,
        messages: [{ role: 'user', content: testMessage }]
      };
      
      await retryStreaming(request, (finalResponse) => {
        addLog(`Retry completed! Content: ${finalResponse.content.length} chars`);
        setLastResponse(finalResponse);
      });
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setLastResponse(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-teal-600 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🧪 Streaming Test Laboratory
          </h1>
          <p className="text-gray-600">
            Test the streaming functionality before integration with main chat interface
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Control Panel */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">🎛️ Control Panel</h2>
            
            {/* Test Message Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Message:
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Enter your test message..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={handleStartStream}
                disabled={isStreaming}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isStreaming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Streaming...
                  </>
                ) : (
                  <>
                    ▶️ Start Stream
                  </>
                )}
              </button>

              <button
                onClick={handleStopStream}
                disabled={!isStreaming}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                ⏹️ Stop
              </button>

              {hasError && canRetry && (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  🔄 Retry
                </button>
              )}

              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                🧹 Clear
              </button>
            </div>

            {/* Status Display */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Connection:</span>
                <span className={`text-sm font-medium ${
                  connectionState === 'connected' ? 'text-green-600' :
                  connectionState === 'connecting' ? 'text-yellow-600' :
                  connectionState === 'error' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {connectionState.toUpperCase()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Chunks Received:</span>
                <span className="text-sm font-medium text-blue-600">{chunksReceived}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Duration:</span>
                <span className="text-sm font-medium text-blue-600">{streamingDuration}ms</span>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm font-medium text-red-800">Error: {error.type}</div>
                  <div className="text-sm text-red-600">{error.message}</div>
                  <div className="text-xs text-red-500 mt-1">
                    Fallback: {error.shouldFallback ? 'Yes' : 'No'} | 
                    Retryable: {error.retryable ? 'Yes' : 'No'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Content Display */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">💬 Streaming Content</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto">
              {accumulatedContent ? (
                <div className="whitespace-pre-wrap text-gray-800">
                  {accumulatedContent}
                  {isStreaming && (
                    <span className="animate-pulse text-blue-600">█</span>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 italic">
                  {isStreaming ? 'Waiting for streaming chunks...' : 'No content yet. Start a stream to see real-time content.'}
                </div>
              )}
            </div>

            {lastResponse && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800">Final Response Metadata:</div>
                <div className="text-xs text-blue-600 mt-1">
                  Model: {lastResponse.model} | 
                  Provider: {lastResponse.provider} | 
                  Tokens: {lastResponse.usage.total_tokens}
                  {lastResponse.cost && ` | Cost: $${lastResponse.cost.toFixed(4)}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity Logs */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Activity Logs</h2>
          
          <div className="bg-gray-900 rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
            {logs.length > 0 ? (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-green-400 text-sm font-mono">
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 italic text-sm">
                No activity logs yet. Start streaming to see detailed logs.
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📖 Test Instructions</h2>
          
          <div className="space-y-3 text-gray-600">
            <div className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">1.</span>
              <span>Enter a test message in the input field (default is a good starting point)</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">2.</span>
              <span>Click "Start Stream" to initiate streaming - watch the content appear in real-time</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">3.</span>
              <span>Monitor the connection status, chunk count, and streaming duration</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">4.</span>
              <span>Check activity logs for detailed streaming events and debugging info</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 font-bold">5.</span>
              <span>Test error scenarios by stopping the stream or testing with invalid configurations</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <strong>Note:</strong> This test page bypasses the main chat interface to isolate streaming functionality testing. 
              Once verified, we'll integrate these features into the main ChatInterface.tsx.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamingTestPage;

// 🎓 Usage Instructions:
//
// This test component allows you to:
// 1. Test streaming functionality in isolation
// 2. Monitor real-time streaming state and metrics
// 3. Verify error handling and fallback mechanisms
// 4. Debug streaming issues before main integration
// 5. Validate browser compatibility and performance
//
// To use this test page:
// 1. Add route in App.tsx: <Route path="/streaming-test" element={<StreamingTestPage />} />
// 2. Navigate to /streaming-test in your browser
// 3. Test various scenarios and configurations
// 4. Check console logs for additional debugging info
//
// The component demonstrates:
// - useStreamingChat hook usage patterns
// - Real-time content accumulation
// - Streaming state management
// - Error handling and recovery
// - Performance monitoring
// - User experience patterns
