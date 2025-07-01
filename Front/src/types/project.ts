/**
 * Project Folder Types
 * Interfaces for simple project folders that organize conversations with default assistants
 */

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
  default_assistant_id?: number;
  default_assistant_name?: string;
  has_default_assistant: boolean;
}

export interface ProjectDetails {
  id: number;
  name: string;
  description?: string;
  default_assistant_id?: number;
  default_assistant_name?: string;
  has_default_assistant: boolean;
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

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  default_assistant_id?: number;
  color?: string;
  icon?: string;
  is_favorited?: boolean;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  default_assistant_id?: number;
  color?: string;
  icon?: string;
  is_favorited?: boolean;
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