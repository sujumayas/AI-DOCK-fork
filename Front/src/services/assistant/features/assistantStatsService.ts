// Assistant Statistics Service
// Handles statistics and analytics for assistants

import { AssistantStatsResponse } from '../../../types/assistant';
import { assistantApiClient } from '../core/assistantApiClient';
import { AssistantErrorHandler } from '../core/assistantErrorHandler';

/**
 * Assistant Statistics Service
 * 
 * 🎓 LEARNING: Analytics Pattern
 * =============================
 * Statistics service provides:
 * - Usage analytics and metrics
 * - Performance tracking
 * - Data aggregation
 * - Dashboard data preparation
 * - Historical trend analysis
 */

export class AssistantStatsService {
  
  /**
   * Get assistant statistics and usage analytics
   */
  async getStats(): Promise<AssistantStatsResponse> {
    try {
      console.log('📊 Fetching assistant statistics');
      
      const stats = await assistantApiClient.get<AssistantStatsResponse>('stats');
      
      console.log('✅ Assistant stats loaded:', {
        totalAssistants: stats.total_assistants,
        activeAssistants: stats.active_assistants,
        totalConversations: stats.total_conversations
      });
      
      return stats;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getStats',
        error,
        'Failed to get assistant stats'
      );
    }
  }

  /**
   * Get usage summary for dashboard display
   */
  async getUsageSummary(): Promise<{
    totalAssistants: number;
    activeAssistants: number;
    totalConversations: number;
    averageConversationsPerAssistant: number;
  }> {
    try {
      const stats = await this.getStats();
      
      const averageConversationsPerAssistant = stats.total_assistants > 0 
        ? Math.round(stats.total_conversations / stats.total_assistants * 100) / 100
        : 0;

      return {
        totalAssistants: stats.total_assistants,
        activeAssistants: stats.active_assistants,
        totalConversations: stats.total_conversations,
        averageConversationsPerAssistant
      };
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getUsageSummary',
        error,
        'Failed to get usage summary'
      );
    }
  }

  /**
   * Get activity metrics for performance tracking
   */
  async getActivityMetrics(): Promise<{
    activePercentage: number;
    conversationActivity: number;
    utilizationRate: number;
  }> {
    try {
      const stats = await this.getStats();
      
      const activePercentage = stats.total_assistants > 0 
        ? Math.round((stats.active_assistants / stats.total_assistants) * 100)
        : 0;

      const conversationActivity = stats.active_assistants > 0
        ? Math.round(stats.total_conversations / stats.active_assistants * 100) / 100
        : 0;

      // Utilization rate could be based on conversations per active assistant
      // Higher values indicate better utilization
      const utilizationRate = conversationActivity > 10 ? 100 : Math.round(conversationActivity * 10);

      return {
        activePercentage,
        conversationActivity,
        utilizationRate: Math.min(utilizationRate, 100) // Cap at 100%
      };
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getActivityMetrics',
        error,
        'Failed to get activity metrics'
      );
    }
  }

  /**
   * Check if statistics service is healthy
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      await this.getStats();
      
      return {
        status: 'healthy',
        message: 'Assistant statistics service is working'
      };
      
    } catch (error) {
      console.error('❌ Assistant statistics service health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Statistics service unavailable'
      };
    }
  }

  /**
   * Format statistics for display
   */
  formatStatsForDisplay(stats: AssistantStatsResponse): {
    cards: Array<{ title: string; value: string; description: string }>;
  } {
    const activePercentage = stats.total_assistants > 0 
      ? Math.round((stats.active_assistants / stats.total_assistants) * 100)
      : 0;

    const avgConversations = stats.total_assistants > 0
      ? (stats.total_conversations / stats.total_assistants).toFixed(1)
      : '0';

    return {
      cards: [
        {
          title: 'Total Assistants',
          value: stats.total_assistants.toString(),
          description: `${stats.active_assistants} active (${activePercentage}%)`
        },
        {
          title: 'Active Assistants',
          value: stats.active_assistants.toString(),
          description: `${activePercentage}% of total assistants`
        },
        {
          title: 'Total Conversations',
          value: stats.total_conversations.toString(),
          description: `${avgConversations} average per assistant`
        }
      ]
    };
  }
}

// Export singleton instance
export const assistantStatsService = new AssistantStatsService();
