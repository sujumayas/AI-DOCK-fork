# AI Dock LLM Base Handler
# Base class with shared request handling logic

from typing import Dict, Any, Optional, List
from datetime import datetime
import logging
from sqlalchemy.orm import Session

from ..models import ChatMessage, ChatRequest
from ..core.config_validator import get_config_validator
from ..quota_manager import get_quota_manager
from ..provider_factory import get_provider_factory
from ..exceptions import LLMServiceError


class BaseRequestHandler:
    """
    Base handler with shared logic for chat request processing.
    
    Shared Responsibilities:
    - Request validation and preparation
    - Provider initialization
    - Quota checking coordination
    - Common request lifecycle management
    """
    
    def __init__(self):
        """Initialize base handler with dependencies."""
        self.logger = logging.getLogger(__name__)
        self.config_validator = get_config_validator()
        self.quota_manager = get_quota_manager()
        self.provider_factory = get_provider_factory()
    
    async def validate_and_prepare_request(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        user_id: int,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        db_session: Optional[Session] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Validate configuration and prepare request data.
        
        Args:
            config_id: ID of the LLM configuration
            messages: List of message dictionaries
            user_id: User making the request
            model: Optional model override
            temperature: Optional temperature override
            max_tokens: Optional max tokens override
            db_session: Database session
            **kwargs: Additional request parameters
            
        Returns:
            Dictionary containing validated config and prepared request
        """
        self.logger.debug(f"Validating and preparing request for user {user_id}, config {config_id}")
        
        # Validate configuration
        config_data = await self.config_validator.get_and_validate_config(config_id, db_session)
        
        # Create chat request object
        chat_request = self._create_chat_request(messages, model, temperature, max_tokens, **kwargs)
        
        # Get provider instance
        provider = self._get_provider_from_config(config_data)
        
        return {
            'config_data': config_data,
            'chat_request': chat_request,
            'provider': provider
        }
    
    async def check_quotas(
        self,
        user_id: int,
        config_id: int,
        request: ChatRequest,
        db_session: Session,
        config_data: Dict[str, Any],
        bypass_quota: bool = False
    ):
        """
        Check user/department quotas before processing request.
        
        Args:
            user_id: User making the request
            config_id: LLM configuration ID
            request: Chat request object
            db_session: Database session
            config_data: Configuration data
            bypass_quota: Whether to skip quota checking
            
        Returns:
            Quota check result or None if bypassed
        """
        if bypass_quota:
            self.logger.info(f"Bypassing quota check for user {user_id} (admin override)")
            return None
        
        try:
            return await self.quota_manager.check_quotas_before_request(
                user_id, config_id, request, db_session, config_data
            )
        except Exception as e:
            self.logger.error(f"Quota check failed (allowing request): {str(e)}")
            return None
    
    def prepare_logging_data(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float],
        max_tokens: Optional[int],
        model: Optional[str],
        bypass_quota: bool,
        streaming: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Prepare data for request logging.
        
        Args:
            messages: Chat messages
            temperature: Temperature setting
            max_tokens: Max tokens setting
            model: Model override
            bypass_quota: Whether quota was bypassed
            streaming: Whether this is a streaming request
            **kwargs: Additional parameters
            
        Returns:
            Dictionary with request and performance data
        """
        # This could be moved to usage_logger if it becomes more complex
        request_data = {
            "messages": messages,
            "parameters": {
                "temperature": temperature,
                "max_tokens": max_tokens,
                "model_override": model,
                "bypass_quota": bypass_quota,
                **kwargs
            },
            "streaming": streaming
        }
        
        performance_data = {
            "request_started_at": datetime.utcnow().isoformat(),
            "streaming": streaming
        }
        
        return {
            'request_data': request_data,
            'performance_data': performance_data
        }
    
    def _create_chat_request(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str],
        temperature: Optional[float],
        max_tokens: Optional[int],
        **kwargs
    ) -> ChatRequest:
        """
        Create ChatRequest object from parameters.
        
        Args:
            messages: List of message dictionaries
            model: Optional model override
            temperature: Optional temperature
            max_tokens: Optional max tokens
            **kwargs: Additional parameters
            
        Returns:
            ChatRequest object
        """
        chat_messages = [ChatMessage(role=msg["role"], content=msg["content"]) for msg in messages]
        return ChatRequest(
            messages=chat_messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
    
    def _get_provider_from_config(self, config_data: Dict[str, Any]):
        """
        Get provider instance from configuration data.
        
        Args:
            config_data: Configuration data dictionary
            
        Returns:
            Provider instance
        """
        config = self.provider_factory.create_config_from_data(config_data)
        return self.provider_factory.get_provider(config)
    
    def _validate_request_parameters(
        self,
        messages: List[Dict[str, str]],
        user_id: int,
        config_id: int
    ) -> None:
        """
        Validate basic request parameters.
        
        Args:
            messages: Chat messages
            user_id: User ID
            config_id: Configuration ID
            
        Raises:
            LLMServiceError: If validation fails
        """
        if not messages:
            raise LLMServiceError("Messages cannot be empty")
        
        if user_id <= 0:
            raise LLMServiceError("Invalid user ID")
        
        if config_id <= 0:
            raise LLMServiceError("Invalid configuration ID")
        
        # Validate message structure
        for i, message in enumerate(messages):
            if not isinstance(message, dict):
                raise LLMServiceError(f"Message {i} must be a dictionary")
            
            if 'role' not in message or 'content' not in message:
                raise LLMServiceError(f"Message {i} must have 'role' and 'content' fields")
            
            if message['role'] not in ['user', 'assistant', 'system']:
                raise LLMServiceError(f"Message {i} has invalid role: {message['role']}")
        
        self.logger.debug("Request parameters validated successfully")
    
    def _log_request_start(
        self,
        user_id: int,
        config_id: int,
        provider_name: str,
        config_name: str,
        streaming: bool = False
    ) -> None:
        """
        Log request start information.
        
        Args:
            user_id: User making the request
            config_id: Configuration ID
            provider_name: Provider name
            config_name: Configuration name
            streaming: Whether this is a streaming request
        """
        request_type = "STREAMING" if streaming else "REGULAR"
        self.logger.info(
            f"Starting {request_type} chat request - "
            f"User: {user_id}, Config: {config_name} ({config_id}), "
            f"Provider: {provider_name}"
        )
