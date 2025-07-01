// 📂 Project Manager Component
// Allows users to view, select, and manage their projects
// Now supports Claude Desktop-like project detail view

import React, { useEffect, useState } from 'react';
import { ProjectSummary } from '../../types/project';
import { projectService } from '../../services/projectService';
import { Folder, PlusCircle, FolderOpen, Settings, Archive, Pencil, Star, Users, Calendar, ArrowLeft, MessageSquare } from 'lucide-react';
import { CreateProjectModal } from './ui/CreateProjectModal';
import { EditProjectModal } from './ui/EditProjectModal';
import { ProjectConversationList } from './ui/ProjectConversationList';

interface ProjectManagerProps {
  selectedProjectId: number | null;
  onProjectSelect: (projectId: number | null) => void;
  onProjectChange: () => Promise<void>;
  onProjectUpdated: (projectId: number) => void;
  isStreaming: boolean;
  className?: string;
  // Conversation management props
  currentConversationId?: number;
  onSelectConversation?: (conversationId: number) => void;
  onNewConversation?: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  selectedProjectId,
  onProjectSelect,
  onProjectChange,
  onProjectUpdated,
  isStreaming,
  className = '',
  currentConversationId,
  onSelectConversation,
  onNewConversation
}) => {
  // State
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // Load projects
  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Separate active and archived projects
  const activeProjects = projects.filter(p => !p.is_archived);
  const archivedProjects = projects.filter(p => p.is_archived);
  
  // Handle project selection - show detail view instead of just highlighting
  const handleProjectSelect = (projectId: number | null) => {
    if (projectId === null) {
      // "All Projects" selected - go back to list view
      setViewMode('list');
      onProjectSelect(null);
    } else {
      // Specific project selected - show detail view
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setSelectedProject(project);
        setViewMode('detail');
        onProjectSelect(projectId);
      }
    }
  };
  
  // Handle back to projects list
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedProject(null);
    onProjectSelect(null);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          {viewMode === 'detail' && selectedProject ? (
            <>
              <button
                onClick={handleBackToList}
                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg shadow-md">
                {selectedProject.icon ? (
                  <span className="text-sm">{selectedProject.icon}</span>
                ) : (
                  <FolderOpen className="w-4 h-4 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedProject.name}</h2>
                <p className="text-xs text-white/60">{selectedProject.conversation_count || 0} conversations</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg shadow-md">
                <Folder className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Projects</h2>
                <p className="text-xs text-white/60">{activeProjects.length} active</p>
              </div>
            </>
          )}
        </div>
        {!isStreaming && viewMode === 'list' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
            title="Create new project"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        )}
        {!isStreaming && viewMode === 'detail' && selectedProject && (
          <button
            onClick={() => {
              setShowEditModal(true);
            }}
            className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
            title="Edit project"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProjectCreated={(projectId) => {
          onProjectSelect(projectId);
          onProjectChange();
        }}
      />

      {/* Edit Project Modal */}
      {selectedProject && (
        <EditProjectModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          project={selectedProject}
          onProjectUpdated={(projectId) => {
            onProjectUpdated(projectId);
            onProjectChange();
          }}
          onProjectDeleted={(projectId) => {
            if (selectedProjectId === projectId) {
              onProjectSelect(null);
            }
            onProjectChange();
          }}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white"></div>
            <p className="text-sm text-white/60">Loading projects...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 flex items-center justify-center bg-red-500/20 rounded-full mx-auto mb-3">
              <Settings className="w-6 h-6 text-red-300" />
            </div>
            <p className="text-sm text-red-300 mb-3">{error}</p>
            <button
              onClick={loadProjects}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg text-white text-sm transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'list' ? (
            /* Projects List View */
            <div className="p-4 space-y-6">
              {/* "All Projects" option */}
              <div className="relative group">
                <button
                  onClick={() => handleProjectSelect(null)}
                  disabled={isStreaming}
                  className={`w-full p-4 rounded-xl transition-all duration-200 ${
                    selectedProjectId === null
                      ? 'bg-gradient-to-r from-blue-500/30 to-teal-500/30 border border-blue-400/40 shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20'
                  } backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-teal-600 shadow-md">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="font-semibold text-white">All Projects</h4>
                      <p className="text-sm text-white/60">View conversations from all projects</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Active projects */}
              {activeProjects.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Active Projects</h3>
                    <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">
                      {activeProjects.length}
                    </span>
                  </div>
                  {activeProjects.map(project => (
                    <div key={project.id} className="relative group">
                      <button
                        onClick={() => handleProjectSelect(project.id)}
                        disabled={isStreaming}
                        className="w-full p-4 rounded-xl transition-all duration-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transform"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md">
                            {project.icon ? (
                              <span className="text-lg">{project.icon}</span>
                            ) : (
                              <FolderOpen className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-white truncate">
                                {project.name}
                              </h4>
                              {project.is_favorited && (
                                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                              )}
                            </div>
                            {project.description && (
                              <p className="text-sm text-white/60 truncate mt-1">
                                {project.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-4 mt-2 text-xs text-white/50">
                              <div className="flex items-center space-x-1">
                                <MessageSquare className="w-3 h-3" />
                                <span>{project.conversation_count || 0} conversations</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                      {!isStreaming && (
                        <button
                          onClick={() => {
                            setSelectedProject(project);
                            setShowEditModal(true);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-105 shadow-lg"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {activeProjects.length === 0 && archivedProjects.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-center py-8">
                  <div className="space-y-4">
                    <div className="w-16 h-16 flex items-center justify-center bg-white/10 rounded-2xl mx-auto backdrop-blur-sm">
                      <Folder className="w-8 h-8 text-white/60" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">No Projects Yet</h3>
                      <p className="text-white/60 text-sm mb-6 max-w-xs">
                        Create your first project to organize conversations and set custom prompts
                      </p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                      >
                        Create Project
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Project Detail View - Claude Desktop Style */
            selectedProject && (
              <div className="h-full flex flex-col">
                {/* Project Info */}
                <div className="p-4 border-b border-white/10">
                  {selectedProject.description && (
                    <p className="text-white/80 text-sm mb-4">
                      {selectedProject.description}
                    </p>
                  )}
                  
                  {/* New Chat Button */}
                  <button
                    onClick={() => {
                      if (onNewConversation) {
                        onNewConversation();
                      }
                    }}
                    disabled={isStreaming}
                    className="w-full p-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>New Chat</span>
                  </button>
                </div>
                
                {/* Project Conversations */}
                <div className="flex-1 overflow-hidden">
                  <ProjectConversationList
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    currentConversationId={currentConversationId}
                    onSelectConversation={onSelectConversation}
                    onNewConversation={onNewConversation}
                    isStreaming={isStreaming}
                    className="h-full"
                  />
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Footer - Only show in list view */}
      {!loading && activeProjects.length > 0 && viewMode === 'list' && (
        <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-sm">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center space-x-2 p-3 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:scale-[1.02] transform"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="font-medium">Create New Project</span>
          </button>
        </div>
      )}
    </div>
  );
};