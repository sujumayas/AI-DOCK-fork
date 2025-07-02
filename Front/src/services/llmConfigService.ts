// AI Dock LLM Configuration Frontend Service
// This handles all API calls for LLM configuration management

import { authService } from './authService';

// =============================================================================
// TYPESCRIPT TYPES FOR LLM CONFIGURATIONS
// =============================================================================

// These match our backend Pydantic schemas
export type LLMProvider = 
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'cohere'
  | 'huggingface'
  | 'azure_openai'
  | 'custom';

export interface LLMProviderInfo {
  value: LLMProvider;
  name: string;
  description: string;
  default_endpoint: string;
  documentation_url?: string;
}

export interface LLMConfigurationSummary {
  id: number;
  name: string;
  provider: LLMProvider;
  provider_name: string;
  default_model: string;
  is_active: boolean;
  is_public: boolean;
  priority: number;
  estimated_cost_per_request?: number;
}

export interface LLMConfigurationResponse {
  id: number;
  name: string;
  description?: string;
  provider: LLMProvider;
  provider_name: string;
  api_endpoint: string;
  api_version?: string;
  default_model: string;
  available_models?: string[];
  model_parameters?: Record<string, any>;
  rate_limit_rpm?: number;
  rate_limit_tpm?: number;
  daily_quota?: number;
  monthly_budget_usd?: number;
  cost_per_1k_input_tokens?: number;
  cost_per_1k_output_tokens?: number;
  cost_per_request?: number;
  estimated_cost_per_request?: number;
  is_active: boolean;
  is_public: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  last_tested_at?: string;
  last_test_result?: string;
  is_rate_limited: boolean;
  has_cost_tracking: boolean;
  custom_headers?: Record<string, string>;
  provider_settings?: Record<string, any>;
}

export interface LLMConfigurationCreate {
  name: string;
  description?: string;
  provider: LLMProvider;
  api_endpoint: string;
  api_key: string;
  api_version?: string;
  default_model: string;
  available_models?: string[];
  model_parameters?: Record<string, any>;
  rate_limit_rpm?: number;
  rate_limit_tpm?: number;
  daily_quota?: number;
  monthly_budget_usd?: number;
  cost_per_1k_input_tokens?: number;
  cost_per_1k_output_tokens?: number;
  cost_per_request?: number;
  is_active?: boolean;
  is_public?: boolean;
  priority?: number;
  custom_headers?: Record<string, string>;
  provider_settings?: Record<string, any>;
}

// NEW: Simplified interface for user-friendly configuration creation
export interface LLMConfigurationSimpleCreate {
  provider: LLMProvider;
  name: string;
  api_key: string;
  description?: string;
}

export interface LLMConfigurationUpdate {
  name?: string;
  description?: string;
  api_endpoint?: string;
  api_key?: string;
  api_version?: string;
  default_model?: string;
  available_models?: string[];
  model_parameters?: Record<string, any>;
  rate_limit_rpm?: number;
  rate_limit_tpm?: number;
  daily_quota?: number;
  monthly_budget_usd?: number;
  cost_per_1k_input_tokens?: number;
  cost_per_1k_output_tokens?: number;
  cost_per_request?: number;
  is_active?: boolean;
  is_public?: boolean;
  priority?: number;
  custom_headers?: Record<string, string>;
  provider_settings?: Record<string, any>;
}

export interface LLMConfigurationTest {
  test_message: string;
  timeout_seconds: number;
}

export interface LLMConfigurationTestResult {
  success: boolean;
  message: string;
  response_time_ms?: number;
  tested_at: string;
  error_details?: Record<string, any>;
}

// =============================================================================
// API RESPONSE HELPERS
// =============================================================================

interface ApiResponse<T> {
  data: T;
  status: number;
}

interface ApiError {
  detail: string;
  status: number;
}

/**
 * Custom error class for LLM configuration API errors
 */
export class LLMConfigError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'LLMConfigError';
  }
}

// =============================================================================
// HTTP CLIENT HELPER
// =============================================================================

/**
 * Make authenticated API requests to the LLM configuration endpoints
 * 
 * Learning: This helper function handles:
 * - Adding authentication headers
 * - Converting responses to JSON
 * - Error handling with proper TypeScript types
 * - Consistent error messaging
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get authentication token
  const token = authService.getToken();
  if (!token) {
    throw new LLMConfigError('Authentication required', 401);
  }

  // Build full URL
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const url = `${baseUrl}/admin/llm-configs${endpoint}`;

  // Set up headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  try {
    console.log(`🔗 API Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle different response status codes
    if (response.status === 401) {
      // Token might be expired
      authService.logout();
      throw new LLMConfigError('Authentication expired. Please log in again.', 401);
    }

    if (response.status === 403) {
      throw new LLMConfigError('Access denied. Admin privileges required.', 403);
    }

    if (response.status === 404) {
      throw new LLMConfigError('LLM configuration not found.', 404);
    }

    if (response.status >= 400) {
      // Try to parse error details
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // If we can't parse the error, use the default message
      }
      throw new LLMConfigError(errorMessage, response.status);
    }

    // Handle successful responses
    if (response.status === 204) {
      // No content (successful delete)
      return null as T;
    }

    if (!response.ok) {
      throw new LLMConfigError(`Request failed: ${response.statusText}`, response.status);
    }

    // Parse JSON response
    const data = await response.json();
    console.log(`✅ API Response: ${response.status}`, data);
    return data;

  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof LLMConfigError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new LLMConfigError('Network error. Please check your connection.', 0);
    }

    // Handle unexpected errors
    console.error('❌ Unexpected API error:', error);
    throw new LLMConfigError(`Unexpected error: ${error.message}`, 500);
  }
}

// =============================================================================
// LLM CONFIGURATION SERVICE CLASS
// =============================================================================

/**
 * LLM Configuration Service
 * 
 * This service provides all the methods needed to manage LLM configurations
 * from the frontend. It's the main interface between our React components
 * and the backend API.
 * 
 * Learning: This follows the "service layer" pattern:
 * - Components call service methods
 * - Service handles API communication
 * - Service provides TypeScript types
 * - Service handles errors consistently
 */
class LLMConfigService {
  
  // =============================================================================
  // READ OPERATIONS
  // =============================================================================

  /**
   * Get all LLM configurations (summary view)
   * 
   * @param includeInactive - Whether to include disabled configurations
   * @returns List of configuration summaries
   */
  async getConfigurations(includeInactive: boolean = false): Promise<LLMConfigurationSummary[]> {
    console.log('📋 Fetching LLM configurations...');
    
    const params = new URLSearchParams();
    if (includeInactive) {
      params.append('include_inactive', 'true');
    }
    
    const endpoint = params.toString() ? `/?${params}` : '/';
    return apiRequest<LLMConfigurationSummary[]>(endpoint);
  }

  /**
   * Get detailed information about a specific configuration
   * 
   * @param configId - ID of the configuration to retrieve
   * @returns Detailed configuration information
   */
  async getConfiguration(configId: number): Promise<LLMConfigurationResponse> {
    console.log(`📄 Fetching LLM configuration ${configId}...`);
    return apiRequest<LLMConfigurationResponse>(`/${configId}`);
  }

  /**
   * Get information about all supported providers
   * 
   * @returns List of provider information for UI dropdowns
   */
  async getProviderInfo(): Promise<LLMProviderInfo[]> {
    console.log('🏢 Fetching provider information...');
    return apiRequest<LLMProviderInfo[]>('/providers/info');
  }

  // =============================================================================
  // CREATE/UPDATE OPERATIONS
  // =============================================================================

  /**
   * Create a new LLM configuration
   * 
   * @param configData - Configuration data to create
   * @returns The newly created configuration
   */
  async createConfiguration(configData: LLMConfigurationCreate): Promise<LLMConfigurationResponse> {
    console.log('➕ Creating new LLM configuration:', configData.name);
    return apiRequest<LLMConfigurationResponse>('/', {
      method: 'POST',
      body: JSON.stringify(configData),
    });
  }

  /**
   * Create a new LLM configuration using simplified input (NEW!)
   * 
   * This method uses the new simplified API that only requires 4 fields.
   * Smart defaults are applied automatically based on the provider.
   * 
   * Learning: This demonstrates progressive disclosure - we provide a
   * simple interface while using the full system capabilities underneath.
   * 
   * @param simpleConfigData - Simplified configuration data (just essentials)
   * @returns The newly created configuration with smart defaults applied
   */
  async createSimpleConfiguration(simpleConfigData: LLMConfigurationSimpleCreate): Promise<LLMConfigurationResponse> {
    console.log('✨ Creating new LLM configuration (simplified):', simpleConfigData.name);
    console.log('🧠 Smart defaults will be applied for provider:', simpleConfigData.provider);
    
    return apiRequest<LLMConfigurationResponse>('/simple', {
      method: 'POST',
      body: JSON.stringify(simpleConfigData),
    });
  }

  /**
   * Update an existing LLM configuration
   * 
   * @param configId - ID of configuration to update
   * @param updateData - Updated configuration data
   * @returns The updated configuration
   */
  async updateConfiguration(
    configId: number, 
    updateData: LLMConfigurationUpdate
  ): Promise<LLMConfigurationResponse> {
    console.log(`✏️ Updating LLM configuration ${configId}...`);
    return apiRequest<LLMConfigurationResponse>(`/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * Delete an LLM configuration
   * 
   * @param configId - ID of configuration to delete
   */
  async deleteConfiguration(configId: number): Promise<void> {
    console.log(`🗑️ Deleting LLM configuration ${configId}...`);
    await apiRequest<void>(`/${configId}`, {
      method: 'DELETE',
    });
  }

  // =============================================================================
  // SPECIAL ACTIONS
  // =============================================================================

  /**
   * Test connectivity to an LLM configuration
   * 
   * @param configId - ID of configuration to test
   * @param testData - Test parameters (message, timeout)
   * @returns Test results
   */
  async testConfiguration(
    configId: number, 
    testData: LLMConfigurationTest = {
      test_message: 'Hello! This is a connectivity test.',
      timeout_seconds: 30
    }
  ): Promise<LLMConfigurationTestResult> {
    console.log(`🧪 Testing LLM configuration ${configId}...`);
    return apiRequest<LLMConfigurationTestResult>(`/${configId}/test`, {
      method: 'POST',
      body: JSON.stringify(testData),
    });
  }

  /**
   * Toggle the active status of an LLM configuration
   * 
   * @param configId - ID of configuration to toggle
   * @returns The updated configuration
   */
  async toggleConfiguration(configId: number): Promise<LLMConfigurationResponse> {
    console.log(`🔄 Toggling LLM configuration ${configId}...`);
    return apiRequest<LLMConfigurationResponse>(`/${configId}/toggle`, {
      method: 'PATCH',
    });
  }

  /**
   * Get usage statistics for a configuration
   * 
   * @param configId - ID of configuration
   * @param days - Number of days to include in statistics
   * @returns Usage statistics (placeholder for now)
   */
  async getUsageStats(configId: number, days: number = 30): Promise<any> {
    console.log(`📊 Fetching usage stats for configuration ${configId}...`);
    const params = new URLSearchParams({ days: days.toString() });
    return apiRequest<any>(`/${configId}/usage-stats?${params}`);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check if a configuration name is available
   * 
   * @param name - Configuration name to check
   * @param excludeId - Exclude this ID from the check (for updates)
   * @returns True if name is available
   */
  async isNameAvailable(name: string, excludeId?: number): Promise<boolean> {
    try {
      const configs = await this.getConfigurations(true); // Include inactive
      return !configs.some(config => 
        config.name.toLowerCase() === name.toLowerCase() && 
        config.id !== excludeId
      );
    } catch (error) {
      console.warn('Could not check name availability:', error);
      return true; // Assume available if we can't check
    }
  }

  /**
   * Get default configuration data for a provider
   * 
   * @param provider - Provider type
   * @returns Default configuration template
   */
  getDefaultConfigForProvider(provider: LLMProvider): Partial<LLMConfigurationCreate> {
    const defaults: Record<LLMProvider, Partial<LLMConfigurationCreate>> = {
      openai: {
        api_endpoint: 'https://api.openai.com/v1',
        default_model: 'gpt-4',
        available_models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        model_parameters: {
          temperature: 0.7,
          max_tokens: 4000,
        },
        rate_limit_rpm: 3000,
        rate_limit_tpm: 90000,
        cost_per_1k_input_tokens: 0.03,
        cost_per_1k_output_tokens: 0.06,
      },
      anthropic: {
        api_endpoint: 'https://api.anthropic.com',
        api_version: '2023-06-01',
        default_model: 'claude-opus-4-0',
        available_models: [
          'claude-opus-4-0',
          'claude-sonnet-4-0',
          'claude-3-7-sonnet-latest',
          'claude-3-5-sonnet-latest',
          'claude-3-5-haiku-latest',
          'claude-opus-4-20250514',
          'claude-sonnet-4-20250514',
          'claude-3-7-sonnet-20250219',
          'claude-3-5-sonnet-20241022',
          'claude-3-5-sonnet-20240620',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ],
        model_parameters: {
          temperature: 0.7,
          max_tokens: 4000,
        },
        rate_limit_rpm: 1000,
        rate_limit_tpm: 80000,
        cost_per_1k_input_tokens: 0.015,
        cost_per_1k_output_tokens: 0.075,
      },
      google: {
        api_endpoint: 'https://generativelanguage.googleapis.com',
        default_model: 'gemini-pro',
        available_models: ['gemini-pro', 'gemini-pro-vision'],
        model_parameters: {
          temperature: 0.7,
          max_tokens: 2048,
        },
      },
      mistral: {
        api_endpoint: 'https://api.mistral.ai',
        default_model: 'mistral-medium',
        available_models: ['mistral-tiny', 'mistral-small', 'mistral-medium'],
        model_parameters: {
          temperature: 0.7,
          max_tokens: 4000,
        },
      },
      cohere: {
        api_endpoint: 'https://api.cohere.ai',
        default_model: 'command',
        available_models: ['command', 'command-light'],
        model_parameters: {
          temperature: 0.7,
          max_tokens: 4000,
        },
      },
      huggingface: {
        api_endpoint: 'https://api-inference.huggingface.co',
        default_model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        model_parameters: {
          temperature: 0.7,
          max_tokens: 4000,
        },
      },
      azure_openai: {
        api_endpoint: 'https://YOUR-RESOURCE.openai.azure.com',
        api_version: '2023-05-15',
        default_model: 'gpt-4',
        available_models: ['gpt-35-turbo', 'gpt-4'],
        model_parameters: {
          temperature: 0.7,
          max_tokens: 4000,
        },
      },
      custom: {
        api_endpoint: 'https://your-llm-endpoint.com',
        default_model: 'your-model',
        model_parameters: {
          temperature: 0.7,
          max_tokens: 4000,
        },
      },
    };

    return defaults[provider] || {};
  }

  /**
   * Format currency values for display
   * 
   * @param amount - Amount in USD
   * @returns Formatted currency string
   */
  formatCurrency(amount?: number): string {
    if (amount === undefined || amount === null) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount < 0.01 ? 6 : 2,
      maximumFractionDigits: amount < 0.01 ? 6 : 2,
    }).format(amount);
  }

  /**
   * Format numbers for display
   * 
   * @param value - Number to format
   * @returns Formatted number string
   */
  formatNumber(value?: number): string {
    if (value === undefined || value === null) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-US').format(value);
  }

  /**
   * Format dates for display
   * 
   * @param dateString - ISO date string
   * @returns Formatted date string
   */
  formatDate(dateString?: string): string {
    if (!dateString) {
      return 'Never';
    }
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }
}

// =============================================================================
// EXPORT SERVICE INSTANCE
// =============================================================================

/**
 * Global LLM configuration service instance
 * 
 * Learning: We export a single instance so all components
 * use the same service object. This is a common pattern
 * for services that don't need to maintain component-specific state.
 */
export const llmConfigService = new LLMConfigService();

// Export types for use in components
export type {
  LLMConfigurationSummary,
  LLMConfigurationResponse,
  LLMConfigurationCreate,
  LLMConfigurationSimpleCreate,
  LLMConfigurationUpdate,
  LLMConfigurationTest,
  LLMConfigurationTestResult,
  LLMProviderInfo,
  LLMProvider,
};
