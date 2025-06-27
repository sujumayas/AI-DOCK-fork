// 🎛️ Configuration Service
// LLM provider configuration management and testing

import { 
  LLMConfigurationSummary, 
  ConfigTestRequest, 
  ConfigTestResponse 
} from '../../types/chat';
import { coreChatService } from './core';
import { createChatServiceError, logChatError } from './errors';

/**
 * Configuration Service - manages LLM provider configurations
 * 🎓 Learning: Centralized configuration management improves maintainability
 */
export class ConfigurationService {

  /**
   * Fetch all LLM configurations available to the user
   * 📋 Get list of providers user can access
   */
  async getAvailableConfigurations(): Promise<LLMConfigurationSummary[]> {
    try {
      console.log('📋 Fetching available LLM configurations...');
      
      const response = await fetch(`${coreChatService.getApiBaseUrl()}/chat/configurations`, {
        method: 'GET',
        headers: coreChatService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw createChatServiceError(
          errorData.detail || 'Failed to fetch configurations',
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
      logChatError('Error fetching configurations', error);
      
      throw createChatServiceError(
        error,
        'Failed to fetch configurations'
      );
    }
  }

  /**
   * Test if a specific LLM configuration is working properly
   * 🧪 Verify provider connectivity and authentication
   */
  async testConfiguration(configId: number): Promise<ConfigTestResponse> {
    try {
      console.log('🧪 Testing configuration:', configId);
      
      const request: ConfigTestRequest = { config_id: configId };
      
      const response = await fetch(`${coreChatService.getApiBaseUrl()}/chat/test-configuration`, {
        method: 'POST',
        headers: coreChatService.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw createChatServiceError(
          errorData.detail || 'Configuration test failed',
          errorData.detail || 'Configuration test failed',
          response.status
        );
      }

      const testResult: ConfigTestResponse = await response.json();
      
      console.log('🧪 Test result:', testResult);
      
      return testResult;
      
    } catch (error) {
      logChatError('Configuration test error', error, { configId });
      
      throw createChatServiceError(
        error,
        'Configuration test failed'
      );
    }
  }
}

// Export singleton instance
export const configurationService = new ConfigurationService();
