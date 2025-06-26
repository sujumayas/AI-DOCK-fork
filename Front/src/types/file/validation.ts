// File validation types and utilities for AI Dock

export interface FileValidationResult {
  blockingErrors: string[];
  warnings: string[];
  isValid: boolean;
}

export interface FileValidationError {
  code: FileValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type FileValidationErrorCode =
  | 'file-too-large'
  | 'file-invalid-type'
  | 'too-many-files'
  | 'file-empty'
  | 'file-corrupt'
  | 'filename-invalid'
  | 'pdf-password-protected'
  | 'pdf-no-text'
  | 'pdf-processing-failed'
  | 'pdf-too-many-pages'
  | 'word-password-protected'
  | 'word-no-text'
  | 'word-processing-failed'
  | 'word-too-complex'
  | 'word-unsupported-format'
  | 'word-corrupted'
  | 'word-macro-content'
  | 'word-too-many-pages';

export class FileUploadError extends Error {
  constructor(
    message: string,
    public errorType: string,
    public statusCode?: number,
    public fileId?: string
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

export class FileValidationFailedError extends Error {
  constructor(
    message: string,
    public validationErrors: FileValidationError[],
    public file: File
  ) {
    super(message);
    this.name = 'FileValidationFailedError';
  }
}

// Note: Constants have been moved to constants.ts to avoid export conflicts
// Import constants from './constants' when needed in validation functions
