// 📁 Create Project Folder Modal - Simplified Version
// Simple modal for creating folders with default assistant selection
// Replaces the complex project creation with folder-based approach

import React, { useState, useEffect } from 'react';
import { X, Folder, Bot, Palette } from 'lucide-react';
import { ProjectCreateRequest } from '../../../types/project';
import { AssistantSummary } from '../../../types/assistant';
import { projectService } from '../../../services/projectService';
import { assistantService } from '../../../services/assistantService';

interface CreateProjectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderCreated: (folderId: number) => void;
}

export const CreateProjectFolderModal: React.FC<CreateProjectFolderModalProps> = ({
  isOpen,
  onClose,
  onFolderCreated
}) => {
  const [formData, setFormData] = useState<ProjectCreateRequest>({
    name: '',
    description: '',
    default_assistant_id: undefined,
    color: '#3B82F6',
    icon: '📁',
    is_favorited: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<AssistantSummary[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);

  // Predefined folder options
  const folderIcons = ['📁', '💼', '🔬', '💻', '✍️', '📊', '🎨', '📚', '🏠', '⚙️'];
  const folderColors = [
    '#3B82F6', // blue
    '#059669', // emerald
    '#DC2626', // red
    '#7C3AED', // violet
    '#F59E0B', // amber
    '#10B981', // emerald
    '#8B5CF6', // purple
    '#06B6D4', // cyan
    '#84CC16', // lime
    '#F97316'  // orange
  ];

  // Load assistants when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAssistants();
      // Reset form
      setFormData({
        name: '',
        description: '',
        default_assistant_id: undefined,
        color: '#3B82F6',
        icon: '📁',
        is_favorited: false
      });
      setError(null);
    }
  }, [isOpen]);

  const loadAssistants = async () => {
    setLoadingAssistants(true);
    try {
      const response = await assistantService.getAssistants();
      // Extract the assistants array from the response
      setAssistants(response.assistants || []);
    } catch (error) {
      console.error('Failed to load assistants:', error);
      setAssistants([]); // Set empty array on error
    } finally {
      setLoadingAssistants(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Folder name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const folder = await projectService.createProject(formData);
      onFolderCreated(folder.id);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProjectCreateRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Folder className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Folder</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Work, Research, Personal..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of what this folder is for..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Default Assistant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4" />
                <span>Default Assistant (Optional)</span>
              </div>
            </label>
            <p className="text-xs text-gray-500 mb-3">
              New conversations in this folder will use this assistant by default
            </p>
            
            {loadingAssistants ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Loading assistants...</span>
              </div>
            ) : (
              <select
                value={formData.default_assistant_id || ''}
                onChange={(e) => handleInputChange('default_assistant_id', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No default assistant</option>
                {Array.isArray(assistants) && assistants.map(assistant => (
                  <option key={assistant.id} value={assistant.id}>
                    {assistant.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Visual Customization */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center space-x-2">
                  <span>{formData.icon}</span>
                  <span>Icon</span>
                </div>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {folderIcons.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => handleInputChange('icon', icon)}
                    className={`p-2 rounded-lg text-lg transition-colors ${
                      formData.icon === icon
                        ? 'bg-blue-100 border-2 border-blue-300'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center space-x-2">
                  <Palette className="w-4 h-4" />
                  <span>Color</span>
                </div>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {folderColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleInputChange('color', color)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      formData.color === color
                        ? 'ring-2 ring-gray-400 ring-offset-2'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Favorite */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="favorite"
              checked={formData.is_favorited}
              onChange={(e) => handleInputChange('is_favorited', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="favorite" className="text-sm text-gray-700">
              Mark as favorite
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 