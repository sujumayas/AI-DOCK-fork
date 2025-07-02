// 🌊 Streaming Chat Service
// Real-time streaming chat functionality with Server-Sent Events

import { 
  StreamingChatRequest,
  StreamingChatChunk,
  StreamingError,
  StreamingConnection,
  ChatResponse
} from '../../types/chat';
import { coreChatService } from './core';
import { createChatServiceError, logChatError } from './errors';

/**
 * Streaming Chat Service - handles real-time chat streaming
 * 🎓 Learning: EventSource API for Server-Sent Events (SSE)
 */
export class StreamingChatService {

  /**
   * Send message with real-time streaming response
   * 🌊 Main streaming function using EventSource for SSE
   */
  async streamMessage(
    request: StreamingChatRequest,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void
  ): Promise<StreamingConnection> {
    try {
      console.log('🌊 Starting streaming chat message:', { 
        config_id: request.config_id, 
        messageCount: request.messages.length,
        url: `${coreChatService.getApiBaseUrl()}/chat/stream`
      });

      // Generate unique request ID for tracking
      const requestId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create streaming connection
      const connection = await this.createStreamingConnection(
        request,
        requestId,
        onChunk,
        onError,
        onComplete
      );

      return connection;
      
    } catch (error) {
      logChatError('Streaming setup error', error);
      
      // Convert to structured streaming error
      const streamingError: StreamingError = {
        type: 'CONNECTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to start streaming',
        shouldFallback: true,  // Always allow fallback for connection errors
        retryable: false       // Setup errors are usually not retryable
      };
      
      onError(streamingError);
      
      // Return a dummy connection for cleanup
      return {
        eventSource: null,
        configId: request.config_id,
        requestId: 'failed',
        onChunk,
        onError,
        onComplete,
        close: () => {}
      };
    }
  }

  /**
   * Set up EventSource for SSE connection
   * 🔌 Creates and manages the streaming connection
   */
  private async createStreamingConnection(
    request: StreamingChatRequest,
    requestId: string,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void
  ): Promise<StreamingConnection> {
    
    // 🔑 Build streaming URL with all request data as query parameters
    const streamUrl = new URL(`${coreChatService.getApiBaseUrl()}/chat/stream`);
    
    // 🔐 Get auth token (EventSource can't send custom headers)
    const authHeaders = coreChatService.getAuthHeaders();
    const authToken = authHeaders['Authorization']?.replace('Bearer ', '');
    
    if (!authToken) {
      throw new Error('No authentication token available for streaming');
    }
    
    // 📝 Set all required query parameters
    streamUrl.searchParams.set('request_id', requestId);
    streamUrl.searchParams.set('config_id', request.config_id.toString());
    streamUrl.searchParams.set('messages', JSON.stringify(request.messages));
    streamUrl.searchParams.set('token', authToken);
    
    // 🎛️ Optional parameters
    if (request.model) {
      streamUrl.searchParams.set('model', request.model);
    }
    if (request.temperature !== undefined) {
      streamUrl.searchParams.set('temperature', request.temperature.toString());
    }
    if (request.max_tokens !== undefined) {
      streamUrl.searchParams.set('max_tokens', request.max_tokens.toString());
    }
    if (request.stream_delay_ms !== undefined) {
      streamUrl.searchParams.set('stream_delay_ms', request.stream_delay_ms.toString());
    }
    if (request.include_usage_in_stream !== undefined) {
      streamUrl.searchParams.set('include_usage_in_stream', request.include_usage_in_stream.toString());
    }
    
    // 📁 Include file attachment IDs for file upload support
    if (request.file_attachment_ids && request.file_attachment_ids.length > 0) {
      streamUrl.searchParams.set('file_attachment_ids', JSON.stringify(request.file_attachment_ids));
      console.log('📁 Including file attachments in stream:', request.file_attachment_ids);
    }
    
    // 🤖 Include assistant and conversation IDs for conversation saving
    if (request.assistant_id) {
      streamUrl.searchParams.set('assistant_id', request.assistant_id.toString());
      console.log('🤖 Including assistant ID in stream:', request.assistant_id);
    }
    if (request.conversation_id) {
      streamUrl.searchParams.set('conversation_id', request.conversation_id.toString());
      console.log('💬 Including conversation ID in stream:', request.conversation_id);
    }
    if (request.project_id) {
      streamUrl.searchParams.set('project_id', request.project_id.toString());
      console.log('🗂️ Including project ID in stream:', request.project_id);
    }
    
    console.log('🌊 Creating EventSource connection to:', streamUrl.toString().replace(authToken, 'TOKEN_HIDDEN'));
    
    // 📡 Set up EventSource for the stream
    let eventSource: EventSource | null = null;
    let accumulatedContent = '';
    let receivedChunks: StreamingChatChunk[] = [];
    
    try {
      // 🚀 Create EventSource connection with all data in URL
      eventSource = new EventSource(streamUrl.toString());
      
      // 📡 Handle incoming streaming chunks
      eventSource.onmessage = (event) => {
        try {
          // Handle completion and error markers
          if (event.data === '[DONE]') {
            console.log('✅ Streaming complete marker received');
            return; // Final response will be sent via last chunk
          }
          
          if (event.data === '[ERROR]') {
            console.error('❌ Streaming error marker received');
            const streamingError: StreamingError = {
              type: 'SERVER_ERROR',
              message: 'Server reported streaming error',
              shouldFallback: true,
              retryable: false
            };
            eventSource?.close();
            onError(streamingError);
            return;
          }
          
          const chunk = this.parseStreamingChunk(event.data);
          
          console.log('📡 Received streaming chunk:', {
            chunkId: chunk.chunk_id,
            contentLength: chunk.content.length,
            isFinal: chunk.is_final
          });
          
          // Accumulate content
          accumulatedContent += chunk.content;
          receivedChunks.push(chunk);
          
          // Call chunk handler
          onChunk(chunk);
          
          // Check if this is the final chunk
          if (chunk.is_final) {
            console.log('✅ Final chunk received, building complete response');
            
            // Build final ChatResponse from accumulated data
            const finalResponse: ChatResponse = {
              content: accumulatedContent,
              model: chunk.model || 'unknown',
              provider: chunk.provider || 'unknown',
              usage: chunk.usage || {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0
              },
              cost: chunk.cost,
              response_time_ms: chunk.response_time_ms,
              timestamp: chunk.timestamp || new Date().toISOString()
            };
            
            // Close connection and notify completion
            eventSource?.close();
            onComplete(finalResponse);
          }
          
        } catch (parseError) {
          logChatError('Error parsing streaming chunk', parseError);
          
          // 🚨 Enhanced error categorization based on error type
          let streamingError: StreamingError;
          
          if (parseError instanceof Error && parseError.message.includes('Backend error:')) {
            // This is a backend error (like quota exceeded or configuration error)
            const errorMessage = parseError.message.replace('Backend error: ', '');
            
            // More specific error type detection
            let errorType: StreamingError['type'] = 'SERVER_ERROR';
            let shouldFallback = false;
            
            if (errorMessage.toLowerCase().includes('quota')) {
              errorType = 'QUOTA_EXCEEDED';
              shouldFallback = false; // Don't fallback for quota errors
            } else if (errorMessage.toLowerCase().includes('configuration_error') || 
                       errorMessage.toLowerCase().includes('api key') ||
                       errorMessage.toLowerCase().includes('invalid')) {
              errorType = 'CONFIGURATION_ERROR';
              shouldFallback = false; // Don't fallback for configuration errors
            }
            
            streamingError = {
              type: errorType,
              message: errorMessage,
              shouldFallback: shouldFallback,
              retryable: false
            };
          } else {
            // This is a parsing error
            streamingError = {
              type: 'PARSE_ERROR',
              message: 'Failed to parse streaming response',
              shouldFallback: true,
              retryable: false
            };
          }
          
          // Always ensure connection is closed on error
          eventSource?.close();
          onError(streamingError);
        }
      };
      
      // 🚨 Handle connection errors
      eventSource.onerror = (error) => {
        logChatError('EventSource error', error);
        
        const streamingError: StreamingError = {
          type: 'CONNECTION_ERROR',
          message: 'Streaming connection failed',
          shouldFallback: true,
          retryable: true
        };
        
        eventSource?.close();
        onError(streamingError);
      };
      
      // 🔌 Handle connection open
      eventSource.onopen = () => {
        console.log('🔌 SSE connection established successfully');
      };
      
    } catch (eventSourceError) {
      logChatError('Failed to create EventSource', eventSourceError);
      throw eventSourceError;
    }
    
    // Return connection interface
    const connection: StreamingConnection = {
      eventSource,
      configId: request.config_id,
      requestId,
      onChunk,
      onError,
      onComplete,
      close: () => {
        console.log('🔌 Closing streaming connection:', requestId);
        eventSource?.close();
      }
    };
    
    return connection;
  }

  /**
   * Parse SSE data to structured chunk with error handling
   * 🔧 Convert SSE strings to typed objects
   */
  private parseStreamingChunk(data: string): StreamingChatChunk {
    try {
      // SSE data format is typically JSON
      const parsed = JSON.parse(data);
      
      // Check for error responses first
      if (parsed.error === true || parsed.error_type || parsed.error_message) {
        console.error('❌ Streaming error received from backend:', {
          errorType: parsed.error_type,
          errorMessage: parsed.error_message,
          chunkIndex: parsed.chunk_index
        });
        
        // Throw a specific error that will be handled by the error handler
        throw new Error(`Backend error: ${parsed.error_type}: ${parsed.error_message}`);
      }
      
      // Better validation for content chunks
      if (typeof parsed.content !== 'string' && parsed.content !== null && parsed.content !== undefined) {
        console.warn('⚠️ Invalid content type in chunk:', typeof parsed.content, parsed);
        throw new Error('Invalid chunk: content field must be string, null, or undefined');
      }
      
      return {
        content: parsed.content || '',
        chunk_id: parsed.chunk_id,
        is_final: parsed.is_final === true,
        model: parsed.model,
        provider: parsed.provider,
        usage: parsed.usage,
        cost: parsed.cost,
        response_time_ms: parsed.response_time_ms,
        timestamp: parsed.timestamp
      };
      
    } catch (error) {
      logChatError('Failed to parse streaming chunk', error, { data });
      
      // Re-throw parsing errors so they can be handled by the error handler
      throw error;
    }
  }

  /**
   * Automatically fall back to regular chat when streaming fails
   * 🛡️ Graceful degradation for better user experience
   */
  async streamMessageWithFallback(
    request: StreamingChatRequest,
    onChunk: (chunk: StreamingChatChunk) => void,
    onError: (error: StreamingError) => void,
    onComplete: (finalResponse: ChatResponse) => void,
    enableFallback: boolean = true
  ): Promise<StreamingConnection | ChatResponse> {
    
    try {
      // Attempt streaming first
      const connection = await this.streamMessage(request, onChunk, onError, (finalResponse) => {
        console.log('✅ Streaming completed successfully');
        onComplete(finalResponse);
      });
      
      return connection;
      
    } catch (streamingError) {
      console.log('⚠️ Streaming failed, checking fallback options:', { enableFallback, error: streamingError });
      
      if (!enableFallback) {
        throw streamingError;
      }
      
      // Fallback to regular chat
      console.log('🔄 Falling back to regular chat');
      
      try {
        const regularResponse = await coreChatService.sendMessage(request);
        
        console.log('✅ Fallback successful, simulating streaming');
        
        // Simulate streaming for consistent UX
        await this.simulateStreamingFromResponse(regularResponse, onChunk, onComplete);
        
        return regularResponse;
        
      } catch (fallbackError) {
        logChatError('Both streaming and fallback failed', fallbackError);
        
        const streamingErrorObj: StreamingError = {
          type: 'SERVER_ERROR',
          message: 'Both streaming and regular chat failed',
          shouldFallback: false,
          retryable: true
        };
        
        onError(streamingErrorObj);
        throw fallbackError;
      }
    }
  }

  /**
   * Convert regular response to streaming chunks for consistent UX
   * 🎭 Progressive disclosure - show content gradually
   */
  private async simulateStreamingFromResponse(
    response: ChatResponse,
    onChunk: (chunk: StreamingChatChunk) => void,
    onComplete: (finalResponse: ChatResponse) => void
  ): Promise<void> {
    const content = response.content;
    const words = content.split(' ');
    const chunkSize = Math.max(1, Math.floor(words.length / 10)); // ~10 chunks
    
    console.log('🎭 Simulating streaming:', { 
      totalWords: words.length, 
      chunkSize,
      estimatedChunks: Math.ceil(words.length / chunkSize)
    });
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkContent = chunkWords.join(' ') + (i + chunkSize < words.length ? ' ' : '');
      const isLast = i + chunkSize >= words.length;
      
      const chunk: StreamingChatChunk = {
        content: chunkContent,
        chunk_id: Math.floor(i / chunkSize),
        is_final: isLast,
        ...(isLast && {
          model: response.model,
          provider: response.provider,
          usage: response.usage,
          cost: response.cost,
          response_time_ms: response.response_time_ms,
          timestamp: response.timestamp
        })
      };
      
      onChunk(chunk);
      
      // Small delay to simulate typing
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    onComplete(response);
  }
}

// Export singleton instance
export const streamingChatService = new StreamingChatService();
