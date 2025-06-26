# AI Dock LLM Chat Handler
# Atomic component for regular (non-streaming) chat request handling

from typing import Dict, Any, Optional, List
from datetime import datetime
import logging
from sqlalchemy.orm import Session

from .base_handler import BaseRequestHandler
from ..models import ChatResponse
from ..core.cost_calculator import get_cost_calculator
from ..core.response_formatter import get_response_formatter
from ..usage_logger import get_usage_logger
from ..exceptions import LLMServiceError


class ChatHandler(BaseRequestHandler):
    """
    Atomic component responsible for handling regular (non-streaming) chat requests.
    
    Single Responsibility:
    - Process regular chat requests through the complete lifecycle
    - Coordinate with providers for standard responses
    - Handle success and error cases for regular requests
    """
    
    def __init__(self):
        """Initialize chat handler with dependencies."""
        super().__init__()
        self.cost_calculator = get_cost_calculator()
        self.response_formatter = get_response_formatter()
        self.usage_logger = get_usage_logger()
        self.logger = logging.getLogger(__name__)
    
    async def handle_chat_request(
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
        assistant_id: Optional[int] = None,
        bypass_quota: bool = False,
        **kwargs
    ) -> ChatResponse:
        """
        Handle a complete regular chat request lifecycle.
        
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
            user_agent: Client user agent string (optional)
            assistant_id: ID of custom assistant being used (optional)
            bypass_quota: If True, skip quota checking (admin only)
            **kwargs: Additional provider-specific parameters
            
        Returns:
            ChatResponse from the LLM provider
            
        Raises:
            LLMServiceError: If request fails at any stage
        """
        self.logger.info(f"Processing regular chat request for user {user_id}, config {config_id}")
        
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
            messages, temperature, max_tokens, model, bypass_quota, streaming=False, **kwargs
        )
        
        request_data = logging_data['request_data']
        performance_data = logging_data['performance_data']
        
        # =============================================================================
        # STEP 4: SEND REQUEST TO PROVIDER
        # =============================================================================
        
        self._log_request_start(
            user_id, config_id, provider.provider_name, config_data['name'], streaming=False
        )
        
        try:
            # Send the actual request to the provider
            response = await provider.send_chat_request(chat_request)
            
            # Record completion timing
            performance_data.update({
                "request_completed_at": datetime.utcnow().isoformat(),
                "response_time_ms": response.response_time_ms
            })
            
            # =============================================================================
            # STEP 5: LOG SUCCESS AND RECORD QUOTA USAGE
            # =============================================================================
            
            await self._log_successful_request(
                user_id, config_id, request_data, response, performance_data,
                session_id, request_id, ip_address, user_agent,
                quota_check_result, bypass_quota, db_session, config_data
            )
            
            self.logger.info(f"Chat request completed successfully for user {user_id}")
            return response
            
        except Exception as e:
            # =============================================================================
            # STEP 6: HANDLE ERRORS AND LOG FAILED REQUESTS
            # =============================================================================
            
            await self._handle_request_error(
                e, user_id, config_id, request_data, performance_data,
                model, provider, config_data, session_id, request_id,
                ip_address, user_agent, quota_check_result
            )
            
            # Re-raise the original error
            self.logger.error(f"Chat request failed for user {user_id}: {str(e)}")
            raise
    
    async def estimate_request_cost(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        db_session: Session,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None
    ) -> Optional[float]:
        """
        Estimate the cost of a chat request before sending it.
        
        Args:
            config_id: ID of the LLM configuration
            messages: List of message dictionaries
            db_session: Database session
            model: Optional model override
            max_tokens: Optional max tokens override
            
        Returns:
            Estimated cost in USD, or None if estimation not possible
        """
        try:
            # Get configuration data
            config_data = await self.config_validator.get_and_validate_config(config_id, db_session)
            
            # Create request for cost estimation
            chat_request = self._create_chat_request(messages, model, None, max_tokens)
            
            # Calculate estimated cost
            estimated_cost = self.cost_calculator.estimate_request_cost(chat_request, config_data)
            
            self.logger.debug(f"Estimated cost for config {config_id}: ${estimated_cost}")
            return estimated_cost
            
        except Exception as e:
            self.logger.warning(f"Failed to estimate request cost: {str(e)}")
            return None
    
    async def _log_successful_request(
        self,
        user_id: int,
        config_id: int,
        request_data: Dict,
        response: ChatResponse,
        performance_data: Dict,
        session_id: Optional[str],
        request_id: Optional[str],
        ip_address: Optional[str],
        user_agent: Optional[str],
        quota_check_result,
        bypass_quota: bool,
        db_session: Session,
        config_data: Dict[str, Any]
    ):
        """
        Log successful request with quota recording.
        
        Args:
            user_id: User ID
            config_id: Configuration ID
            request_data: Request data for logging
            response: Chat response
            performance_data: Performance metrics
            session_id: Session identifier
            request_id: Request identifier
            ip_address: Client IP
            user_agent: Client user agent
            quota_check_result: Result from quota checking
            bypass_quota: Whether quota was bypassed
            db_session: Database session
            config_data: Configuration data
        """
        # Calculate actual cost if not already set
        if not response.cost:
            response.cost = self.cost_calculator.calculate_actual_cost(response, config_data)
        
        # Create response data for logging
        response_data = self.usage_logger.create_success_response_data(
            response,
            quota_check_passed=quota_check_result is not None,
            quota_details=quota_check_result.quota_details if quota_check_result else {}
        )
        
        # Log the request with quota recording
        await self.usage_logger.log_llm_request_with_quota(
            user_id, config_id, request_data, response_data, performance_data,
            session_id, request_id, ip_address, user_agent, response, bypass_quota, db_session
        )
        
        self.logger.debug(f"Successfully logged chat request for user {user_id}")
    
    async def _handle_request_error(
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
        quota_check_result
    ):
        """
        Handle request error with comprehensive logging.
        
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
        """
        # Update performance data with completion info
        performance_data.update({
            "request_completed_at": datetime.utcnow().isoformat(),
            "response_time_ms": int(
                (datetime.utcnow() - datetime.fromisoformat(performance_data["request_started_at"]))
                .total_seconds() * 1000
            )
        })
        
        # Create error response data
        response_data = self.usage_logger.create_error_response_data(
            error,
            model or config_data['default_model'],
            provider.provider_name,
            quota_check_passed=False,
            quota_details=quota_check_result.quota_details if quota_check_result else {}
        )
        
        # Log the failed request
        await self.usage_logger.log_llm_request_with_quota(
            user_id, config_id, request_data, response_data, performance_data,
            session_id, request_id, ip_address, user_agent
        )
        
        self.logger.error(f"Logged failed chat request for user {user_id}: {str(error)}")


# Factory function for dependency injection
def get_chat_handler() -> ChatHandler:
    """
    Get chat handler instance.
    
    Returns:
        ChatHandler instance
    """
    return ChatHandler()
