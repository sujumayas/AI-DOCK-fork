# AI Dock LLM Service Package
# Modular LLM integration with comprehensive quota enforcement

# Core exports
from .llm_service import LLMService, get_llm_service

# Data models
from .models import ChatMessage, ChatRequest, ChatResponse, StreamingChunk

# Exceptions
from .exceptions import (
    LLMServiceError,
    LLMProviderError,
    LLMConfigurationError,
    LLMQuotaExceededError,
    LLMDepartmentQuotaExceededError,
    LLMUserNotFoundError,
    LLMStreamingError,
    LLMModelNotAvailableError
)

# Provider management
from .provider_factory import LLMProviderFactory, get_provider_factory
from .providers import BaseLLMProvider, OpenAIProvider, AnthropicProvider

# Service components
from .quota_manager import LLMQuotaManager, get_quota_manager
from .usage_logger import LLMUsageLogger, get_usage_logger

# Export all public interfaces
__all__ = [
    # Main service
    'LLMService',
    'get_llm_service',
    
    # Data models
    'ChatMessage',
    'ChatRequest', 
    'ChatResponse',
    'StreamingChunk',
    
    # Exceptions
    'LLMServiceError',
    'LLMProviderError',
    'LLMConfigurationError',
    'LLMQuotaExceededError',
    'LLMDepartmentQuotaExceededError',
    'LLMUserNotFoundError',
    'LLMStreamingError',
    'LLMModelNotAvailableError',
    
    # Provider management
    'LLMProviderFactory',
    'get_provider_factory',
    'BaseLLMProvider',
    'OpenAIProvider',
    'AnthropicProvider',
    
    # Service components
    'LLMQuotaManager',
    'get_quota_manager',
    'LLMUsageLogger',
    'get_usage_logger'
]
