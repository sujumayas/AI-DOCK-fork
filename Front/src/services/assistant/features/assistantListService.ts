// Assistant List Service
// Handles list management, pagination, filtering, and search operations

import {
  AssistantSummary,
  AssistantListRequest,
  AssistantListResponse,
  ASSISTANT_API_DEFAULTS
} from '../../../types/assistant';
import { assistantApiClient } from '../core/assistantApiClient';
import { AssistantErrorHandler } from '../core/assistantErrorHandler';

/**
 * Assistant List Service
 * 
 * 🎓 LEARNING: List Management Pattern
 * ===================================
 * List service provides:
 * - Pagination support
 * - Search and filtering
 * - Sorting capabilities
 * - Query parameter handling
 * - Consistent list responses
 */

export class AssistantListService {
  
  /**
   * Get user's assistants with pagination and filtering
   */
  async getAssistants(params: AssistantListRequest = {}): Promise<AssistantListResponse> {
    try {
      const {
        limit = ASSISTANT_API_DEFAULTS.LIST_LIMIT,
        offset = 0,
        search,
        status_filter,
        sort_by = ASSISTANT_API_DEFAULTS.DEFAULT_SORT_BY,
        sort_order = ASSISTANT_API_DEFAULTS.DEFAULT_SORT_ORDER,
        include_inactive = false
      } = params;
      
      console.log('📋 Fetching assistants:', { limit, offset, search, status_filter });
      
      // Build query parameters
      const queryParams: Record<string, string> = {
        limit: limit.toString(),
        offset: offset.toString(),
        sort_by,
        sort_order,
        include_inactive: include_inactive.toString()
      };

      if (search) {
        queryParams.search = search;
      }
      
      if (status_filter) {
        queryParams.status_filter = status_filter;
      }
      
      const data = await assistantApiClient.get<AssistantListResponse>('', queryParams);
      
      console.log('✅ Assistants fetched:', {
        count: data.assistants.length,
        total: data.total_count,
        hasMore: data.has_more
      });
      
      return data;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getAssistants',
        error,
        'Failed to fetch assistants',
        undefined,
        params
      );
    }
  }

  /**
   * Search assistants by name or description
   */
  async search(query: string, limit: number = 20): Promise<AssistantSummary[]> {
    try {
      console.log('🔍 Searching assistants:', query);
      
      const response = await this.getAssistants({
        search: query,
        limit: limit,
        sort_by: 'name',
        sort_order: 'asc'
      });
      
      console.log('✅ Search completed:', response.assistants.length, 'results');
      return response.assistants;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'search',
        error,
        'Search failed',
        undefined,
        { query, limit }
      );
    }
  }

  /**
   * Get only active assistants
   */
  async getActive(limit: number = 50): Promise<AssistantSummary[]> {
    try {
      const response = await this.getAssistants({
        limit: limit,
        include_inactive: false,
        sort_by: 'name',
        sort_order: 'asc'
      });
      
      return response.assistants;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getActive',
        error,
        'Failed to get active assistants',
        undefined,
        { limit }
      );
    }
  }

  /**
   * Get assistants by status filter
   */
  async getByStatus(status: string, limit: number = 50): Promise<AssistantSummary[]> {
    try {
      const response = await this.getAssistants({
        status_filter: status,
        limit: limit,
        sort_by: 'updated_at',
        sort_order: 'desc'
      });
      
      return response.assistants;
      
    } catch (error) {
      AssistantErrorHandler.handleError(
        'getByStatus',
        error,
        `Failed to get assistants with status: ${status}`,
        undefined,
        { status, limit }
      );
    }
  }

  /**
   * Get paginated results for infinite scroll or pagination
   */
  async getPaginated(
    page: number, 
    pageSize: number = ASSISTANT_API_DEFAULTS.LIST_LIMIT,
    filters?: Partial<AssistantListRequest>
  ): Promise<AssistantListResponse> {
    const offset = page * pageSize;
    
    return this.getAssistants({
      ...filters,
      limit: pageSize,
      offset: offset
    });
  }

  /**
   * Check if assistant name is available
   */
  async isNameAvailable(name: string, excludeId?: number): Promise<boolean> {
    try {
      const response = await this.search(name, 10);
      
      // Check if any result has exact name match
      const exactMatch = response.find(assistant => 
        assistant.name.toLowerCase() === name.toLowerCase() &&
        assistant.id !== excludeId
      );
      
      return !exactMatch;
      
    } catch (error) {
      console.error('❌ Failed to check name availability:', error);
      // If we can't check, assume name is available
      return true;
    }
  }
}

// Export singleton instance
export const assistantListService = new AssistantListService();
