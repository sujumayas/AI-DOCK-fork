// ✨ Assistant Creation Modal
// Modal component for creating new AI assistants with comprehensive form validation
// This showcases advanced form patterns and modal UX design for the Custom Assistants feature

import React, { useState, useEffect } from 'react';
import { X, Bot, Eye, EyeOff, AlertCircle, CheckCircle, Settings, Wand2 } from 'lucide-react';

import { assistantService } from '../../services/assistantService';
import { 
  AssistantCreate, 
  AssistantFormData,
  validateAssistantFormData,
  hasValidationErrors,
  createDefaultAssistantFormData,
  DEFAULT_ASSISTANT_CONFIG,
  ASSISTANT_VALIDATION
} from '../../types/assistant';

interface CreateAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssistantCreated: () => void; // Callback to refresh assistant list
}

/**
 * CreateAssistantModal Component
 * 
 * 🎓 LEARNING: Advanced Modal and Form Patterns
 * =============================================
 * This component demonstrates:
 * - Complex form state management with TypeScript
 * - Real-time validation with user-friendly feedback
 * - Advanced UI patterns (collapsible sections, character counters)
 * - Integration with backend API services
 * - Accessibility considerations (ESC key, focus management)
 * - Form reset and cleanup on close/success
 * - Loading states and error handling
 * - Model preferences configuration
 */
export const CreateAssistantModal: React.FC<CreateAssistantModalProps> = ({
  isOpen,
  onClose,
  onAssistantCreated
}) => {


  // =============================================================================
  // STATE MANAGEMENT
  // =============================================================================

  // Form data state - using our typed form data interface
  const [formData, setFormData] = useState<AssistantFormData>(createDefaultAssistantFormData());

  // Form validation and submission state
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false); // Track if user has tried to submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // UI state
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Character counters for better UX
  const nameLength = formData.name.length;
  const descriptionLength = formData.description.length;
  const systemPromptLength = formData.system_prompt.length;

  // =============================================================================
  // FORM VALIDATION
  // =============================================================================

  /**
   * Validate form in real-time
   * 
   * 🎓 LEARNING: Real-time Validation
   * ================================
   * Real-time validation provides immediate feedback to users,
   * improving the form completion experience and reducing errors.
   */
  const validateForm = () => {
    const errors = validateAssistantFormData(formData);
    setValidationErrors(errors);
    return !hasValidationErrors(errors);
  };

  /**
   * Validate individual field on blur
   * 
   * 🎓 LEARNING: Field-level Validation
   * ==================================
   * Validating on blur (when user leaves field) provides feedback
   * without being too aggressive during typing.
   */
  const validateField = (fieldName: keyof AssistantFormData) => {
    const errors = validateAssistantFormData(formData);
    setValidationErrors(prev => ({
      ...prev,
      [fieldName]: errors[fieldName] || []
    }));
  };

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle input changes with validation
   * 
   * 🎓 LEARNING: Controlled Components
   * =================================
   * React controlled components keep form state in sync with UI.
   * Every change updates state and triggers re-render.
   */
  const handleInputChange = (field: keyof AssistantFormData, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Clear validation errors for this field when user starts typing
    if (validationErrors[field]?.length > 0) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: []
      }));
    }
  };

  /**
   * Handle model preference changes
   * 
   * 🎓 LEARNING: Nested Object Updates
   * ==================================
   * When updating nested objects in React state, we need to
   * spread both the parent object and the nested object.
   */
  const handleModelPreferenceChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      model_preferences: {
        ...prev.model_preferences,
        [key]: value
      }
    }));
  };

  /**
   * Handle form submission
   * 
   * 🎓 LEARNING: Async Form Submission
   * =================================
   * Form submission includes:
   * - Client-side validation
   * - Loading states
   * - Error handling
   * - Success feedback
   * - State cleanup
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark that user has attempted to submit
    setHasAttemptedSubmit(true);
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      
      // Convert form data to API request format
      const createData: AssistantCreate = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        system_prompt: formData.system_prompt.trim(),
        model_preferences: formData.model_preferences
      };

      // Create assistant via service
      await assistantService.createAssistant(createData);
      
      // Show success state
      setSubmitSuccess(true);
      
      // Notify parent component to refresh list
      onAssistantCreated();
      
      // Close modal after short delay to show success
      setTimeout(() => {
        handleClose();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to create assistant:', error);
      
      // 🎓 LEARNING: Robust Error Handling
      // ====================================
      // We need to handle different error types:
      // - AssistantServiceError (our custom error with specific messages)
      // - Network errors (fetch failures)
      // - Generic errors
      
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Failed to create assistant. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle modal close with cleanup
   * 
   * 🎓 LEARNING: Component Cleanup
   * =============================
   * Proper cleanup prevents state from leaking between modal opens.
   */
  const handleClose = () => {
    // Reset form state
    setFormData(createDefaultAssistantFormData());
    setValidationErrors({});
    setHasAttemptedSubmit(false);
    setShowAdvancedSettings(false);
    setSubmitError(null);
    setSubmitSuccess(false);
    
    // Actually close the modal
    onClose();
  };

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Handle ESC key to close modal
   * 
   * 🎓 LEARNING: Keyboard Accessibility
   * ==================================
   * ESC key support is important for modal UX and accessibility.
   */
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);



  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render input field with validation and character counter
   * 
   * 🎓 LEARNING: Reusable UI Components
   * ==================================
   * Creating render helpers reduces code duplication and ensures
   * consistent styling and behavior across form fields.
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

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
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
                hasAttemptedSubmit && hasError
                  ? 'border-red-300 focus:border-red-500'
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
                hasAttemptedSubmit && hasError
                  ? 'border-red-300 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            />
          )}
        </div>
        
        {/* Show validation errors only after submit attempt */}
        {hasAttemptedSubmit && hasError && (
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
    key: string,
    label: string,
    type: 'text' | 'number' = 'text',
    min?: number,
    max?: number,
    step?: string,
    placeholder?: string
  ) => {
    const value = formData.model_preferences[key as keyof typeof formData.model_preferences];

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input
          type={type}
          value={value || ''}
          onChange={(e) => {
            const newValue = type === 'number' ? parseFloat(e.target.value) || undefined : e.target.value;
            handleModelPreferenceChange(key, newValue);
          }}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    );
  };

  /**
   * Render success state
   */
  const renderSuccessState = () => (
    <div className="text-center py-8">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Assistant Created Successfully!</h3>
      <p className="text-gray-600">
        Your new AI assistant "{formData.name}" has been created and is ready to use.
      </p>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  // 🎓 LEARNING: Better Modal Rendering Pattern
  // ===============================================
  // Instead of early return, we use conditional rendering within JSX.
  // This prevents React hydration issues and state synchronization problems.
  
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50"
      onClick={handleClose}
    >
      <div 
        className="relative top-20 mx-auto p-5 border border-white/20 w-full max-w-3xl shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Create New Assistant</h3>
              <p className="text-sm text-gray-600">Configure your custom AI assistant</p>
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
        {submitSuccess ? (
          renderSuccessState()
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 flex items-center">
                <Wand2 className="h-4 w-4 mr-2 text-blue-600" />
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
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-green-600" />
                System Prompt
              </h4>
              
              {renderInputField(
                'system_prompt', 
                'System Prompt', 
                'textarea', 
                'Define how your assistant should behave, its personality, expertise, and response style...',
                true,
                ASSISTANT_VALIDATION.SYSTEM_PROMPT.MAX_LENGTH,
                systemPromptLength
              )}
              
              {/* System Prompt Tips */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">💡 Tips for Writing System Prompts:</h5>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Be specific about the assistant's role and expertise</li>
                  <li>• Define the tone and communication style</li>
                  <li>• Include any constraints or guidelines</li>
                  <li>• Mention output format preferences if relevant</li>
                </ul>
              </div>
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
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
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
                disabled={isSubmitting || (hasAttemptedSubmit && hasValidationErrors(validationErrors))}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSubmitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <Bot className="h-4 w-4" />
                <span>{isSubmitting ? 'Creating...' : 'Create Assistant'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/**
 * 🎓 LEARNING SUMMARY: CreateAssistantModal
 * ========================================
 * 
 * **Key Concepts Demonstrated:**
 * 
 * 1. **Complex Form Management**
 *    - TypeScript interfaces for form data
 *    - Real-time validation with immediate feedback
 *    - Nested object updates (model preferences)
 *    - Character counters for better UX
 * 
 * 2. **Advanced UI Patterns**
 *    - Collapsible sections (advanced settings)
 *    - Progressive disclosure (system prompt preview)
 *    - Loading states and success feedback
 *    - Error handling with specific messages
 * 
 * 3. **API Integration**
 *    - Service layer integration
 *    - Error handling for different failure modes
 *    - Loading states during async operations
 *    - Success callbacks to parent components
 * 
 * 4. **Accessibility & UX**
 *    - ESC key support for modal closing
 *    - Focus management and keyboard navigation
 *    - Clear validation feedback
 *    - Consistent visual hierarchy
 * 
 * 5. **Code Organization**
 *    - Separation of concerns (state, handlers, render)
 *    - Reusable render helper functions
 *    - Comprehensive commenting for learning
 *    - TypeScript for type safety
 * 
 * **Integration Points:**
 * - Uses assistantService for API calls
 * - Integrates with assistant types and validation
 * - Follows project modal patterns
 * - Ready for use in AssistantManager component
 */
