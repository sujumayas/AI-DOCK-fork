// 🗑️ LLM Configuration Delete Modal Component
// This component provides a safe confirmation dialog for deleting LLM configurations
// 
// Learning: This demonstrates important UX patterns:
// - Confirmation dialogs for destructive actions
// - Clear messaging about consequences
// - Safe deletion patterns with proper warnings

import React from 'react';
import { LLMConfigurationResponse } from '../../services/llmConfigService';

interface LLMDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  configuration: LLMConfigurationResponse | null;
  isDeleting: boolean;
}

/**
 * Delete LLM Configuration Confirmation Modal
 * 
 * This component provides a safe confirmation dialog for deleting LLM configurations.
 * It shows important warnings and requires explicit confirmation to prevent accidents.
 */
const LLMDeleteModal: React.FC<LLMDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  configuration,
  isDeleting
}) => {
  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle delete confirmation
   */
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Delete confirmation error:', error);
      // Error handling is done in the parent component
    }
  };

  /**
   * Handle escape key press
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isDeleting) {
      onClose();
    }
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  /**
   * Render warning indicators based on configuration status
   */
  const renderWarnings = () => {
    if (!configuration) return null;

    const warnings = [];

    // Active configuration warning
    if (configuration.is_active) {
      warnings.push({
        type: 'danger',
        icon: '⚠️',
        message: 'This configuration is currently ACTIVE and may be in use by users.'
      });
    }

    // Public configuration warning
    if (configuration.is_public) {
      warnings.push({
        type: 'warning',
        icon: '👥',
        message: 'This configuration is available to all users in your organization.'
      });
    }

    // High priority warning
    if (configuration.priority <= 5) {
      warnings.push({
        type: 'info',
        icon: '⭐',
        message: 'This is a high-priority configuration (priority ' + configuration.priority + ').'
      });
    }

    return warnings.length > 0 ? (
      <div className="space-y-2 mb-4">
        {warnings.map((warning, index) => (
          <div 
            key={index}
            className={`p-3 rounded-md text-sm ${
              warning.type === 'danger' 
                ? 'bg-red-50 text-red-800 border border-red-200'
                : warning.type === 'warning'
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            <span className="mr-2">{warning.icon}</span>
            {warning.message}
          </div>
        ))}
      </div>
    ) : null;
  };

  /**
   * Render configuration details
   */
  const renderConfigurationDetails = () => {
    if (!configuration) return null;

    return (
      <div className="bg-gray-50 rounded-md p-4 mb-4">
        <h4 className="font-medium text-gray-900 mb-2">Configuration Details</h4>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Name:</span>
            <span className="font-medium">{configuration.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Provider:</span>
            <span className="font-medium">{configuration.provider_name}</span>
          </div>
          <div className="flex justify-between">
            <span>Default Model:</span>
            <span className="font-medium">{configuration.default_model}</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={`font-medium ${configuration.is_active ? 'text-green-600' : 'text-gray-500'}`}>
              {configuration.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {configuration.description && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-500">Description:</span>
              <p className="mt-1 text-gray-700">{configuration.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  if (!isOpen || !configuration) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            {/* Danger Icon */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
                  />
                </svg>
              </div>
            </div>
            
            {/* Title */}
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">
                Delete LLM Configuration
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                This action cannot be undone
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Warning Messages */}
          {renderWarnings()}

          {/* Main Message */}
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete the configuration{' '}
            <span className="font-semibold">"{configuration.name}"</span>?
          </p>

          <p className="text-sm text-gray-600 mb-4">
            This will permanently remove the configuration and all its settings. 
            Any users currently relying on this configuration will lose access.
          </p>

          {/* Configuration Details */}
          {renderConfigurationDetails()}

          {/* Consequences */}
          <div className="bg-gray-50 border-l-4 border-gray-400 p-3 mb-4">
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">What happens when you delete this:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>The configuration will be permanently removed</li>
                <li>Users will no longer be able to use this provider</li>
                <li>Any saved API keys will be securely destroyed</li>
                <li>Usage history will be preserved for auditing</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {isDeleting && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isDeleting ? 'Deleting...' : 'Delete Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LLMDeleteModal;