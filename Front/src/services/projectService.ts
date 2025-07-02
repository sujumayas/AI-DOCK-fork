import type { ProjectSummary, ProjectDetails, ProjectListResponse } from "../types/project";
import { authService } from './authService';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface Project {
  id: number;
  name: string;
  description?: string;
  system_prompt?: string;
  system_prompt_preview?: string;
  model_preferences?: Record<string, any>;
  has_custom_preferences: boolean;
  color?: string;
  icon?: string;
  user_id: number;
  is_active: boolean;
  is_archived: boolean;
  is_favorited: boolean;
  conversation_count: number;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
}

export interface ProjectServiceError extends Error {
  code?: string;
  status?: number;
  details?: any;
}

// =============================================================================
// API CLIENT CONFIGURATION
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Make authenticated API requests to project endpoints
 * Following the same pattern as other working services in the codebase
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get authentication token using authService (same as other services)
  const token = authService.getToken();
  if (!token) {
    throw new ProjectServiceError('Authentication required. Please log in.');
  }

  // Build full URL
  const url = `${API_BASE_URL}${endpoint}`;

  // Set up headers with proper authentication
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  try {
    console.log(`🎯 Project API: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle authentication errors
    if (response.status === 401) {
      authService.logout(); // Clear invalid token
      throw new ProjectServiceError('Session expired. Please log in again.');
    }

    if (response.status === 403) {
      throw new ProjectServiceError('Access denied. Please check your permissions.');
    }

    if (response.status === 404) {
      throw new ProjectServiceError('Project not found.');
    }

    // Handle client errors (400-499)
    if (response.status >= 400 && response.status < 500) {
      let errorMessage = `Request failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If we can't parse error response, use the default message
      }
      throw new ProjectServiceError(errorMessage);
    }

    // Handle server errors (500+)
    if (response.status >= 500) {
      throw new ProjectServiceError('Server error. Please try again later.');
    }

    // Handle successful responses
    if (response.status === 204) {
      // No content (successful delete)
      return null as T;
    }

    if (!response.ok) {
      throw new ProjectServiceError(`Unexpected response: ${response.statusText}`);
    }

    // Parse and return JSON response
    const data = await response.json();
    console.log(`✅ Project API Success:`, data);
    return data;

  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof ProjectServiceError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new ProjectServiceError('Network error. Please check your connection.');
    }

    // Handle unexpected errors
    console.error('❌ Unexpected API error:', error);
    throw new ProjectServiceError(`Unexpected error: ${error.message || 'Unknown error'}`);
  }
}

// Custom error class
class ProjectServiceError extends Error {
  code?: string;
  status?: number;
  details?: any;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProjectServiceError';
    this.status = status;
  }
}

// =============================================================================
// PROJECT SERVICE
// =============================================================================

class ProjectServiceClass {
  // Get all projects
  async getProjects(): Promise<ProjectSummary[]> {
    try {
      const response = await apiRequest<ProjectListResponse>('/api/projects/');
      return response.projects || [];
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      throw error;
    }
  }

  // Get a specific project
  async getProject(projectId: number): Promise<ProjectDetails> {
    try {
      const response = await apiRequest<ProjectDetails>(`/api/projects/${projectId}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch project ${projectId}:`, error);
      throw error;
    }
  }

  // Create a new project
  async createProject(data: {
    name: string;
    description?: string;
    system_prompt?: string;
    model_preferences?: Record<string, any>;
    color?: string;
    icon?: string;
  }): Promise<ProjectDetails> {
    try {
      const response = await apiRequest<ProjectDetails>('/api/projects/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  // Update a project
  async updateProject(
    projectId: number,
    data: {
      name?: string;
      description?: string;
      system_prompt?: string;
      model_preferences?: Record<string, any>;
      color?: string;
      icon?: string;
      is_active?: boolean;
      is_archived?: boolean;
      is_favorited?: boolean;
    }
  ): Promise<ProjectDetails> {
    try {
      const response = await apiRequest<ProjectDetails>(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      console.error(`Failed to update project ${projectId}:`, error);
      throw error;
    }
  }

  // Delete project
  async deleteProject(projectId: number): Promise<void> {
    try {
      await apiRequest<void>(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Failed to delete project ${projectId}:`, error);
      throw error;
    }
  }

  // Archive project
  async archiveProject(projectId: number): Promise<void> {
    try {
      await apiRequest<void>(`/api/projects/${projectId}/archive`, {
        method: 'POST',
      });
    } catch (error) {
      console.error(`Failed to archive project ${projectId}:`, error);
      throw error;
    }
  }

  // Unarchive project
  async unarchiveProject(projectId: number): Promise<void> {
    try {
      await apiRequest<void>(`/api/projects/${projectId}/unarchive`, {
        method: 'POST',
      });
    } catch (error) {
      console.error(`Failed to unarchive project ${projectId}:`, error);
      throw error;
    }
  }

  // Toggle favorite status
  async toggleFavorite(projectId: number): Promise<void> {
    try {
      await apiRequest<void>(`/api/projects/${projectId}/favorite`, {
        method: 'POST',
      });
    } catch (error) {
      console.error(`Failed to toggle favorite for project ${projectId}:`, error);
      throw error;
    }
  }

  // Add conversation to project
  async addConversationToProject(projectId: number, conversationId: number): Promise<void> {
    try {
      await apiRequest<void>(`/api/projects/${projectId}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conversationId }),
      });
    } catch (error) {
      console.error(`Failed to add conversation ${conversationId} to project ${projectId}:`, error);
      throw error;
    }
  }

  // Remove conversation from project
  async removeConversationFromProject(projectId: number, conversationId: number): Promise<void> {
    try {
      await apiRequest<void>(`/api/projects/${projectId}/conversations/${conversationId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Failed to remove conversation ${conversationId} from project ${projectId}:`, error);
      throw error;
    }
  }

  // Get project conversations
  async getProjectConversations(projectId: number): Promise<any[]> {
    try {
      const response = await apiRequest<{ conversations: any[] }>(`/api/projects/${projectId}/conversations`);
      return response.conversations || [];
    } catch (error) {
      console.error(`Failed to fetch conversations for project ${projectId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const projectService = new ProjectServiceClass();