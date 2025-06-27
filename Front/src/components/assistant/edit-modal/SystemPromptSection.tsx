// 🎯 System Prompt Form Section
// Component for system prompt configuration with preview functionality
// Demonstrates expandable content and preview patterns

import React from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';
import { FormField } from './FormField';
import { AssistantFormData, ASSISTANT_VALIDATION } from '../../../types/assistant';

interface SystemPromptSectionProps {
  formData: AssistantFormData;
  originalData: AssistantFormData;
  validationErrors: Record<string, string[]>;
  systemPromptLength: number;
  showSystemPromptPreview: boolean;
  onInputChange: (field: keyof AssistantFormData, value: any) => void;
  onFieldBlur: (fieldName: keyof AssistantFormData) => void;
  onTogglePreview: () => void;
}

/**
 * SystemPromptSection Component
 * 
 * 🎓 LEARNING: Section Component with Preview
 * ==========================================
 * - Handles system prompt input and preview
 * - Toggle functionality for preview mode
 * - Section header with controls
 * - Proper textarea handling
 */
export const SystemPromptSection: React.FC<SystemPromptSectionProps> = ({
  formData,
  originalData,
  validationErrors,
  systemPromptLength,
  showSystemPromptPreview,
  onInputChange,
  onFieldBlur,
  onTogglePreview
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
      {/* Section Header with Preview Toggle */}
      <div className="flex items-center justify-between">
        <h4 className="text-md font-medium text-gray-900 flex items-center">
          <Settings className="h-4 w-4 mr-2 text-green-600" />
          System Prompt
        </h4>
        <button
          type="button"
          onClick={onTogglePreview}
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
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
  );
};
