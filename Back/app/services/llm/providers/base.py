# AI Dock Base LLM Provider
# Abstract base class for all LLM providers

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, AsyncGenerator, List
import logging
import httpx
import time

from app.models.llm_config import LLMConfiguration
from ..models import ChatRequest, ChatResponse
from ..exceptions import LLMProviderError

class BaseLLMProvider(ABC):
    """
    Abstract Base Class for all LLM (Large Language Model) providers.
    
    This class defines the common interface that all provider implementations
    must adhere to. It ensures consistency in how the LLM service interacts
    with different providers (e.g., OpenAI, Anthropic).
    
    Key Responsibilities:
    - Define contract for sending chat requests.
    - Provide a standard way to test API connections.
    - Offer cost estimation capabilities.
    - Handle shared configuration and HTTP client management.
    """

    def __init__(self, config: LLMConfiguration):
        """
        Initialize the provider with its configuration.
        
        Args:
            config: An LLMConfiguration object containing all necessary
                    settings for this provider (API keys, endpoints, etc.).
        """
        if not isinstance(config, LLMConfiguration):
            raise TypeError("config must be an instance of LLMConfiguration")
        
        self.config = config
        # Use module and class name for a specific logger instance
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        self.logger.info(f"Initialized provider: {self.provider_name} with config '{self.config.name}'")

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """
        Return the display name of the provider (e.g., "OpenAI").
        This is an abstract property that must be implemented by subclasses.
        """
        pass

    @abstractmethod
    async def send_chat_request(self, request: ChatRequest) -> ChatResponse:
        """
        Send a chat request to the LLM provider.
        
        This is the primary method for getting a response from an LLM. It must be
        implemented by all subclasses to handle the specific API format and
        logic of the provider.
        
        Args:
            request: A ChatRequest object containing the messages and other
                     parameters for the chat completion.
                     
        Returns:
            A ChatResponse object containing the model's reply, usage data, and cost.
        """
        pass

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to the provider's API.
        
        This method sends a simple, low-cost request to the provider to verify
        that the API key and endpoint are configured correctly. Subclasses can
        override this for more specific health checks.
        
        Returns:
            A dictionary containing the test result, including success status,
            a message, and performance data.
        """
        self.logger.info(f"Testing connection for {self.provider_name}...")
        try:
            # A minimal request to test the connection
            test_request = ChatRequest(messages=[{"role": "user", "content": "hello"}])
            start_time = time.time()
            await self.send_chat_request(test_request)
            response_time_ms = int((time.time() - start_time) * 1000)
            
            self.logger.info(f"Connection test for {self.provider_name} successful.")
            return {"success": True, "message": "Connection successful", "response_time_ms": response_time_ms}
        except Exception as e:
            self.logger.error(f"Connection test for {self.provider_name} failed: {e}")
            return {"success": False, "message": str(e), "error_type": type(e).__name__}

    def _validate_configuration(self):
        """
        Validate that the necessary configuration for the provider is present.
        
        Raises:
            LLMConfigurationError: If the API key or endpoint is missing.
        """
        if not self.config.api_key_encrypted:
            raise LLMProviderError("API key is not configured for this provider.")
        if not self.config.api_endpoint:
            raise LLMProviderError("API endpoint is not configured for this provider.")

    def _get_http_client(self) -> httpx.AsyncClient:
        """

        Create and configure an asynchronous HTTP client for making API requests.
        
        This method sets up the base URL, authentication headers, and other
        HTTP-level settings.
        
        Returns:
            An httpx.AsyncClient instance ready for use.
        """
        api_key = self.config.get_decrypted_api_key()
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": api_key, # Standard for many services, incl. Anthropic
            "Authorization": f"Bearer {api_key}" # Standard for OpenAI
        }
        
        if self.config.custom_headers:
            headers.update(self.config.custom_headers)
            
        return httpx.AsyncClient(
            headers=headers,
            timeout=60.0, # Generous timeout for slow models
            # http2=True # Enable HTTP/2 for potential performance improvements
        )

    def _calculate_actual_cost(self, usage: Dict[str, int]) -> Optional[float]:
        """
        Calculate the actual cost of a request based on token usage.
        
        Args:
            usage: A dictionary containing 'input_tokens' and 'output_tokens'.
            
        Returns:
            The calculated cost as a float, or None if cost tracking is disabled.
        """
        if not self.config.has_cost_tracking:
            return None
        return self.config.calculate_request_cost(usage.get("input_tokens", 0), usage.get("output_tokens", 0))

    async def simulate_streaming_response(self, request: ChatRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Default fallback streaming implementation.
        
        This is used when a provider doesn't have native streaming support.
        Gets the full response and yields it in chunks to simulate streaming.
        
        Args:
            request: The chat request to process.
            
        Yields:
            Streaming chunks as dictionaries, with content and metadata.
        """
        self.logger.info(f"Using base fallback streaming for {self.provider_name}")
        
        try:
            response = await self.send_chat_request(request)
            
            if not response or not response.content:
                yield {
                    "content": "", "is_final": True, "error": "No response content to stream",
                    "model": "unknown", "provider": self.provider_name
                }
                return

            # Chunk the response content
            content = response.content
            chunk_size = 10
            
            for i in range(0, len(content), chunk_size):
                chunk_content = content[i:i + chunk_size]
                is_final = (i + chunk_size) >= len(content)
                
                yield {
                    "content": chunk_content, "is_final": is_final, "model": response.model,
                    "provider": self.provider_name,
                    "usage": response.usage if is_final else None,
                    "cost": response.cost if is_final else None,
                    "response_time_ms": response.response_time_ms if is_final else None
                }
                
                # Brief delay to simulate streaming
                if not is_final:
                    await asyncio.sleep(0.05)
            
        except Exception as e:
            self.logger.error(f"Base fallback streaming failed: {e}")
            yield {
                "content": "", "is_final": True,
                "error": f"Streaming failed: {type(e).__name__}",
                "model": "unknown", "provider": self.provider_name
            }

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(config='{self.config.name}')"
