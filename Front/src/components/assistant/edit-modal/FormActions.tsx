// 🚀 Form Actions Component
// Footer component with form submission buttons and controls
// Demonstrates action bar patterns and button state management

import React from 'react';
import { RefreshCw, Bot, AlertCircle } from 'lucide-react';

interface FormActionsProps {
  isSubmitting: boolean;
  hasFormChanged: boolean;
  hasValidationErrors: boolean;
  submitError: string | null;
  onReset: () => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * FormActions Component
 * 
 * 🎓 LEARNING: Action Bar Pattern
 * ==============================
 * - Groups related actions together
 * - Smart button states based on form state
 * - Clear hierarchy (primary vs secondary actions)
 * - Error display within action context
 */
export const FormActions: React.FC<FormActionsProps> = ({
  isSubmitting,
  hasFormChanged,
  hasValidationErrors,
  submitError,
  onReset,
  onCancel,
  onSubmit
}) => {

  /**
   * Get the submit button text based on current state
   */
  const getSubmitButtonText = (): string => {
    if (isSubmitting) {
      return 'Saving...';
    }
    if (!hasFormChanged) {
      return 'No Changes';
    }
    return 'Save Changes';
  };

  /**
   * Check if submit button should be disabled
   */
  const isSubmitDisabled = (): boolean => {
    return isSubmitting || !hasFormChanged || hasValidationErrors;
  };

  /**
   * Check if reset button should be disabled
   */
  const isResetDisabled = (): boolean => {
    return !hasFormChanged || isSubmitting;
  };

  return (
    <>
      {/* Error Display */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
            <span className="text-sm text-red-800">{submitError}</span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        
        {/* Secondary Actions (Left) */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onReset}
            disabled={isResetDisabled()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reset</span>
          </button>
        </div>
        
        {/* Primary Actions (Right) */}
        <div className="flex items-center space-x-3">
          
          {/* Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitDisabled()}
            onClick={onSubmit}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {/* Loading Spinner */}
            {isSubmitting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            
            {/* Bot Icon */}
            <Bot className="h-4 w-4" />
            
            {/* Dynamic Text */}
            <span>{getSubmitButtonText()}</span>
          </button>
        </div>
      </div>
    </>
  );
};
