# AI Dock Main LLM Service - Refactored Thin Facade
# Simplified orchestration layer that delegates to modular components

from typing import Dict, Any, Optional, List, AsyncGenerator
import logging

from ...models.llm_config import LLMConfiguration
from .core.orchestrator import get_llm_orchestrator
from .models import ChatResponse
from .exceptions import LLMServiceError


class LLMService:
    """
    Main LLM service facade that provides a clean interface to LLM functionality.
    
    This service has been refactored from 1500+ lines to ~100 lines by extracting
    all business logic into modular atomic components. The service now acts as a
    thin facade that delegates all operations to the orchestrator.
    
    Architecture:
    - LLMService (this facade) → LLMOrchestrator → Atomic Components
    - All business logic is in atomic components (handlers, core, logging)
    - This service provides backward compatibility and a clean public API
    """
    
    def __init__(self):
        """Initialize the LLM service facade."""
        self.logger = logging.getLogger(__name__)
        self.orchestrator = get_llm_orchestrator()
        self.logger.info("LLM Service initialized as thin facade with modular orchestrator")
    
    # =============================================================================
    # MAIN CHAT REQUEST METHODS (Delegate to Orchestrator)
    # =============================================================================
    
    async def send_chat_request(
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
        Send a regular chat request.
        
        This method provides backward compatibility while delegating all
        processing to the modular orchestrator.
        
        Args:
            config_id: ID of the LLM configuration to use
            messages: List of message dictionaries (role, content)
            user_id: ID of user making the request (for usage tracking)
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
            Chat response from the LLM
            
        Raises:
            LLMServiceError: If request fails at any stage
        """
        self.logger.debug(f"LLM Service delegating chat request to orchestrator - User: {user_id}")
        
        return await self.orchestrator.process_chat_request(
            config_id=config_id,
            messages=messages,
            user_id=user_id,
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
    
    async def stream_chat_request(
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
        Stream a chat request with real-time response chunks.
        
        This method provides backward compatibility while delegating all
        streaming processing to the modular orchestrator.
        
        Args:
            config_id: ID of the LLM configuration to use
            messages: List of message dictionaries (role, content)
            user_id: ID of user making the request (for usage tracking)
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
            Dict[str, Any]: Streaming chunks with content, metadata, and final stats
        """
        self.logger.debug(f"LLM Service delegating streaming request to orchestrator - User: {user_id}")
        
        async for chunk in self.orchestrator.process_streaming_request(
            config_id=config_id,
            messages=messages,
            user_id=user_id,
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
    
    # =============================================================================
    # CONFIGURATION AND TESTING METHODS (Delegate to Orchestrator)
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
        
        Delegates to orchestrator for actual testing while providing
        backward compatibility.
        
        Args:
            config: LLM configuration object (optional)
            config_id: Configuration ID if config not provided
            test_message: Test message to send
            timeout_seconds: Test timeout
            
        Returns:
            Test result dictionary
        """
        self.logger.debug(f"LLM Service delegating config test to orchestrator - Config: {config_id}")
        
        return await self.orchestrator.test_configuration(
            config=config,
            config_id=config_id,
            test_message=test_message,
            timeout_seconds=timeout_seconds
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
        
        Delegates to orchestrator for cost estimation.
        
        Args:
            config_id: ID of the LLM configuration
            messages: List of message dictionaries
            model: Optional model override
            max_tokens: Optional max tokens override
            
        Returns:
            Estimated cost in USD, or None if estimation not possible
        """
        self.logger.debug(f"LLM Service delegating cost estimation to orchestrator - Config: {config_id}")
        
        return await self.orchestrator.estimate_request_cost(
            config_id=config_id,
            messages=messages,
            model=model,
            max_tokens=max_tokens
        )
    
    # =============================================================================
    # QUOTA STATUS METHODS (Delegate to Orchestrator)
    # =============================================================================
    
    async def get_user_quota_status(self, user_id: int) -> Dict[str, Any]:
        """
        Get quota status for a user's department.
        
        Delegates to orchestrator for quota status checking.
        
        Args:
            user_id: User ID to check quota for
            
        Returns:
            Quota status information
        """
        self.logger.debug(f"LLM Service delegating quota status check to orchestrator - User: {user_id}")
        
        return await self.orchestrator.get_user_quota_status(user_id)
    
    async def check_user_can_use_config(self, user_id: int, config_id: int) -> Dict[str, Any]:
        """
        Check if a user can use a specific LLM configuration based on quotas.
        
        Delegates to orchestrator for configuration usage checking.
        
        Args:
            user_id: User ID to check
            config_id: Configuration ID to check
            
        Returns:
            Configuration usage permission information
        """
        self.logger.debug(f"LLM Service delegating config usage check to orchestrator - User: {user_id}, Config: {config_id}")
        
        return await self.orchestrator.check_user_can_use_config(user_id, config_id)
    
    # =============================================================================
    # SERVICE STATUS AND HEALTH METHODS
    # =============================================================================
    
    def get_service_status(self) -> Dict[str, Any]:
        """
        Get status of the LLM service and all its components.
        
        Returns:
            Comprehensive status information for monitoring
        """
        orchestrator_status = self.orchestrator.get_orchestrator_status()
        
        return {
            "service": "healthy",
            "architecture": "modular_facade",
            "facade_version": "refactored_thin",
            "available_operations": self.orchestrator.get_available_operations(),
            "orchestrator_status": orchestrator_status,
            "components_count": len(orchestrator_status.get("components", {})),
            "backward_compatibility": "maintained"
        }
    
    def get_available_methods(self) -> List[str]:
        """
        Get list of available service methods for API documentation.
        
        Returns:
            List of method names available in this service
        """
        return [
            "send_chat_request",
            "stream_chat_request",
            "test_configuration", 
            "estimate_request_cost",
            "get_user_quota_status",
            "check_user_can_use_config",
            "get_service_status",
            "get_available_methods"
        ]

    async def get_dynamic_models(
        self,
        config_id: int,
        db,
        use_cache: bool = True,
        show_all_models: bool = False
    ) -> dict:
        from app.models.llm_config import LLMConfiguration
        from app.services.llm.core.orchestrator import LLMOrchestrator
        from app.services.model_filter import ModelFilterLevel

        config = await db.get(LLMConfiguration, config_id)
        if not config:
            raise ValueError(f"LLM config {config_id} not found")

        provider = config.provider.value if hasattr(config.provider, "value") else str(config.provider)
        default_model = config.default_model

        # Get orchestrator instance
        orchestrator = LLMOrchestrator()
        
        try:
            # 🐛 DEBUG: Add detailed logging to see what's happening
            self.logger.info(f"🔍 Attempting to fetch models from {provider} API for config {config_id}")
            self.logger.info(f"🔍 show_all_models={show_all_models}, use_cache={use_cache}")
            
            # Fetch models from the provider using the orchestrator
            models = await orchestrator.get_provider_models(config_id)
            
            self.logger.info(f"✅ Successfully fetched {len(models)} models from {provider} API: {models[:5]}...")
            
            # Apply filtering if not showing all models
            if not show_all_models:
                from app.services.model_filter import OpenAIModelFilter, ModelFilterLevel
                filter_engine = OpenAIModelFilter()
                filtered_models, metadata = filter_engine.filter_models(
                    models, 
                    ModelFilterLevel.RECOMMENDED
                )
                self.logger.info(f"🔍 Applied filtering: {len(models)} -> {len(filtered_models)} models")
                models = filtered_models
            
            return {
                "models": models,
                "provider": provider,
                "default_model": default_model,
                "cached": use_cache,
                "filtering_applied": not show_all_models
            }
            
        except Exception as e:
            # 🐛 DEBUG: Add detailed error logging to see what's failing
            self.logger.error(f"❌ Failed to fetch models from {provider} API for config {config_id}: {type(e).__name__}: {str(e)}")
            self.logger.error(f"❌ Exception details: {repr(e)}")
            
            # Fallback to configuration models if API fails
            fallback_models = [default_model] if default_model else []
            self.logger.warning(f"🔄 Falling back to configuration models for config {config_id}: {fallback_models}")
            
            return {
                "models": fallback_models,
                "provider": provider,
                "default_model": default_model,
                "cached": False,
                "filtering_applied": False,
                "error": str(e)
            }


# Global service instance (singleton pattern - maintains backward compatibility)
_llm_service = None

def get_llm_service() -> LLMService:
    """
    Get the global LLM service instance.
    
    This maintains backward compatibility with the existing singleton pattern
    while providing access to the refactored modular service.
    
    Returns:
        Singleton LLM service instance (now a thin facade)
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


# Export main service (maintains backward compatibility)
__all__ = ['LLMService', 'get_llm_service']
