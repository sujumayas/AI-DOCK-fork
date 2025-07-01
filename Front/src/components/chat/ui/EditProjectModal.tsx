// 📂 Edit Project Modal Component
// Form for editing existing projects

import React, { useState, useEffect } from 'react';
import { Save, X, Archive, Trash2, Folder, FileText, Wand2 } from 'lucide-react';
import type { ProjectSummary, ProjectDetails } from '../../../types/project';
import { projectService } from '../../../services/projectService';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSummary;
  onProjectUpdated: (projectId: number) => void;
  onProjectDeleted?: (projectId: number) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
  onProjectDeleted
}) => {
  // Project details state
  const [, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelPreferences, setModelPreferences] = useState<Record<string, any>>({});
  const [isArchived, setIsArchived] = useState(project.is_archived);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load project details when modal opens
  useEffect(() => {
    if (isOpen && project) {
      const loadProjectDetails = async () => {
        setLoading(true);
        setError(null);
        try {
          const details = await projectService.getProject(project.id);
          setProjectDetails(details);
          
          // Update form with full details
          setName(details.name);
          setDescription(details.description || '');
          setSystemPrompt(details.system_prompt || '');
          setModelPreferences(details.model_preferences || {});
          setIsArchived(details.is_archived);
        } catch (err: any) {
          setError(err.message || 'Failed to load project details');
          // Fall back to summary data
          setName(project.name);
          setDescription(project.description || '');
          setSystemPrompt('');
          setModelPreferences({});
          setIsArchived(project.is_archived);
        } finally {
          setLoading(false);
        }
      };
      
      loadProjectDetails();
    }
  }, [isOpen, project]);

  // Handle close
  const handleClose = () => {
    setError(null);
    setShowDeleteConfirm(false);
    onClose();
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate
      if (!name.trim()) {
        throw new Error('Project name is required');
      }

      // Update project
      await projectService.updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim() || undefined,
        model_preferences: Object.keys(modelPreferences).length > 0 ? modelPreferences : undefined,
        is_archived: isArchived
      });

      // Notify and close
      onProjectUpdated(project.id);
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle archive toggle
  const handleArchiveToggle = async () => {
    try {
      if (isArchived) {
        await projectService.unarchiveProject(project.id);
        setIsArchived(false);
      } else {
        await projectService.archiveProject(project.id);
        setIsArchived(true);
      }
      onProjectUpdated(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project archive status');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      await projectService.deleteProject(project.id);
      onProjectDeleted?.(project.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={handleClose} 
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(59,130,246,0.1) 100%)',
        }}
      >
        {/* Glassmorphism background effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-teal-500/5 rounded-2xl pointer-events-none" />
        
        <div className="relative p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-blue-500 to-teal-600 rounded-xl shadow-lg">
                <Folder className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Edit Project</h2>
                <p className="text-sm text-white/60">Modify project settings and preferences</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white"></div>
                <p className="text-sm text-white/60">Loading project details...</p>
              </div>
            </div>
          )}

          {/* Form */}
          {!loading && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-white">
                  <FileText className="w-4 h-4 text-blue-300" />
                  <span>Project Name*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all duration-200"
                  placeholder="Enter a descriptive project name"
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-white">
                  <FileText className="w-4 h-4 text-teal-300" />
                  <span>Description</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400/50 transition-all duration-200 resize-none"
                  placeholder="Describe the purpose of this project (optional)"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-white">
                  <Wand2 className="w-4 h-4 text-purple-300" />
                  <span>System Prompt</span>
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all duration-200 resize-none"
                  placeholder="Define custom instructions for this project's AI conversations (optional)"
                  rows={4}
                  maxLength={2000}
                />
                <div className="flex items-center space-x-2 text-xs text-white/50">
                  <Wand2 className="w-3 h-3" />
                  <span>This will be applied to all conversations in this project</span>
                </div>
              </div>

              {/* Archive toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                <div className="flex items-center space-x-3">
                  <Archive className={`w-5 h-5 ${isArchived ? 'text-orange-300' : 'text-white/60'}`} />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {isArchived ? 'Archived Project' : 'Active Project'}
                    </p>
                    <p className="text-xs text-white/60">
                      {isArchived 
                        ? 'This project is archived and hidden from the main list' 
                        : 'This project is active and visible in the main list'
                      }
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    isArchived
                      ? 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/30 border border-orange-400/40'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
                  }`}
                >
                  {isArchived ? 'Unarchive' : 'Archive'}
                </button>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-4 bg-red-500/20 backdrop-blur-sm border border-red-400/40 rounded-xl">
                  <p className="text-sm text-red-200 font-medium">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {/* Delete button */}
                <div>
                  {showDeleteConfirm ? (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/40 rounded-lg text-sm font-medium transition-all duration-200"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 border border-white/20 rounded-lg text-sm font-medium transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center space-x-2 px-4 py-2 text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-lg transition-all duration-200 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Project</span>
                    </button>
                  )}
                </div>

                {/* Save/Cancel buttons */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-3 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl transition-all duration-200 hover:scale-105 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-600 hover:from-blue-600 hover:to-teal-700 text-white rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg font-medium"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};