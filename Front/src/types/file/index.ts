// Central export point for all file-related types and utilities
// This allows clean imports like: import { FileUpload, generateFileId } from '../../types/file'

// Export all core types
export * from './core';

// Export all PDF-specific types
export * from './pdf';

// Export all Word document-specific types
export * from './word';

// Export all validation types and classes
export * from './validation';

// Export all constants - these should only come from constants.ts
export * from './constants';

// Export utility functions explicitly to avoid conflicts with constants
export {
  generateFileId,
  createFileUpload,
  validateFileDetailed,
  validateFile,
  isSupportedFileType,
  isValidFileSize,
  isPDFFile,
  isWordFile,
  isUploadInProgress,
  isUploadCompleted,
  hasUploadError,
  canRetryUpload,
  isAttachmentDownloadable,
  hasPDFMetadata,
  isPDFTextExtractionSuccessful,
  isPDFSuitableForAI,
  hasWordMetadata,
  isWordTextExtractionSuccessful,
  isWordSuitableForAI,
  formatFileSize,
  getFileIcon,
  calculateUploadSpeed,
  estimateRemainingTime,
  formatPDFMetadata,
  getPDFQualityDescription,
  getPDFProcessingStatus,
  formatWordMetadata,
  getWordQualityDescription,
  getWordComplexityDescription,
  getWordProcessingStatus,
  extractWordOutline,
  isWordStructureComplex,
  shouldProcessWordDocument,
  validateWordDocumentSignature
} from './utilities';

// Note: This index file maintains the same public API as the original file.ts
// All existing imports will continue to work without any changes.
// 
// Constants are exported only from constants.ts to avoid conflicts.
// Utility functions are explicitly exported to prevent star export conflicts.
