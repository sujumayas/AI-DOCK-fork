// ✏️ LLM Configuration Edit Modal Component
// This component provides a comprehensive form for editing existing LLM configurations
// 
// Learning: This demonstrates advanced React form patterns for editing:
// - Form pre-population with existing data
// - Partial update handling (only send changed fields)
// - API key security (show placeholder, update only if changed)
// - Validation with pre-filled data

import React, { useState, useEffect } from 'react';
import { 
  LLMConfigurationUpdate,
  LLMConfigurationResponse,
  LLMProviderInfo,
  LLMProvider,
  LLMConfigError
} from '../../services/llmConfigService';

interface LLMEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (configId: number, configData: LLMConfigurationUpdate) => Promise<void>;
  configuration: LLMConfigurationResponse | null;
  providerInfo: LLMProviderInfo[];
  isSubmitting: boolean;
}

/**
 * Edit LLM Configuration Modal
 * 
 * This component provides a comprehensive form for editing existing LLM configurations.
 * It pre-populates all fields and handles partial updates efficiently.
 */
const LLMEditModal: React.FC<LLMEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  configuration,
  providerInfo,
  isSubmitting
}) => {
  // =============================================================================
  // FORM STATE MANAGEMENT
  // =============================================================================

  // Form data - initialized from existing configuration
  const [formData, setFormData] = useState<Partial<LLMConfigurationUpdate>>({});
  
  // Track which fields have been modified (for partial updates)
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [availableModelsText, setAvailableModelsText] = useState('');
  
  // API key handling
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Selected provider info for dynamic field updates
  const [selectedProviderInfo, setSelectedProviderInfo] = useState<LLMProviderInfo | null>(null);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Pre-populate form when configuration changes
   */
  useEffect(() => {
    if (configuration) {
      console.log('📝 Pre-populating edit form with configuration:', configuration.name);
      
      // Initialize form data with existing configuration
      const initialData: Partial<LLMConfigurationUpdate> = {
        name: configuration.name,
        description: configuration.description,
        provider: configuration.provider,
        api_endpoint: configuration.api_endpoint,
        api_version: configuration.api_version,
        default_model: configuration.default_model,
        available_models: configuration.available_models,
        model_parameters: configuration.model_parameters,
        rate_limit_rpm: configuration.rate_limit_rpm,
        rate_limit_tpm: configuration.rate_limit_tpm,
        daily_quota: configuration.daily_quota,
        monthly_budget_usd: configuration.monthly_budget_usd,
        cost_per_1k_input_tokens: configuration.cost_per_1k_input_tokens,
        cost_per_1k_output_tokens: configuration.cost_per_1k_output_tokens,
        cost_per_request: configuration.cost_per_request,
        is_active: configuration.is_active,
        is_public: configuration.is_public,
        priority: configuration.priority,
        custom_headers: configuration.custom_headers,
        provider_settings: configuration.provider_settings
      };

      setFormData(initialData);
      
      // Set up available models text display
      setAvailableModelsText((configuration.available_models || []).join(', '));
      
      // Reset modification tracking
      setModifiedFields(new Set());
      setApiKeyChanged(false);
      setShowApiKey(false);
      
      // Find provider info
      const providerData = providerInfo.find(p => p.value === configuration.provider);
      setSelectedProviderInfo(providerData || null);
    }
  }, [configuration, providerInfo]);

  /**
   * Reset form when modal opens/closes
   */
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setShowAdvanced(false);
    }
  }, [isOpen]);

  // =============================================================================
  // FORM VALIDATION
  // =============================================================================

  /**
   * Validate form data before submission
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Only validate modified fields that have required constraints
    if (modifiedFields.has('name') && !formData.name?.trim()) {
      newErrors.name = 'Configuration name is required';
    }

    if (modifiedFields.has('api_key') && !formData.api_key?.trim()) {
      newErrors.api_key = 'API key cannot be empty';
    }

    if (modifiedFields.has('api_endpoint') && !formData.api_endpoint?.trim()) {
      newErrors.api_endpoint = 'API endpoint is required';
    }

    if (modifiedFields.has('default_model') && !formData.default_model?.trim()) {
      newErrors.default_model = 'Default model is required';
    }

    // Numeric field validation
    if (modifiedFields.has('rate_limit_rpm') && formData.rate_limit_rpm !== undefined && formData.rate_limit_rpm < 1) {
      newErrors.rate_limit_rpm = 'Rate limit must be at least 1 request per minute';
    }

    if (modifiedFields.has('rate_limit_tpm') && formData.rate_limit_tpm !== undefined && formData.rate_limit_tpm < 100) {
      newErrors.rate_limit_tpm = 'Token limit must be at least 100 tokens per minute';
    }

    if (modifiedFields.has('priority') && formData.priority !== undefined && (formData.priority < 1 || formData.priority > 100)) {
      newErrors.priority = 'Priority must be between 1 and 100';
    }

    // Cost validation
    if (modifiedFields.has('cost_per_1k_input_tokens') && formData.cost_per_1k_input_tokens !== undefined && formData.cost_per_1k_input_tokens < 0) {
      newErrors.cost_per_1k_input_tokens = 'Cost cannot be negative';
    }

    if (modifiedFields.has('cost_per_1k_output_tokens') && formData.cost_per_1k_output_tokens !== undefined && formData.cost_per_1k_output_tokens < 0) {
      newErrors.cost_per_1k_output_tokens = 'Cost cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle form field changes with modification tracking
   */
  const handleFieldChange = (field: keyof LLMConfigurationUpdate, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Track that this field has been modified
    setModifiedFields(prev => new Set([...prev, field]));

    // Special handling for API key
    if (field === 'api_key') {
      setApiKeyChanged(true);
    }

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * Handle available models text change (convert to array)
   */
  const handleAvailableModelsChange = (text: string) => {
    setAvailableModelsText(text);
    
    // Convert comma-separated text to array
    const models = text
      .split(',')
      .map(model => model.trim())
      .filter(model => model.length > 0);
    
    handleFieldChange('available_models', models);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!configuration) {
      setErrors({ general: 'No configuration selected for editing' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      // Only include modified fields in the update
      const updateData: LLMConfigurationUpdate = {};
      
      modifiedFields.forEach(field => {
        if (formData[field as keyof LLMConfigurationUpdate] !== undefined) {
          (updateData as any)[field] = formData[field as keyof LLMConfigurationUpdate];
        }
      });

      // Only include API key if it was actually changed
      if (apiKeyChanged && formData.api_key) {
        updateData.api_key = formData.api_key;
      }

      console.log('📝 Submitting update with modified fields:', Object.keys(updateData));

      await onSubmit(configuration.id, updateData);
    } catch (error) {
      console.error('Form submission error:', error);
      
      if (error instanceof LLMConfigError) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Failed to update configuration. Please try again.' });
      }
    }
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render form field with error handling and modification tracking
   */
  const renderFormField = (
    label: string,
    field: keyof LLMConfigurationUpdate,
    type: 'text' | 'number' | 'password' | 'textarea' | 'select',
    options?: { value: any; label: string }[],
    placeholder?: string,
    required?: boolean
  ) => {
    const error = errors[field];
    const value = formData[field];
    const isModified = modifiedFields.has(field);

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          {isModified && <span className="text-blue-500 ml-1">●</span>}
        </label>
        
        {field === 'api_key' ? (
          // Special handling for API key field
          <div className="space-y-2">
            {!showApiKey ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value="••••••••••••••••••••••••••••••••"
                  disabled
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(true)}
                  className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50"
                >
                  Change API Key
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  value={value as string || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  placeholder="Enter new API key..."
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowApiKey(false);
                      setApiKeyChanged(false);
                      setFormData(prev => ({ ...prev, api_key: undefined }));
                      setModifiedFields(prev => {
                        const newSet = new Set(prev);
                        newSet.delete('api_key');
                        return newSet;
                      });
                    }}
                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <span className="text-xs text-gray-500 py-1">Leave empty to keep current API key</span>
                </div>
              </div>
            )}
          </div>
        ) : type === 'textarea' ? (
          <textarea
            value={value as string || ''}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        ) : type === 'select' ? (
          <select
            value={value as string || ''}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            {options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={value as string || ''}
            onChange={(e) => {
              const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
              handleFieldChange(field, newValue);
            }}
            placeholder={placeholder}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        )}
        
        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}
      </div>
    );
  };

  /**
   * Render checkbox field with modification tracking
   */
  const renderCheckboxField = (
    label: string,
    field: keyof LLMConfigurationUpdate,
    description?: string
  ) => {
    const value = formData[field] as boolean;
    const isModified = modifiedFields.has(field);

    return (
      <div className="mb-4">
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => handleFieldChange(field, e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 mt-1"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">
              {label}
              {isModified && <span className="text-blue-500 ml-1">●</span>}
            </span>
            {description && (
              <p className="text-sm text-gray-500">{description}</p>
            )}
          </div>
        </label>
      </div>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  if (!isOpen || !configuration) return null;

  const providerOptions = providerInfo.map(provider => ({
    value: provider.value,
    label: provider.name
  }));

  const modifiedCount = modifiedFields.size;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Edit LLM Configuration
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Modify the settings for "{configuration.name}"
              </p>
              {modifiedCount > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  {modifiedCount} field{modifiedCount !== 1 ? 's' : ''} modified
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Basic Configuration */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFormField(
                'Configuration Name',
                'name',
                'text',
                undefined,
                'e.g., "OpenAI GPT-4 Production"',
                true
              )}

              {renderFormField(
                'Provider',
                'provider',
                'select',
                providerOptions,
                undefined,
                true
              )}
            </div>

            {renderFormField(
              'Description',
              'description',
              'textarea',
              undefined,
              'Brief description of this configuration...'
            )}
          </div>

          {/* Provider Configuration */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Provider Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFormField(
                'API Endpoint',
                'api_endpoint',
                'text',
                undefined,
                'https://api.openai.com/v1',
                true
              )}

              {renderFormField(
                'API Version',
                'api_version',
                'text',
                undefined,
                'v1, 2023-05-15, etc.'
              )}
            </div>

            {renderFormField(
              'API Key',
              'api_key',
              'password',
              undefined,
              'Your API key (will be encrypted)',
              false
            )}
          </div>

          {/* Model Configuration */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Model Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFormField(
                'Default Model',
                'default_model',
                'text',
                undefined,
                'gpt-4, claude-3-sonnet, etc.',
                true
              )}

              {renderFormField(
                'Priority',
                'priority',
                'number',
                undefined,
                '1 (highest) to 100 (lowest)'
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Available Models
                {modifiedFields.has('available_models') && <span className="text-blue-500 ml-1">●</span>}
              </label>
              <textarea
                value={availableModelsText}
                onChange={(e) => handleAvailableModelsChange(e.target.value)}
                placeholder="gpt-4, gpt-3.5-turbo, gpt-4-turbo (comma-separated)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                List all models available through this provider, separated by commas
              </p>
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              <svg 
                className={`w-4 h-4 mr-2 transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Settings
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4">
                {/* Rate Limits */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Rate Limits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderFormField(
                      'Requests per Minute',
                      'rate_limit_rpm',
                      'number',
                      undefined,
                      '60'
                    )}

                    {renderFormField(
                      'Tokens per Minute',
                      'rate_limit_tpm',
                      'number',
                      undefined,
                      '10000'
                    )}
                  </div>
                </div>

                {/* Cost Configuration */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Cost Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderFormField(
                      'Cost per 1K Input Tokens ($)',
                      'cost_per_1k_input_tokens',
                      'number',
                      undefined,
                      '0.0015'
                    )}

                    {renderFormField(
                      'Cost per 1K Output Tokens ($)',
                      'cost_per_1k_output_tokens',
                      'number',
                      undefined,
                      '0.002'
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderFormField(
                      'Daily Quota (requests)',
                      'daily_quota',
                      'number',
                      undefined,
                      'Leave empty for unlimited'
                    )}

                    {renderFormField(
                      'Monthly Budget ($)',
                      'monthly_budget_usd',
                      'number',
                      undefined,
                      'Leave empty for unlimited'
                    )}
                  </div>
                </div>

                {/* Access Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Access Settings</h4>
                  
                  {renderCheckboxField(
                    'Active',
                    'is_active',
                    'Enable this configuration for use'
                  )}

                  {renderCheckboxField(
                    'Public',
                    'is_public',
                    'Make available to all users (unchecked = admin only)'
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || modifiedCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSubmitting ? 'Updating...' : modifiedCount === 0 ? 'No Changes' : `Update Configuration (${modifiedCount} changes)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LLMEditModal;