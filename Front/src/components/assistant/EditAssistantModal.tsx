// ✏️ Assistant Edit Modal
// Modal component for editing existing AI assistants with pre-populated form data
// This demonstrates form pre-population and update patterns for the Custom Assistants feature

import React, { useEffect } from 'react';
import { Assistant } from '../../types/assistant';
import { hasValidationErrors } from '../../types/assistant';
import {
  ModalHeader,
  LoadingState,
  SuccessState,
  BasicInformationSection,
  SystemPromptSection,
  AdvancedSettingsSection,
  FormActions,
  useEditAssistantForm
} from './edit-modal';

interface EditAssistantModalProps {
  isOpen: boolean;
  assistant: Assistant | null; // The assistant to edit
  onClose: () => void;
  onAssistantUpdated: () => void; // Callback to refresh assistant list
}

/**
 * EditAssistantModal Component
 * 
 * 🎓 LEARNING: Refactored Modal Pattern
 * ====================================
 * This component demonstrates:
 * - Container component using atomic sub-components
 * - Custom hook for state management
 * - Clean separation of concerns
 * - Modular, maintainable architecture
 * - Each section is an independent component
 */
export const EditAssistantModal: React.FC<EditAssistantModalProps> = ({
  isOpen,
  assistant,
  onClose,
  onAssistantUpdated
}) => {

  // =============================================================================
  // HOOK USAGE - All logic extracted to custom hook
  // =============================================================================

  const {
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
    showSystemPromptPreview,
    
    // Actions
    handleInputChange,
    handleModelPreferenceChange,
    handleSubmit,
    resetForm,
    validateField,
    toggleAdvancedSettings,
    toggleSystemPromptPreview,
    
    // Utilities
    hasFormChanged,
    canSubmit
  } = useEditAssistantForm({
    isOpen,
    assistant,
    onAssistantUpdated,
    onClose
  });

  // =============================================================================
  // EFFECTS
  // =============================================================================

  /**
   * Handle ESC key to close modal
   */
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
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
  }, [isOpen, onClose]);

  // =============================================================================
  // EARLY RETURNS
  // =============================================================================

  // Don't render if modal is not open or no assistant provided
  if (!isOpen || !assistant) return null;

  // =============================================================================
  // MAIN RENDER - Composed of atomic components
  // =============================================================================

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-white/20 w-full max-w-3xl shadow-2xl rounded-2xl bg-white/95 backdrop-blur-sm">
        
        {/* Modal Header - Extracted Component */}
        <ModalHeader
          assistant={assistant}
          hasFormChanged={hasFormChanged()}
          onClose={onClose}
        />

        {/* Modal Content - State-based rendering */}
        {isLoading ? (
          <LoadingState />
        ) : submitSuccess ? (
          <SuccessState assistantName={formData.name} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Information Section - Extracted Component */}
            <BasicInformationSection
              formData={formData}
              originalData={originalData}
              validationErrors={validationErrors}
              nameLength={nameLength}
              descriptionLength={descriptionLength}
              onInputChange={handleInputChange}
              onFieldBlur={validateField}
            />

            {/* System Prompt Section - Extracted Component */}
            <SystemPromptSection
              formData={formData}
              originalData={originalData}
              validationErrors={validationErrors}
              systemPromptLength={systemPromptLength}
              showSystemPromptPreview={showSystemPromptPreview}
              onInputChange={handleInputChange}
              onFieldBlur={validateField}
              onTogglePreview={toggleSystemPromptPreview}
            />

            {/* Advanced Settings Section - Extracted Component */}
            <AdvancedSettingsSection
              formData={formData}
              originalData={originalData}
              showAdvancedSettings={showAdvancedSettings}
              onToggleAdvancedSettings={toggleAdvancedSettings}
              onModelPreferenceChange={handleModelPreferenceChange}
            />

            {/* Form Actions - Extracted Component */}
            <FormActions
              isSubmitting={isSubmitting}
              hasFormChanged={hasFormChanged()}
              hasValidationErrors={hasValidationErrors(validationErrors)}
              submitError={submitError}
              onReset={resetForm}
              onCancel={onClose}
              onSubmit={handleSubmit}
            />
          </form>
        )}
      </div>
    </div>
  );
};

/**
 * 🎓 LEARNING SUMMARY: Refactored EditAssistantModal
 * =================================================
 * 
 * **Refactoring Benefits Achieved:**
 * 
 * 1. **Modular Architecture**
 *    - Main modal is now ~150 lines (was 935 lines)
 *    - Each section is an independent component
 *    - Clean separation of concerns
 *    - Easy to test individual components
 * 
 * 2. **Custom Hook Pattern**
 *    - All business logic extracted to useEditAssistantForm
 *    - State management centralized and reusable
 *    - Component focuses purely on composition
 *    - Easy to test logic separately from UI
 * 
 * 3. **Atomic Components**
 *    - FormField: Reusable across any form
 *    - ModalStates: Consistent loading/success patterns
 *    - Sections: Focused, single-responsibility components
 *    - Each component is independently maintainable
 * 
 * 4. **Component Composition**
 *    - Main component composes smaller components
 *    - Props drilling is minimal and clean
 *    - Each section handles its own concerns
 *    - Easy to rearrange or modify sections
 * 
 * 5. **Improved Maintainability**
 *    - Bugs can be isolated to specific components
 *    - Features can be added to individual sections
 *    - Code is easier to understand and navigate
 *    - Testing is more granular and effective
 * 
 * **File Structure Created:**
 * ```
 * /edit-modal/
 *   ├── BasicInformationSection.tsx   (Name/description fields)
 *   ├── SystemPromptSection.tsx       (System prompt with preview)
 *   ├── AdvancedSettingsSection.tsx   (Model preferences)
 *   ├── FormActions.tsx               (Reset/Cancel/Save buttons)
 *   ├── ModalHeader.tsx               (Title and close button)
 *   ├── FormField.tsx                 (Reusable form input)
 *   ├── ModalStates.tsx               (Loading/success states)
 *   ├── useEditAssistantForm.ts       (Custom hook with all logic)
 *   └── index.ts                      (Clean exports)
 * ```
 * 
 * **Integration Points:**
 * - Follows integration guide patterns
 * - Uses existing assistant service and types
 * - Maintains all original functionality
 * - Ready for use in AssistantManager component
 * - Consistent with project glassmorphism styling
 */
