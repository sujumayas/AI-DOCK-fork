// Assistant Error Handler
// Centralized error parsing and handling for assistant services

import { AssistantServiceError } from '../../../types/assistant';

/**
 * Assistant Error Handler
 * 
 * 🎓 LEARNING: Error Handling Patterns
 * ===================================
 * Centralized error handling provides:
 * - Consistent error message parsing
 * - Unified error response structure
 * - Type-safe error handling
 * - Debug logging capabilities
 * - Field validation error processing
 */

export class AssistantErrorHandler {
  
  /**
   * Parse error response from backend API
   * Handles different error response structures consistently
   */
  static parseErrorResponse(errorData: any, defaultMessage: string): { message: string; type: string } {
    let errorMessage = defaultMessage;
    let errorType = 'unknown_error';
    
    // Try different possible message and error type locations
    if (typeof errorData.message === 'string' && errorData.message) {
      // Flat structure - message at top level
      errorMessage = errorData.message;
      errorType = errorData.error || errorData.error_type || 'unknown_error';
    } else if (typeof errorData.detail === 'object' && errorData.detail) {
      // Nested structure - check detail object
      if (typeof errorData.detail.message === 'string' && errorData.detail.message) {
        errorMessage = errorData.detail.message;
      }
      errorType = errorData.detail.error || errorData.detail.error_type || 'unknown_error';
    } else if (typeof errorData.detail === 'string' && errorData.detail) {
      // Detail is a string message
      errorMessage = errorData.detail;
    } else if (typeof errorData.error === 'string' && errorData.error) {
      // Error field contains the message
      errorMessage = errorData.error;
    } else if (typeof errorData === 'string') {
      // Entire response is a string
      errorMessage = errorData;
    }
    
    return { message: errorMessage, type: errorType };
  }

  /**
   * Create AssistantServiceError from API response error
   */
  static createServiceError(
    error: any,
    defaultMessage: string,
    assistantId?: number,
    context?: string
  ): AssistantServiceError {
    // Handle API errors with status and data
    if (error && typeof error === 'object' && error.status && error.data) {
      const { message, type } = this.parseErrorResponse(error.data, defaultMessage);
      
      return new AssistantServiceError(
        message,
        error.status,
        assistantId,
        type,
        error.data.field_errors
      );
    }

    // Handle existing AssistantServiceError
    if (error instanceof AssistantServiceError) {
      return error;
    }

    // Handle generic errors
    const errorMessage = error instanceof Error ? error.message : defaultMessage;
    return new AssistantServiceError(errorMessage, undefined, assistantId);
  }

  /**
   * Log error with context for debugging
   */
  static logError(operation: string, error: any, context?: any): void {
    console.error(`❌ Assistant ${operation} failed:`, error);
    
    if (context) {
      console.error('Context:', context);
    }

    // Additional debug info for development
    if (error instanceof AssistantServiceError) {
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        assistantId: error.assistantId,
        errorType: error.errorType,
        fieldErrors: error.fieldErrors
      });
    }
  }

  /**
   * Handle and transform API errors with logging
   */
  static handleError(
    operation: string,
    error: any,
    defaultMessage: string,
    assistantId?: number,
    context?: any
  ): never {
    this.logError(operation, error, context);
    throw this.createServiceError(error, defaultMessage, assistantId);
  }
}
