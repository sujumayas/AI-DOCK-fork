// AI Dock Types Index
// Central export file for all TypeScript types
// This provides clean imports throughout the application

// =============================================================================
// CORE FEATURE TYPES
// =============================================================================

// Authentication types
export * from './auth';

// Chat functionality types
export * from './chat';

// Conversation management types
export * from './conversation';

// Admin functionality types (avoid User duplicate with auth)
export type {
  LoadingState,
  UserResponse,
  CreateUserRequest,
  UpdateUserRequest,
  UserListResponse,
  UserSearchFilters,
  UserSearchResult,
  UserStats,
  UserRole,
  UserPermission,
  RoleResponse,
  PermissionResponse,
  DepartmentResponse,
  DepartmentCreateRequest,
  DepartmentUpdateRequest,
  DepartmentListResponse,
  DepartmentStats,
  DepartmentWithUsers,
  AdminApiResponse,
  AdminApiError
} from './admin';

// User management types
export * from './manager';

// Quota system types
export * from './quota';

// Usage analytics types
export * from './usage';

// File upload and attachment types
export * from './file';

// Custom assistants types
export * from './assistant';

// =============================================================================
// CONVENIENCE RE-EXPORTS
// =============================================================================

// Most commonly used chat types
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatUIState
} from './chat';

// Most commonly used conversation types
export type {
  Conversation,
  ConversationSummary,
  ConversationDetail,
  ConversationMessage,
  ConversationCreate,
  ConversationUIState
} from './conversation';

// Most commonly used auth types
export type {
  LoginRequest,
  LoginResponse,
  UserInfo
} from './auth';

// Most commonly used file types
export type {
  FileUpload,
  FileMetadata,
  FileAttachment,
  UploadProgress,
  FileError,
  FileUploadUIState
} from './file';

// Most commonly used assistant types
export type {
  Assistant,
  AssistantSummary,
  AssistantCreate,
  AssistantUpdate,
  AssistantListResponse,
  AssistantConversationCreate,
  AssistantUIState
} from './assistant';

// =============================================================================
// UTILITY TYPE COLLECTIONS
// =============================================================================

// All error classes for centralized error handling
export {
  ChatServiceError,
  // 📁 NEW: File-related chat utility functions
  messageHasFiles,
  getMessageFileCount,
  conversationHasFiles,
  getTotalFileCount,
  createChatMessageWithFiles
} from './chat';

export {
  ConversationServiceError
} from './conversation';

export {
  FileUploadError,
  FileValidationFailedError
} from './file';

export {
  AssistantServiceError
} from './assistant';

// All utility functions for type conversions
export {
  chatMessageToConversationMessage,
  conversationMessageToChatMessage,
  conversationMessagesToChatMessages,
  chatMessagesToConversationMessages,
  generateTitleFromMessages,
  shouldAutoSave
} from './conversation';

// All utility functions for file operations
export {
  createFileUpload,
  generateFileId,
  validateFile,
  formatFileSize,
  getFileIcon,
  calculateUploadSpeed,
  estimateRemainingTime,
  isUploadInProgress,
  isUploadCompleted,
  hasUploadError,
  isSupportedFileType,
  isValidFileSize,
  canRetryUpload,
  isAttachmentDownloadable
} from './file';

// All utility functions for assistant operations
export {
  isAssistant,
  isAssistantSummary,
  assistantToSummary,
  createDefaultAssistantFormData,
  validateAssistantFormData,
  hasValidationErrors,
  formatAssistantStatus,
  formatConversationCount,
  generateSystemPromptPreview,
  DEFAULT_ASSISTANT_CONFIG,
  ASSISTANT_VALIDATION,
  ASSISTANT_API_DEFAULTS
} from './assistant';

// =============================================================================
// TYPE COLLECTIONS BY DOMAIN
// =============================================================================

// Everything related to chat functionality
export type ChatTypes = {
  Message: import('./chat').ChatMessage;
  Request: import('./chat').ChatRequest;
  Response: import('./chat').ChatResponse;
  UIState: import('./chat').ChatUIState;
  Config: import('./chat').LLMConfigurationSummary;
  Error: import('./chat').ChatServiceError;
};

// Everything related to conversation management
export type ConversationTypes = {
  Conversation: import('./conversation').Conversation;
  Summary: import('./conversation').ConversationSummary;
  Detail: import('./conversation').ConversationDetail;
  Message: import('./conversation').ConversationMessage;
  Create: import('./conversation').ConversationCreate;
  UIState: import('./conversation').ConversationUIState;
  Error: import('./conversation').ConversationServiceError;
};

// Everything related to file uploads and attachments
export type FileTypes = {
  Upload: import('./file').FileUpload;
  Metadata: import('./file').FileMetadata;
  Attachment: import('./file').FileAttachment;
  Progress: import('./file').UploadProgress;
  Error: import('./file').FileError;
  UIState: import('./file').FileUploadUIState;
  DragDrop: import('./file').DragDropState;
  Status: import('./file').FileUploadStatus;
};

// Everything related to custom assistants
export type AssistantTypes = {
  Assistant: import('./assistant').Assistant;
  Summary: import('./assistant').AssistantSummary;
  Create: import('./assistant').AssistantCreate;
  Update: import('./assistant').AssistantUpdate;
  ListResponse: import('./assistant').AssistantListResponse;
  ConversationCreate: import('./assistant').AssistantConversationCreate;
  ConversationResponse: import('./assistant').AssistantConversationResponse;
  UIState: import('./assistant').AssistantUIState;
  FormData: import('./assistant').AssistantFormData;
  Error: import('./assistant').AssistantServiceError;
};

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// Clean imports throughout the application:

// Import specific types (recommended for most cases)
import { ChatMessage, ConversationSummary, FileUpload, FileAttachment, Assistant, AssistantCreate } from '@/types';

// Import all types from a domain
import { ChatTypes, ConversationTypes, FileTypes, AssistantTypes } from '@/types';

// Import utility functions
import { 
  chatMessageToConversationMessage, 
  shouldAutoSave,
  formatFileSize,
  validateFile,
  getFileIcon,
  validateAssistantFormData,
  formatAssistantStatus 
} from '@/types';

// Import error classes
import { 
  ChatServiceError, 
  ConversationServiceError,
  FileUploadError,
  FileValidationFailedError,
  AssistantServiceError 
} from '@/types';

// Use domain-specific type collections
function handleChat(message: ChatTypes['Message']) { ... }
function saveConversation(conv: ConversationTypes['Create']) { ... }
function uploadFile(file: FileTypes['Upload']) { ... }
function trackProgress(progress: FileTypes['Progress']) { ... }
function createAssistant(data: AssistantTypes['Create']) { ... }
function updateAssistant(assistant: AssistantTypes['Assistant']) { ... }
*/
