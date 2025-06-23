// ✏️ Assistant Edit Modal
// Modal component for editing existing AI assistants with pre-populated form data
// This demonstrates form pre-population and update patterns for the Custom Assistants feature

import React, { useState, useEffect } from 'react';
import { X, Bot, Eye, EyeOff, AlertCircle, CheckCircle, Settings, Wand2, RefreshCw } from 'lucide-react';

import { assistantService } from '../../services/assistantService';
import { 
  Assistant,
  AssistantUpdate, 
  AssistantFormData,
  validateAssistantFormData,
  hasValidationErrors,
  ASSISTANT_VALIDATION
} from '../../types/assistant';

interface EditAssistantModalProps {
  isOpen: boolean;
  assistant: Assistant | null; // The assistant to edit
  onClose: () => void;
  onAssistantUpdated: () => void; // Callback to refresh assistant list
}

// Add this type above the component
type ModelPreferenceKey = keyof AssistantFormData['model_preferences'];

/**
 * EditAssistantModal Component
 * 
 * 🎓 LEARNING: Edit Form Patterns
 * ==============================
 * This component demonstrates:
 * - Pre-populating forms with existing data
 * - Handling updates vs creates in form components
 * - Tracking form changes (dirty state)
 * - Partial updates (only sending changed fields)
 * - Form reset to original values
 * - Loading states for data fetching and saving
 * - Optimistic updates vs server validation
 */
export const EditAssistantModal: React.FC<EditAssistantModalProps> = ({
  isOpen,
  assistant,
  onClose,
  onAssistantUpdated
}) => {

  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Form data state - initialized from assistant prop
  const [formData, setFormData] = useState<AssistantFormData>({
    name: '',
    description: '',
    system_prompt: '',
    model_preferences: {}
  });

  // Track original data to detect changes
  const [originalData, setOriginalData] = useState<AssistantFormData>({
    name: '',
    description: '',
    system_prompt: '',
    model_preferences: {}
  });

  // Form validation and submission state
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // UI state
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showSystemPromptPreview, setShowSystemPromptPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Character counters for better UX
  const [nameLength, setNameLength] = useState(0);
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [systemPromptLength, setSystemPromptLength] = useState(0);

  // =============================================================================
  // FORM INITIALIZATION
  // =============================================================================

  /**
   * Initialize form data from assistant prop
   * 
   * 🎓 LEARNING: Form Pre-population
   * ===============================
   * When editing existing data:
   * - Pre-populate form fields with current values
   * - Keep track of original values for change detection
   * - Handle null/undefined values gracefully
   * - Set up UI state (character counters, expanded sections)
   */
  const initializeFormData = (assistantData: Assistant) => {
    const formData: AssistantFormData = {
      name: assistantData.name || '',
      description: assistantData.description || '',
      system_prompt: assistantData.system_prompt || '',
      model_preferences: assistantData.model_preferences ? { ...assistantData.model_preferences } : {}
    };

    setFormData(formData);
    setOriginalData({ 
      name: assistantData.name || '',
      description: assistantData.description || '',
      system_prompt: assistantData.system_prompt || '',
      model_preferences: assistantData.model_preferences ? { ...assistantData.model_preferences } : {}
    }); // Ensure exact same values for comparison

    // 🔧 FIX: Clear validation errors and run initial validation
    const initialValidationErrors = validateAssistantFormData(formData);
    setValidationErrors(initialValidationErrors);
    
    // 🔍 DEBUG: Log initial validation state
    console.log('🔧 Form initialized with validation:', {
      assistantName: assistantData.name,
      hasInitialErrors: hasValidationErrors(initialValidationErrors),
      errorKeys: Object.keys(initialValidationErrors),
      initialValidationErrors
    });

    // Initialize character counters
    setNameLength(formData.name.length);
    setDescriptionLength(formData.description.length);
    setSystemPromptLength(formData.system_prompt.length);

    // Show advanced settings if model preferences exist
    const hasModelPrefs = Object.keys(formData.model_preferences).length > 0;
    setShowAdvancedSettings(hasModelPrefs);
  };

  /**
   * Reset form to original values
   */
  const resetForm = () => {
    if (assistant) {
      initializeFormData(assistant);
      setValidationErrors({});
      setSubmitError(null);
    }
  };

  // =============================================================================
  // CHANGE DETECTION
  // =============================================================================

  /**
   * Check if form data has changed from original
   * 
   * 🎓 LEARNING: Change Detection
   * ============================
   * Detecting changes helps with:
   * - Showing unsaved changes warning
   * - Only updating changed fields (performance)
   * - Providing better UX feedback
   */
  const hasFormChanged = (): boolean => {
    if (!originalData) return false;

    // Simple string comparisons (handle null/undefined as empty strings)
    const nameChanged = (formData.name || '') !== (originalData.name || '');
    const descriptionChanged = (formData.description || '') !== (originalData.description || '');
    const systemPromptChanged = (formData.system_prompt || '') !== (originalData.system_prompt || '');
    
    // Object comparison for model preferences
    const formPrefs = formData.model_preferences || {};
    const originalPrefs = originalData.model_preferences || {};
    
    // Sort keys to ensure consistent comparison
    const formPrefsStr = JSON.stringify(formPrefs, Object.keys(formPrefs).sort());
    const originalPrefsStr = JSON.stringify(originalPrefs, Object.keys(originalPrefs).sort());
    const modelPreferencesChanged = formPrefsStr !== originalPrefsStr;

    const hasChanges = nameChanged || descriptionChanged || systemPromptChanged || modelPreferencesChanged;
    
    // Debug: Log change detection details
    if (hasChanges) {
      console.log('🔧 Form changes detected:', {
        nameChanged,
        descriptionChanged, 
        systemPromptChanged,
        modelPreferencesChanged,
        formData: {
          name: formData.name || '',
          description: formData.description || '',
          system_prompt: formData.system_prompt || ''
        },
        originalData: {
          name: originalData.name || '',
          description: originalData.description || '',
          system_prompt: originalData.system_prompt || ''
        }
      });
    }

    return hasChanges;
  };

  /**
   * Get only the changed fields for partial update
   * 
   * 🎓 LEARNING: Partial Updates
   * ===========================
   * Only sending changed fields:
   * - Reduces network payload
   * - Minimizes server processing
   * - Reduces chance of conflicts
   * - Provides clearer audit trail
   */
  const getChangedFields = (): AssistantUpdate => {
    const updates: AssistantUpdate = {};

    if ((formData.name || '') !== (originalData.name || '')) {
      updates.name = formData.name.trim();
    }

    if ((formData.description || '') !== (originalData.description || '')) {
      updates.description = formData.description.trim() || undefined;
    }

    if ((formData.system_prompt || '') !== (originalData.system_prompt || '')) {
      updates.system_prompt = formData.system_prompt.trim();
    }

    const formPrefs = formData.model_preferences || {};
    const originalPrefs = originalData.model_preferences || {};
    const formPrefsStr = JSON.stringify(formPrefs, Object.keys(formPrefs).sort());
    const originalPrefsStr = JSON.stringify(originalPrefs, Object.keys(originalPrefs).sort());
    
    if (formPrefsStr !== originalPrefsStr) {
      updates.model_preferences = formData.model_preferences;
    }

    return updates;
  };

  // =============================================================================
  // FORM VALIDATION
  // =============================================================================

  /**
   * Validate form in real-time
   */
  const validateForm = () => {
    const errors = validateAssistantFormData(formData);
    setValidationErrors(errors);
    return !hasValidationErrors(errors);
  };

  /**
   * Validate individual field on blur
   */
  const validateField = (fieldName: keyof AssistantFormData) => {
    // 🔧 FIX: Run full validation to avoid stale errors
    const errors = validateAssistantFormData(formData);
    setValidationErrors(errors); // Set ALL errors, not just current field
    
    // 🔍 DEBUG: Log field validation
    console.log('🔧 Field blur validation:', {
      fieldName,
      hasErrors: hasValidationErrors(errors),
      errorKeys: Object.keys(errors)
    });
  };

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle input changes with validation
   */
  const handleInputChange = (field: keyof AssistantFormData, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Update character counters
    if (field === 'name') setNameLength(value.length);
    if (field === 'description') setDescriptionLength(value.length);
    if (field === 'system_prompt') setSystemPromptLength(value.length);

    // 🔧 FIX: Run full validation instead of partial validation
    // This ensures we don't have stale validation errors
    const errors = validateAssistantFormData(newFormData);
    setValidationErrors(errors); // Set ALL errors, not just current field
    
    // 🔍 DEBUG: Log validation state for debugging
    console.log('🔧 Validation after field change:', {
      field,
      value: value?.toString().substring(0, 50) + (value?.length > 50 ? '...' : ''),
      hasErrors: hasValidationErrors(errors),
      errorKeys: Object.keys(errors),
      errors
    });
  };

  /**
   * Handle model preference changes
   */
  const handleModelPreferenceChange = (key: string, value: any) => {
    const newFormData = {
      ...formData,
      model_preferences: {
        ...formData.model_preferences,
        [key]: value
      }
    };
    
    setFormData(newFormData);
    
    // 🔧 FIX: Also validate when model preferences change
    const errors = validateAssistantFormData(newFormData);
    setValidationErrors(errors);
    
    // 🔍 DEBUG: Log model preference validation
    console.log('🔧 Model preference validation:', {
      key,
      value,
      hasErrors: hasValidationErrors(errors),
      errorKeys: Object.keys(errors)
    });
  };

  /**
   * Handle form submission
   * 
   * 🎓 LEARNING: Update Form Submission
   * ==================================
   * Update forms differ from create forms:
   * - Need to check if any changes were made
   * - Only send changed fields to server
   * - Handle optimistic vs pessimistic updates
   * - Provide clear feedback about what changed
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assistant) return;
    
    // Check if form has changes
    if (!hasFormChanged()) {
      // No changes made, just close the modal
      handleClose();
      return;
    }
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      
      // Get only changed fields
      const updateData = getChangedFields();
      
      // Update assistant via service
      const updatedAssistant = await assistantService.updateAssistant(assistant.id, updateData);
      
      // Show success state
      setSubmitSuccess(true);
      
      // Notify parent component to refresh
      onAssistantUpdated();
      
      // Close modal after short delay to show success
      setTimeout(() => {
        handleClose();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to update assistant:', error);
      
      // Handle different types of errors
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Failed to update assistant. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle modal close (no unsaved changes warning)
   */
  const handleClose = () => {
    // Reset all state
    setFormData({ name: '', description: '', system_prompt: '', model_preferences: {} });
    setOriginalData({ name: '', description: '', system_prompt: '', model_preferences: {} });
    setValidationErrors({});
    setIsSubmitting(false);
    setSubmitSuccess(false);
    setSubmitError(null);
    setShowAdvancedSettings(false);
    setShowSystemPromptPreview(false);
    setIsLoading(false);
    setNameLength(0);
    setDescriptionLength(0);
    setSystemPromptLength(0);
    onClose();
  };

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Initialize form when assistant prop changes
   */
  useEffect(() => {
    if (isOpen && assistant) {
      setIsLoading(true);
      
      // Small delay to show loading state
      setTimeout(() => {
        initializeFormData(assistant);
        setIsLoading(false);
        
        // Debug: Log initialization
        console.log('🔧 Assistant modal initialized:', {
          assistant: assistant.name,
          originalData: {
            name: assistant.name || '',
            description: assistant.description || '',
            system_prompt: assistant.system_prompt || ''
          }
        });
      }, 100);
    }
  }, [isOpen, assistant]);

  /**
   * Handle ESC key to close modal
   */
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, hasFormChanged()]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render input field with validation and character counter
   */
  const renderInputField = (
    name: keyof AssistantFormData,
    label: string,
    type: 'text' | 'textarea' = 'text',
    placeholder?: string,
    required: boolean = false,
    maxLength?: number,
    currentLength?: number
  ) => {
    const hasError = validationErrors[name]?.length > 0;
    const value = formData[name] as string;
    const hasChanged = (value || '') !== ((originalData[name] as string) || '');

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          {hasChanged && <span className="ml-2 text-xs text-blue-600 font-medium">Changed</span>}
          {maxLength && currentLength !== undefined && (
            <span className={`ml-2 text-xs ${
              currentLength > maxLength ? 'text-red-500' : 'text-gray-500'
            }`}>
              {currentLength}/{maxLength}
            </span>
          )}
        </label>
        
        <div className="relative">
          {type === 'textarea' ? (
            <textarea
              value={value || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              onBlur={() => validateField(name)}
              placeholder={placeholder}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition-colors resize-vertical ${
                hasError
                  ? 'border-red-300 focus:border-red-500'
                  : hasChanged
                  ? 'border-blue-300 focus:border-blue-500 bg-blue-50/30'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            />
          ) : (
            <input
              type={type}
              value={value || ''}
              onChange={(e) => handleInputChange(name, e.target.value)}
              onBlur={() => validateField(name)}
              placeholder={placeholder}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition-colors ${
                hasError
                  ? 'border-red-300 focus:border-red-500'
                  : hasChanged
                  ? 'border-blue-300 focus:border-blue-500 bg-blue-50/30'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            />
          )}
        </div>
        
        {/* Show validation errors */}
        {hasError && (
          <div className="mt-1">
            {validationErrors[name].map((error, index) => (
              <p key={index} className="text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {error}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render model preference field
   */
  const renderModelPreferenceField = (
    key: ModelPreferenceKey,
    label: string,
    type: 'text' | 'number' = 'text',
    min?: number,
    max?: number,
    step?: string,
    placeholder?: string
  ) => {
    const value = formData.model_preferences[key];
    const originalValue = originalData.model_preferences[key];
    const hasChanged = JSON.stringify(value ?? '') !== JSON.stringify(originalValue ?? '');

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {hasChanged && <span className="ml-2 text-xs text-blue-600 font-medium">Changed</span>}
        </label>
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => {
            const newValue = type === 'number' ? (e.target.value === '' ? undefined : parseFloat(e.target.value)) : e.target.value;
            handleModelPreferenceChange(key, newValue);
          }}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
            hasChanged ? 'border-blue-300 bg-blue-50/30' : 'border-gray-300'
          }`}
        />
      </div>
    );
  };

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <div className="text-center py-12">
      <RefreshCw className="h-8 w-8 text-blue-500 mx-auto mb-4 animate-spin" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Assistant Data...</h3>
      <p className="text-gray-600">Please wait while we load the assistant details.</p>
    </div>
  );

  /**
   * Render success state
   */
  const renderSuccessState = () => (
    <div className="text-center py-8">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Assistant Updated Successfully!</h3>
      <p className="text-gray-600">
        Your changes to "{formData.name}" have been saved.
      </p>
    </div>
  );

  // Don't render if modal is not open or no assistant provided
  if (!isOpen || !assistant) return null;

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-white/20 w-full max-w-3xl shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Bot className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit Assistant</h3>
              <p className="text-sm text-gray-600">
                {assistant.name} • ID: {assistant.id}
                {hasFormChanged() && <span className="ml-2 text-blue-600 font-medium">• Unsaved Changes</span>}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Content */}
        {isLoading ? (
          renderLoadingState()
        ) : submitSuccess ? (
          renderSuccessState()
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 flex items-center">
                <Wand2 className="h-4 w-4 mr-2 text-green-600" />
                Basic Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInputField(
                  'name', 
                  'Assistant Name', 
                  'text', 
                  'e.g., "Research Assistant"', 
                  true,
                  ASSISTANT_VALIDATION.NAME.MAX_LENGTH,
                  nameLength
                )}
                
                <div className="md:col-span-1">
                  {renderInputField(
                    'description', 
                    'Description', 
                    'text', 
                    'Brief description of your assistant',
                    false,
                    ASSISTANT_VALIDATION.DESCRIPTION.MAX_LENGTH,
                    descriptionLength
                  )}
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-gray-900 flex items-center">
                  <Settings className="h-4 w-4 mr-2 text-green-600" />
                  System Prompt
                </h4>
                <button
                  type="button"
                  onClick={() => setShowSystemPromptPreview(!showSystemPromptPreview)}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  {showSystemPromptPreview ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      <span>Hide Preview</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span>Show Preview</span>
                    </>
                  )}
                </button>
              </div>
              
              {renderInputField(
                'system_prompt', 
                'System Prompt', 
                'textarea', 
                'Define how your assistant should behave, its personality, expertise, and response style...',
                true,
                ASSISTANT_VALIDATION.SYSTEM_PROMPT.MAX_LENGTH,
                systemPromptLength
              )}
              
              {/* System Prompt Preview */}
              {showSystemPromptPreview && formData.system_prompt && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Preview:</h5>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">
                    {formData.system_prompt}
                  </p>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center text-blue-600 hover:text-blue-800 font-medium mb-4"
              >
                <svg 
                  className={`w-4 h-4 mr-2 transform transition-transform ${showAdvancedSettings ? 'rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced Model Settings
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Optional
                </span>
              </button>

              {showAdvancedSettings && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
                  <p className="text-sm text-gray-600 mb-4">
                    Configure model-specific parameters. Leave empty to use defaults.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderModelPreferenceField(
                      'model',
                      'Preferred Model',
                      'text',
                      undefined,
                      undefined,
                      undefined,
                      'e.g., gpt-4, claude-3-sonnet'
                    )}
                    
                    {renderModelPreferenceField(
                      'temperature',
                      'Temperature',
                      'number',
                      0,
                      2,
                      '0.1',
                      '0.7 (default)'
                    )}
                    
                    {renderModelPreferenceField(
                      'max_tokens',
                      'Max Tokens',
                      'number',
                      1,
                      32000,
                      '1',
                      '2048 (default)'
                    )}
                    
                    {renderModelPreferenceField(
                      'top_p',
                      'Top P',
                      'number',
                      0,
                      1,
                      '0.1',
                      '1.0 (default)'
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>Temperature:</strong> Controls randomness (0.0 = focused, 2.0 = creative)</p>
                    <p><strong>Max Tokens:</strong> Maximum response length</p>
                    <p><strong>Top P:</strong> Controls diversity via nucleus sampling</p>
                  </div>
                </div>
              )}
            </div>

            {/* Form-level error */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                  <span className="text-sm text-red-800">{submitError}</span>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={!hasFormChanged() || isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset</span>
                </button>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting || !hasFormChanged() || hasValidationErrors(validationErrors)}
                  className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  onClick={() => {
                    // 🔍 DEBUG: Log why button might be disabled
                    console.log('🔧 Save button clicked:', {
                      isSubmitting,
                      hasFormChanged: hasFormChanged(),
                      hasValidationErrors: hasValidationErrors(validationErrors),
                      validationErrors,
                      validationErrorKeys: Object.keys(validationErrors),
                      formData: {
                        name: formData.name,
                        description: formData.description,
                        system_prompt: formData.system_prompt?.substring(0, 50) + '...'
                      }
                    });
                  }}
                >
                  {isSubmitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <Bot className="h-4 w-4" />
                  <span>
                    {isSubmitting 
                      ? 'Saving...' 
                      : !hasFormChanged() 
                      ? 'No Changes' 
                      : 'Save Changes'
                    }
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/**
 * 🎓 LEARNING SUMMARY: EditAssistantModal
 * ======================================
 * 
 * **Key Concepts Demonstrated:**
 * 
 * 1. **Edit Form Patterns**
 *    - Pre-populating forms with existing data
 *    - Change detection and visual indicators
 *    - Partial updates (only changed fields)
 *    - Unsaved changes warnings
 * 
 * 2. **Advanced State Management**
 *    - Tracking original vs current values
 *    - Form dirty state detection
 *    - Optimistic UI updates
 *    - Loading states for data fetching
 * 
 * 3. **User Experience Enhancements**
 *    - Visual indicators for changed fields
 *    - Reset to original values functionality
 *    - Confirmation dialogs for data loss prevention
 *    - Smart button states (disabled when no changes)
 * 
 * 4. **API Integration Patterns**
 *    - Partial update requests
 *    - Error handling for update operations
 *    - Success feedback and callback handling
 *    - Network efficiency (only send changes)
 * 
 * 5. **TypeScript Best Practices**
 *    - Strong typing for form data and props
 *    - Type-safe change detection
 *    - Interface segregation for updates
 *    - Generic form field handling
 * 
 * **Differences from Create Modal:**
 * - Pre-populated form fields
 * - Change detection and visual feedback
 * - Partial update API calls
 * - Unsaved changes handling
 * - Reset functionality
 * - Different button text and colors
 * 
 * **Integration Points:**
 * - Uses assistantService.updateAssistant()
 * - Integrates with Assistant type definitions
 * - Follows same modal patterns as create
 * - Ready for use in AssistantManager component
 */
