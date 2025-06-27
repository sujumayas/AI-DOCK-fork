// 💰 Cost Service
// Cost estimation for chat requests and usage tracking

import { 
  CostEstimateRequest, 
  CostEstimateResponse 
} from '../../types/chat';
import { coreChatService } from './core';
import { createChatServiceError, logChatError } from './errors';

/**
 * Cost Service - handles cost estimation and budget management
 * 🎓 Learning: Cost estimation helps users make informed decisions
 */
export class CostService {

  /**
   * Get cost estimate before sending expensive requests
   * 💰 Helps users understand the cost impact of their requests
   */
  async estimateCost(request: CostEstimateRequest): Promise<CostEstimateResponse> {
    try {
      console.log('💰 Estimating cost for:', { 
        config_id: request.config_id,
        messageCount: request.messages.length 
      });
      
      const response = await fetch(`${coreChatService.getApiBaseUrl()}/chat/estimate-cost`, {
        method: 'POST',
        headers: coreChatService.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw createChatServiceError(
          errorData.detail || 'Cost estimation failed',
          errorData.detail || 'Cost estimation failed',
          response.status
        );
      }

      const costEstimate: CostEstimateResponse = await response.json();
      
      console.log('💰 Cost estimate:', costEstimate);
      
      return costEstimate;
      
    } catch (error) {
      logChatError('Cost estimation error', error, {
        configId: request.config_id,
        messageCount: request.messages.length
      });
      
      throw createChatServiceError(
        error,
        'Cost estimation failed'
      );
    }
  }
}

// Export singleton instance
export const costService = new CostService();
