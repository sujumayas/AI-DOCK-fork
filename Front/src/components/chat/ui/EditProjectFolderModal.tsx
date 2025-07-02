// 📁 Edit Project Folder Modal - Simplified Version
// Simple modal for editing folders with default assistant selection
// Replaces the complex project editing with folder-based approach

import React, { useState, useEffect } from 'react';
import { X, Folder, Bot, Palette, Trash2, Archive, Star } from 'lucide-react';
import { ProjectSummary, ProjectUpdateRequest } from '../../../types/project';
import { AssistantSummary } from '../../../types/assistant';
import { projectService } from '../../../services/projectService';
import { assistantService } from '../../../services/assistantService';

interface EditProjectFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ProjectSummary;
  onFolderUpdated: (folderId: number) => void;
  onFolderDeleted: (folderId: number) => void;
}

export const EditProjectFolderModal: React.FC<EditProjectFolderModalProps> = ({
  isOpen,
  onClose,
  folder,
  onFolderUpdated,
  onFolderDeleted
}) => {
  const [formData, setFormData] = useState<ProjectUpdateRequest>({
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Initialize form data from folder
  useEffect(() => {
    if (isOpen && folder) {
      setFormData({
        name: folder.name,
        description: folder.description || '',
        default_assistant_id: folder.default_assistant_id,
        color: folder.color || '#3B82F6',
        icon: folder.icon || '📁',
        is_favorited: folder.is_favorited
      });
      setError(null);
      setShowDeleteConfirm(false);
      loadAssistants();
    }
  }, [isOpen, folder]);

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
    
    if (!formData.name?.trim()) {
      setError('Folder name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await projectService.updateProject(folder.id, formData);
      onFolderUpdated(folder.id);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to update folder');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      await projectService.deleteProject(folder.id);
      onFolderDeleted(folder.id);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to delete folder');
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    setError(null);

    try {
      await projectService.archiveProject(folder.id);
      onFolderUpdated(folder.id);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to archive folder');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProjectUpdateRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen || !folder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-sm">{folder.icon}</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Folder</h2>
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

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <h3 className="font-medium text-red-900">Delete Folder</h3>
              </div>
              <p className="text-sm text-red-700 mb-4">
                Are you sure you want to delete "{folder.name}"? This action cannot be undone.
                {folder.conversation_count > 0 && (
                  <span className="block mt-1 font-medium">
                    This folder contains {folder.conversation_count} conversation(s).
                  </span>
                )}
              </p>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
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
                <span>Default Assistant</span>
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

          {/* Folder Actions */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Folder Actions</h3>
            <div className="space-y-2">
              {!folder.is_archived && (
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={loading}
                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archive Folder</span>
                </button>
              )}
              
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || showDeleteConfirm}
                className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Folder</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
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
              disabled={loading || !formData.name?.trim() || showDeleteConfirm}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 