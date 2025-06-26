// 🌊 Streaming State Manager
// Utilities for managing streaming chat state in React components
// This provides hooks and utilities for real-time chat streaming

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  StreamingState, 
  StreamingChatChunk, 
  StreamingError, 
  StreamingConnection,
  ChatResponse,
  StreamingChatRequest
} from '../types/chat';
import { chatService } from '../services/chatService';

// 🎓 CUSTOM HOOK: useStreamingChat
// This hook manages all streaming state and provides easy-to-use methods for React components
export const useStreamingChat = () => {
  // 🎯 Core streaming state
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    connectionState: 'disconnected',
    accumulatedContent: '',
    receivedChunks: [],
  });

  // 🔗 Connection reference for cleanup
  const connectionRef = useRef<StreamingConnection | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // 🧹 CLEANUP: Close connection on unmount or error
  const cleanup = useCallback(() => {
    if (connectionRef.current) {
      console.log('🧹 Cleaning up streaming connection');
      connectionRef.current.close();
      connectionRef.current = null;
    }
    
    setStreamingState(prev => ({
      ...prev,
      isStreaming: false,
      connectionState: 'disconnected'
    }));
  }, []);

  // 🌊 STREAM MESSAGE: Main function to start streaming
  const streamMessage = useCallback(async (
    request: StreamingChatRequest,
    onComplete?: (response: ChatResponse) => void,
    enableFallback: boolean = true
  ): Promise<boolean> => {
    console.log('🌊 Starting stream message with hook');
    
    // Cleanup any existing connection
    cleanup();
    
    // Initialize streaming state
    startTimeRef.current = new Date();
    setStreamingState({
      isStreaming: true,
      connectionState: 'connecting',
      accumulatedContent: '',
      receivedChunks: [],
      startTime: startTimeRef.current,
    });

    try {
      // 📡 Chunk handler: Called for each streaming chunk
      const handleChunk = (chunk: StreamingChatChunk) => {
        console.log('📡 Handling chunk in React hook:', {
          chunkId: chunk.chunk_id,
          contentLength: chunk.content.length,
          isFinal: chunk.is_final
        });

        setStreamingState(prev => ({
          ...prev,
          connectionState: 'connected',
          accumulatedContent: prev.accumulatedContent + chunk.content,
          receivedChunks: [...prev.receivedChunks, chunk],
          lastChunkTime: new Date(),
        }));
      };

      // 🚨 Error handler: Called when streaming fails with enhanced cleanup
      const handleError = (error: StreamingError) => {
        console.error('🚨 Streaming error in React hook:', error);
        
        setStreamingState(prev => ({
          ...prev,
          connectionState: 'error',
          error,
          isStreaming: false, // 🔧 ENHANCED: Always stop streaming on error
        }));

        // 🧹 ENHANCED: Ensure connection cleanup on error
        if (connectionRef.current) {
          console.log('🧹 Cleaning up connection due to error:', error.type);
          connectionRef.current.close();
          connectionRef.current = null;
        }

        // Note: chatService will handle fallback automatically if enabled
      };

      // ✅ Complete handler: Called when streaming finishes
      const handleComplete = (finalResponse: ChatResponse) => {
        console.log('✅ Streaming complete in React hook');
        
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          connectionState: 'disconnected',
        }));
        
        // Clean up connection
        cleanup();
        
        // Call user's completion handler
        onComplete?.(finalResponse);
      };

      // 🚀 Start streaming with fallback support
      const result = await chatService.streamMessageWithFallback(
        request,
        handleChunk,
        handleError,
        handleComplete,
        enableFallback
      );

      // Store connection reference for cleanup
      if ('eventSource' in result) {
        connectionRef.current = result as StreamingConnection;
      }
      // If result is ChatResponse, it means fallback was used successfully

      return true;

    } catch (error) {
      console.error('❌ Failed to start streaming:', error);
      
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
        connectionState: 'error',
        error: {
          type: 'CONNECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to start streaming',
          shouldFallback: false,
          retryable: true
        }
      }));
      
      cleanup();
      return false;
    }
  }, [cleanup]);

  // 🛑 STOP STREAMING: Manual stop function
  const stopStreaming = useCallback(() => {
    console.log('🛑 Manually stopping streaming');
    cleanup();
  }, [cleanup]);

  // 🔄 RETRY STREAMING: Retry with same request
  const retryStreaming = useCallback(async (
    lastRequest: StreamingChatRequest,
    onComplete?: (response: ChatResponse) => void
  ): Promise<boolean> => {
    console.log('🔄 Retrying streaming');
    return streamMessage(lastRequest, onComplete);
  }, [streamMessage]);

  // 🧹 Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 🎯 Return state and methods for components to use
  return {
    // State
    streamingState,
    isStreaming: streamingState.isStreaming,
    connectionState: streamingState.connectionState,
    accumulatedContent: streamingState.accumulatedContent,
    receivedChunks: streamingState.receivedChunks,
    error: streamingState.error,
    
    // Actions
    streamMessage,
    stopStreaming,
    retryStreaming,
    
    // Computed properties
    hasError: !!streamingState.error,
    canRetry: streamingState.error?.retryable ?? false,
    shouldShowFallbackOption: streamingState.error?.shouldFallback ?? false,
    
    // Performance metrics
    streamingDuration: streamingState.startTime 
      ? (streamingState.lastChunkTime || new Date()).getTime() - streamingState.startTime.getTime()
      : 0,
    chunksReceived: streamingState.receivedChunks.length,
  };
};

// 🎛️ STREAMING STATE UTILITIES
// Helper functions for working with streaming state

export const createInitialStreamingState = (): StreamingState => ({
  isStreaming: false,
  connectionState: 'disconnected',
  accumulatedContent: '',
  receivedChunks: [],
});

export const isStreamingActive = (state: StreamingState): boolean => {
  return state.isStreaming && state.connectionState !== 'error';
};

export const getStreamingProgress = (state: StreamingState): {
  chunksReceived: number;
  totalContent: string;
  lastChunkTime?: Date;
  estimatedWPM?: number;
} => {
  const words = state.accumulatedContent.split(' ').filter(word => word.length > 0);
  
  let estimatedWPM;
  if (state.startTime && state.lastChunkTime && words.length > 0) {
    const timeElapsedMinutes = (state.lastChunkTime.getTime() - state.startTime.getTime()) / (1000 * 60);
    estimatedWPM = timeElapsedMinutes > 0 ? words.length / timeElapsedMinutes : 0;
  }
  
  return {
    chunksReceived: state.receivedChunks.length,
    totalContent: state.accumulatedContent,
    lastChunkTime: state.lastChunkTime,
    estimatedWPM
  };
};

// 🎨 UI HELPER: Format streaming content for display
export const formatStreamingContent = (
  content: string, 
  isStreaming: boolean,
  showTypingIndicator: boolean = true
): string => {
  if (!isStreaming || !showTypingIndicator) {
    return content;
  }
  
  // Add typing indicator (cursor) when actively streaming
  return content + '█';
};

// 🔍 DEBUG HELPERS: For development and troubleshooting

export const logStreamingDebugInfo = (state: StreamingState): void => {
  if (process.env.NODE_ENV === 'development') {
    const progress = getStreamingProgress(state);
    
    console.group('🔍 Streaming Debug Info');
    console.log('State:', state.connectionState);
    console.log('Is Streaming:', state.isStreaming);
    console.log('Chunks Received:', progress.chunksReceived);
    console.log('Content Length:', progress.totalContent.length);
    console.log('Estimated WPM:', progress.estimatedWPM?.toFixed(1) || 'N/A');
    console.log('Error:', state.error);
    console.groupEnd();
  }
};

export const validateStreamingChunk = (chunk: StreamingChatChunk): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (typeof chunk.content !== 'string') {
    errors.push('Invalid content type');
  }
  
  if (chunk.chunk_id !== undefined && typeof chunk.chunk_id !== 'number') {
    errors.push('Invalid chunk_id type');
  }
  
  if (chunk.is_final !== undefined && typeof chunk.is_final !== 'boolean') {
    errors.push('Invalid is_final type');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 🎯 Export all utilities for easy importing
export default {
  useStreamingChat,
  createInitialStreamingState,
  isStreamingActive,
  getStreamingProgress,
  formatStreamingContent,
  logStreamingDebugInfo,
  validateStreamingChunk
};

// 🎓 Usage Example for Components:
/*
import { useStreamingChat } from '../utils/streamingStateManager';

function ChatComponent() {
  const {
    streamingState,
    accumulatedContent,
    streamMessage,
    stopStreaming,
    hasError,
    canRetry
  } = useStreamingChat();

  const handleSendMessage = async () => {
    const request: StreamingChatRequest = {
      config_id: 1,
      messages: [{ role: 'user', content: 'Hello!' }]
    };

    const success = await streamMessage(request, (finalResponse) => {
      console.log('Chat complete:', finalResponse);
    });

    if (!success) {
      console.log('Streaming failed');
    }
  };

  return (
    <div>
      <div>{accumulatedContent}</div>
      {streamingState.isStreaming && <div>Typing...</div>}
      {hasError && canRetry && <button onClick={() => retryStreaming()}>Retry</button>}
    </div>
  );
}
*/
