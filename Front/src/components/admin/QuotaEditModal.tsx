// ✏️ Quota Edit Modal
// Complete form for editing existing department quotas

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { quotaService } from '../../services/quotaService';
import { departmentService, DepartmentDropdownOption } from '../../services/departmentService';
import { 
  QuotaResponse,
  QuotaUpdateRequest, 
  QuotaFormErrors,
  DepartmentOption, 
  LLMConfigOption,
  QuotaPeriod,
  QUOTA_PERIOD_OPTIONS
} from '../../types/quota';

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

interface QuotaEditModalProps {
  isOpen: boolean;
  quota: QuotaResponse | null; // The quota to edit
  onClose: () => void;
  onSuccess: (quota: QuotaResponse) => void; // Called when quota is successfully updated
  className?: string;
}

interface EditFormState {
  data: QuotaUpdateRequest;
  errors: QuotaFormErrors;
  isSubmitting: boolean;
  isDirty: boolean;
}

interface ReferenceData {
  departments: DepartmentDropdownOption[];
  llmConfigs: LLMConfigOption[];
  loading: boolean;
  error: string | null;
}

// =============================================================================
// MAIN QUOTA EDIT MODAL COMPONENT
// =============================================================================

/**
 * Quota Edit Modal Component
 * 
 * Learning: This demonstrates editing patterns including:
 * - Pre-populating forms with existing data
 * - Partial updates (only changed fields)
 * - Handling immutable vs mutable fields
 * - Change tracking and dirty state management
 * - Optimistic updates vs server confirmation
 */
export function QuotaEditModal({ isOpen, quota, onClose, onSuccess, className = '' }: QuotaEditModalProps) {
  
  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Form state for editing (only fields that can be changed)
  const [formState, setFormState] = useState<EditFormState>({
    data: {},
    errors: {},
    isSubmitting: false,
    isDirty: false,
  });

  // Reference data for dropdowns (needed for department/LLM config names)
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    departments: [],
    llmConfigs: [],
    loading: true,
    error: null,
  });

  // UI state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // =============================================================================
  // DATA LOADING AND INITIALIZATION
  // =============================================================================

  /**
   * Load reference data when modal opens
   */
  const loadReferenceData = useCallback(async () => {
    if (!isOpen) return;

    try {
      console.log('📚 Loading reference data for quota editing...');
      setReferenceData(prev => ({ ...prev, loading: true, error: null }));

      // Load departments and LLM configs in parallel
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

      console.log('✅ Reference data loaded for editing');

    } catch (error) {
      console.error('❌ Error loading reference data:', error);
      setReferenceData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load reference data',
      }));
    }
  }, [isOpen]);

  /**
   * Initialize form with quota data
   * 
   * Learning: When editing, we start with the current values
   * but only track fields that the user can actually change.
   */
  const initializeForm = useCallback(() => {
    if (!quota) return;

    console.log('📝 Initializing edit form with quota data:', quota);

    // Set form data with only editable fields
    setFormState({
      data: {
        limit_value: quota.limit_value,
        name: quota.name,
        description: quota.description || '',
        is_enforced: quota.is_enforced,
        quota_period: quota.quota_period as QuotaPeriod,
        // Note: department_id and quota_type are typically not editable after creation
        // llm_config_id could be editable depending on business rules
      },
      errors: {},
      isSubmitting: false,
      isDirty: false,
    });

    // Show advanced options if quota has advanced settings
    if (quota.description || !quota.is_enforced) {
      setShowAdvancedOptions(true);
    }

  }, [quota]);

  // =============================================================================
  // FORM HANDLING
  // =============================================================================

  /**
   * Update form data with validation
   */
  const updateFormData = useCallback((updates: Partial<QuotaUpdateRequest>) => {
    setFormState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
      isDirty: true,
      errors: {}, // Clear errors when user makes changes
    }));
  }, []);

  /**
   * Validate form data for editing
   * 
   * Learning: Edit validation is often different from create validation
   * because some fields may not be editable or have different constraints.
   */
  const validateForm = useCallback((): QuotaFormErrors => {
    const { data } = formState;
    const errors: QuotaFormErrors = {};

    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        errors.name = 'Quota name is required';
      } else if (data.name.length > 200) {
        errors.name = 'Quota name must be 200 characters or less';
      }
    }

    // Validate limit value if provided
    if (data.limit_value !== undefined) {
      if (!data.limit_value || data.limit_value <= 0) {
        errors.limit_value = 'Quota limit must be greater than 0';
      } else if (data.limit_value > 999999999) {
        errors.limit_value = 'Quota limit is too large';
      }
    }

    // Validate description if provided
    if (data.description !== undefined && data.description && data.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }

    // Business logic validation based on original quota
    if (quota && data.limit_value !== undefined) {
      if (quota.quota_type === 'cost' && data.limit_value > 100000) {
        errors.limit_value = 'Cost quotas over $100,000 require additional approval';
      }

      if (quota.quota_type === 'tokens' && data.limit_value < 1000) {
        errors.limit_value = 'Token quotas should be at least 1,000 tokens';
      }

      if (quota.quota_type === 'requests' && data.limit_value < 10) {
        errors.limit_value = 'Request quotas should be at least 10 requests';
      }

      // Warn if reducing limit below current usage
      if (data.limit_value < quota.current_usage) {
        errors.limit_value = `Warning: New limit is below current usage (${quotaService.formatQuotaAmount(quota.current_usage, quota.quota_type)})`;
      }
    }

    return errors;
  }, [formState, quota]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quota) return;

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormState(prev => ({ ...prev, errors }));
      return;
    }

    try {
      console.log('✏️ Updating quota:', quota.id, formState.data);
      setFormState(prev => ({ ...prev, isSubmitting: true, errors: {} }));

      // Only send changed fields (exclude undefined values)
      const updateData = Object.fromEntries(
        Object.entries(formState.data).filter(([_, value]) => value !== undefined)
      ) as QuotaUpdateRequest;

      // Update the quota
      const updatedQuota = await quotaService.updateQuota(quota.id, updateData);

      console.log('✅ Quota updated successfully:', updatedQuota);

      // Reset form and close modal
      resetForm();
      onSuccess(updatedQuota);
      onClose();

    } catch (error) {
      console.error('❌ Error updating quota:', error);
      setFormState(prev => ({
        ...prev,
        isSubmitting: false,
        errors: {
          submit: error instanceof Error ? error.message : 'Failed to update quota'
        },
      }));
    }
  }, [quota, formState.data, validateForm, onSuccess, onClose]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormState({
      data: {},
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
   * Get current form values (combining original quota data with form changes)
   */
  const currentValues = useMemo(() => {
    if (!quota) return null;

    return {
      ...quota,
      ...formState.data, // Form changes override original values
    };
  }, [quota, formState.data]);

  /**
   * Format preview of the quota limit
   */
  const formattedLimit = useMemo(() => {
    if (!currentValues || currentValues.limit_value === undefined) return '';
    return quotaService.formatQuotaAmount(currentValues.limit_value, quota?.quota_type || 'cost');
  }, [currentValues, quota]);

  /**
   * Check if form has actual changes
   */
  const hasChanges = useMemo(() => {
    return Object.keys(formState.data).some(key => {
      const formValue = formState.data[key as keyof QuotaUpdateRequest];
      const originalValue = quota?.[key as keyof QuotaResponse];
      return formValue !== originalValue;
    });
  }, [formState.data, quota]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Load reference data when modal opens
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Initialize form when quota changes
  useEffect(() => {
    if (isOpen && quota) {
      initializeForm();
    }
  }, [isOpen, quota, initializeForm]);

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
    description?: string
  ) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
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
   * Render immutable field (shows value but can't be edited)
   */
  const renderImmutableField = (label: string, value: string, description?: string) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {description && (
        <p className="text-xs text-gray-500 mb-2">{description}</p>
      )}
      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
        {value}
      </div>
      <p className="text-xs text-gray-500 mt-1">This field cannot be changed after quota creation</p>
    </div>
  );

  // Don't render if modal is not open or no quota provided
  if (!isOpen || !quota) return null;

  /**
   * Render loading state for reference data
   */
  if (referenceData.loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading form data...</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render error state for reference data
   */
  if (referenceData.error) {
    return (
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
    );
  }

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Quota</h2>
              <p className="text-sm text-gray-600 mt-1">
                {quota.name} • {quota.department_name}
              </p>
            </div>
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

          {/* Current quota status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Current Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Usage</div>
                <div className="font-medium">{quotaService.formatUsagePercentage(quota)}</div>
              </div>
              <div>
                <div className="text-gray-600">Current</div>
                <div className="font-medium">{quotaService.formatQuotaAmount(quota.current_usage, quota.quota_type)}</div>
              </div>
              <div>
                <div className="text-gray-600">Limit</div>
                <div className="font-medium">{quotaService.formatQuotaAmount(quota.limit_value, quota.quota_type)}</div>
              </div>
              <div>
                <div className="text-gray-600">Status</div>
                <div className={`font-medium ${quotaService.getStatusColor(quota)}`}>
                  {quotaService.getStatusIcon(quota)} {quota.is_exceeded ? 'Exceeded' : quota.is_near_limit ? 'Near Limit' : 'Healthy'}
                </div>
              </div>
            </div>
          </div>

          {/* Immutable fields (for reference) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {renderImmutableField(
              'Department',
              quota.department_name || `Department ${quota.department_id}`,
              'Department cannot be changed after quota creation'
            )}

            {renderImmutableField(
              'Quota Type',
              `${quota.quota_type.charAt(0).toUpperCase() + quota.quota_type.slice(1)} ${quota.quota_type === 'cost' ? '($)' : quota.quota_type === 'tokens' ? '(tokens)' : '(requests)'}`,
              'Quota type cannot be changed after creation'
            )}
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Quota name */}
            {renderField(
              'Quota Name',
              <input
                type="text"
                value={currentValues?.name || ''}
                onChange={(e) => updateFormData({ name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a descriptive name for this quota"
                maxLength={200}
                disabled={formState.isSubmitting}
                required
              />,
              formState.errors.name,
              true,
              'A human-readable name for this quota'
            )}

            {/* Limit value */}
            {renderField(
              'Quota Limit',
              <div className="relative">
                <input
                  type="number"
                  value={currentValues?.limit_value || ''}
                  onChange={(e) => updateFormData({ limit_value: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter limit amount"
                  min="0"
                  step={quota.quota_type === 'cost' ? '0.01' : '1'}
                  disabled={formState.isSubmitting}
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500 text-sm">
                    {quota.quota_type === 'cost' && '$'}
                    {quota.quota_type === 'tokens' && 'tokens'}
                    {quota.quota_type === 'requests' && 'reqs'}
                  </span>
                </div>
                {currentValues?.limit_value && currentValues.limit_value > 0 && (
                  <div className="mt-1 text-sm text-gray-600">
                    Preview: {formattedLimit}
                  </div>
                )}
              </div>,
              formState.errors.limit_value,
              true,
              'Maximum usage allowed per period'
            )}
          </div>

          {/* Reset period */}
          {renderField(
            'Reset Period',
            <select
              value={currentValues?.quota_period || quota.quota_period}
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
            'How often the quota resets'
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
              {/* LLM provider (immutable for now) */}
              {renderImmutableField(
                'LLM Provider',
                quota.llm_config_name || 'All Providers',
                'LLM provider cannot be changed after quota creation'
              )}

              {/* Description */}
              {renderField(
                'Description (Optional)',
                <textarea
                  value={currentValues?.description || ''}
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
                    checked={currentValues?.is_enforced ?? quota.is_enforced}
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
              disabled={formState.isSubmitting || !hasChanges || Object.keys(validateForm()).length > 0}
            >
              {formState.isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                'Update Quota'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuotaEditModal;
