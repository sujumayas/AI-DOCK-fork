// 📝 Modal Header Component
// Header section of edit assistant modal with title, assistant info, and close button
// Demonstrates modal header patterns and context display

import React from 'react';
import { X, Bot } from 'lucide-react';
import { Assistant } from '../../../types/assistant';

interface ModalHeaderProps {
  assistant: Assistant;
  hasFormChanged: boolean;
  onClose: () => void;
}

/**
 * ModalHeader Component
 * 
 * 🎓 LEARNING: Modal Header Pattern
 * ================================
 * - Clear modal identification and context
 * - Visual hierarchy with icons and typography
 * - Status indicators (unsaved changes)
 * - Consistent close button placement
 */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
  assistant,
  hasFormChanged,
  onClose
}) => {

  return (
    <div className="flex items-center justify-between mb-6">
      
      {/* Left Side: Title and Info */}
      <div className="flex items-center space-x-3">
        
        {/* Icon Container */}
        <div className="p-2 bg-green-100 rounded-lg">
          <Bot className="h-6 w-6 text-green-600" />
        </div>
        
        {/* Title and Subtitle */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Assistant
          </h3>
          <p className="text-sm text-gray-600">
            {assistant.name} • ID: {assistant.id}
            {hasFormChanged && (
              <span className="ml-2 text-blue-600 font-medium">
                • Unsaved Changes
              </span>
            )}
          </p>
        </div>
      </div>
      
      {/* Right Side: Close Button */}
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
        aria-label="Close modal"
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );
};
