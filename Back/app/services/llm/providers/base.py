# AI Dock LLM Provider Base Class
# Abstract interface for all LLM providers

import httpx
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

from app.models.llm_config import LLMConfiguration
from ..exceptions import LLMConfigurationError
from ..models import ChatRequest, ChatResponse


class BaseLLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    
    This defines the interface that all providers must implement.
    Each provider (OpenAI, Claude, etc.) will have its own class.
    """
    
    def __init__(self, config: LLMConfiguration):
        """
        Initialize the provider with configuration.
        
        Args:
            config: LLM configuration from database
        """
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Get the human-readable provider name."""
        pass
    
    @abstractmethod
    async def send_chat_request(self, request: ChatRequest) -> ChatResponse:
        """
        Send a chat request to the provider.
        
        Args:
            request: Chat request to send
            
        Returns:
            Chat response from the provider
            
        Raises:
            LLMProviderError: If the provider returns an error
            LLMConfigurationError: If configuration is invalid
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to the provider.
        
        Returns:
            Test result dictionary with success status and details
        """
        pass
    
    @abstractmethod
    def estimate_cost(self, request: ChatRequest) -> Optional[float]:
        """
        Estimate the cost of a request before sending it.
        
        Args:
            request: Chat request to estimate
            
        Returns:
            Estimated cost in USD, or None if cost tracking not available
        """
        pass
    
    @abstractmethod
    async def get_available_models(self) -> list[str]:
        """
        Fetch available models from the provider's API.
        
        Returns:
            List of model IDs available from the provider
            
        Raises:
            LLMProviderError: If API call fails
            LLMConfigurationError: If configuration is invalid
        """
        pass
    
    # =============================================================================
    # COMMON HELPER METHODS
    # =============================================================================
    
    def _get_http_client(self, timeout: int = 30) -> httpx.AsyncClient:
        """
        Get configured HTTP client for API requests.
        
        Args:
            timeout: Request timeout in seconds
            
        Returns:
            Configured HTTP client
        """
        return httpx.AsyncClient(
            timeout=timeout,
            headers=self.config.get_api_headers(),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
    
    def _calculate_actual_cost(self, usage: Dict[str, int]) -> Optional[float]:
        """
        Calculate actual cost based on token usage.
        
        Args:
            usage: Token usage dictionary
            
        Returns:
            Actual cost in USD, or None if cost tracking not available
        """
        if not self.config.has_cost_tracking:
            return None
            
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        
        return self.config.calculate_request_cost(input_tokens, output_tokens)
    
    def _validate_configuration(self) -> None:
        """
        Validate that the configuration is valid for this provider.
        
        Raises:
            LLMConfigurationError: If configuration is invalid
        """
        if not self.config.is_active:
            raise LLMConfigurationError(f"Configuration '{self.config.name}' is not active")
        
        if not self.config.api_key_encrypted:
            raise LLMConfigurationError(f"No API key configured for '{self.config.name}'")
        
        if not self.config.api_endpoint:
            raise LLMConfigurationError(f"No API endpoint configured for '{self.config.name}'")
    
    def _estimate_usage_from_content(self, content: str, request_payload: Dict[str, Any]) -> Dict[str, int]:
        """
        Estimate token usage from content for providers without usage reporting.
        
        Args:
            content: Response content
            request_payload: Original request data
            
        Returns:
            Estimated usage dictionary
        """
        # Rough estimation: 1 token ≈ 4 characters
        output_tokens = len(content) // 4
        
        # Estimate input tokens from request
        input_chars = 0
        if "messages" in request_payload:
            for msg in request_payload["messages"]:
                input_chars += len(msg.get("content", ""))
        
        input_tokens = input_chars // 4
        total_tokens = input_tokens + output_tokens
        
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens, 
            "total_tokens": total_tokens
        }
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(config='{self.config.name}')"


# Export base class
__all__ = ['BaseLLMProvider']
