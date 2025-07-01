// 📂 Project Selector Card Component
// Shows current project context and allows switching projects

import React from 'react';
import { Folder, ChevronRight, Sparkles } from 'lucide-react';
import type { ProjectSummary } from '../../../types/project';

interface ProjectSelectorCardProps {
  selectedProject: ProjectSummary | null;
  onChangeClick: () => void;
  isStreaming: boolean;
}

export const ProjectSelectorCard: React.FC<ProjectSelectorCardProps> = ({
  selectedProject,
  onChangeClick,
  isStreaming
}) => {
  // Don't show anything if no project is selected
  if (!selectedProject) return null;

  return (
    <div className="px-4 py-3 mb-4">
      <button
        onClick={onChangeClick}
        disabled={isStreaming}
        className={`group w-full flex items-center space-x-4 p-5 rounded-2xl transition-all duration-300 ${
          isStreaming
            ? 'opacity-50 cursor-not-allowed bg-white/5'
            : 'hover:bg-white/10 bg-white/5 hover:scale-[1.02] transform'
        } backdrop-blur-md border border-white/20 shadow-lg hover:shadow-xl`}
        style={{
          background: isStreaming 
            ? 'rgba(255,255,255,0.05)' 
            : 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(16,185,129,0.08) 100%)',
        }}
      >
        {/* Glassmorphism background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-emerald-500/5 rounded-2xl pointer-events-none" />
        
        <div className="relative flex items-center flex-1 min-w-0">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-xl mr-4 ring-2 ring-white/10 group-hover:ring-white/20 transition-all duration-300">
            {selectedProject.icon ? (
              <span className="text-2xl">{selectedProject.icon}</span>
            ) : (
              <Folder className="w-6 h-6 text-white" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-white truncate">
                {selectedProject.name}
              </h3>
              <Sparkles className="w-3 h-3 text-emerald-300 opacity-75" />
            </div>
            {selectedProject.description && (
              <p className="text-sm text-white/70 truncate mt-1">
                {selectedProject.description}
              </p>
            )}
            <div className="flex items-center space-x-2 mt-1 text-xs text-white/50">
              <span>Active Project</span>
              <span>•</span>
              <span>{selectedProject.conversation_count || 0} conversations</span>
            </div>
          </div>
        </div>
        
        <ChevronRight className={`w-5 h-5 text-white/60 transition-all duration-300 ${
          isStreaming ? 'opacity-50' : 'group-hover:text-white group-hover:translate-x-1'
        }`} />
      </button>
    </div>
  );
};