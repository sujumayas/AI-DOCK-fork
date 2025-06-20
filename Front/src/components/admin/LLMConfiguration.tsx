// 🤖 LLM Configuration Management Component
// This component provides a complete interface for managing LLM provider configurations
// 
// Learning: This demonstrates advanced React patterns:
// - Complex form handling with validation
// - Table management with actions
// - Modal patterns for create/edit
// - Async operations with loading states
// - Error handling and user feedback

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  llmConfigService,
  LLMConfigurationSummary,
  LLMConfigurationResponse,
  LLMConfigurationCreate,
  LLMConfigurationSimpleCreate,
  LLMConfigurationUpdate,
  LLMProviderInfo,
  LLMProvider,
  LLMConfigError
} from '../../services/llmConfigService';
import LLMCreateModal from './LLMCreateModal';
import LLMSimpleCreateModal from './LLMSimpleCreateModal';
import LLMEditModal from './LLMEditModal';
import LLMDeleteModal from './LLMDeleteModal';

/**
 * LLM Configuration Management Component
 * 
 * This is the main component that admins use to manage LLM provider configurations.
 * It handles the full CRUD lifecycle and provides a comprehensive admin interface.
 */
const LLMConfiguration: React.FC = () => {
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Data state
  const [configurations, setConfigurations] = useState<LLMConfigurationSummary[]>([]);
  const [providerInfo, setProviderInfo] = useState<LLMProviderInfo[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<LLMConfigurationResponse | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSimpleCreateModal, setShowSimpleCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  /**
   * Memoized statistics for the header
   */
  const statistics = useMemo(() => {
    const total = configurations.length;
    const active = configurations.filter(c => c.is_active).length;
    const inactive = total - active;
    const providers = new Set(configurations.map(c => c.provider)).size;

    return { total, active, inactive, providers };
  }, [configurations]);

  /**
   * Memoized provider options for forms
   */
  const providerOptions = useMemo(() => {
    return providerInfo.map(provider => ({
      value: provider.value,
      label: provider.name,
      description: provider.description
    }));
  }, [providerInfo]);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  /**
   * Load all LLM configurations from the API
   */
  const loadConfigurations = useCallback(async () => {
    try {
      console.log('🔄 Loading LLM configurations...');
      setError(null);
      
      const configs = await llmConfigService.getConfigurations(includeInactive);
      setConfigurations(configs);
      
      console.log(`✅ Loaded ${configs.length} configurations`);
    } catch (err) {
      console.error('❌ Failed to load configurations:', err);
      setError(err instanceof LLMConfigError ? err.message : 'Failed to load configurations');
    }
  }, [includeInactive]);

  /**
   * Load provider information for dropdowns
   */
  const loadProviderInfo = useCallback(async () => {
    try {
      const providers = await llmConfigService.getProviderInfo();
      setProviderInfo(providers);
      console.log(`✅ Loaded ${providers.length} provider types`);
    } catch (err) {
      console.error('❌ Failed to load provider info:', err);
      // Don't set error state for this - provider info is secondary
    }
  }, []);

  /**
   * Initialize component data
   */
  const initializeData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Load both configurations and provider info in parallel
      await Promise.all([
        loadConfigurations(),
        loadProviderInfo()
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [loadConfigurations, loadProviderInfo]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Load data when component mounts or includeInactive changes
   */
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  /**
   * Reload configurations when includeInactive filter changes
   */
  useEffect(() => {
    if (!isLoading) {
      loadConfigurations();
    }
  }, [includeInactive, loadConfigurations, isLoading]);

  // =============================================================================
  // CRUD OPERATIONS
  // =============================================================================

  /**
   * Create a new LLM configuration (advanced)
   */
  const handleCreate = useCallback(async (configData: LLMConfigurationCreate) => {
    setIsSubmitting(true);
    try {
      console.log('➕ Creating configuration (advanced):', configData.name);
      
      const newConfig = await llmConfigService.createConfiguration(configData);
      
      // Reload the list to show the new configuration
      await loadConfigurations();
      
      setShowCreateModal(false);
      console.log(`✅ Created configuration: ${newConfig.name}`);
      
    } catch (err) {
      console.error('❌ Failed to create configuration:', err);
      throw err; // Let the form handle the error display
    } finally {
      setIsSubmitting(false);
    }
  }, [loadConfigurations]);

  /**
   * Create a new LLM configuration (simplified)
   */
  const handleSimpleCreate = useCallback(async (simpleConfigData: LLMConfigurationSimpleCreate) => {
    setIsSubmitting(true);
    try {
      console.log('✨ Creating configuration (simplified):', simpleConfigData.name);
      
      const newConfig = await llmConfigService.createSimpleConfiguration(simpleConfigData);
      
      // Reload the list to show the new configuration
      await loadConfigurations();
      
      setShowSimpleCreateModal(false);
      console.log(`✅ Created configuration with smart defaults: ${newConfig.name}`);
      
    } catch (err) {
      console.error('❌ Failed to create simplified configuration:', err);
      throw err; // Let the form handle the error display
    } finally {
      setIsSubmitting(false);
    }
  }, [loadConfigurations]);

  /**
   * Update an existing LLM configuration
   */
  const handleUpdate = useCallback(async (configId: number, updateData: LLMConfigurationUpdate) => {
    setIsSubmitting(true);
    try {
      console.log(`✏️ Updating configuration ${configId}`);
      
      const updatedConfig = await llmConfigService.updateConfiguration(configId, updateData);
      
      // Reload the list to show updated data
      await loadConfigurations();
      
      setShowEditModal(false);
      setSelectedConfig(null);
      console.log(`✅ Updated configuration: ${updatedConfig.name}`);
      
    } catch (err) {
      console.error('❌ Failed to update configuration:', err);
      throw err; // Let the form handle the error display
    } finally {
      setIsSubmitting(false);
    }
  }, [loadConfigurations]);

  /**
   * Delete an LLM configuration
   */
  const handleDelete = useCallback(async (configId: number) => {
    setIsSubmitting(true);
    try {
      console.log(`🗑️ Deleting configuration ${configId}`);
      
      await llmConfigService.deleteConfiguration(configId);
      
      // Reload the list
      await loadConfigurations();
      
      setShowDeleteConfirm(false);
      setSelectedConfig(null);
      console.log(`✅ Deleted configuration ${configId}`);
      
    } catch (err) {
      console.error('❌ Failed to delete configuration:', err);
      setError(err instanceof LLMConfigError ? err.message : 'Failed to delete configuration');
    } finally {
      setIsSubmitting(false);
    }
  }, [loadConfigurations]);

  /**
   * Toggle configuration active status
   */
  const handleToggleActive = useCallback(async (configId: number) => {
    try {
      console.log(`🔄 Toggling configuration ${configId}`);
      
      await llmConfigService.toggleConfiguration(configId);
      
      // Reload the list to show updated status
      await loadConfigurations();
      
      console.log(`✅ Toggled configuration ${configId}`);
      
    } catch (err) {
      console.error('❌ Failed to toggle configuration:', err);
      setError(err instanceof LLMConfigError ? err.message : 'Failed to toggle configuration');
    }
  }, [loadConfigurations]);

  /**
   * Test configuration connectivity
   */
  const handleTestConfiguration = useCallback(async (configId: number) => {
    setIsTesting(true);
    try {
      console.log(`🧪 Testing configuration ${configId}`);
      
      const testResult = await llmConfigService.testConfiguration(configId);
      
      // Show test result (you could display this in a modal or notification)
      if (testResult.success) {
        console.log(`✅ Test successful:`, testResult);
        alert(`✅ Test Successful!\n\nProvider: ${testResult.message}\nResponse time: ${testResult.response_time_ms}ms`);
      } else {
        console.log(`❌ Test failed:`, testResult);
        alert(`❌ Test Failed!\n\n${testResult.message}`);
      }
      
      // Reload to update last tested timestamp
      await loadConfigurations();
      
    } catch (err) {
      console.error('❌ Test failed:', err);
      alert(`❌ Test Error!\n\n${err instanceof LLMConfigError ? err.message : 'Test failed'}`);
    } finally {
      setIsTesting(false);
    }
  }, [loadConfigurations]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle editing a configuration
   */
  const handleEditClick = useCallback(async (config: LLMConfigurationSummary) => {
    try {
      console.log(`📄 Loading details for configuration ${config.id}`);
      
      // Load full configuration details for editing
      const fullConfig = await llmConfigService.getConfiguration(config.id);
      setSelectedConfig(fullConfig);
      setShowEditModal(true);
      
    } catch (err) {
      console.error('❌ Failed to load configuration details:', err);
      setError(err instanceof LLMConfigError ? err.message : 'Failed to load configuration details');
    }
  }, []);

  /**
   * Handle delete confirmation
   */
  const handleDeleteClick = useCallback((config: LLMConfigurationSummary) => {
    setSelectedConfig(config as LLMConfigurationResponse);
    setShowDeleteConfirm(true);
  }, []);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading LLM configurations...</p>
      </div>
    </div>
  );

  /**
   * Render error state
   */
  const renderError = () => (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Error Loading Configurations</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <div className="mt-4">
            <button
              onClick={() => {
                setError(null);
                initializeData();
              }}
              className="bg-red-100 hover:bg-red-200 text-red-800 font-medium py-1 px-3 rounded text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * Render header with statistics and controls
   */
  const renderHeader = () => (
    <div className="mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">LLM Provider Configurations</h2>
          <p className="text-blue-100 mt-1">
            Manage API connections to different LLM providers (OpenAI, Claude, etc.)
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* Simple Create Button (Primary) */}
          <button
            onClick={() => setShowSimpleCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Provider
          </button>
          
          {/* Advanced Create Button (Secondary) */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-md flex items-center gap-2 transition-colors border border-white/30"
            title="Advanced configuration with all options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Advanced
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 border border-white/20">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Total Configurations</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Active</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Inactive</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.inactive}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Providers</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.providers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-blue-100">Show inactive configurations</span>
        </label>
      </div>
    </div>
  );

  /**
   * Render status badge
   */
  const renderStatusBadge = (isActive: boolean) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      isActive
        ? 'bg-green-100 text-green-800'
        : 'bg-gray-100 text-gray-800'
    }`}>
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${
        isActive ? 'bg-green-400' : 'bg-gray-400'
      }`}></span>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );

  /**
   * Render provider badge
   */
  const renderProviderBadge = (provider: LLMProvider, providerName: string) => {
    const providerColors: Record<LLMProvider, string> = {
      openai: 'bg-blue-100 text-blue-800',
      anthropic: 'bg-orange-100 text-orange-800',
      google: 'bg-red-100 text-red-800',
      mistral: 'bg-purple-100 text-purple-800',
      cohere: 'bg-green-100 text-green-800',
      huggingface: 'bg-yellow-100 text-yellow-800',
      azure_openai: 'bg-indigo-100 text-indigo-800',
      custom: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        providerColors[provider] || 'bg-gray-100 text-gray-800'
      }`}>
        {providerName}
      </span>
    );
  };

  /**
   * Render configurations table
   */
  const renderConfigurationsTable = () => {
    if (configurations.length === 0) {
      return (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-white">No LLM configurations</h3>
          <p className="mt-1 text-sm text-blue-200">
            Get started by adding your first LLM provider configuration.
          </p>
          <div className="mt-6">
          <button
          onClick={() => setShowSimpleCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
          Add Provider
          </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white/95 backdrop-blur-sm shadow-2xl overflow-hidden rounded-2xl border border-white/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Configuration
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {configurations.map((config) => (
                <tr key={config.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {config.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Priority: {config.priority}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderProviderBadge(config.provider, config.provider_name)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {config.default_model}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderStatusBadge(config.is_active)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {llmConfigService.formatCurrency(config.estimated_cost_per_request)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {/* Test button */}
                      <button
                        onClick={() => handleTestConfiguration(config.id)}
                        disabled={isTesting || !config.is_active}
                        className="text-purple-600 hover:text-purple-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Test connectivity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </button>

                      {/* Toggle active button */}
                      <button
                        onClick={() => handleToggleActive(config.id)}
                        className={`${config.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        title={config.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {config.is_active ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => handleEditClick(config)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit configuration"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteClick(config)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete configuration"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {renderHeader()}
      
      {error && renderError()}
      
      {isLoading ? renderLoading() : renderConfigurationsTable()}
      
      {/* Simplified Create Configuration Modal (PRIMARY) */}
      <LLMSimpleCreateModal
        isOpen={showSimpleCreateModal}
        onClose={() => setShowSimpleCreateModal(false)}
        onSubmit={handleSimpleCreate}
        providerInfo={providerInfo}
        isSubmitting={isSubmitting}
      />

      {/* Advanced Create Configuration Modal (SECONDARY) */}
      <LLMCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        providerInfo={providerInfo}
        isSubmitting={isSubmitting}
      />

      {/* Edit Configuration Modal */}
      <LLMEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedConfig(null);
        }}
        onSubmit={handleUpdate}
        configuration={selectedConfig}
        providerInfo={providerInfo}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation Modal */}
      <LLMDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedConfig(null);
        }}
        onConfirm={() => handleDelete(selectedConfig?.id!)}
        configuration={selectedConfig}
        isDeleting={isSubmitting}
      />
    </div>
  );
};

export default LLMConfiguration;