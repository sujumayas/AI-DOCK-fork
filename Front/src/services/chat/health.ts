// 🏥 Health Service
// Chat service health monitoring and status checking

import { coreChatService } from './core';
import { createChatServiceError, logChatError } from './errors';

/**
 * Health Service - monitors chat service availability and status
 * 🎓 Learning: Health checks are essential for production monitoring
 */
export class HealthService {

  /**
   * Verify chat service is working properly
   * 🏥 Basic health check for service availability
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${coreChatService.getApiBaseUrl()}/chat/health`, {
        method: 'GET',
        headers: coreChatService.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      return await response.json();
      
    } catch (error) {
      logChatError('Health check failed', error);
      
      throw createChatServiceError(
        error,
        'Health check failed'
      );
    }
  }
}

// Export singleton instance
export const healthService = new HealthService();
