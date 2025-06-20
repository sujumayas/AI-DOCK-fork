// 🤖 Simplified LLM Configuration Create Modal Component
// This is the NEW user-friendly approach - only 4 fields needed!
// 
// Learning: This demonstrates progressive disclosure - hiding complexity
// from users while maintaining full functionality underneath.

import React, { useState } from 'react';

interface LLMProviderInfo {
  value: string;
  name: string;
  description: string;
  default_endpoint?: string;
}

interface LLMSimpleCreateData {
  provider: string;
  name: string;
  api_key: string;
  description?: string;
}

interface LLMSimpleCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (configData: LLMSimpleCreateData) => Promise<void>;
  providerInfo: LLMProviderInfo[];
  isSubmitting: boolean;
}

/**
 * Simplified LLM Configuration Create Modal
 * 
 * This component shows how progressive disclosure works:
 * - Users only see 4 essential fields
 * - Smart defaults handle everything else
 * - Advanced options are available separately for power users
 */
const LLMSimpleCreateModal: React.FC<LLMSimpleCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  providerInfo,
  isSubmitting
}) => {
  // =============================================================================
  // SIMPLIFIED FORM STATE (Only 4 fields!)
  // =============================================================================

  const [formData, setFormData] = useState<LLMSimpleCreateData>({
    provider: 'openai',
    name: '',
    api_key: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // =============================================================================
  // SMART PROVIDER HINTS (Help users with context)
  // =============================================================================

  const getProviderHints = (provider: string) => {
    const hints = {
      openai: {
        apiKeyHint: "Starts with 'sk-' and is about 51 characters long",
        endpoint: "https://api.openai.com/v1",
        models: "GPT-4, GPT-4 Turbo, GPT-3.5 Turbo",
        docs: "https://platform.openai.com/docs"
      },
      anthropic: {
        apiKeyHint: "Starts with 'sk-ant-' from your Anthropic Console",
        endpoint: "https://api.anthropic.com",
        models: "Claude-3 Opus, Sonnet, Haiku",
        docs: "https://docs.anthropic.com"
      },
      google: {
        apiKeyHint: "Google AI Studio API key",
        endpoint: "https://generativelanguage.googleapis.com",
        models: "Gemini 1.5 Pro, Gemini Pro",
        docs: "https://ai.google.dev"
      },
      mistral: {
        apiKeyHint: "Mistral API key from your dashboard",
        endpoint: "https://api.mistral.ai",
        models: "Mistral Large, Medium, Small",
        docs: "https://docs.mistral.ai"
      },
      azure_openai: {
        apiKeyHint: "Azure OpenAI API key from Azure Portal",
        endpoint: "https://your-resource.openai.azure.com",
        models: "GPT-4, GPT-35-Turbo (deployed models)",
        docs: "https://docs.microsoft.com/azure/cognitive-services/openai/"
      }
    };

    return hints[provider as keyof typeof hints] || {
      apiKeyHint: "API key for your custom provider",
      endpoint: "Your custom endpoint URL",
      models: "Your available models",
      docs: "#"
    };
  };

  // =============================================================================
  // FORM VALIDATION (Simple but effective)
  // =============================================================================

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Configuration name is required';
    }

    if (!formData.api_key.trim()) {
      newErrors.api_key = 'API key is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  const handleFieldChange = (field: keyof LLMSimpleCreateData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors({ general: 'Failed to create configuration. Please try again.' });
    }
  };

  const handleClose = () => {
    setFormData({
      provider: 'openai',
      name: '',
      api_key: '',
      description: ''
    });
    setErrors({});
    onClose();
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const selectedProvider = providerInfo.find(p => p.value === formData.provider);
  const hints = getProviderHints(formData.provider);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Add AI Provider
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Just 4 fields needed - we'll handle the rest! 🚀
              </p>
            </div>
            <button
              onClick={handleClose}
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

          {/* 1. Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Provider *
            </label>
            <select
              value={formData.provider}
              onChange={(e) => handleFieldChange('provider', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {providerInfo.map(provider => (
                <option key={provider.value} value={provider.value}>
                  {provider.name}
                </option>
              ))}
            </select>
            
            {/* Provider Info Card */}
            {selectedProvider && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 text-sm font-medium">
                  {selectedProvider.name}
                </p>
                <p className="text-blue-700 text-sm mt-1">
                  {selectedProvider.description}
                </p>
                <div className="mt-2 text-xs text-blue-600">
                  <div>🔗 Endpoint: {hints.endpoint}</div>
                  <div>🤖 Models: {hints.models}</div>
                  <div>📚 <a href={hints.docs} target="_blank" rel="noopener noreferrer" className="underline">Documentation</a></div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Configuration Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuration Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="e.g., OpenAI Production, Claude Team, etc."
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">
              Give this configuration a memorable name for your team
            </p>
          </div>

          {/* 3. API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key *
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => handleFieldChange('api_key', e.target.value)}
              placeholder="Paste your API key here"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.api_key ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.api_key && (
              <p className="text-red-500 text-sm mt-1">{errors.api_key}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">
              💡 {hints.apiKeyHint}
            </p>
          </div>

          {/* 4. Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Brief description of when to use this configuration..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-gray-500 text-sm mt-1">
              Help your team understand when to use this configuration
            </p>
          </div>

          {/* Smart Defaults Notice */}
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <h4 className="text-green-800 text-sm font-medium">✨ Smart Defaults Applied</h4>
            <p className="text-green-700 text-sm mt-1">
              We'll automatically configure API endpoints, rate limits, cost tracking, 
              and model settings based on {selectedProvider?.name || 'your provider'} best practices.
            </p>
            <p className="text-green-600 text-xs mt-2">
              You can always adjust these settings later in the advanced configuration.
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isSubmitting && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSubmitting ? 'Creating...' : 'Create Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LLMSimpleCreateModal;
