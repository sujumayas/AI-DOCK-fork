// 🛠️ Chat Error Utilities
// Centralized error handling and type definitions for chat services

import { ChatServiceError } from '../../types/chat';

/**
 * Determine error type from HTTP status code
 * 🎓 Learning: Consistent error categorization helps with user experience
 */
export const getErrorType = (statusCode: number): string => {
  switch (statusCode) {
    case 400: return 'INVALID_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 429: return 'QUOTA_EXCEEDED';
    case 502: return 'PROVIDER_ERROR';
    case 500: return 'SERVER_ERROR';
    default: return 'UNKNOWN_ERROR';
  }
};

/**
 * Create a standardized ChatServiceError from various error types
 * 🎓 Learning: Consistent error formatting improves debugging
 */
export const createChatServiceError = (
  error: unknown,
  defaultMessage: string = 'An unexpected error occurred',
  statusCode?: number
): ChatServiceError => {
  // If it's already a ChatServiceError, pass it through
  if (error instanceof ChatServiceError) {
    return error;
  }

  // Extract message from various error types
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : defaultMessage;

  // Determine error type if status code provided
  const errorType = statusCode ? getErrorType(statusCode) : 'NETWORK_ERROR';

  return new ChatServiceError(errorMessage, statusCode, errorType);
};

/**
 * Enhanced error logger with structured output
 * 🎓 Learning: Detailed logging helps with production debugging
 */
export const logChatError = (context: string, error: unknown, details?: Record<string, any>) => {
  console.error(`❌ ${context}:`, error);
  
  if (details) {
    console.error('📝 Error details:', details);
  }
  
  // Enhanced error details for debugging
  if (error instanceof Error) {
    console.error('🔍 Error debug info:', {
      errorType: typeof error,
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name
    });
  }
};
