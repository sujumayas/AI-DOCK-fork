# AI Dock OpenAI Provider Implementation
# Handles communication with OpenAI's API (GPT-3.5, GPT-4, etc.)

import httpx
import json
import time
from typing import Dict, Any, Optional

from app.models.llm_config import LLMProvider
from ..exceptions import LLMProviderError, LLMConfigurationError, LLMQuotaExceededError
from ..models import ChatRequest, ChatResponse, ChatMessage
from .base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI provider implementation.
    
    Handles communication with OpenAI's API (GPT-3.5, GPT-4, etc.)
    """
    
    @property
    def provider_name(self) -> str:
        return "OpenAI"
    
    async def send_chat_request(self, request: ChatRequest) -> ChatResponse:
        """
        Send chat request to OpenAI API.
        
        OpenAI API format:
        POST https://api.openai.com/v1/chat/completions
        {
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hello!"}],
            "temperature": 0.7,
            "max_tokens": 1000
        }
        """
        self._validate_configuration()
        
        # Build request payload in OpenAI format
        payload = {
            "model": request.model or self.config.default_model,
            "messages": [msg.to_dict() for msg in request.messages]
        }
        
        # Add optional parameters
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        elif self.config.model_parameters and "temperature" in self.config.model_parameters:
            payload["temperature"] = self.config.model_parameters["temperature"]
        
        if request.max_tokens is not None:
            payload["max_tokens"] = request.max_tokens
        elif self.config.model_parameters and "max_tokens" in self.config.model_parameters:
            payload["max_tokens"] = self.config.model_parameters["max_tokens"]
        
        # Add any extra parameters from request
        payload.update(request.extra_params)
        
        # Record start time for performance tracking
        start_time = time.time()
        
        # Make the API request
        async with self._get_http_client() as client:
            try:
                self.logger.info(f"Sending OpenAI request: model={payload['model']}")
                
                response = await client.post(
                    f"{self.config.api_endpoint}/chat/completions",
                    json=payload
                )
                
                response_time_ms = int((time.time() - start_time) * 1000)
                
                # Handle different response status codes
                if response.status_code == 200:
                    return await self._process_success_response(response, response_time_ms)
                else:
                    await self._handle_error_response(response)
                    
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
    
    async def _process_success_response(self, response: httpx.Response, response_time_ms: int) -> ChatResponse:
        """Process successful OpenAI API response."""
        data = response.json()
        
        # Extract response content
        content = data["choices"][0]["message"]["content"]
        model = data["model"]
        
        # Extract usage information
        usage = {}
        if "usage" in data:
            usage = {
                "input_tokens": data["usage"].get("prompt_tokens", 0),
                "output_tokens": data["usage"].get("completion_tokens", 0),
                "total_tokens": data["usage"].get("total_tokens", 0)
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
    
    async def _handle_error_response(self, response: httpx.Response) -> None:
        """Handle OpenAI API error responses."""
        try:
            error_data = response.json()
            error_message = error_data.get("error", {}).get("message", "Unknown error")
            error_type = error_data.get("error", {}).get("type", "unknown")
        except:
            error_message = f"HTTP {response.status_code}: {response.text}"
            error_type = "http_error"
        
        # Map OpenAI error types to our exceptions
        if response.status_code == 401:
            raise LLMConfigurationError(f"Invalid API key: {error_message}")
        elif response.status_code == 429:
            raise LLMQuotaExceededError(f"Rate limit exceeded: {error_message}")
        elif response.status_code == 400:
            raise LLMProviderError(f"Bad request: {error_message}", self.provider_name, response.status_code)
        else:
            raise LLMProviderError(
                f"OpenAI API error: {error_message}",
                provider=self.provider_name,
                status_code=response.status_code,
                error_details={"error_type": error_type}
            )
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test OpenAI API connection."""
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
        """Estimate cost for OpenAI request."""
        if not self.config.has_cost_tracking:
            return None
        
        # Rough estimation: count characters and estimate tokens
        # 1 token ≈ 4 characters for English text
        total_chars = sum(len(msg.content) for msg in request.messages)
        estimated_input_tokens = total_chars // 4
        
        # Estimate output tokens (conservative guess)
        max_tokens = request.max_tokens or self.config.model_parameters.get("max_tokens", 1000)
        estimated_output_tokens = min(max_tokens, estimated_input_tokens // 2)
        
        return self.config.calculate_request_cost(estimated_input_tokens, estimated_output_tokens)
    
    # =============================================================================
    # STREAMING SUPPORT FOR OPENAI
    # =============================================================================
    
    async def stream_chat_request(self, request: ChatRequest):
        """
        Stream responses from OpenAI using their native streaming API.
        
        OpenAI supports real streaming via Server-Sent Events. We set stream=True
        in the request and process the SSE chunks.
        
        Yields:
            Dict[str, Any]: Streaming chunks with OpenAI content
        """
        self._validate_configuration()
        
        # Build OpenAI streaming request
        payload = {
            "model": request.model or self.config.default_model,
            "messages": [msg.to_dict() for msg in request.messages],
            "stream": True  # Enable streaming
        }
        
        # Add optional parameters
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        elif self.config.model_parameters and "temperature" in self.config.model_parameters:
            payload["temperature"] = self.config.model_parameters["temperature"]
        
        if request.max_tokens is not None:
            payload["max_tokens"] = request.max_tokens
        elif self.config.model_parameters and "max_tokens" in self.config.model_parameters:
            payload["max_tokens"] = self.config.model_parameters["max_tokens"]
        
        payload.update(request.extra_params)
        
        start_time = time.time()
        
        async with self._get_http_client() as client:
            try:
                self.logger.info(f"Starting OpenAI streaming request: model={payload['model']}")
                
                # Make streaming request
                async with client.stream(
                    "POST",
                    f"{self.config.api_endpoint}/chat/completions",
                    json=payload
                ) as response:
                    
                    if response.status_code != 200:
                        await self._handle_error_response(response)
                    
                    # Process streaming response
                    accumulated_content = ""
                    model_name = payload["model"]
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix
                            
                            if data_str.strip() == "[DONE]":
                                # Streaming finished
                                response_time_ms = int((time.time() - start_time) * 1000)
                                
                                # Calculate final usage and cost
                                final_usage = self._estimate_usage_from_content(accumulated_content, payload)
                                final_cost = self._calculate_actual_cost(final_usage)
                                
                                yield {
                                    "content": "",
                                    "is_final": True,
                                    "model": model_name,
                                    "provider": self.provider_name,
                                    "usage": final_usage,
                                    "cost": final_cost,
                                    "response_time_ms": response_time_ms
                                }
                                break
                            
                            try:
                                # Parse JSON chunk
                                chunk_data = json.loads(data_str)
                                
                                # Extract content from OpenAI chunk format
                                choices = chunk_data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    
                                    if content:
                                        accumulated_content += content
                                        
                                        # Yield content chunk
                                        yield {
                                            "content": content,
                                            "is_final": False,
                                            "model": model_name,
                                            "provider": self.provider_name
                                        }
                                
                            except json.JSONDecodeError:
                                # Skip malformed chunks
                                continue
                            
            except httpx.TimeoutException:
                raise LLMProviderError(
                    "Streaming request timed out",
                    provider=self.provider_name,
                    error_details={"timeout": True, "streaming": True}
                )
            except httpx.RequestError as e:
                raise LLMProviderError(
                    f"Streaming network error: {str(e)}",
                    provider=self.provider_name,
                    error_details={"network_error": str(e), "streaming": True}
                )


# Export OpenAI provider
__all__ = ['OpenAIProvider']
