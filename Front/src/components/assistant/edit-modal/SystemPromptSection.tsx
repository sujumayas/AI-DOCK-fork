// 🎯 System Prompt Form Section
// Component for system prompt configuration
// Demonstrates expandable content patterns

import React from 'react';
import { Settings } from 'lucide-react';
import { FormField } from './FormField';
import { AssistantFormData, ASSISTANT_VALIDATION } from '../../../types/assistant';

interface SystemPromptSectionProps {
  formData: AssistantFormData;
  originalData: AssistantFormData;
  validationErrors: Record<string, string[]>;
  systemPromptLength: number;
  onInputChange: (field: keyof AssistantFormData, value: any) => void;
  onFieldBlur: (fieldName: keyof AssistantFormData) => void;
}

/**
 * SystemPromptSection Component
 * 
 * 🎓 LEARNING: Section Component
 * =============================
 * - Handles system prompt input
 * - Section header
 * - Proper textarea handling
 */
export const SystemPromptSection: React.FC<SystemPromptSectionProps> = ({
  formData,
  originalData,
  validationErrors,
  systemPromptLength,
  onInputChange,
  onFieldBlur
}) => {

  /**
   * Check if system prompt field has changed from original value
   */
  const hasFieldChanged = (): boolean => {
    return (formData.system_prompt || '') !== (originalData.system_prompt || '');
  };

  /**
   * Check if system prompt field has validation errors
   */
  const hasFieldError = (): boolean => {
    return validationErrors.system_prompt?.length > 0;
  };

  /**
   * Get validation errors for system prompt field
   */
  const getFieldErrors = (): string[] => {
    return validationErrors.system_prompt || [];
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-md font-medium text-gray-900 flex items-center">
          <Settings className="h-4 w-4 mr-2 text-green-600" />
          System Prompt
        </h4>
      </div>
      
      {/* System Prompt Textarea */}
      <FormField
        name="system_prompt"
        label="System Prompt"
        type="textarea"
        value={formData.system_prompt || ''}
        placeholder="Define how your assistant should behave, its personality, expertise, and response style..."
        required={true}
        maxLength={ASSISTANT_VALIDATION.SYSTEM_PROMPT.MAX_LENGTH}
        currentLength={systemPromptLength}
        hasError={hasFieldError()}
        hasChanged={hasFieldChanged()}
        validationErrors={getFieldErrors()}
        rows={6}
        onChange={(value) => onInputChange('system_prompt', value)}
        onBlur={() => onFieldBlur('system_prompt')}
      />
    </div>
  );
};
