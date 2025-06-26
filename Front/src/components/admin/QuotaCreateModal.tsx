// 🎯 Quota Creation Modal
// Complete form for creating new department quotas

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { quotaService } from '../../services/quotaService';
import { departmentService, DepartmentDropdownOption } from '../../services/departmentService';
import { 
  QuotaCreateRequest, 
  QuotaFormState, 
  QuotaFormErrors,
  DepartmentOption, 
  LLMConfigOption,
  QuotaType,
  QuotaPeriod,
  QUOTA_TYPE_OPTIONS,
  QUOTA_PERIOD_OPTIONS
} from '../../types/quota';

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

interface QuotaCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (quota: any) => void; // Called when quota is successfully created
  className?: string;
}

interface ReferenceData {
  departments: DepartmentDropdownOption[];
  llmConfigs: LLMConfigOption[];
  loading: boolean;
  error: string | null;
}

// =============================================================================
// MAIN QUOTA CREATE MODAL COMPONENT
// =============================================================================

/**
 * Quota Create Modal Component
 * 
 * Learning: This demonstrates advanced form patterns including:
 * - Complex validation with real-time feedback
 * - Dependent dropdown selections (department -> LLM config)
 * - Modal UX patterns with proper focus management
 * - Error handling with field-specific messages
 * - Preview calculations and formatting
 */
export function QuotaCreateModal({ isOpen, onClose, onSuccess, className = '' }: QuotaCreateModalProps) {
  
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Form state following our established pattern
  const [formState, setFormState] = useState<QuotaFormState>({
    data: {
      department_id: 0,
      llm_config_id: undefined,
      quota_type: 'cost',
      quota_period: 'monthly',
      limit_value: 1000,
      name: '',
      description: '',
      is_enforced: true,
    },
    errors: {},
    isSubmitting: false,
    isDirty: false,
  });

  // Reference data for dropdowns
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    departments: [],
    llmConfigs: [],
    loading: true,
    error: null,
  });

  // UI state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  /**
   * Load reference data when modal opens
   * 
   * Learning: We only load data when the modal opens to avoid
   * unnecessary API calls when the modal is closed.
   */
  const loadReferenceData = useCallback(async () => {
    if (!isOpen) return;

    try {
      console.log('📚 Loading reference data for quota creation...');
      setReferenceData(prev => ({ ...prev, loading: true, error: null }));

      // Load departments and LLM configs in parallel
      // Use departmentService for dynamic department loading (same as UserCreateModal)
      const [departments, llmConfigs] = await Promise.all([
        departmentService.getDepartmentsForDropdown(),
        quotaService.getLLMConfigs(),
      ]);

      setReferenceData({
        departments,
        llmConfigs,
        loading: false,
        error: null,
      });

      console.log('✅ Reference data loaded:', departments.length, 'departments,', llmConfigs.length, 'LLM configs');

    } catch (error) {
      console.error('❌ Error loading reference data:', error);
      setReferenceData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load reference data',
      }));
    }
  }, [isOpen]);

  // =============================================================================
  // FORM HANDLING
  // =============================================================================

  /**
   * Update form data with validation
   * 
   * Learning: This pattern provides immediate validation feedback
   * as users type, improving the form experience.
   */
  const updateFormData = useCallback((updates: Partial<QuotaCreateRequest>) => {
    setFormState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
      isDirty: true,
      errors: {}, // Clear errors when user makes changes
    }));
  }, []);

  /**
   * Validate form data
   * 
   * Learning: Client-side validation provides immediate feedback,
   * but we should always validate on the server too for security.
   */
  const validateForm = useCallback((): QuotaFormErrors => {
    const { data } = formState;
    const errors: QuotaFormErrors = {};

    // Required field validation
    if (!data.name || data.name.trim().length === 0) {
      errors.name = 'Quota name is required';
    } else if (data.name.length > 200) {
      errors.name = 'Quota name must be 200 characters or less';
    }

    if (!data.department_id || data.department_id <= 0) {
      errors.department_id = 'Please select a department';
    }

    if (!data.quota_type) {
      errors.quota_type = 'Please select a quota type';
    }

    if (!data.quota_period) {
      errors.quota_period = 'Please select a quota period';
    }

    if (!data.limit_value || data.limit_value <= 0) {
      errors.limit_value = 'Quota limit must be greater than 0';
    } else if (data.limit_value > 999999999) {
      errors.limit_value = 'Quota limit is too large';
    }

    // Business logic validation
    if (data.description && data.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }

    // Quota-specific validation
    if (data.quota_type === 'cost' && data.limit_value > 100000) {
      errors.limit_value = 'Cost quotas over $100,000 require additional approval';
    }

    if (data.quota_type === 'tokens' && data.limit_value < 1000) {
      errors.limit_value = 'Token quotas should be at least 1,000 tokens';
    }

    if (data.quota_type === 'requests' && data.limit_value < 10) {
      errors.limit_value = 'Request quotas should be at least 10 requests';
    }

    return errors;
  }, [formState]);

  /**
   * Handle form submission
   * 
   * Learning: Form submission should include validation, loading states,
   * error handling, and success feedback.
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormState(prev => ({ ...prev, errors }));
      return;
    }

    try {
      console.log('🎯 Creating quota:', formState.data);
      setFormState(prev => ({ ...prev, isSubmitting: true, errors: {} }));

      // Create the quota
      const newQuota = await quotaService.createQuota(formState.data);

      console.log('✅ Quota created successfully:', newQuota);

      // Reset form and close modal
      resetForm();
      onSuccess(newQuota);
      onClose();

    } catch (error) {
      console.error('❌ Error creating quota:', error);
      setFormState(prev => ({
        ...prev,
        isSubmitting: false,
        errors: {
          submit: error instanceof Error ? error.message : 'Failed to create quota'
        },
      }));
    }
  }, [formState.data, validateForm, onSuccess, onClose]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormState({
      data: {
        department_id: 0,
        llm_config_id: undefined,
        quota_type: 'cost',
        quota_period: 'monthly',
        limit_value: 1000,
        name: '',
        description: '',
        is_enforced: true,
      },
      errors: {},
      isSubmitting: false,
      isDirty: false,
    });
    setShowAdvancedOptions(false);
  }, []);

  /**
   * Handle modal close with confirmation if form is dirty
   */
  const handleClose = useCallback(() => {
    if (formState.isDirty && !formState.isSubmitting) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close this form?'
      );
      if (!confirmed) return;
    }

    resetForm();
    onClose();
  }, [formState.isDirty, formState.isSubmitting, onClose, resetForm]);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  /**
   * Generate suggested quota name based on selections
   */
  const suggestedName = useMemo(() => {
    const { department_id, quota_type, quota_period, llm_config_id } = formState.data;
    
    if (!department_id || !quota_type || !quota_period) return '';

    const department = referenceData.departments.find(d => d.value === department_id);
    const llmConfig = referenceData.llmConfigs.find(c => c.id === llm_config_id);
    
    const parts = [
      department?.label || 'Department',
      llmConfig?.name || 'All Providers',
      quota_period.charAt(0).toUpperCase() + quota_period.slice(1),
      quota_type.charAt(0).toUpperCase() + quota_type.slice(1)
    ];

    return parts.join(' ') + ' Quota';
  }, [formState.data, referenceData]);

  /**
   * Format preview of the quota limit
   */
  const formattedLimit = useMemo(() => {
    return quotaService.formatQuotaAmount(formState.data.limit_value || 0, formState.data.quota_type);
  }, [formState.data.limit_value, formState.data.quota_type]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Load reference data when modal opens
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Auto-fill quota name if empty
  useEffect(() => {
    if (!formState.data.name && suggestedName && formState.isDirty) {
      updateFormData({ name: suggestedName });
    }
  }, [suggestedName, formState.data.name, formState.isDirty, updateFormData]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render form field with label and error handling
   */
  const renderField = (
    label: string,
    children: React.ReactNode,
    error?: string,
    required: boolean = false,
    description?: string,
    fieldId?: string
  ) => (
    <div className="mb-4">
      <label 
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {description && (
        <p className="text-xs text-gray-500 mb-2">{description}</p>
      )}
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );

  /**
   * Render loading state for reference data
   */
  if (referenceData.loading) {
    return isOpen ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading form data...</p>
          </div>
        </div>
      </div>
    ) : null;
  }

  /**
   * Render error state for reference data
   */
  if (referenceData.error) {
    return isOpen ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-600 text-lg font-medium mb-2">Error Loading Form</div>
            <p className="text-gray-600 mb-4">{referenceData.error}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={loadReferenceData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null;
  }

  // Don't render if modal is not open
  if (!isOpen) return null;

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create New Quota</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              disabled={formState.isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Submit error */}
          {formState.errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{formState.errors.submit}</p>
            </div>
          )}

          {/* Basic quota information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Department selection */}
            {renderField(
              'Department',
              <div>
                {/* Show loading state while departments are being fetched */}
                {referenceData.loading ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    <span className="text-gray-500">Loading departments...</span>
                  </div>
                ) : (
                  <select
                    id="quota-department"
                    name="quota-department"
                    value={formState.data.department_id || ''}
                    onChange={(e) => updateFormData({ department_id: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={formState.isSubmitting}
                    required
                  >
                    <option value="">Select a department</option>
                    {referenceData.departments.map(dept => (
                      <option key={dept.value} value={dept.value}>
                        {dept.label}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Show error state if departments failed to load */}
                {referenceData.error && (
                  <p className="mt-1 text-sm text-amber-600 flex items-center">
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    {referenceData.error}
                  </p>
                )}
                
                {/* Show helpful info if no departments available */}
                {!referenceData.loading && referenceData.departments.length === 0 && !referenceData.error && (
                  <p className="mt-1 text-sm text-blue-600 flex items-center">
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    No departments available. Create departments in the Admin Panel first.
                  </p>
                )}
              </div>,
              formState.errors.department_id,
              true,
              'Choose which department this quota applies to',
              'quota-department'
            )}

            {/* Quota type */}
            {renderField(
              'Quota Type',
              <select
                id="quota-type"
                name="quota-type"
                value={formState.data.quota_type}
                onChange={(e) => updateFormData({ quota_type: e.target.value as QuotaType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={formState.isSubmitting}
                required
              >
                {QUOTA_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label} - {option.description}
                  </option>
                ))}
              </select>,
              formState.errors.quota_type,
              true,
              'What type of usage to limit',
              'quota-type'
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Quota period */}
            {renderField(
              'Reset Period',
              <select
                id="quota-period"
                name="quota-period"
                value={formState.data.quota_period}
                onChange={(e) => updateFormData({ quota_period: e.target.value as QuotaPeriod })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={formState.isSubmitting}
                required
              >
                {QUOTA_PERIOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label} - {option.description}
                  </option>
                ))}
              </select>,
              formState.errors.quota_period,
              true,
              'How often the quota resets',
              'quota-period'
            )}

            {/* Limit value */}
            {renderField(
              'Quota Limit',
              <div className="relative">
                <input
                  id="quota-limit"
                  name="quota-limit"
                  type="number"
                  value={formState.data.limit_value || ''}
                  onChange={(e) => updateFormData({ limit_value: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter limit amount"
                  min="0"
                  step={formState.data.quota_type === 'cost' ? '0.01' : '1'}
                  disabled={formState.isSubmitting}
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 text-sm">
                    {formState.data.quota_type === 'cost' && '$'}
                    {formState.data.quota_type === 'tokens' && 'tokens'}
                    {formState.data.quota_type === 'requests' && 'reqs'}
                  </span>
                </div>
                {formState.data.limit_value > 0 && (
                  <div className="mt-1 text-sm text-gray-600">
                    Preview: {formattedLimit}
                  </div>
                )}
              </div>,
              formState.errors.limit_value,
              true,
              'Maximum usage allowed per period',
              'quota-limit'
            )}
          </div>

          {/* Quota name */}
          {renderField(
            'Quota Name',
            <div>
              <input
                id="quota-name"
                name="quota-name"
                type="text"
                value={formState.data.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a descriptive name for this quota"
                maxLength={200}
                disabled={formState.isSubmitting}
                required
                autoComplete="off"
              />
              {suggestedName && !formState.data.name && (
                <button
                  type="button"
                  onClick={() => updateFormData({ name: suggestedName })}
                  className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  Use suggested: "{suggestedName}"
                </button>
              )}
            </div>,
            formState.errors.name,
            true,
            'A human-readable name for this quota',
            'quota-name'
          )}

          {/* Advanced options toggle */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <svg 
                className={`w-4 h-4 mr-1 transform transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </button>
          </div>

          {/* Advanced options */}
          {showAdvancedOptions && (
            <div className="border-t border-gray-200 pt-4 mb-6">
              {/* LLM provider selection */}
              {renderField(
                'LLM Provider (Optional)',
                <select
                  value={formState.data.llm_config_id || ''}
                  onChange={(e) => updateFormData({ 
                    llm_config_id: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={formState.isSubmitting}
                >
                  <option value="">All LLM Providers</option>
                  {referenceData.llmConfigs.map(config => (
                    <option key={config.id} value={config.id} disabled={!config.is_active}>
                      {config.name} ({config.provider}) {!config.is_active && '(Inactive)'}
                    </option>
                  ))}
                </select>,
                formState.errors.llm_config_id,
                false,
                'Leave empty to apply to all LLM providers'
              )}

              {/* Description */}
              {renderField(
                'Description (Optional)',
                <textarea
                  value={formState.data.description || ''}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description of this quota's purpose..."
                  rows={3}
                  maxLength={500}
                  disabled={formState.isSubmitting}
                />,
                formState.errors.description,
                false,
                'Additional details about this quota'
              )}

              {/* Enforcement toggle */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formState.data.is_enforced}
                    onChange={(e) => updateFormData({ is_enforced: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={formState.isSubmitting}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Enforce quota (block requests when exceeded)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  When enabled, requests will be blocked when the quota is exceeded. 
                  When disabled, quota violations will be logged but not blocked.
                </p>
              </div>
            </div>
          )}

          {/* Form actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              disabled={formState.isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={formState.isSubmitting || Object.keys(validateForm()).length > 0}
            >
              {formState.isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Quota'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuotaCreateModal;
