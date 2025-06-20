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

// Admin functionality types
export * from './admin';

// User management types
export * from './manager';

// Quota system types
export * from './quota';

// Usage analytics types
export * from './usage';

// File upload and attachment types
export * from './file';

// =============================================================================
// CONVENIENCE RE-EXPORTS
// =============================================================================

// Most commonly used chat types
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatUIState,
  LLMConfigurationSummary
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

// =============================================================================
// UTILITY TYPE COLLECTIONS
// =============================================================================

// All error classes for centralized error handling
export {
  ChatServiceError,
  ConversationServiceError,
  // 📁 NEW: File-related chat utility functions
  messageHasFiles,
  getMessageFileCount,
  conversationHasFiles,
  getTotalFileCount,
  createChatMessageWithFiles
} from './chat';

export {
  FileUploadError,
  FileValidationFailedError
} from './file';

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

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// Clean imports throughout the application:

// Import specific types (recommended for most cases)
import { ChatMessage, ConversationSummary, FileUpload, FileAttachment } from '@/types';

// Import all types from a domain
import { ChatTypes, ConversationTypes, FileTypes } from '@/types';

// Import utility functions
import { 
  chatMessageToConversationMessage, 
  shouldAutoSave,
  formatFileSize,
  validateFile,
  getFileIcon 
} from '@/types';

// Import error classes
import { 
  ChatServiceError, 
  ConversationServiceError,
  FileUploadError,
  FileValidationFailedError 
} from '@/types';

// Use domain-specific type collections
function handleChat(message: ChatTypes['Message']) { ... }
function saveConversation(conv: ConversationTypes['Create']) { ... }
function uploadFile(file: FileTypes['Upload']) { ... }
function trackProgress(progress: FileTypes['Progress']) { ... }
*/
