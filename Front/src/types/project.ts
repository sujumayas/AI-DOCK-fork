/**
 * Project Types
 * Interfaces for user-created projects that group conversations with custom prompts
 */

// ProjectModelPreferences removed - using Record<string, any> for flexibility

export interface ProjectSummary {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_favorited: boolean;
  is_archived: boolean;
  conversation_count: number;
  last_accessed_at?: string;
}

export interface ProjectDetails {
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

export interface ProjectListResponse {
  projects: ProjectSummary[];
  total: number;
  has_more: boolean;
}

export interface ProjectConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_at?: string;
}