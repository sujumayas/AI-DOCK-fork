// 📂 Projects Sidebar Component
// Displays a toggleable list of projects with management capabilities
// Features proper mobile/desktop responsive behavior with glassmorphism design

import React from 'react';
// import { ProjectSummary } from '../../../types/project';
import { ProjectManager } from '../ProjectManager';

interface ProjectsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProjectId: number | null;
  onSelectProject: (projectId: number | null) => void;
  onProjectChange: () => Promise<void>;
  onProjectUpdated: (projectId: number) => void;
  isStreaming: boolean;
  className?: string;
}

export const ProjectsSidebar: React.FC<ProjectsSidebarProps> = ({
  isOpen,
  onClose,
  selectedProjectId,
  onSelectProject,
  onProjectChange,
  onProjectUpdated,
  isStreaming,
  className = ''
}) => {
  return (
    <>
      {/* Mobile overlay backdrop - only show on mobile when open */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
          aria-label="Close projects sidebar"
        />
      )}

      {/* Sidebar container with proper responsive behavior */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-80
          transform transition-transform duration-300 ease-in-out
          bg-white/10 backdrop-blur-xl border-r border-white/20 shadow-2xl
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${className}
        `}
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(59,130,246,0.1) 100%)',
        }}
        aria-hidden={!isOpen}
      >
        {/* Glassmorphism background effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-teal-500/5 pointer-events-none" />
        
        {/* Project Manager Content */}
        <ProjectManager
          selectedProjectId={selectedProjectId}
          onProjectSelect={onSelectProject}
          onProjectChange={onProjectChange}
          onProjectUpdated={onProjectUpdated}
          isStreaming={isStreaming}
          className="h-full relative z-10"
        />
      </aside>
    </>
  );
};