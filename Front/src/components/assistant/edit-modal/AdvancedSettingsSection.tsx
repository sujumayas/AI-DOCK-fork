// ⚙️ Advanced Model Settings Section
// Component for model preferences configuration with collapsible interface
// Demonstrates advanced form patterns and model parameter handling

import React from 'react';
import { AssistantFormData } from '../../../types/assistant';

interface AdvancedSettingsSectionProps {
  formData: AssistantFormData;
  originalData: AssistantFormData;
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
  onModelPreferenceChange: (key: string, value: any) => void;
}

// Type for model preference keys to ensure type safety
type ModelPreferenceKey = keyof AssistantFormData['model_preferences'];

/**
 * AdvancedSettingsSection Component
 * 
 * 🎓 LEARNING: Advanced Form Section Pattern
 * =========================================
 * - Collapsible section for optional settings
 * - Model parameter configuration
 * - Type-safe preference handling
 * - Help text and guidance for users
 */
export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
  formData,
  originalData,
  showAdvancedSettings,
  onToggleAdvancedSettings,
  onModelPreferenceChange
}) => {

  /**
   * Render model preference field with change detection
   */
  const renderModelPreferenceField = (
    key: ModelPreferenceKey,
    label: string,
    type: 'text' | 'number' = 'text',
    min?: number,
    max?: number,
    step?: string,
    placeholder?: string
  ) => {
    const value = formData.model_preferences[key];
    const originalValue = originalData.model_preferences[key];
    const hasChanged = JSON.stringify(value ?? '') !== JSON.stringify(originalValue ?? '');

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {hasChanged && <span className="ml-2 text-xs text-blue-600 font-medium">Changed</span>}
        </label>
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => {
            const newValue = type === 'number' ? (e.target.value === '' ? undefined : parseFloat(e.target.value)) : e.target.value;
            onModelPreferenceChange(key, newValue);
          }}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
            hasChanged ? 'border-blue-300 bg-blue-50/30' : 'border-gray-300'
          }`}
        />
      </div>
    );
  };

  return (
    <div>
      {/* Section Toggle Header */}
      <button
        type="button"
        onClick={onToggleAdvancedSettings}
        className="flex items-center text-blue-600 hover:text-blue-800 font-medium mb-4 transition-colors"
      >
        <svg 
          className={`w-4 h-4 mr-2 transform transition-transform duration-200 ${showAdvancedSettings ? 'rotate-90' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Advanced Model Settings
        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          Optional
        </span>
      </button>

      {/* Collapsible Settings Content */}
      {showAdvancedSettings && (
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
          {/* Section Description */}
          <p className="text-sm text-gray-600 mb-4">
            Configure model-specific parameters. Leave empty to use defaults.
          </p>
          
          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderModelPreferenceField(
              'model',
              'Preferred Model',
              'text',
              undefined,
              undefined,
              undefined,
              'e.g., gpt-4, claude-3-sonnet'
            )}
            
            {renderModelPreferenceField(
              'temperature',
              'Temperature',
              'number',
              0,
              2,
              '0.1',
              '0.7 (default)'
            )}
            
            {renderModelPreferenceField(
              'max_tokens',
              'Max Tokens',
              'number',
              1,
              32000,
              '1',
              '2048 (default)'
            )}
            
            {renderModelPreferenceField(
              'top_p',
              'Top P',
              'number',
              0,
              1,
              '0.1',
              '1.0 (default)'
            )}
          </div>
          
          {/* Help Text */}
          <div className="text-xs text-gray-500 space-y-1 mt-4">
            <p><strong>Temperature:</strong> Controls randomness (0.0 = focused, 2.0 = creative)</p>
            <p><strong>Max Tokens:</strong> Maximum response length</p>
            <p><strong>Top P:</strong> Controls diversity via nucleus sampling</p>
          </div>
        </div>
      )}
    </div>
  );
};
