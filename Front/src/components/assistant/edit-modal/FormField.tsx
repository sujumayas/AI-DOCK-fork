// 🔧 Reusable Form Field Component
// Generic form input component with validation, change detection, and character counting
// Follows the integration guide's atomic component pattern

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'textarea';
  value: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  currentLength?: number;
  hasError: boolean;
  hasChanged: boolean;
  validationErrors: string[];
  rows?: number;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/**
 * FormField Component
 * 
 * 🎓 LEARNING: Atomic Component Pattern
 * ====================================
 * - Single responsibility: render form input with validation
 * - Reusable across different forms and contexts
 * - Self-contained styling and behavior
 * - Props-driven configuration
 */
export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  type = 'text',
  value,
  placeholder,
  required = false,
  maxLength,
  currentLength,
  hasError,
  hasChanged,
  validationErrors,
  rows = 4,
  onChange,
  onBlur
}) => {

  /**
   * Get input styling based on state
   */
  const getInputClassName = () => {
    const baseClasses = 'w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition-colors';
    
    if (hasError) {
      return `${baseClasses} border-red-300 focus:border-red-500`;
    }
    
    if (hasChanged) {
      return `${baseClasses} border-blue-300 focus:border-blue-500 bg-blue-50/30`;
    }
    
    return `${baseClasses} border-gray-300 focus:border-blue-500`;
  };

  /**
   * Get character counter styling
   */
  const getCounterClassName = () => {
    if (maxLength && currentLength !== undefined && currentLength > maxLength) {
      return 'text-red-500';
    }
    return 'text-gray-500';
  };

  return (
    <div>
      {/* Label with indicators */}
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {hasChanged && <span className="ml-2 text-xs text-blue-600 font-medium">Changed</span>}
        {maxLength && currentLength !== undefined && (
          <span className={`ml-2 text-xs ${getCounterClassName()}`}>
            {currentLength}/{maxLength}
          </span>
        )}
      </label>
      
      {/* Input field */}
      <div className="relative">
        {type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            rows={rows}
            className={`${getInputClassName()} resize-vertical`}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={getInputClassName()}
          />
        )}
      </div>
      
      {/* Validation errors */}
      {hasError && (
        <div className="mt-1">
          {validationErrors.map((error, index) => (
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
