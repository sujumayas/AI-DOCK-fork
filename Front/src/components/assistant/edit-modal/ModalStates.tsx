// 🎭 Modal State Components
// Loading and success state components for edit assistant modal
// Follows atomic component pattern for UI states

import React from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';

interface LoadingStateProps {
  title?: string;
  message?: string;
}

interface SuccessStateProps {
  assistantName: string;
  message?: string;
}

/**
 * LoadingState Component
 * 
 * 🎓 LEARNING: State Component Pattern
 * ===================================
 * - Dedicated component for loading UI state
 * - Consistent loading experience across app
 * - Configurable messaging
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading Assistant Data...',
  message = 'Please wait while we load the assistant details.'
}) => (
  <div className="text-center py-12">
    <RefreshCw className="h-8 w-8 text-blue-500 mx-auto mb-4 animate-spin" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600">{message}</p>
  </div>
);

/**
 * SuccessState Component
 * 
 * 🎓 LEARNING: Success Feedback Pattern
 * ====================================
 * - Clear visual confirmation of successful action
 * - Specific feedback about what was accomplished
 * - Consistent success experience
 */
export const SuccessState: React.FC<SuccessStateProps> = ({
  assistantName,
  message
}) => (
  <div className="text-center py-8">
    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">Assistant Updated Successfully!</h3>
    <p className="text-gray-600">
      {message || `Your changes to "${assistantName}" have been saved.`}
    </p>
  </div>
);
