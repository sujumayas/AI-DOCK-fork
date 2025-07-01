// 📂 Create Project Modal Component
// Form for creating new projects with name, description, and system prompt

import React, { useState } from 'react';
import { PlusCircle, X, Folder, Wand2, FileText } from 'lucide-react';
// Removed ProjectModelPreferences import as it's no longer needed
import { projectService } from '../../../services/projectService';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: number) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelPreferences, setModelPreferences] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form
  const resetForm = () => {
    setName('');
    setDescription('');
    setSystemPrompt('');
    setModelPreferences({});
    setError(null);
  };

  // Handle close
  const handleClose = () => {
    resetForm();
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

      // Create project
      const newProject = await projectService.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim() || undefined,
        model_preferences: Object.keys(modelPreferences).length > 0 ? modelPreferences : undefined
      });

      // Reset and close
      resetForm();
      onProjectCreated(newProject.id);
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
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
              <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg">
                <Folder className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Create New Project</h2>
                <p className="text-sm text-white/60">Organize conversations with custom settings</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
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

            {/* Error message */}
            {error && (
              <div className="p-4 bg-red-500/20 backdrop-blur-sm border border-red-400/40 rounded-xl">
                <p className="text-sm text-red-200 font-medium">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
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
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg font-medium"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Creating...' : 'Create Project'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};