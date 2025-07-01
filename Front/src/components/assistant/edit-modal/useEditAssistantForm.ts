// 📝 Edit Assistant Form Hook
// Custom hook that manages all form state, validation, and change detection logic
// Follows the integration guide pattern of extracting reusable state logic

import { useState, useEffect } from 'react';
import { assistantService } from '../../../services/assistantService';
import { 
  Assistant,
  AssistantUpdate, 
  AssistantFormData,
  validateAssistantFormData,
  hasValidationErrors
} from '../../../types/assistant';

interface UseEditAssistantFormProps {
  isOpen: boolean;
  assistant: Assistant | null;
  onAssistantUpdated: () => void;
  onClose: () => void;
}

interface UseEditAssistantFormReturn {
  // Form data
  formData: AssistantFormData;
  originalData: AssistantFormData;
  
  // Validation
  validationErrors: Record<string, string[]>;
  
  // State flags
  isSubmitting: boolean;
  submitSuccess: boolean;
  submitError: string | null;
  isLoading: boolean;
  
  // Character counters
  nameLength: number;
  descriptionLength: number;
  systemPromptLength: number;
  
  // UI state
  showAdvancedSettings: boolean;
  
  // Actions
  handleInputChange: (field: keyof AssistantFormData, value: any) => void;
  handleModelPreferenceChange: (key: string, value: any) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  validateField: (fieldName: keyof AssistantFormData) => void;
  toggleAdvancedSettings: () => void;
  
  // Utilities
  hasFormChanged: () => boolean;
  canSubmit: () => boolean;
}

/**
 * Custom hook for managing edit assistant form state and logic
 * 
 * 🎓 LEARNING: Custom Hook Pattern
 * ===============================
 * - Extracts complex state logic from components
 * - Provides clean interface for component consumption
 * - Enables reusability across different UI implementations
 * - Separates business logic from presentation
 */
export const useEditAssistantForm = ({
  isOpen,
  assistant,
  onAssistantUpdated,
  onClose
}: UseEditAssistantFormProps): UseEditAssistantFormReturn => {

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
    });

    // Clear validation errors and run initial validation
    const initialValidationErrors = validateAssistantFormData(formData);
    setValidationErrors(initialValidationErrors);
    
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
   */
  const hasFormChanged = (): boolean => {
    if (!originalData) return false;

    // Simple string comparisons (handle null/undefined as empty strings)
    const nameChanged = (formData.name || '') !== (originalData.name || '');
    
    // 🔧 DESCRIPTION FIX: Properly handle null vs empty string
    // Convert empty strings to null for comparison to match backend behavior
    const currentDescription = formData.description?.trim() || null;
    const originalDescription = originalData.description?.trim() || null;
    const descriptionChanged = currentDescription !== originalDescription;
    
    const systemPromptChanged = (formData.system_prompt || '') !== (originalData.system_prompt || '');
    
    // Object comparison for model preferences
    const formPrefs = formData.model_preferences || {};
    const originalPrefs = originalData.model_preferences || {};
    
    // Sort keys to ensure consistent comparison
    const formPrefsStr = JSON.stringify(formPrefs, Object.keys(formPrefs).sort());
    const originalPrefsStr = JSON.stringify(originalPrefs, Object.keys(originalPrefs).sort());
    const modelPreferencesChanged = formPrefsStr !== originalPrefsStr;

    return nameChanged || descriptionChanged || systemPromptChanged || modelPreferencesChanged;
  };

  /**
   * Get only the changed fields for partial update
   */
  const getChangedFields = (): AssistantUpdate => {
    const updates: AssistantUpdate = {};

    if ((formData.name || '') !== (originalData.name || '')) {
      updates.name = formData.name.trim();
    }

    // 🔧 DESCRIPTION FIX: Use same comparison logic as hasFormChanged
    const currentDescription = formData.description?.trim() || null;
    const originalDescription = originalData.description?.trim() || null;
    if (currentDescription !== originalDescription) {
      // Send empty string to backend (it will convert to null)
      updates.description = formData.description.trim();
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
  // VALIDATION
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
    const errors = validateAssistantFormData(formData);
    setValidationErrors(errors);
  };

  /**
   * Check if form can be submitted
   */
  const canSubmit = (): boolean => {
    return hasFormChanged() && !hasValidationErrors(validationErrors) && !isSubmitting;
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

    // Run full validation
    const errors = validateAssistantFormData(newFormData);
    setValidationErrors(errors);
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
    
    // Validate when model preferences change
    const errors = validateAssistantFormData(newFormData);
    setValidationErrors(errors);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assistant) return;
    
    // Check if form has changes
    if (!hasFormChanged()) {
      // No changes made, just close the modal
      onClose();
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
      await assistantService.updateAssistant(assistant.id, updateData);
      
      // Show success state
      setSubmitSuccess(true);
      
      // Notify parent component to refresh
      onAssistantUpdated();
      
      // Close modal after short delay to show success
      setTimeout(() => {
        onClose();
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
   * Toggle advanced settings section
   */
  const toggleAdvancedSettings = () => {
    setShowAdvancedSettings(!showAdvancedSettings);
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
      }, 100);
    }
  }, [isOpen, assistant]);

  /**
   * Reset all state when modal closes
   */
  useEffect(() => {
    if (!isOpen) {
      // Reset all state
      setFormData({ name: '', description: '', system_prompt: '', model_preferences: {} });
      setOriginalData({ name: '', description: '', system_prompt: '', model_preferences: {} });
      setValidationErrors({});
      setIsSubmitting(false);
      setSubmitSuccess(false);
      setSubmitError(null);
      setShowAdvancedSettings(false);
      setIsLoading(false);
      setNameLength(0);
      setDescriptionLength(0);
      setSystemPromptLength(0);
    }
  }, [isOpen]);

  // =============================================================================
  // RETURN INTERFACE
  // =============================================================================

  return {
    // Form data
    formData,
    originalData,
    
    // Validation
    validationErrors,
    
    // State flags
    isSubmitting,
    submitSuccess,
    submitError,
    isLoading,
    
    // Character counters
    nameLength,
    descriptionLength,
    systemPromptLength,
    
    // UI state
    showAdvancedSettings,
    
    // Actions
    handleInputChange,
    handleModelPreferenceChange,
    handleSubmit,
    resetForm,
    validateField,
    toggleAdvancedSettings,
    
    // Utilities
    hasFormChanged,
    canSubmit
  };
};
