# AI Dock LLM Streaming Handler
# Atomic component for streaming chat request handling

import asyncio
from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime
import logging
from sqlalchemy.orm import Session

from .base_handler import BaseRequestHandler
from ..models import ChatResponse
from ..core.cost_calculator import get_cost_calculator
from ..core.response_formatter import get_response_formatter
from ..usage_logger import get_usage_logger
from ..exceptions import LLMServiceError, LLMProviderError


class StreamingHandler(BaseRequestHandler):
    """
    Atomic component responsible for handling streaming chat requests.
    
    Single Responsibility:
    - Process streaming chat requests with real-time chunk delivery
    - Coordinate provider streaming with background logging
    - Handle streaming-specific error cases and cleanup
    """
    
    def __init__(self):
        """Initialize streaming handler with dependencies."""
        super().__init__()
        self.cost_calculator = get_cost_calculator()
        self.response_formatter = get_response_formatter()
        self.usage_logger = get_usage_logger()
        self.logger = logging.getLogger(__name__)
    
    async def handle_streaming_request(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        user_id: int,
        db_session: Session,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        bypass_quota: bool = False,
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Handle a complete streaming chat request lifecycle.
        
        Args:
            config_id: ID of the LLM configuration to use
            messages: List of message dictionaries (role, content)
            user_id: ID of user making the request
            db_session: Database session for all operations
            model: Override model (optional)
            temperature: Override temperature (optional)
            max_tokens: Override max tokens (optional)
            session_id: Session identifier for grouping requests (optional)
            request_id: Unique request identifier for tracing (optional)
            ip_address: Client IP address (optional)
            user_agent: Client user agent (optional)
            bypass_quota: If True, skip quota checking (admin only)
            **kwargs: Additional provider-specific parameters
            
        Yields:
            Dict[str, Any]: Formatted streaming chunks with content and metadata
            
        Raises:
            LLMServiceError: If request fails at any stage
        """
        self.logger.info(f"Processing STREAMING chat request for user {user_id}, config {config_id}")
        
        # =============================================================================
        # STEP 1: VALIDATE AND PREPARE REQUEST
        # =============================================================================
        
        self._validate_request_parameters(messages, user_id, config_id)
        
        prepared_data = await self.validate_and_prepare_request(
            config_id, messages, user_id, model, temperature, max_tokens, db_session, **kwargs
        )
        
        config_data = prepared_data['config_data']
        chat_request = prepared_data['chat_request']
        provider = prepared_data['provider']
        
        # =============================================================================
        # STEP 2: CHECK QUOTAS
        # =============================================================================
        
        quota_check_result = await self.check_quotas(
            user_id, config_id, chat_request, db_session, config_data, bypass_quota
        )
        
        # =============================================================================
        # STEP 3: PREPARE LOGGING DATA
        # =============================================================================
        
        logging_data = self.prepare_logging_data(
            messages, temperature, max_tokens, model, bypass_quota, streaming=True, **kwargs
        )
        
        request_data = logging_data['request_data']
        performance_data = logging_data['performance_data']
        
        # =============================================================================
        # STEP 4: START STREAMING FROM PROVIDER
        # =============================================================================
        
        self._log_request_start(
            user_id, config_id, provider.provider_name, config_data['name'], streaming=True
        )
        
        # Initialize streaming state
        accumulated_content = ""
        accumulated_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        actual_model = chat_request.model or config_data['default_model']  # Track actual model used
        chunk_count = 0
        streaming_start_time = datetime.utcnow()
        
        try:
            # Stream from provider with error handling
            async for chunk_data in self._stream_from_provider(provider, chat_request):
                
                chunk_count += 1
                chunk_content = chunk_data.get("content", "")
                accumulated_content += chunk_content
                
                # Update usage data if available
                if "usage" in chunk_data:
                    accumulated_usage.update(chunk_data["usage"])
                
                # Track the actual model from streaming chunks
                if "model" in chunk_data and chunk_data["model"]:
                    actual_model = chunk_data["model"]
                
                # Handle final chunk
                if chunk_data.get("is_final"):
                    
                    # Calculate final metrics
                    streaming_duration_ms = int(
                        (datetime.utcnow() - streaming_start_time).total_seconds() * 1000
                    )
                    
                    # Create final response for logging (FIXED: Added await)
                    final_response = await self._create_final_response(
                        accumulated_content, accumulated_usage, actual_model, config_data,
                        provider.provider_name, streaming_duration_ms
                    )
                    
                    # Start background logging task (fire and forget)
                    asyncio.create_task(
                        self._log_streaming_success_background(
                            user_id, config_id, request_data, final_response, performance_data,
                            session_id, request_id, ip_address, user_agent,
                            quota_check_result, bypass_quota, db_session, chunk_count, config_data
                        )
                    )
                    
                    # Format and yield final chunk
                    final_chunk = self.response_formatter.format_streaming_final_chunk(
                        accumulated_content, final_response, chunk_count, streaming_duration_ms
                    )
                    
                    yield self.response_formatter.add_request_metadata(
                        final_chunk, request_id, session_id, user_id, config_id
                    )
                    
                    break
                else:
                    # Format and yield regular chunk
                    formatted_chunk = self.response_formatter.format_streaming_chunk(
                        chunk_data, chunk_count - 1, provider.provider_name
                    )
                    
                    yield self.response_formatter.add_request_metadata(
                        formatted_chunk, request_id, session_id, user_id, config_id
                    )
                
            self.logger.info(f"Streaming completed successfully for user {user_id}: {chunk_count} chunks sent")
            
        except Exception as e:
            # =============================================================================
            # STEP 5: HANDLE STREAMING ERRORS
            # =============================================================================
            
            streaming_duration_ms = int(
                (datetime.utcnow() - streaming_start_time).total_seconds() * 1000
            )
            
            # Start background error logging (fire and forget)
            asyncio.create_task(
                self._log_streaming_error_background(
                    e, user_id, config_id, request_data, performance_data,
                    model, provider, config_data, session_id, request_id,
                    ip_address, user_agent, quota_check_result, chunk_count,
                    accumulated_content, streaming_duration_ms
                )
            )
            
            # Re-raise the error for the caller to handle
            self.logger.error(f"Streaming request failed for user {user_id}: {str(e)}")
            raise
    
    async def _stream_from_provider(self, provider, request) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream response from provider, handling different streaming capabilities.
        
        Args:
            provider: The LLM provider instance
            request: The chat request
            
        Yields:
            Dict[str, Any]: Streaming chunks
        """
        self.logger.info(f"🌊 Attempting to stream from provider: {provider.provider_name}")
        self.logger.debug(f"Provider type: {type(provider)}")
        self.logger.debug(f"Provider methods: {[m for m in dir(provider) if 'stream' in m.lower()]}")
        
        # Prioritize native streaming, fallback to simulated streaming
        if hasattr(provider, 'stream_chat_request'):
            self.logger.info(f"Using native streaming for {provider.provider_name}")
            async for chunk in provider.stream_chat_request(request):
                yield chunk
        elif hasattr(provider, 'simulate_streaming_response'):
            self.logger.info(f"Using simulated streaming for {provider.provider_name}")
            
            try:
                streaming_result = provider.simulate_streaming_response(request)
                
                # Validate the streaming result
                if streaming_result is None:
                    raise LLMProviderError(
                        "Provider streaming method returned None instead of async generator",
                        provider.provider_name
                    )
                
                # Check if it's actually an async generator
                import inspect
                if not inspect.isasyncgen(streaming_result) and not hasattr(streaming_result, '__aiter__'):
                    raise LLMProviderError(
                        f"Provider streaming method returned {type(streaming_result).__name__} instead of async generator",
                        provider.provider_name
                    )
                
                # Stream the chunks
                async for chunk in streaming_result:
                    # Check if chunk contains an error
                    if chunk.get("error"):
                        raise LLMProviderError(
                            chunk.get("error", "Unknown provider error"),
                            provider.provider_name
                        )
                    yield chunk
                    
            except Exception as e:
                self.logger.error(f"Simulated streaming failed for {provider.provider_name}: {e}")
                raise
        else:
            # Last resort: handler-level fallback streaming
            self.logger.info(f"Using handler fallback streaming for {provider.provider_name}")
            response = await provider.send_chat_request(request)
            content = response.content
            chunk_size = 10
            
            for i in range(0, len(content), chunk_size):
                chunk_content = content[i:i + chunk_size]
                is_final = (i + chunk_size) >= len(content)
                
                yield {
                    "content": chunk_content,
                    "is_final": is_final,
                    "model": response.model,
                    "provider": response.provider,
                    "usage": response.usage if is_final else None,
                    "cost": response.cost if is_final else None,
                    "response_time_ms": response.response_time_ms if is_final else None
                }
                
                if not is_final:
                    await asyncio.sleep(0.05)
    
    async def _create_final_response(
        self,
        accumulated_content: str,
        accumulated_usage: Dict[str, int],
        actual_model: str,
        config_data: Dict[str, Any],
        provider_name: str,
        streaming_duration_ms: int
    ) -> ChatResponse:
        """
        Create final ChatResponse object from accumulated streaming data.
        
        Args:
            accumulated_content: Complete content from streaming
            accumulated_usage: Final usage statistics
            actual_model: The actual model used (from streaming chunks or request)
            config_data: Configuration data
            provider_name: Name of the provider
            streaming_duration_ms: Total streaming duration
            
        Returns:
            ChatResponse object for logging
        """
        # Calculate final cost using LiteLLM (FIXED: Added await)
        final_cost = await self.cost_calculator.calculate_streaming_cost(accumulated_usage, config_data, actual_model)
        
        return ChatResponse(
            content=accumulated_content,
            model=actual_model,  # FIXED: Use actual model instead of config default
            provider=provider_name,
            usage=accumulated_usage,
            cost=final_cost,  # This is the actual cost from LiteLLM
            response_time_ms=streaming_duration_ms
        )
    
    async def _log_streaming_success_background(
        self,
        user_id: int,
        config_id: int,
        request_data: Dict,
        final_response: ChatResponse,
        performance_data: Dict,
        session_id: Optional[str],
        request_id: Optional[str],
        ip_address: Optional[str],
        user_agent: Optional[str],
        quota_check_result,
        bypass_quota: bool,
        db_session: Session,
        chunk_count: int,
        config_data: Dict[str, Any]
    ):
        """
        Background task for logging successful streaming requests.
        
        Args:
            user_id: User ID
            config_id: Configuration ID
            request_data: Request data
            final_response: Final response object
            performance_data: Performance metrics
            session_id: Session identifier
            request_id: Request identifier
            ip_address: Client IP
            user_agent: Client user agent
            quota_check_result: Quota check result
            bypass_quota: Whether quota was bypassed
            db_session: Database session
            chunk_count: Number of chunks sent
            config_data: Configuration data
        """
        try:
            # Update performance data
            performance_data.update({
                "request_completed_at": datetime.utcnow().isoformat(),
                "response_time_ms": final_response.response_time_ms,
                "chunks_sent": chunk_count
            })
            
            # Create response data for logging
            response_data = self.usage_logger.create_success_response_data(
                final_response,
                streaming=True,
                chunks_sent=chunk_count,
                quota_check_passed=quota_check_result is not None,
                quota_details=quota_check_result.quota_details if quota_check_result else {}
            )
            
            # Log the streaming request
            await self.usage_logger.log_streaming_usage_background(
                user_id, config_id, request_data, response_data, performance_data,
                session_id, request_id, ip_address, user_agent, final_response, bypass_quota, db_session
            )
            
            self.logger.debug(f"Successfully logged streaming request for user {user_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to log streaming success: {str(e)}")
    
    async def _log_streaming_error_background(
        self,
        error: Exception,
        user_id: int,
        config_id: int,
        request_data: Dict,
        performance_data: Dict,
        model: Optional[str],
        provider,
        config_data: Dict[str, Any],
        session_id: Optional[str],
        request_id: Optional[str],
        ip_address: Optional[str],
        user_agent: Optional[str],
        quota_check_result,
        chunk_count: int,
        partial_content: str,
        streaming_duration_ms: int
    ):
        """
        Background task for logging streaming errors.
        
        Args:
            error: Exception that occurred
            user_id: User ID
            config_id: Configuration ID
            request_data: Request data
            performance_data: Performance data
            model: Model used
            provider: Provider instance
            config_data: Configuration data
            session_id: Session identifier
            request_id: Request identifier
            ip_address: Client IP
            user_agent: Client user agent
            quota_check_result: Quota check result
            chunk_count: Number of chunks sent before error
            partial_content: Content received before error
            streaming_duration_ms: Duration before error
        """
        try:
            # Update performance data
            performance_data.update({
                "request_completed_at": datetime.utcnow().isoformat(),
                "response_time_ms": streaming_duration_ms,
                "chunks_sent": chunk_count,
                "error_during_streaming": True,
                "partial_content_length": len(partial_content)
            })
            
            # Create error response data
            response_data = self.usage_logger.create_error_response_data(
                error,
                model or config_data['default_model'],
                provider.provider_name,
                streaming=True,
                chunks_sent=chunk_count,
                partial_content=partial_content,
                quota_check_passed=False,
                quota_details=quota_check_result.quota_details if quota_check_result else {}
            )
            
            # Log the failed streaming request
            await self.usage_logger.log_streaming_usage_background(
                user_id, config_id, request_data, response_data, performance_data,
                session_id, request_id, ip_address, user_agent, None, False, None
            )
            
            self.logger.debug(f"Successfully logged streaming error for user {user_id}")
            
        except Exception as logging_error:
            self.logger.error(f"Failed to log streaming error: {str(logging_error)}")


# Factory function for dependency injection
def get_streaming_handler() -> StreamingHandler:
    """
    Get streaming handler instance.
    
    Returns:
        StreamingHandler instance
    """
    return StreamingHandler()
