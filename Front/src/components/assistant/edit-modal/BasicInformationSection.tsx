// 📝 Basic Information Form Section
// Component for assistant name and description fields
// Demonstrates form section pattern with atomic field components

import React from 'react';
import { Wand2 } from 'lucide-react';
import { FormField } from './FormField';
import { AssistantFormData, ASSISTANT_VALIDATION } from '../../../types/assistant';

interface BasicInformationSectionProps {
  formData: AssistantFormData;
  originalData: AssistantFormData;
  validationErrors: Record<string, string[]>;
  nameLength: number;
  descriptionLength: number;
  onInputChange: (field: keyof AssistantFormData, value: any) => void;
  onFieldBlur: (fieldName: keyof AssistantFormData) => void;
}

/**
 * BasicInformationSection Component
 * 
 * 🎓 LEARNING: Form Section Pattern
 * ================================
 * - Groups related form fields together
 * - Encapsulates section-specific logic
 * - Uses atomic FormField components
 * - Self-contained validation and styling
 */
export const BasicInformationSection: React.FC<BasicInformationSectionProps> = ({
  formData,
  originalData,
  validationErrors,
  nameLength,
  descriptionLength,
  onInputChange,
  onFieldBlur
}) => {

  /**
   * Check if a field has changed from original value
   */
  const hasFieldChanged = (field: keyof AssistantFormData): boolean => {
    return (formData[field] || '') !== (originalData[field] || '');
  };

  /**
   * Check if a field has validation errors
   */
  const hasFieldError = (field: keyof AssistantFormData): boolean => {
    return validationErrors[field]?.length > 0;
  };

  /**
   * Get validation errors for a field
   */
  const getFieldErrors = (field: keyof AssistantFormData): string[] => {
    return validationErrors[field] || [];
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <h4 className="text-md font-medium text-gray-900 flex items-center">
        <Wand2 className="h-4 w-4 mr-2 text-green-600" />
        Basic Information
      </h4>
      
      {/* Form Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Assistant Name Field */}
        <FormField
          name="name"
          label="Assistant Name"
          type="text"
          value={formData.name || ''}
          placeholder='e.g., "Research Assistant"'
          required={true}
          maxLength={ASSISTANT_VALIDATION.NAME.MAX_LENGTH}
          currentLength={nameLength}
          hasError={hasFieldError('name')}
          hasChanged={hasFieldChanged('name')}
          validationErrors={getFieldErrors('name')}
          onChange={(value) => onInputChange('name', value)}
          onBlur={() => onFieldBlur('name')}
        />
        
        {/* Description Field */}
        <div className="md:col-span-1">
          <FormField
            name="description"
            label="Description"
            type="text"
            value={formData.description || ''}
            placeholder="Brief description of your assistant"
            required={false}
            maxLength={ASSISTANT_VALIDATION.DESCRIPTION.MAX_LENGTH}
            currentLength={descriptionLength}
            hasError={hasFieldError('description')}
            hasChanged={hasFieldChanged('description')}
            validationErrors={getFieldErrors('description')}
            onChange={(value) => onInputChange('description', value)}
            onBlur={() => onFieldBlur('description')}
          />
        </div>
      </div>
    </div>
  );
};
