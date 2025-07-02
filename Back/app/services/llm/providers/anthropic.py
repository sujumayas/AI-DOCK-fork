# AI Dock Anthropic (Claude) Provider Implementation
# Handles communication with Anthropic's API (Claude models)

import httpx
import time
import json
import asyncio
from typing import Dict, Any, Optional, AsyncGenerator

from app.models.llm_config import LLMProvider
from ..exceptions import LLMProviderError, LLMConfigurationError, LLMQuotaExceededError
from ..models import ChatRequest, ChatResponse, ChatMessage
from .base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    """
    Anthropic (Claude) provider implementation.
    
    Handles communication with Anthropic's API (Claude models).
    Now supports native streaming using Anthropic's SSE API!
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
            "model": "claude-3-opus-20240229",
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
                
                # Fix URL construction to handle trailing slashes properly
                endpoint_base = self.config.api_endpoint.rstrip('/')
                url = f"{endpoint_base}/v1/messages"
                
                # Add debug logging for the URL and headers
                self.logger.debug(f"Making POST request to: {url}")
                self.logger.debug(f"Request headers: {client.headers}")
                
                response = await client.post(
                    url,
                    json=payload
                )
                
                response_time_ms = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    return await self._process_claude_success_response(response, response_time_ms)
                else:
                    # This always raises an exception, so execution never continues past here
                    await self._handle_claude_error_response(response)
                    # This should never be reached, but adding explicit raise for safety
                    raise LLMProviderError(
                        f"Unexpected response status: {response.status_code}",
                        provider=self.provider_name,
                        status_code=response.status_code
                    )
                    
            except httpx.TimeoutException:
                self.logger.error(f"Anthropic API request timeout for URL: {url}")
                raise LLMProviderError(
                    "Request timed out",
                    provider=self.provider_name,
                    error_details={"timeout": True}
                )
            except httpx.RequestError as e:
                self.logger.error(f"Anthropic API request error for URL: {url}, Error: {str(e)}")
                self.logger.error(f"Error type: {type(e).__name__}")
                # More specific error handling for DNS resolution
                if "nodename nor servname" in str(e) or "Name or service not known" in str(e):
                    raise LLMProviderError(
                        f"DNS resolution failed for {self.config.api_endpoint}. Please check your network connection.",
                        provider=self.provider_name,
                        error_details={"dns_error": str(e)}
                    )
                else:
                    raise LLMProviderError(
                        f"Network error: {str(e)}",
                        provider=self.provider_name,
                        error_details={"network_error": str(e)}
                    )
    
    async def _process_claude_success_response(self, response: httpx.Response, response_time_ms: int) -> ChatResponse:
        """Process successful Anthropic API response."""
        try:
            data = response.json()
            self.logger.info(f"Anthropic API response data: {data}")
        except Exception as e:
            self.logger.error(f"Failed to parse Anthropic response as JSON: {e}")
            self.logger.error(f"Response text: {response.text}")
            raise LLMProviderError(
                f"Invalid JSON response from Anthropic API: {str(e)}",
                provider=self.provider_name,
                error_details={"response_text": response.text}
            )
        
        # Claude response format:
        # {
        #   "content": [{"text": "Hello! How can I help?", "type": "text"}],
        #   "model": "claude-3-opus-20240229",
        #   "usage": {"input_tokens": 10, "output_tokens": 15}
        # }
        
        # Extract content (Claude returns array of content blocks)
        content = ""
        if data.get("content"):
            self.logger.info(f"Processing content blocks: {data.get('content')}")
            for block in data["content"]:
                if block.get("type") == "text":
                    content += block.get("text", "")
        else:
            self.logger.warning(f"No content found in Anthropic response: {data}")
        
        model = data.get("model", "unknown")
        self.logger.info(f"Extracted content length: {len(content)}, model: {model}")
        
        # Extract usage information
        usage = {}
        if "usage" in data:
            usage = {
                "input_tokens": data["usage"].get("input_tokens", 0),
                "output_tokens": data["usage"].get("output_tokens", 0),
                "total_tokens": data["usage"].get("input_tokens", 0) + data["usage"].get("output_tokens", 0)
            }
            self.logger.info(f"Usage data: {usage}")
        
        # Calculate cost
        cost = self._calculate_actual_cost(usage)
        self.logger.info(f"Calculated cost: {cost}")
        
        chat_response = ChatResponse(
            content=content,
            model=model,
            provider=self.provider_name,
            usage=usage,
            cost=cost,
            response_time_ms=response_time_ms,
            raw_response=data
        )
        
        self.logger.info(f"Created ChatResponse: content_length={len(chat_response.content)}, model={chat_response.model}")
        return chat_response
    
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
    # NATIVE STREAMING FOR ANTHROPIC (NEW!)
    # =============================================================================
    
    async def stream_chat_request(self, request: ChatRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream responses from Anthropic using their native streaming API.
        
        Anthropic supports real streaming via Server-Sent Events. We set stream=True
        in the request and process the SSE chunks.
        
        Yields:
            Dict[str, Any]: Streaming chunks with Anthropic content
        """
        self._validate_configuration()
        
        # Build Anthropic streaming request
        max_tokens = (
            request.max_tokens or 
            (self.config.model_parameters or {}).get("max_tokens") or 
            4000
        )
        
        payload = {
            "model": request.model or self.config.default_model,
            "max_tokens": max_tokens,
            "messages": [],
            "stream": True  # Enable native streaming
        }
        
        # Convert messages to Anthropic format
        system_message = None
        for msg in request.messages:
            if msg.role == "system":
                system_message = msg.content
            else:
                payload["messages"].append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        if system_message:
            payload["system"] = system_message
        
        # Add optional parameters
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        elif self.config.model_parameters and "temperature" in self.config.model_parameters:
            payload["temperature"] = self.config.model_parameters["temperature"]
        
        payload.update(request.extra_params)
        
        start_time = time.time()
        
        # Create streaming request using async context manager
        async with self._get_http_client() as client:
            try:
                self.logger.info(f"🌊 Starting Anthropic native streaming: model={payload['model']}")
                
                endpoint_base = self.config.api_endpoint.rstrip('/')
                url = f"{endpoint_base}/v1/messages"
                
                # Make streaming request
                async with client.stream(
                    "POST",
                    url,
                    json=payload
                ) as response:
                    
                    if response.status_code != 200:
                        await self._handle_claude_error_response(response)
                    
                    # Process Anthropic SSE streaming response
                    accumulated_content = ""
                    model_name = payload["model"]
                    usage_data = {}
                    chunk_count = 0
                    
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                            
                        # Parse SSE format: "event: type" and "data: json"
                        if line.startswith("event:"):
                            event_type = line[6:].strip()
                            continue
                        elif line.startswith("data:"):
                            data_str = line[5:].strip()
                            
                            try:
                                # Parse JSON chunk
                                chunk_data = json.loads(data_str)
                                chunk_count += 1
                                
                                # Handle different Anthropic event types
                                event_type = chunk_data.get("type", "")
                                
                                if event_type == "message_start":
                                    # Extract model and initial usage
                                    message = chunk_data.get("message", {})
                                    model_name = message.get("model", model_name)
                                    usage_data = message.get("usage", {})
                                    
                                elif event_type == "content_block_delta":
                                    # Extract text content from delta
                                    delta = chunk_data.get("delta", {})
                                    if delta.get("type") == "text_delta":
                                        text_content = delta.get("text", "")
                                        if text_content:
                                            accumulated_content += text_content
                                            
                                            # Yield content chunk
                                            yield {
                                                "content": text_content,
                                                "is_final": False,
                                                "model": model_name,
                                                "provider": self.provider_name,
                                                "chunk_count": chunk_count
                                            }
                                
                                elif event_type == "message_delta":
                                    # Update usage data with final counts
                                    delta_usage = chunk_data.get("usage", {})
                                    if delta_usage:
                                        usage_data.update(delta_usage)
                                
                                elif event_type == "message_stop":
                                    # End of stream - send final chunk with usage/cost
                                    response_time_ms = int((time.time() - start_time) * 1000)
                                    
                                    # Calculate final usage
                                    final_usage = {
                                        "input_tokens": usage_data.get("input_tokens", 0),
                                        "output_tokens": usage_data.get("output_tokens", 0),
                                        "total_tokens": usage_data.get("input_tokens", 0) + usage_data.get("output_tokens", 0)
                                    }
                                    
                                    # Calculate cost
                                    cost = self._calculate_actual_cost(final_usage)
                                    
                                    # Final chunk
                                    yield {
                                        "content": "",
                                        "is_final": True,
                                        "model": model_name,
                                        "provider": self.provider_name,
                                        "usage": final_usage,
                                        "cost": cost,
                                        "response_time_ms": response_time_ms,
                                        "total_content": accumulated_content,
                                        "chunk_count": chunk_count
                                    }
                                    
                                    self.logger.info(f"✅ Anthropic native streaming completed: {chunk_count} chunks, {len(accumulated_content)} chars")
                                    return
                                
                                elif event_type == "ping":
                                    # Keep-alive ping, ignore
                                    continue
                                
                                elif event_type == "error":
                                    # Handle streaming errors
                                    error_info = chunk_data.get("error", {})
                                    error_message = error_info.get("message", "Unknown streaming error")
                                    raise LLMProviderError(
                                        f"Anthropic streaming error: {error_message}",
                                        provider=self.provider_name,
                                        error_details={"streaming_error": error_info}
                                    )
                                
                            except json.JSONDecodeError:
                                # Skip malformed chunks
                                self.logger.warning(f"Skipping malformed JSON chunk: {data_str[:100]}...")
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
    
    # =============================================================================
    # SIMULATED STREAMING (FALLBACK ONLY - native streaming preferred)
    # =============================================================================
    
    async def simulate_streaming_response(self, request: ChatRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Fallback streaming implementation for Anthropic.
        
        This method only runs when native streaming fails. It gets the full response
        and chunks it to simulate streaming behavior.
        
        Yields:
            Dict[str, Any]: Simulated streaming chunks
        """
        self.logger.info("🔄 Using fallback simulated streaming for Anthropic")
        
        try:
            # Get complete response
            response = await self.send_chat_request(request)
            
            if not response or not response.content:
                yield {
                    "content": "",
                    "is_final": True,
                    "error": "No response content to stream",
                    "model": request.model or self.config.default_model,
                    "provider": self.provider_name
                }
                return

            # Stream content in small chunks
            content = response.content
            chunk_size = 10
            
            for i in range(0, len(content), chunk_size):
                chunk_content = content[i:i + chunk_size]
                is_final = (i + chunk_size) >= len(content)
                
                yield {
                    "content": chunk_content,
                    "is_final": is_final,
                    "model": response.model,
                    "provider": self.provider_name,
                    "usage": response.usage if is_final else None,
                    "cost": response.cost if is_final else None,
                    "response_time_ms": response.response_time_ms if is_final else None
                }
                
                # Small delay to simulate streaming
                if not is_final:
                    await asyncio.sleep(0.05)
            
        except Exception as e:
            self.logger.error(f"Fallback streaming failed: {e}")
            yield {
                "content": "",
                "is_final": True,
                "error": f"Streaming failed: {str(e)}",
                "model": getattr(request, 'model', None) or getattr(self.config, 'default_model', 'unknown'),
                "provider": self.provider_name
            }
    
    def get_known_models(self) -> list:
        """
        Get known Claude models since Anthropic doesn't have a public models endpoint.
        
        Returns:
            List of known Claude model identifiers
        """
        return [
            # Claude 4 models (latest generation)
            "claude-opus-4-20250514",      # Most capable and intelligent model yet
            "claude-sonnet-4-20250514",    # High-performance model with exceptional reasoning
            
            # Claude 3.7 models
            "claude-3-7-sonnet-20250219",  # High-performance with extended thinking
            
            # Claude 3.5 models (current generation)
            "claude-3-5-sonnet-20241022",  # Latest Claude 3.5 Sonnet v2
            "claude-3-5-sonnet-20240620",  # Claude 3.5 Sonnet
            "claude-3-5-haiku-20241022",   # Claude 3.5 Haiku
            
            # Claude 3 models (previous generation)
            "claude-3-opus-20240229",      # Claude 3 Opus
            "claude-3-sonnet-20240229",    # Claude 3 Sonnet
            "claude-3-haiku-20240307",     # Claude 3 Haiku
            
            # Model aliases (for convenience)
            "claude-opus-4-0",             # Latest Claude Opus 4
            "claude-sonnet-4-0",           # Latest Claude Sonnet 4
            "claude-3-7-sonnet-latest",    # Latest Claude 3.7 Sonnet
            "claude-3-5-sonnet-latest",    # Latest Claude 3.5 Sonnet
            "claude-3-5-haiku-latest"      # Latest Claude 3.5 Haiku
        ]


# Export Anthropic provider
__all__ = ['AnthropicProvider']
