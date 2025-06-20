// 🔐 Streaming Authentication Helper
// Workarounds for EventSource authentication limitations
// EventSource doesn't support custom headers, so we need creative solutions

import { authService } from '../services/authService';

// 🎓 AUTHENTICATION STRATEGIES for Streaming
// EventSource has limitations with headers, so we provide multiple approaches

export interface StreamingAuthConfig {
  strategy: 'url_token' | 'cookie' | 'readable_stream';
  token?: string;
  cookieName?: string;
}

// 🔑 GET STREAMING AUTH CONFIG: Determine best auth strategy for current setup
export const getStreamingAuthConfig = (): StreamingAuthConfig => {
  const token = authService.getToken();
  
  if (!token) {
    throw new Error('No authentication token available for streaming');
  }
  
  // For now, we'll use URL token strategy
  // TODO: In production, consider cookie-based auth or ReadableStream approach
  return {
    strategy: 'url_token',
    token
  };
};

// 🌐 BUILD AUTHENTICATED STREAMING URL: Create URL with auth for EventSource
export const buildAuthenticatedStreamingUrl = (
  baseUrl: string,
  requestId: string,
  authConfig: StreamingAuthConfig
): string => {
  const url = new URL(baseUrl);
  url.searchParams.set('request_id', requestId);
  
  switch (authConfig.strategy) {
    case 'url_token':
      if (authConfig.token) {
        // ⚠️ Security Note: URL tokens are visible in logs
        // In production, prefer cookie or ReadableStream approaches
        url.searchParams.set('token', authConfig.token);
      }
      break;
      
    case 'cookie':
      // Cookies are automatically sent with EventSource requests
      // No URL modification needed
      break;
      
    case 'readable_stream':
      // This would use fetch() with ReadableStream instead of EventSource
      // More complex but allows full header control
      break;
  }
  
  return url.toString();
};

// 🔄 FALLBACK DETECTION: Determine when to use fallback
export const shouldUseFallback = (error: any): {
  useFallback: boolean;
  reason: string;
  retryable: boolean;
} => {
  // Check for common streaming failure patterns
  
  if (error?.type === 'CONNECTION_ERROR') {
    return {
      useFallback: true,
      reason: 'Connection failed - network or server issue',
      retryable: true
    };
  }
  
  if (error?.status === 401 || error?.status === 403) {
    return {
      useFallback: true,
      reason: 'Authentication failed - token may be expired',
      retryable: false
    };
  }
  
  if (error?.status === 429) {
    return {
      useFallback: false,  // Don't fallback on rate limits
      reason: 'Rate limited - should wait before retry',
      retryable: true
    };
  }
  
  if (error?.status === 502 || error?.status === 503) {
    return {
      useFallback: true,
      reason: 'Server temporarily unavailable',
      retryable: true
    };
  }
  
  // Default: try fallback for unknown errors
  return {
    useFallback: true,
    reason: 'Unknown error - attempting fallback',
    retryable: true
  };
};

// 🎭 SIMULATE TYPING EFFECT: Create realistic typing simulation for fallback
export const createTypingSimulation = (
  content: string,
  options: {
    wordsPerChunk?: number;
    delayMs?: number;
    variableSpeed?: boolean;
  } = {}
): {
  chunks: string[];
  delays: number[];
} => {
  const {
    wordsPerChunk = 3,
    delayMs = 50,
    variableSpeed = true
  } = options;
  
  const words = content.split(' ');
  const chunks: string[] = [];
  const delays: number[] = [];
  
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    const chunkText = chunkWords.join(' ') + (i + wordsPerChunk < words.length ? ' ' : '');
    chunks.push(chunkText);
    
    // Variable speed simulation
    let delay = delayMs;
    if (variableSpeed) {
      // Longer pauses for punctuation
      if (chunkText.includes('.') || chunkText.includes('!') || chunkText.includes('?')) {
        delay *= 2;
      }
      // Shorter pauses for commas
      if (chunkText.includes(',')) {
        delay *= 1.5;
      }
      // Add randomness (±25%)
      delay *= (0.75 + Math.random() * 0.5);
    }
    
    delays.push(Math.round(delay));
  }
  
  return { chunks, delays };
};

// 🔍 COMPATIBILITY CHECK: Verify browser streaming support
export const checkStreamingCompatibility = (): {
  supported: boolean;
  features: {
    eventSource: boolean;
    readableStream: boolean;
    fetchStream: boolean;
  };
  recommendations: string[];
} => {
  const features = {
    eventSource: typeof EventSource !== 'undefined',
    readableStream: typeof ReadableStream !== 'undefined',
    fetchStream: typeof ReadableStream !== 'undefined' && 'body' in Response.prototype
  };
  
  const recommendations: string[] = [];
  
  if (!features.eventSource) {
    recommendations.push('EventSource not supported - will use fallback mode only');
  }
  
  if (!features.readableStream) {
    recommendations.push('ReadableStream not supported - limited streaming options');
  }
  
  const supported = features.eventSource || features.fetchStream;
  
  if (!supported) {
    recommendations.push('No streaming support detected - will use regular chat only');
  }
  
  return {
    supported,
    features,
    recommendations
  };
};

// 🚨 ERROR RECOVERY: Smart error recovery strategies
export const createErrorRecoveryStrategy = (
  error: any,
  attemptCount: number,
  maxAttempts: number = 3
): {
  shouldRetry: boolean;
  delayMs: number;
  useStreaming: boolean;
  message: string;
} => {
  const fallbackInfo = shouldUseFallback(error);
  
  // Don't retry if we've hit max attempts
  if (attemptCount >= maxAttempts) {
    return {
      shouldRetry: false,
      delayMs: 0,
      useStreaming: false,
      message: 'Max retry attempts reached - using fallback mode'
    };
  }
  
  // Handle specific error types
  if (error?.status === 429) {
    // Rate limited - wait longer
    const delay = Math.min(1000 * Math.pow(2, attemptCount), 30000); // Exponential backoff, max 30s
    return {
      shouldRetry: true,
      delayMs: delay,
      useStreaming: true,
      message: `Rate limited - waiting ${delay/1000}s before retry`
    };
  }
  
  if (error?.status === 401 || error?.status === 403) {
    // Auth error - don't retry streaming
    return {
      shouldRetry: true,
      delayMs: 0,
      useStreaming: false,
      message: 'Authentication failed - using regular chat'
    };
  }
  
  if (fallbackInfo.retryable) {
    // Retryable error - exponential backoff
    const delay = Math.min(500 * Math.pow(1.5, attemptCount), 5000); // Max 5s delay
    return {
      shouldRetry: true,
      delayMs: delay,
      useStreaming: !fallbackInfo.useFallback,
      message: `${fallbackInfo.reason} - retrying in ${delay/1000}s`
    };
  }
  
  // Non-retryable error
  return {
    shouldRetry: false,
    delayMs: 0,
    useStreaming: false,
    message: fallbackInfo.reason
  };
};

// 🎯 ENHANCED STREAMING SERVICE: Wrapper with all error handling
export class EnhancedStreamingService {
  private attemptCounts = new Map<string, number>();
  
  async streamWithRecovery(
    request: any,
    callbacks: {
      onChunk: (chunk: any) => void;
      onError: (error: any) => void;
      onComplete: (response: any) => void;
    },
    options: {
      maxAttempts?: number;
      enableFallback?: boolean;
      requestId?: string;
    } = {}
  ): Promise<any> {
    const {
      maxAttempts = 3,
      enableFallback = true,
      requestId = `enhanced_${Date.now()}`
    } = options;
    
    const attemptCount = this.attemptCounts.get(requestId) || 0;
    this.attemptCounts.set(requestId, attemptCount + 1);
    
    try {
      // Check compatibility first
      const compatibility = checkStreamingCompatibility();
      if (!compatibility.supported) {
        console.log('🔄 No streaming support - using fallback immediately');
        // Use regular chat service
        return this.fallbackToRegularChat(request, callbacks);
      }
      
      // Try streaming
      console.log(`🌊 Streaming attempt ${attemptCount + 1}/${maxAttempts} for request ${requestId}`);
      
      // Import and use chat service (avoiding circular dependency)
      const { chatService } = await import('../services/chatService');
      
      return await chatService.streamMessageWithFallback(
        request,
        callbacks.onChunk,
        callbacks.onError,
        callbacks.onComplete,
        enableFallback
      );
      
    } catch (error) {
      console.error(`❌ Streaming attempt ${attemptCount + 1} failed:`, error);
      
      const recovery = createErrorRecoveryStrategy(error, attemptCount, maxAttempts);
      
      if (recovery.shouldRetry) {
        console.log(`🔄 Recovery strategy: ${recovery.message}`);
        
        if (recovery.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, recovery.delayMs));
        }
        
        // Recursive retry
        return this.streamWithRecovery(request, callbacks, {
          ...options,
          requestId
        });
      } else {
        console.log(`🛑 No more retries: ${recovery.message}`);
        
        if (enableFallback) {
          return this.fallbackToRegularChat(request, callbacks);
        } else {
          throw error;
        }
      }
    }
  }
  
  private async fallbackToRegularChat(request: any, callbacks: any): Promise<any> {
    console.log('🔄 Using regular chat fallback');
    
    const { chatService } = await import('../services/chatService');
    const response = await chatService.sendMessage(request);
    
    // Simulate streaming for consistent UX
    const typing = createTypingSimulation(response.content);
    
    for (let i = 0; i < typing.chunks.length; i++) {
      const chunk = {
        content: typing.chunks[i],
        chunk_id: i,
        is_final: i === typing.chunks.length - 1,
        ...(i === typing.chunks.length - 1 && {
          model: response.model,
          provider: response.provider,
          usage: response.usage,
          cost: response.cost,
          response_time_ms: response.response_time_ms,
          timestamp: response.timestamp
        })
      };
      
      callbacks.onChunk(chunk);
      
      if (i < typing.chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, typing.delays[i]));
      }
    }
    
    callbacks.onComplete(response);
    return response;
  }
  
  clearAttemptHistory(): void {
    this.attemptCounts.clear();
  }
}

// Export singleton instance
export const enhancedStreamingService = new EnhancedStreamingService();

// 🎯 Export utilities
export default {
  getStreamingAuthConfig,
  buildAuthenticatedStreamingUrl,
  shouldUseFallback,
  createTypingSimulation,
  checkStreamingCompatibility,
  createErrorRecoveryStrategy,
  enhancedStreamingService
};

// 🎓 Usage Example:
/*
import { enhancedStreamingService } from '../utils/streamingAuth';

// Use enhanced streaming with automatic error recovery
const result = await enhancedStreamingService.streamWithRecovery(
  request,
  {
    onChunk: (chunk) => console.log('Chunk:', chunk),
    onError: (error) => console.error('Error:', error),
    onComplete: (response) => console.log('Complete:', response)
  },
  {
    maxAttempts: 3,
    enableFallback: true
  }
);
*/
