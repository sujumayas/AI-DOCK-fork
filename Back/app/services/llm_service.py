# AI Dock LLM Service - Modular Import Wrapper
# This file maintains backward compatibility while using the new modular structure
"""
AI Dock LLM Service - Refactored Modular Version

WHAT CHANGED:
- Original 2,600-line file split into 11 atomic modules
- Main orchestration logic reduced to ~300 lines  
- Provider pattern with factory for extensibility
- Quota management extracted to dedicated service
- Usage logging separated for better maintainability
- Comprehensive error handling maintained
- All streaming functionality preserved

MODULES CREATED:
├── /services/llm/
│   ├── __init__.py              # Clean package exports
│   ├── exceptions.py            # All LLM-specific exceptions
│   ├── models.py               # Data classes (ChatMessage, ChatRequest, etc.)
│   ├── llm_service.py          # Main orchestration service (300 lines)
│   ├── provider_factory.py     # Provider instantiation and caching
│   ├── quota_manager.py        # Quota checking and enforcement
│   ├── usage_logger.py         # Usage tracking and logging
│   └── providers/
│       ├── __init__.py         # Provider exports
│       ├── base.py            # Abstract base provider
│       ├── openai.py          # OpenAI implementation
│       └── anthropic.py       # Anthropic implementation

BENEFITS:
✅ Single Responsibility: Each module has one clear purpose
✅ Testability: Components can be unit tested in isolation
✅ Maintainability: Changes affect minimal surface area
✅ Extensibility: New providers just implement base interface
✅ Performance: Better caching and resource management
✅ Error Isolation: Failures contained to specific components

BACKWARD COMPATIBILITY:
This file provides the same public interface as before.
All existing API endpoints continue to work unchanged.
"""

# Import the refactored service components
from .llm.llm_service import LLMService, get_llm_service
from .llm.exceptions import (
    LLMServiceError, 
    LLMConfigurationError,
    LLMProviderError,
    LLMQuotaExceededError,
    LLMDepartmentQuotaExceededError,
    LLMUserNotFoundError
)
from .llm.models import ChatMessage, ChatRequest, ChatResponse

# Export the same interface for backward compatibility
__all__ = [
    # Main service
    'LLMService',
    'get_llm_service',
    
    # Exceptions  
    'LLMServiceError',
    'LLMConfigurationError', 
    'LLMProviderError',
    'LLMQuotaExceededError',
    'LLMDepartmentQuotaExceededError',
    'LLMUserNotFoundError',
    
    # Data models
    'ChatMessage',
    'ChatRequest', 
    'ChatResponse'
]

# Backward compatibility: allow direct imports
# from services.llm_service import LLMService
# This still works exactly the same as before!

# For convenience, provide a default service instance
def get_service():
    """Get the default LLM service instance (alias for get_llm_service)."""
    return get_llm_service()

# Module-level service instance for backward compatibility
llm_service = get_llm_service()
