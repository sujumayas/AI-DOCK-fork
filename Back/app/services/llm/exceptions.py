# AI Dock LLM Service Exceptions
# Comprehensive error handling for LLM integrations with quota enforcement

from typing import Dict, Any, Optional
from ..quota_service import QuotaCheckResult


class LLMServiceError(Exception):
    """Base exception for LLM service errors."""
    pass


class LLMProviderError(LLMServiceError):
    """Error from external LLM provider (API issues, rate limits, etc.)."""
    
    def __init__(
        self, 
        message: str, 
        provider: str, 
        status_code: Optional[int] = None, 
        error_details: Optional[Dict] = None
    ):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code
        self.error_details = error_details or {}


class LLMConfigurationError(LLMServiceError):
    """Error with LLM configuration (invalid settings, missing API keys, etc.)."""
    pass


class LLMQuotaExceededError(LLMServiceError):
    """Error when usage quota is exceeded."""
    pass


class LLMDepartmentQuotaExceededError(LLMServiceError):
    """Error when department quota is exceeded."""
    
    def __init__(
        self, 
        message: str, 
        department_id: int,
        quota_check_result: Optional[QuotaCheckResult] = None
    ):
        super().__init__(message)
        self.department_id = department_id
        self.quota_check_result = quota_check_result


class LLMUserNotFoundError(LLMServiceError):
    """Error when user is not found or has no department."""
    pass


class LLMStreamingError(LLMServiceError):
    """Error during streaming operations."""
    
    def __init__(
        self, 
        message: str, 
        provider: str,
        partial_content: str = "",
        chunk_count: int = 0
    ):
        super().__init__(message)
        self.provider = provider
        self.partial_content = partial_content
        self.chunk_count = chunk_count


class LLMModelNotAvailableError(LLMServiceError):
    """Error when requested model is not available."""
    
    def __init__(self, message: str, model: str, provider: str, available_models: list = None):
        super().__init__(message)
        self.model = model
        self.provider = provider
        self.available_models = available_models or []


# Export all exceptions for easy importing
__all__ = [
    'LLMServiceError',
    'LLMProviderError', 
    'LLMConfigurationError',
    'LLMQuotaExceededError',
    'LLMDepartmentQuotaExceededError',
    'LLMUserNotFoundError',
    'LLMStreamingError',
    'LLMModelNotAvailableError'
]
