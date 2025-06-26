# AI Dock LLM Orchestrator
# Main coordination layer for modular LLM service components

from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime
import logging
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.llm_config import LLMConfiguration

# Import all atomic components
from app.services.llm.core.config_validator import get_config_validator
from app.services.llm.core.cost_calculator import get_cost_calculator
from app.services.llm.core.response_formatter import get_response_formatter
from app.services.llm.handlers.chat_handler import get_chat_handler
from app.services.llm.handlers.streaming_handler import get_streaming_handler
from app.services.llm.logging.request_logger import get_request_logger
from app.services.llm.logging.error_handler import get_error_handler
from app.services.llm.quota_manager import get_quota_manager
from app.services.llm.models import ChatResponse
from app.services.llm.exceptions import LLMServiceError


class LLMOrchestrator:
    """
    Main orchestration layer that coordinates all modular LLM service components.
    
    This orchestrator is responsible for:
    - Delegating requests to appropriate handlers (chat vs streaming)
    - Coordinating between atomic components
    - Providing a clean interface for the main service facade
    - Managing cross-cutting concerns like logging and error handling
    
    The orchestrator itself is thin and focuses purely on coordination,
    while all business logic is contained in the atomic components.
    """
    
    def __init__(self):
        """Initialize orchestrator with all dependencies."""
        self.logger = logging.getLogger(__name__)
        
        # Core components
        self.config_validator = get_config_validator()
        self.cost_calculator = get_cost_calculator()
        self.response_formatter = get_response_formatter()
        
        # Request handlers
        self.chat_handler = get_chat_handler()
        self.streaming_handler = get_streaming_handler()
        
        # Logging and error handling
        self.request_logger = get_request_logger()
        self.error_handler = get_error_handler()
        
        # Quota management
        self.quota_manager = get_quota_manager()
        
        self.logger.info("LLM Orchestrator initialized with all atomic components")
    
    # =============================================================================
    # MAIN REQUEST COORDINATION METHODS
    # =============================================================================
    
    async def process_chat_request(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        user_id: int,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        assistant_id: Optional[int] = None,
        bypass_quota: bool = False,
        **kwargs
    ) -> ChatResponse:
        """
        Process a regular (non-streaming) chat request.
        
        This method coordinates the complete request lifecycle by delegating
        to the chat handler while managing error handling and logging.
        
        Args:
            config_id: ID of the LLM configuration to use
            messages: List of message dictionaries (role, content)
            user_id: ID of user making the request
            model: Override model (optional)
            temperature: Override temperature (optional)
            max_tokens: Override max tokens (optional)
            session_id: Session identifier for grouping requests (optional)
            request_id: Unique request identifier for tracing (optional)
            ip_address: Client IP address (optional)
            user_agent: Client user agent string (optional)
            assistant_id: ID of custom assistant being used (optional)
            bypass_quota: If True, skip quota checking (admin only)
            **kwargs: Additional provider-specific parameters
            
        Returns:
            ChatResponse from the LLM provider
            
        Raises:
            LLMServiceError: If request fails at any stage
        """
        self.logger.info(f"Orchestrating chat request - User: {user_id}, Config: {config_id}")
        
        # Get database session for request processing
        with next(get_db()) as db_session:
            try:
                # Delegate to chat handler for complete processing
                response = await self.chat_handler.handle_chat_request(
                    config_id=config_id,
                    messages=messages,
                    user_id=user_id,
                    db_session=db_session,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    session_id=session_id,
                    request_id=request_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    assistant_id=assistant_id,
                    bypass_quota=bypass_quota,
                    **kwargs
                )
                
                self.logger.info(f"Chat request orchestration completed successfully for user {user_id}")
                return response
                
            except Exception as e:
                # Handle error through error handler
                error_context = {
                    "user_id": user_id,
                    "config_id": config_id,
                    "request_id": request_id,
                    "session_id": session_id,
                    "request_type": "chat"
                }
                
                error_result = self.error_handler.handle_request_error(e, error_context)
                self.logger.error(f"Chat request orchestration failed: {error_result['classification']['user_friendly_message']}")
                
                # Re-raise the original error for the caller
                raise
    
    async def process_streaming_request(
        self,
        config_id: int,
        messages: List[Dict[str, str]], 
        user_id: int,
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
        Process a streaming chat request.
        
        This method coordinates streaming requests by delegating to the
        streaming handler while managing error handling.
        
        Args:
            config_id: ID of the LLM configuration to use
            messages: List of message dictionaries (role, content)
            user_id: ID of user making the request
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
        self.logger.info(f"Orchestrating streaming request - User: {user_id}, Config: {config_id}")
        
        # Get database session for request processing
        with next(get_db()) as db_session:
            try:
                # Delegate to streaming handler for complete processing
                async for chunk in self.streaming_handler.handle_streaming_request(
                    config_id=config_id,
                    messages=messages,
                    user_id=user_id,
                    db_session=db_session,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    session_id=session_id,
                    request_id=request_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    bypass_quota=bypass_quota,
                    **kwargs
                ):
                    yield chunk
                
                self.logger.info(f"Streaming request orchestration completed successfully for user {user_id}")
                
            except Exception as e:
                # Handle streaming error through error handler
                error_context = {
                    "user_id": user_id,
                    "config_id": config_id,
                    "request_id": request_id,
                    "session_id": session_id,
                    "request_type": "streaming"
                }
                
                error_result = self.error_handler.handle_streaming_error(e, error_context)
                self.logger.error(f"Streaming request orchestration failed: {error_result['classification']['user_friendly_message']}")
                
                # Re-raise the original error for the caller
                raise
    
    # =============================================================================
    # CONFIGURATION AND TESTING COORDINATION
    # =============================================================================
    
    async def test_configuration(
        self, 
        config: Optional[LLMConfiguration] = None,
        config_id: Optional[int] = None,
        test_message: str = "Hello! This is a test.",
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """
        Test a specific LLM configuration.
        
        Coordinates configuration testing by delegating to the chat handler
        while adding orchestrator-level error handling and formatting.
        
        Args:
            config: LLM configuration object (optional)
            config_id: Configuration ID if config not provided
            test_message: Test message to send
            timeout_seconds: Test timeout
            
        Returns:
            Formatted test result dictionary
        """
        self.logger.info(f"Orchestrating configuration test - Config ID: {config_id}")
        
        try:
            # Get configuration if not provided
            if config is None:
                if config_id is None:
                    raise LLMServiceError("Either config or config_id must be provided")
                    
                with next(get_db()) as db_session:
                    config_data = await self.config_validator.get_and_validate_config(config_id, db_session)
                    # Get the actual config object for provider testing
                    config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            
            # Test through chat handler (it has the provider testing logic)
            test_result = await self.chat_handler.test_configuration(
                config=config,
                test_message=test_message,
                timeout_seconds=timeout_seconds
            )
            
            # Format test response
            formatted_result = self.response_formatter.format_test_response(
                test_result, config.name, config.provider
            )
            
            self.logger.info(f"Configuration test completed - Success: {formatted_result['success']}")
            return formatted_result
            
        except Exception as e:
            error_context = {
                "config_id": config_id,
                "test_message": test_message,
                "operation": "configuration_test"
            }
            
            error_result = self.error_handler.handle_request_error(e, error_context)
            
            # Return formatted error response
            return self.response_formatter.format_error_response(
                e, config.provider if config else None, config.default_model if config else None
            )
    
    async def estimate_request_cost(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        max_tokens: Optional[int] = None
    ) -> Optional[float]:
        """
        Estimate the cost of a chat request.
        
        Coordinates cost estimation by delegating to the chat handler.
        
        Args:
            config_id: ID of the LLM configuration
            messages: List of message dictionaries
            model: Optional model override
            max_tokens: Optional max tokens override
            
        Returns:
            Estimated cost in USD, or None if estimation not possible
        """
        self.logger.debug(f"Orchestrating cost estimation - Config: {config_id}")
        
        try:
            with next(get_db()) as db_session:
                estimated_cost = await self.chat_handler.estimate_request_cost(
                    config_id, messages, db_session, model, max_tokens
                )
                
                self.logger.debug(f"Cost estimation completed: ${estimated_cost}")
                return estimated_cost
                
        except Exception as e:
            self.logger.warning(f"Cost estimation failed: {str(e)}")
            return None
    
    # =============================================================================
    # QUOTA STATUS COORDINATION
    # =============================================================================
    
    async def get_user_quota_status(self, user_id: int) -> Dict[str, Any]:
        """
        Get quota status for a user's department.
        
        Delegates to quota manager while adding orchestrator-level formatting.
        
        Args:
            user_id: User ID to check quota for
            
        Returns:
            Quota status information
        """
        self.logger.debug(f"Orchestrating quota status check for user {user_id}")
        
        try:
            with next(get_db()) as db_session:
                quota_status = await self.quota_manager.get_user_quota_status(user_id, db_session)
                
                self.logger.debug(f"Quota status retrieved for user {user_id}")
                return quota_status
                
        except Exception as e:
            self.logger.warning(f"Failed to get quota status for user {user_id}: {str(e)}")
            return {
                "error": str(e),
                "quota_available": False,
                "can_make_requests": False
            }
    
    async def check_user_can_use_config(self, user_id: int, config_id: int) -> Dict[str, Any]:
        """
        Check if a user can use a specific LLM configuration based on quotas.
        
        Args:
            user_id: User ID to check
            config_id: Configuration ID to check
            
        Returns:
            Configuration usage permission information
        """
        self.logger.debug(f"Orchestrating config usage check - User: {user_id}, Config: {config_id}")
        
        try:
            with next(get_db()) as db_session:
                config_data = await self.config_validator.get_and_validate_config(config_id, db_session)
                usage_check = await self.quota_manager.check_user_can_use_config(
                    user_id, config_id, db_session, config_data
                )
                
                self.logger.debug(f"Config usage check completed for user {user_id}")
                return usage_check
                
        except Exception as e:
            self.logger.warning(f"Failed to check config usage for user {user_id}: {str(e)}")
            return {
                "error": str(e),
                "can_use_config": False,
                "quota_available": False
            }
    
    # =============================================================================
    # HEALTH AND STATUS METHODS
    # =============================================================================
    
    def get_orchestrator_status(self) -> Dict[str, Any]:
        """
        Get status of all orchestrator components.
        
        Returns:
            Status information for debugging and monitoring
        """
        return {
            "orchestrator": "healthy",
            "components": {
                "config_validator": "initialized",
                "cost_calculator": "initialized", 
                "response_formatter": "initialized",
                "chat_handler": "initialized",
                "streaming_handler": "initialized",
                "request_logger": "initialized",
                "error_handler": "initialized",
                "quota_manager": "initialized"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def get_available_operations(self) -> List[str]:
        """Get list of available operations this orchestrator supports."""
        return [
            "process_chat_request",
            "process_streaming_request", 
            "test_configuration",
            "estimate_request_cost",
            "get_user_quota_status",
            "check_user_can_use_config",
            "get_provider_models"
        ]
    
    async def get_provider_models(self, config_id: int) -> list[str]:
        """
        Fetch available models from a provider's API with intelligent caching.
        
        Args:
            config_id: ID of the LLM configuration to use
            
        Returns:
            List of model IDs available from the provider
            
        Raises:
            LLMServiceError: If configuration not found or provider error
        """
        # 🐛 DEBUG: Add detailed logging
        self.logger.info(f"🔍 Orchestrator fetching models for config {config_id}")
        
        # 🚀 NEW: Try to get models from cache first
        try:
            from ..cache import get_model_cache_manager
            cache_manager = get_model_cache_manager()
            
            # Check cache for models (try both filtered and unfiltered versions)
            cached_data = await cache_manager.get_models(config_id, show_all_models=True)
            
            if cached_data:
                self.logger.info(f"📋 Cache HIT: Using cached models for config {config_id} (expires in {cached_data.time_until_expiry()})")
                return cached_data.models
            else:
                self.logger.info(f"📋 Cache MISS: Fetching fresh models for config {config_id}")
        
        except Exception as cache_error:
            self.logger.warning(f"⚠️ Cache error, fetching fresh models: {str(cache_error)}")
        
        # Import here to avoid circular imports
        from app.core.database import SyncSessionLocal
        from sqlalchemy import select
        from app.models.llm_config import LLMConfiguration
        from ..provider_factory import get_provider
        
        # Use synchronous database session for now
        # TODO: Convert to async session in future refactor
        try:
            with SyncSessionLocal() as db_session:
                # Get configuration
                config = db_session.get(LLMConfiguration, config_id)
                if not config:
                    raise LLMServiceError(f"Configuration {config_id} not found")
                
                self.logger.info(f"🔍 Found config: {config.name} (Provider: {config.provider})")
                
                # Get provider instance
                provider = get_provider(config)
                
                # 🌐 Fetch models from provider API
                self.logger.info(f"🌐 Fetching models from {config.provider} API...")
                models = await provider.get_available_models()
                
                self.logger.info(f"✅ Successfully fetched {len(models)} models from {config.provider} API")
                
                # 🚀 NEW: Cache the fetched models for future requests
                try:
                    cache_success = await cache_manager.set_models(
                        config_id=config_id,
                        models=models,
                        provider=config.provider.value if hasattr(config.provider, 'value') else str(config.provider),
                        config_name=config.name,
                        default_model=config.default_model,
                        show_all_models=True,  # Cache the full unfiltered list
                        ttl_seconds=3600,  # 1 hour cache
                        total_api_models=len(models)
                    )
                    
                    if cache_success:
                        self.logger.info(f"💾 Successfully cached {len(models)} models for config {config_id}")
                    else:
                        self.logger.warning(f"⚠️ Failed to cache models for config {config_id}")
                
                except Exception as cache_error:
                    self.logger.error(f"❌ Error caching models: {str(cache_error)}")
                    # Don't fail the request if caching fails
                
                return models
                
        except Exception as e:
            self.logger.error(f"❌ Error fetching models from provider: {str(e)}")
            raise LLMServiceError(f"Failed to fetch models from provider: {str(e)}")
        
        return []


# Factory function for dependency injection
def get_llm_orchestrator() -> LLMOrchestrator:
    """
    Get LLM orchestrator instance.
    
    Returns:
        LLMOrchestrator instance
    """
    return LLMOrchestrator()


# Export main orchestrator
__all__ = ['LLMOrchestrator', 'get_llm_orchestrator']
