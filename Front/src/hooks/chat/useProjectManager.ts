// 📂 Project Management Hook
// Handles project selection, loading, and state management

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProjectSummary, ProjectDetails } from '../../types/project';
import type { ChatMessage } from '../../types/chat';

// Import service (to be implemented)
import { projectService } from '../../services/projectService';

export interface ProjectManagerReturn {
  availableProjects: ProjectSummary[];
  selectedProjectId: number | null;
  selectedProject: ProjectDetails | null;
  projectsLoading: boolean;
  projectsError: string | null;
  showProjectManager: boolean;
  handleProjectSelect: (projectId: number | null) => void;
  handleProjectChange: () => Promise<void>;
  handleProjectIntroduction: (project: ProjectDetails, previousProject: ProjectDetails | null) => ChatMessage;
  setShowProjectManager: (show: boolean) => void;
  clearProjectFromUrl: () => void;
  loadAvailableProjects: (skipIntro?: boolean) => Promise<void>;
  // Added for default assistant integration
  getProjectDefaultAssistantId: (projectId: number) => number | null;
}

export const useProjectManager = (
  onMessage?: (message: ChatMessage) => void
): ProjectManagerReturn => {
  // State
  const [searchParams, setSearchParams] = useSearchParams();
  const [availableProjects, setAvailableProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetails | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);

  // Load projects initially and when URL params change
  useEffect(() => {
    const projectId = searchParams.get('project');
    if (projectId) {
      const numericId = parseInt(projectId, 10);
      if (!isNaN(numericId)) {
        handleProjectSelect(numericId);
      }
    }
  }, [searchParams]);

  // Load available projects
  const loadAvailableProjects = useCallback(async (skipIntro: boolean = false) => {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const projects = await projectService.getProjects();
      setAvailableProjects(projects);

      // If URL has a project ID, select it
      const projectId = searchParams.get('project');
      if (projectId) {
        const numericId = parseInt(projectId, 10);
        if (!isNaN(numericId)) {
          // Load full project details for the selected project
          try {
            const project = await projectService.getProject(numericId);
            setSelectedProjectId(numericId);
            setSelectedProject(project);

            // Add introduction message if needed
            if (!skipIntro && onMessage) {
              const introMessage = handleProjectIntroduction(project, null);
              onMessage(introMessage);
            }
          } catch (error) {
            console.error('Failed to load project details:', error);
            // Fallback to summary data if available
            const projectSummary = projects.find(p => p.id === numericId);
            if (projectSummary) {
              setSelectedProjectId(numericId);
              // Convert summary to partial details
              setSelectedProject({
                ...projectSummary,
                system_prompt: undefined,
                system_prompt_preview: undefined,
                model_preferences: undefined,
                has_custom_preferences: false,
                user_id: 0, // We don't have this from summary
                is_active: true,
                created_at: '',
                updated_at: ''
              } as ProjectDetails);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjectsError('Failed to load available projects');
    } finally {
      setProjectsLoading(false);
    }
  }, [searchParams, onMessage]);

  // Handle project selection
  const handleProjectSelect = useCallback(async (projectId: number | null) => {
    // Clear current project
    if (!projectId) {
      setSelectedProjectId(null);
      setSelectedProject(null);
      setSearchParams(params => {
        params.delete('project');
        return params;
      });
      return;
    }

    try {
      const project = await projectService.getProject(projectId);
      
      // Update state
      setSelectedProjectId(projectId);
      setSelectedProject(project);

      // Update URL
      setSearchParams(params => {
        params.set('project', projectId.toString());
        return params;
      });

      // Generate introduction message
      if (onMessage) {
        const introMessage = handleProjectIntroduction(project, selectedProject);
        onMessage(introMessage);
      }
    } catch (error) {
      console.error('Failed to select project:', error);
      setProjectsError('Failed to select project');
    }
  }, [selectedProject, setSearchParams, onMessage]);

  // Handle project updates
  const handleProjectChange = useCallback(async () => {
    await loadAvailableProjects(true);
  }, [loadAvailableProjects]);

  // Generate project introduction message
  const handleProjectIntroduction = useCallback((
    project: ProjectDetails,
    previousProject: ProjectDetails | null
  ): ChatMessage => {
    const message: ChatMessage = {
      role: 'system',
      content: `Now working in the "${project.name}" project${previousProject ? ` (switched from "${previousProject.name}")` : ''}.${
        project.description ? `\n\n${project.description}` : ''
      }`,
      projectId: project.id,
      projectName: project.name,
      projectChanged: !!previousProject
    };

    if (previousProject) {
      message.previousProjectName = previousProject.name;
    }

    return message;
  }, []);

  // Clear project from URL
  const clearProjectFromUrl = useCallback(() => {
    setSearchParams(params => {
      params.delete('project');
      return params;
    });
  }, [setSearchParams]);

  // Get default assistant ID for a project
  const getProjectDefaultAssistantId = useCallback((projectId: number): number | null => {
    if (selectedProject && selectedProject.id === projectId) {
      return selectedProject.default_assistant_id || null;
    }
    
    // Fallback to project summary if available
    const projectSummary = availableProjects.find(p => p.id === projectId);
    return projectSummary?.default_assistant_id || null;
  }, [selectedProject, availableProjects]);

  return {
    availableProjects,
    selectedProjectId,
    selectedProject,
    projectsLoading,
    projectsError,
    showProjectManager,
    handleProjectSelect,
    handleProjectChange,
    handleProjectIntroduction,
    setShowProjectManager,
    clearProjectFromUrl,
    loadAvailableProjects,
    getProjectDefaultAssistantId
  };
};