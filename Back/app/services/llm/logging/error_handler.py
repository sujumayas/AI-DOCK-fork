# AI Dock LLM Error Handler
# Atomic component for centralized error handling and classification

from typing import Dict, Any, Optional, Tuple
import logging
import traceback
from datetime import datetime

from ..exceptions import (
    LLMServiceError, 
    LLMProviderError, 
    LLMDepartmentQuotaExceededError,
    LLMUserNotFoundError
)


class ErrorHandler:
    """
    Atomic component responsible for centralized error handling and classification.
    
    Single Responsibility:
    - Classify and categorize different types of errors
    - Create standardized error responses
    - Log errors with appropriate detail levels
    - Handle error recovery and fallback strategies
    """
    
    def __init__(self):
        """Initialize error handler."""
        self.logger = logging.getLogger(__name__)
    
    def classify_error(self, error: Exception) -> Dict[str, Any]:
        """
        Classify an error and determine its type, severity, and handling strategy.
        
        Args:
            error: Exception to classify
            
        Returns:
            Dictionary with error classification information
        """
        error_classification = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "severity": self._determine_severity(error),
            "category": self._determine_category(error),
            "recoverable": self._is_recoverable(error),
            "user_friendly_message": self._get_user_friendly_message(error),
            "requires_retry": self._requires_retry(error),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Add specific details for known error types
        if isinstance(error, LLMDepartmentQuotaExceededError):
            error_classification.update({
                "quota_details": getattr(error, 'quota_details', {}),
                "department_id": getattr(error, 'department_id', None)
            })
        elif isinstance(error, LLMProviderError):
            error_classification.update({
                "provider_name": getattr(error, 'provider_name', None),
                "provider_error_code": getattr(error, 'error_code', None)
            })
        
        self.logger.debug(f"Classified error: {error_classification['category']} - {error_classification['severity']}")
        return error_classification
    
    def handle_request_error(
        self,
        error: Exception,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle an error that occurred during request processing.
        
        Args:
            error: Exception that occurred
            context: Context information (user_id, config_id, etc.)
            
        Returns:
            Dictionary with error handling result and response data
        """
        error_classification = self.classify_error(error)
        
        # Log error with appropriate level
        self._log_error_with_context(error, error_classification, context)
        
        # Create error response
        error_response = self._create_error_response(error, error_classification, context)
        
        # Determine if error should be retried
        retry_info = self._get_retry_info(error, error_classification)
        
        return {
            "error_response": error_response,
            "classification": error_classification,
            "retry_info": retry_info,
            "handled_at": datetime.utcnow().isoformat()
        }
    
    def handle_streaming_error(
        self,
        error: Exception,
        context: Dict[str, Any],
        partial_content: str = "",
        chunks_sent: int = 0
    ) -> Dict[str, Any]:
        """
        Handle an error that occurred during streaming.
        
        Args:
            error: Exception that occurred
            context: Context information
            partial_content: Content received before error
            chunks_sent: Number of chunks sent before error
            
        Returns:
            Dictionary with streaming error handling result
        """
        error_classification = self.classify_error(error)
        
        # Add streaming-specific context
        streaming_context = {
            **context,
            "partial_content_length": len(partial_content),
            "chunks_sent": chunks_sent,
            "streaming": True
        }
        
        # Log streaming error
        self._log_streaming_error(error, error_classification, streaming_context)
        
        # Create streaming error response
        error_response = self._create_streaming_error_response(
            error, error_classification, streaming_context, partial_content
        )
        
        return {
            "error_response": error_response,
            "classification": error_classification,
            "streaming_context": streaming_context,
            "handled_at": datetime.utcnow().isoformat()
        }
    
    def _determine_severity(self, error: Exception) -> str:
        """Determine error severity level."""
        if isinstance(error, LLMDepartmentQuotaExceededError):
            return "WARNING"  # Expected business logic
        elif isinstance(error, LLMUserNotFoundError):
            return "ERROR"    # Data integrity issue
        elif isinstance(error, LLMProviderError):
            return "ERROR"    # External service issue
        elif isinstance(error, LLMServiceError):
            return "ERROR"    # Internal service issue
        elif isinstance(error, (ConnectionError, TimeoutError)):
            return "WARNING"  # Temporary network issue
        elif isinstance(error, ValueError):
            return "ERROR"    # Input validation issue
        else:
            return "CRITICAL" # Unknown error type
    
    def _determine_category(self, error: Exception) -> str:
        """Determine error category for handling strategy."""
        if isinstance(error, LLMDepartmentQuotaExceededError):
            return "QUOTA"
        elif isinstance(error, LLMUserNotFoundError):
            return "AUTHENTICATION"
        elif isinstance(error, LLMProviderError):
            return "PROVIDER"
        elif isinstance(error, LLMServiceError):
            return "SERVICE"
        elif isinstance(error, (ConnectionError, TimeoutError)):
            return "NETWORK"
        elif isinstance(error, ValueError):
            return "VALIDATION"
        elif isinstance(error, PermissionError):
            return "AUTHORIZATION"
        else:
            return "UNKNOWN"
    
    def _is_recoverable(self, error: Exception) -> bool:
        """Determine if error is recoverable through retry or alternative action."""
        recoverable_types = (
            ConnectionError,
            TimeoutError,
            # Some provider errors might be temporary
        )
        
        if isinstance(error, recoverable_types):
            return True
        elif isinstance(error, LLMProviderError):
            # Check if provider error is temporary
            error_code = getattr(error, 'error_code', None)
            return error_code in ['rate_limit', 'service_unavailable', 'timeout']
        
        return False
    
    def _requires_retry(self, error: Exception) -> bool:
        """Determine if error should trigger automatic retry."""
        if isinstance(error, (ConnectionError, TimeoutError)):
            return True
        elif isinstance(error, LLMProviderError):
            error_code = getattr(error, 'error_code', None)
            return error_code == 'rate_limit'
        
        return False
    
    def _get_user_friendly_message(self, error: Exception) -> str:
        """Get user-friendly error message."""
        if isinstance(error, LLMDepartmentQuotaExceededError):
            return "Your department has exceeded its usage quota. Please contact your administrator."
        elif isinstance(error, LLMUserNotFoundError):
            return "Authentication failed. Please log in again."
        elif isinstance(error, LLMProviderError):
            return "The AI service is temporarily unavailable. Please try again later."
        elif isinstance(error, (ConnectionError, TimeoutError)):
            return "Network connection issue. Please check your connection and try again."
        elif isinstance(error, ValueError):
            return "Invalid request format. Please check your input and try again."
        else:
            return "An unexpected error occurred. Please try again or contact support."
    
    def _log_error_with_context(
        self,
        error: Exception,
        classification: Dict[str, Any],
        context: Dict[str, Any]
    ):
        """Log error with appropriate detail level based on severity."""
        severity = classification["severity"]
        category = classification["category"]
        message = f"LLM Error - {category}: {str(error)}"
        
        # Create context string for logging
        context_str = ", ".join([f"{k}={v}" for k, v in context.items() if v is not None])
        
        if severity == "CRITICAL":
            self.logger.critical(f"{message} | Context: {context_str} | Stack: {traceback.format_exc()}")
        elif severity == "ERROR":
            self.logger.error(f"{message} | Context: {context_str}")
        elif severity == "WARNING":
            self.logger.warning(f"{message} | Context: {context_str}")
        else:
            self.logger.info(f"{message} | Context: {context_str}")
    
    def _log_streaming_error(
        self,
        error: Exception,
        classification: Dict[str, Any],
        context: Dict[str, Any]
    ):
        """Log streaming-specific error information."""
        severity = classification["severity"]
        chunks_sent = context.get("chunks_sent", 0)
        partial_length = context.get("partial_content_length", 0)
        
        message = (f"Streaming Error after {chunks_sent} chunks "
                  f"({partial_length} chars): {str(error)}")
        
        if severity == "CRITICAL":
            self.logger.critical(message)
        elif severity == "ERROR":
            self.logger.error(message)
        else:
            self.logger.warning(message)
    
    def _create_error_response(
        self,
        error: Exception,
        classification: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create standardized error response."""
        return {
            "success": False,
            "error": classification["user_friendly_message"],
            "error_type": classification["error_type"],
            "error_code": classification["category"],
            "timestamp": classification["timestamp"],
            "recoverable": classification["recoverable"],
            "retry_after": self._get_retry_delay(error) if classification["requires_retry"] else None,
            "context": {
                "user_id": context.get("user_id"),
                "config_id": context.get("config_id"),
                "request_id": context.get("request_id")
            }
        }
    
    def _create_streaming_error_response(
        self,
        error: Exception,
        classification: Dict[str, Any],
        context: Dict[str, Any],
        partial_content: str
    ) -> Dict[str, Any]:
        """Create streaming-specific error response."""
        response = self._create_error_response(error, classification, context)
        response.update({
            "streaming": True,
            "chunks_sent": context.get("chunks_sent", 0),
            "partial_content_length": len(partial_content),
            "partial_content_available": len(partial_content) > 0
        })
        
        return response
    
    def _get_retry_info(self, error: Exception, classification: Dict[str, Any]) -> Dict[str, Any]:
        """Get retry information for recoverable errors."""
        if not classification["requires_retry"]:
            return {"should_retry": False}
        
        return {
            "should_retry": True,
            "retry_after_seconds": self._get_retry_delay(error),
            "max_retries": self._get_max_retries(error),
            "retry_strategy": self._get_retry_strategy(error)
        }
    
    def _get_retry_delay(self, error: Exception) -> int:
        """Get retry delay in seconds for specific error types."""
        if isinstance(error, LLMProviderError):
            error_code = getattr(error, 'error_code', None)
            if error_code == 'rate_limit':
                return 60  # Wait 1 minute for rate limits
        elif isinstance(error, (ConnectionError, TimeoutError)):
            return 5   # Wait 5 seconds for network issues
        
        return 30  # Default retry delay
    
    def _get_max_retries(self, error: Exception) -> int:
        """Get maximum retry attempts for specific error types."""
        if isinstance(error, (ConnectionError, TimeoutError)):
            return 3
        elif isinstance(error, LLMProviderError):
            return 2
        
        return 1  # Default max retries
    
    def _get_retry_strategy(self, error: Exception) -> str:
        """Get retry strategy for specific error types."""
        if isinstance(error, LLMProviderError):
            error_code = getattr(error, 'error_code', None)
            if error_code == 'rate_limit':
                return "exponential_backoff"
        
        return "fixed_delay"


# Factory function for dependency injection
def get_error_handler() -> ErrorHandler:
    """
    Get error handler instance.
    
    Returns:
        ErrorHandler instance
    """
    return ErrorHandler()
