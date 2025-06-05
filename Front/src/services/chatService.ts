// 💬 Chat Service
// This service handles all communication with our FastAPI chat endpoints
// It manages LLM interactions, configurations, and cost estimation

import { 
  ChatRequest, 
  ChatResponse, 
  LLMConfigurationSummary, 
  ConfigTestRequest, 
  ConfigTestResponse,
  CostEstimateRequest,
  CostEstimateResponse,
  ChatServiceError 
} from '../types/chat';
import { authService } from './authService';

// Configuration - using same base URL as auth service
const API_BASE_URL = 'http://localhost:8000';

class ChatService {
  
  // 💬 SEND CHAT MESSAGE: Main function to chat with LLMs
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      console.log('📤 Sending chat message:', { 
        config_id: request.config_id, 
        messageCount: request.messages.length,
        url: `${API_BASE_URL}/chat/send`,
        headers: authService.getAuthHeaders()
      });

      const response = await fetch(`${API_BASE_URL}/chat/send`, {
        method: 'POST',
        headers: authService.getAuthHeaders(), // Use existing auth pattern
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.detail || 'Failed to send chat message';
        
        // Create specific error with status code for better error handling
        throw new ChatServiceError(
          errorMessage, 
          response.status,
          this.getErrorType(response.status)
        );
      }

      const chatResponse: ChatResponse = await response.json();
      
      console.log('📥 Received chat response:', { 
        provider: chatResponse.provider, 
        model: chatResponse.model,
        tokenCount: chatResponse.usage.total_tokens 
      });
      
      return chatResponse;
      
    } catch (error) {
      console.error('❌ Chat service error:', error);
      
      if (error instanceof ChatServiceError) {
        throw error; // Re-throw our custom errors
      }
      
      // 🔍 DEBUG: Log more details about the error
      console.error('❌ Full error details:', {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        errorName: error instanceof Error ? error.name : 'Unknown'
      });
      
      // Convert network/unknown errors to ChatServiceError
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred while processing your chat message';
        
      throw new ChatServiceError(
        errorMessage,
        undefined,
        'NETWORK_ERROR'
      );
    }
  }

  // 🎛️ GET AVAILABLE CONFIGURATIONS: Fetch LLM providers user can access
  async getAvailableConfigurations(): Promise<LLMConfigurationSummary[]> {
    try {
      console.log('📋 Fetching available LLM configurations...');
      
      const response = await fetch(`${API_BASE_URL}/chat/configurations`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Failed to fetch configurations',
          response.status
        );
      }

      const configurations: LLMConfigurationSummary[] = await response.json();
      
      console.log('📋 Available configurations:', configurations.map(c => ({
        id: c.id,
        name: c.name,
        provider: c.provider
      })));
      
      return configurations;
      
    } catch (error) {
      console.error('❌ Error fetching configurations:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Failed to fetch configurations'
      );
    }
  }

  // 🧪 TEST CONFIGURATION: Check if an LLM provider is working
  async testConfiguration(configId: number): Promise<ConfigTestResponse> {
    try {
      console.log('🧪 Testing configuration:', configId);
      
      const request: ConfigTestRequest = { config_id: configId };
      
      const response = await fetch(`${API_BASE_URL}/chat/test-configuration`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Configuration test failed',
          response.status
        );
      }

      const testResult: ConfigTestResponse = await response.json();
      
      console.log('🧪 Test result:', testResult);
      
      return testResult;
      
    } catch (error) {
      console.error('❌ Configuration test error:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Configuration test failed'
      );
    }
  }

  // 💰 ESTIMATE COST: Get cost estimate before sending expensive requests
  async estimateCost(request: CostEstimateRequest): Promise<CostEstimateResponse> {
    try {
      console.log('💰 Estimating cost for:', { 
        config_id: request.config_id,
        messageCount: request.messages.length 
      });
      
      const response = await fetch(`${API_BASE_URL}/chat/estimate-cost`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Cost estimation failed',
          response.status
        );
      }

      const costEstimate: CostEstimateResponse = await response.json();
      
      console.log('💰 Cost estimate:', costEstimate);
      
      return costEstimate;
      
    } catch (error) {
      console.error('❌ Cost estimation error:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Cost estimation failed'
      );
    }
  }

  // 🎯 GET AVAILABLE MODELS: Get models for a specific configuration
  async getAvailableModels(configId: number): Promise<string[]> {
    try {
      console.log('🎯 Fetching models for configuration:', configId);
      
      const response = await fetch(`${API_BASE_URL}/chat/models/${configId}`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ChatServiceError(
          errorData.detail || 'Failed to fetch available models',
          response.status
        );
      }

      const models: string[] = await response.json();
      
      console.log('🎯 Available models:', models);
      
      return models;
      
    } catch (error) {
      console.error('❌ Error fetching models:', error);
      
      if (error instanceof ChatServiceError) {
        throw error;
      }
      
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Failed to fetch models'
      );
    }
  }

  // 🏥 HEALTH CHECK: Verify chat service is working
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/health`, {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      return await response.json();
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw new ChatServiceError(
        error instanceof Error ? error.message : 'Health check failed'
      );
    }
  }

  // 🛠️ HELPER: Determine error type from HTTP status code
  private getErrorType(statusCode: number): string {
    switch (statusCode) {
      case 400: return 'INVALID_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 429: return 'QUOTA_EXCEEDED';
      case 502: return 'PROVIDER_ERROR';
      case 500: return 'SERVER_ERROR';
      default: return 'UNKNOWN_ERROR';
    }
  }
}

// Export singleton instance following the same pattern as authService
export const chatService = new ChatService();

// 🎯 How this service works:
//
// 1. **Authentication Integration**: Uses authService.getAuthHeaders() 
//    to automatically include JWT tokens in all requests
//
// 2. **Error Handling**: Converts backend errors to ChatServiceError 
//    with status codes and error types for better UX
//
// 3. **Logging**: Console.log statements help debug API interactions
//    (these would be removed or made configurable in production)
//
// 4. **Type Safety**: Uses TypeScript interfaces from types/chat.ts
//    to ensure frontend/backend compatibility
//
// 5. **Consistent Pattern**: Follows the same structure as authService
//    making it easy for developers to understand and maintain
//
// Usage Example:
// ```
// import { chatService } from '../services/chatService';
//
// // Get available LLM providers
// const configs = await chatService.getAvailableConfigurations();
//
// // Send a chat message
// const response = await chatService.sendMessage({
//   config_id: 1,
//   messages: [{ role: 'user', content: 'Hello!' }]
// });
// ```
