# AI Dock Anthropic (Claude) Provider Implementation
# Handles communication with Anthropic's API (Claude models)

import httpx
import time
from typing import Dict, Any, Optional

from app.models.llm_config import LLMProvider
from ..exceptions import LLMProviderError, LLMConfigurationError, LLMQuotaExceededError
from ..models import ChatRequest, ChatResponse, ChatMessage
from .base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    """
    Anthropic (Claude) provider implementation.
    
    Handles communication with Anthropic's API (Claude models).
    Note: Claude's API format is different from OpenAI's!
    """
    
    @property
    def provider_name(self) -> str:
        return "Anthropic (Claude)"
    
    async def send_chat_request(self, request: ChatRequest) -> ChatResponse:
        """
        Send chat request to Anthropic API.
        
        Anthropic API format is different from OpenAI:
        POST https://api.anthropic.com/v1/messages
        {
            "model": "claude-3-opus-20240229",/Users/blas/Desktop/INRE/INRE-DOCK-2/Back/app/services/llm/provider_factory.py
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": "Hello!"}]
        }
        """
        self._validate_configuration()
        
        # Claude requires at least max_tokens to be specified
        max_tokens = (
            request.max_tokens or 
            (self.config.model_parameters or {}).get("max_tokens") or 
            4000  # Default fallback
        )
        
        # Build request payload in Anthropic format
        payload = {
            "model": request.model or self.config.default_model,
            "max_tokens": max_tokens,
            "messages": []
        }
        
        # Convert messages to Anthropic format
        # Note: Anthropic doesn't support 'system' role in messages array
        # System messages need to be handled differently
        system_message = None
        for msg in request.messages:
            if msg.role == "system":
                # Store system message separately
                system_message = msg.content
            else:
                payload["messages"].append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        # Add system message if present
        if system_message:
            payload["system"] = system_message
        
        # Add optional parameters
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        elif self.config.model_parameters and "temperature" in self.config.model_parameters:
            payload["temperature"] = self.config.model_parameters["temperature"]
        
        # Add any extra parameters
        payload.update(request.extra_params)
        
        # Record start time
        start_time = time.time()
        
        # Make API request
        async with self._get_http_client() as client:
            try:
                self.logger.info(f"Sending Anthropic request: model={payload['model']}")
                
                response = await client.post(
                    f"{self.config.api_endpoint}/v1/messages",
                    json=payload
                )
                
                response_time_ms = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    return await self._process_claude_success_response(response, response_time_ms)
                else:
                    await self._handle_claude_error_response(response)
                    
            except httpx.TimeoutException:
                raise LLMProviderError(
                    "Request timed out",
                    provider=self.provider_name,
                    error_details={"timeout": True}
                )
            except httpx.RequestError as e:
                raise LLMProviderError(
                    f"Network error: {str(e)}",
                    provider=self.provider_name,
                    error_details={"network_error": str(e)}
                )
    
    async def _process_claude_success_response(self, response: httpx.Response, response_time_ms: int) -> ChatResponse:
        """Process successful Anthropic API response."""
        data = response.json()
        
        # Claude response format:
        # {
        #   "content": [{"text": "Hello! How can I help?", "type": "text"}],
        #   "model": "claude-3-opus-20240229",
        #   "usage": {"input_tokens": 10, "output_tokens": 15}
        # }
        
        # Extract content (Claude returns array of content blocks)
        content = ""
        if data.get("content"):
            for block in data["content"]:
                if block.get("type") == "text":
                    content += block.get("text", "")
        
        model = data.get("model", "unknown")
        
        # Extract usage information
        usage = {}
        if "usage" in data:
            usage = {
                "input_tokens": data["usage"].get("input_tokens", 0),
                "output_tokens": data["usage"].get("output_tokens", 0),
                "total_tokens": data["usage"].get("input_tokens", 0) + data["usage"].get("output_tokens", 0)
            }
        
        # Calculate cost
        cost = self._calculate_actual_cost(usage)
        
        return ChatResponse(
            content=content,
            model=model,
            provider=self.provider_name,
            usage=usage,
            cost=cost,
            response_time_ms=response_time_ms,
            raw_response=data
        )
    
    async def _handle_claude_error_response(self, response: httpx.Response) -> None:
        """Handle Anthropic API error responses."""
        try:
            error_data = response.json()
            error_message = error_data.get("error", {}).get("message", "Unknown error")
            error_type = error_data.get("error", {}).get("type", "unknown")
        except:
            error_message = f"HTTP {response.status_code}: {response.text}"
            error_type = "http_error"
        
        # Map Anthropic error types to our exceptions
        if response.status_code == 401:
            raise LLMConfigurationError(f"Invalid API key: {error_message}")
        elif response.status_code == 429:
            raise LLMQuotaExceededError(f"Rate limit exceeded: {error_message}")
        elif response.status_code == 400:
            raise LLMProviderError(f"Bad request: {error_message}", self.provider_name, response.status_code)
        else:
            raise LLMProviderError(
                f"Anthropic API error: {error_message}",
                provider=self.provider_name,
                status_code=response.status_code,
                error_details={"error_type": error_type}
            )
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test Anthropic API connection."""
        try:
            # Create a simple test request
            test_request = ChatRequest(
                messages=[ChatMessage("user", "Hello! This is a test.")],
                max_tokens=10
            )
            
            start_time = time.time()
            response = await self.send_chat_request(test_request)
            response_time = int((time.time() - start_time) * 1000)
            
            return {
                "success": True,
                "message": "Connection successful",
                "response_time_ms": response_time,
                "model": response.model,
                "cost": response.cost
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
                "error_type": type(e).__name__
            }
    
    def estimate_cost(self, request: ChatRequest) -> Optional[float]:
        """Estimate cost for Anthropic request."""
        if not self.config.has_cost_tracking:
            return None
        
        # Similar to OpenAI estimation
        total_chars = sum(len(msg.content) for msg in request.messages)
        estimated_input_tokens = total_chars // 4
        
        # Claude typically generates fewer tokens than requested max
        max_tokens = request.max_tokens or self.config.model_parameters.get("max_tokens", 4000)
        estimated_output_tokens = min(max_tokens, estimated_input_tokens // 2)
        
        return self.config.calculate_request_cost(estimated_input_tokens, estimated_output_tokens)
    
    async def get_available_models(self) -> list[str]:
        """
        Get available Claude models.
        
        Note: Anthropic doesn't have a public models endpoint, so we return
        the known list of Claude models.
        
        Returns:
            List of known Claude model identifiers
        """
        self._validate_configuration()
        
        # Since Anthropic doesn't have a public models endpoint,
        # we return the known list of Claude models
        known_models = self.get_known_models()
        self.logger.info(f"Returning {len(known_models)} known Claude models")
        return known_models
    
    # =============================================================================
    # SIMULATED STREAMING FOR ANTHROPIC
    # =============================================================================
    
    async def simulate_streaming_response(self, request: ChatRequest):
        """
        Simulate streaming for Anthropic by chunking a regular response.
        
        Note: Anthropic doesn't have native streaming yet, so we simulate it
        by getting the full response and then yielding it in chunks.
        
        Yields:
            Dict[str, Any]: Simulated streaming chunks
        """
        # Get the full response first
        full_response = await self.send_chat_request(request)
        
        # Split content into chunks (simulate streaming)
        content = full_response.content
        chunk_size = 10  # Characters per chunk
        
        for i in range(0, len(content), chunk_size):
            chunk_content = content[i:i + chunk_size]
            is_final = (i + chunk_size) >= len(content)
            
            yield {
                "content": chunk_content,
                "is_final": is_final,
                "model": full_response.model,
                "provider": self.provider_name,
                "usage": full_response.usage if is_final else None,
                "cost": full_response.cost if is_final else None,
                "response_time_ms": full_response.response_time_ms if is_final else None
            }
            
            # Small delay to simulate network latency
            import asyncio
            await asyncio.sleep(0.05)  # 50ms delay between chunks
    
    def get_known_models(self) -> list:
        """
        Get known Claude models since Anthropic doesn't have a public models endpoint.
        
        Returns:
            List of known Claude model identifiers
        """
        return [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229", 
            "claude-3-haiku-20240307",
            "claude-3-5-sonnet-20240620"
        ]


# Export Anthropic provider
__all__ = ['AnthropicProvider']
