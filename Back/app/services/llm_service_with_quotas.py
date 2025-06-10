# AI Dock LLM Integration Service WITH QUOTA ENFORCEMENT
# This is the updated version that includes quota checking and enforcement

import asyncio
import httpx
import json
import time
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
import logging
from abc import ABC, abstractmethod
from decimal import Decimal

# Database and configuration imports
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from ..core.database import get_async_session, get_db
from ..models.llm_config import LLMConfiguration, LLMProvider
from ..models.user import User
from ..models.department import Department
from ..schemas.llm_config import LLMConfigurationResponse

# Import usage service for logging (existing)
from .usage_service import usage_service

# Import quota service for enforcement (NEW!)
from .quota_service import get_quota_service, QuotaService, QuotaCheckResult, QuotaViolationType

# Import all existing provider classes and exceptions
from .llm_service import (
    LLMServiceError, LLMProviderError, LLMConfigurationError, LLMQuotaExceededError,
    ChatMessage, ChatRequest, ChatResponse,
    BaseLLMProvider, OpenAIProvider, AnthropicProvider
)

# =============================================================================
# NEW QUOTA-RELATED EXCEPTIONS
# =============================================================================

class LLMDepartmentQuotaExceededError(LLMServiceError):
    """Error when department quota is exceeded."""
    
    def __init__(
        self, 
        message: str, 
        department_id: int,
        quota_check_result: Optional[QuotaCheckResult] = None
    ):
        super().__init__(message)
        self.department_id = department_id
        self.quota_check_result = quota_check_result

class LLMUserNotFoundError(LLMServiceError):
    """Error when user is not found or has no department."""
    pass

# =============================================================================
# ENHANCED LLM SERVICE WITH QUOTA ENFORCEMENT
# =============================================================================

class QuotaEnforcedLLMService:
    """
    Enhanced LLM service that enforces department quotas.
    
    This service adds quota checking and enforcement to the existing LLM functionality.
    It ensures that departments cannot exceed their spending/usage limits.
    
    Flow:
    1. User makes chat request
    2. Look up user's department
    3. Check if department has quota remaining
    4. If yes: proceed with LLM request and record usage
    5. If no: block request and return quota error
    """
    
    def __init__(self):
        """Initialize the quota-enforced LLM service."""
        self.logger = logging.getLogger(__name__)
        self._provider_cache: Dict[int, BaseLLMProvider] = {}
    
    # =============================================================================
    # PROVIDER MANAGEMENT (SAME AS ORIGINAL)
    # =============================================================================
    
    def _get_provider_class(self, provider_type: LLMProvider) -> type:
        """Get the provider class for a given provider type."""
        provider_classes = {
            LLMProvider.OPENAI: OpenAIProvider,
            LLMProvider.ANTHROPIC: AnthropicProvider,
        }
        
        provider_class = provider_classes.get(provider_type)
        if not provider_class:
            raise LLMServiceError(f"Unsupported provider: {provider_type}")
        
        return provider_class
    
    def _get_provider(self, config: LLMConfiguration) -> BaseLLMProvider:
        """Get or create a provider instance for the given configuration."""
        # Check cache first
        if config.id in self._provider_cache:
            cached_provider = self._provider_cache[config.id]
            if cached_provider.config.updated_at == config.updated_at:
                return cached_provider
        
        # Create new provider instance
        provider_class = self._get_provider_class(config.provider)
        provider = provider_class(config)
        
        # Cache it
        self._provider_cache[config.id] = provider
        
        return provider
    
    # =============================================================================
    # USER AND DEPARTMENT LOOKUP METHODS
    # =============================================================================
    
    async def _get_user_with_department(self, user_id: int, db_session: Session) -> tuple[User, Department]:
        """
        Get user and their department for quota checking.
        
        Args:
            user_id: ID of the user making the request
            db_session: Database session
            
        Returns:
            Tuple of (user, department)
            
        Raises:
            LLMUserNotFoundError: If user not found or has no department
        """
        # Get user from database
        user = db_session.query(User).filter(User.id == user_id).first()
        if not user:
            raise LLMUserNotFoundError(f"User {user_id} not found")
        
        # Get user's department
        if not user.department_id:
            raise LLMUserNotFoundError(f"User {user_id} has no department assigned")
        
        department = db_session.query(Department).filter(Department.id == user.department_id).first()
        if not department:
            raise LLMUserNotFoundError(f"Department {user.department_id} not found for user {user_id}")
        
        return user, department
    
    # =============================================================================
    # QUOTA CHECKING METHODS
    # =============================================================================
    
    async def _check_quotas_before_request(
        self,
        user_id: int,
        config_id: int,
        request: ChatRequest,
        db_session: Session
    ) -> QuotaCheckResult:
        """
        Check if the user's department can make this LLM request.
        
        Args:
            user_id: User making the request
            config_id: LLM configuration being used
            request: The chat request to check
            db_session: Database session
            
        Returns:
            QuotaCheckResult indicating if request is allowed
            
        Raises:
            LLMDepartmentQuotaExceededError: If quota is exceeded
            LLMUserNotFoundError: If user/department not found
        """
        self.logger.info(f"Checking quotas for user {user_id}, config {config_id}")
        
        # Get user and department
        user, department = await self._get_user_with_department(user_id, db_session)
        
        # Get LLM configuration for cost estimation
        config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
        if not config:
            raise LLMServiceError(f"LLM configuration {config_id} not found")
        
        # Get quota service
        quota_service = get_quota_service(db_session)
        
        # Estimate costs and tokens for quota checking
        provider = self._get_provider(config)
        estimated_cost = provider.estimate_cost(request)
        
        # Estimate tokens (rough calculation)
        total_chars = sum(len(msg.content) for msg in request.messages)
        estimated_tokens = total_chars // 4  # Rough estimate: 1 token ≈ 4 chars
        
        # Add estimated output tokens
        max_tokens = request.max_tokens or config.model_parameters.get("max_tokens", 1000)
        estimated_total_tokens = estimated_tokens + min(max_tokens, estimated_tokens)
        
        # Check quotas
        quota_result = await quota_service.check_department_quotas(
            department_id=department.id,
            llm_config_id=config_id,
            estimated_cost=Decimal(str(estimated_cost)) if estimated_cost else None,
            estimated_tokens=estimated_total_tokens,
            request_count=1
        )
        
        # If quota check failed, raise appropriate error
        if quota_result.is_blocked:
            self.logger.warning(f"Quota blocked request for user {user_id}: {quota_result.message}")
            raise LLMDepartmentQuotaExceededError(
                f"Department '{department.name}' quota exceeded: {quota_result.message}",
                department_id=department.id,
                quota_check_result=quota_result
            )
        
        self.logger.info(f"Quota check passed for user {user_id}")
        return quota_result
    
    async def _record_quota_usage(
        self,
        user_id: int,
        config_id: int,
        response: ChatResponse,
        db_session: Session
    ) -> Dict[str, Any]:
        """
        Record actual usage against department quotas.
        
        Args:
            user_id: User who made the request
            config_id: LLM configuration used
            response: The chat response with actual usage data
            db_session: Database session
            
        Returns:
            Dictionary with quota update results
        """
        self.logger.info(f"Recording quota usage for user {user_id}")
        
        try:
            # Get user and department
            user, department = await self._get_user_with_department(user_id, db_session)
            
            # Get quota service
            quota_service = get_quota_service(db_session)
            
            # Extract actual usage from response
            actual_cost = Decimal(str(response.cost)) if response.cost else None
            total_tokens = response.usage.get("total_tokens")
            
            # Record usage
            usage_result = await quota_service.record_usage(
                department_id=department.id,
                llm_config_id=config_id,
                actual_cost=actual_cost,
                total_tokens=total_tokens,
                request_count=1
            )
            
            if usage_result["success"]:
                self.logger.info(f"Quota usage recorded for user {user_id}: cost=${actual_cost}, tokens={total_tokens}")
            else:
                self.logger.error(f"Failed to record quota usage: {usage_result.get('error')}")
            
            return usage_result
            
        except Exception as e:
            self.logger.error(f"Error recording quota usage: {str(e)}")
            # Don't fail the request if quota recording fails
            return {"success": False, "error": str(e)}
    
    # =============================================================================
    # MAIN CHAT REQUEST METHOD WITH QUOTA ENFORCEMENT
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
        bypass_quota: bool = False,  # NEW: Allow admins to bypass quotas
        **kwargs
    ) -> ChatResponse:
        """
        Send a chat request with quota enforcement.
        
        This method now includes quota checking BEFORE the LLM request
        and quota usage recording AFTER the LLM request.
        
        Args:
            config_id: ID of the LLM configuration to use
            messages: List of message dictionaries (role, content)
            user_id: ID of user making the request
            model: Override model (optional)
            temperature: Override temperature (optional)
            max_tokens: Override max tokens (optional)
            session_id: Session identifier (optional)
            request_id: Unique request identifier (optional)
            ip_address: Client IP address (optional)
            user_agent: Client user agent (optional)
            bypass_quota: If True, skip quota checking (admin only)
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Chat response from the LLM
            
        Raises:
            LLMDepartmentQuotaExceededError: If quota is exceeded
            LLMUserNotFoundError: If user/department not found
            LLMServiceError: If configuration not found or request fails
        """
        self.logger.info(f"Processing chat request for user {user_id}, config {config_id}")
        
        # =============================================================================
        # STEP 1: GET CONFIGURATION AND VALIDATE
        # =============================================================================
        
        # Get database session
        with next(get_db()) as db_session:
            
            # Get configuration
            config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            if not config:
                raise LLMServiceError(f"LLM configuration {config_id} not found")
            
            if not config.is_active:
                raise LLMServiceError(f"LLM configuration '{config.name}' is not active")
            
            # =============================================================================
            # STEP 2: QUOTA CHECKING (NEW!)
            # =============================================================================
            
            quota_check_result = None
            if not bypass_quota:
                try:
                    # Convert messages to ChatMessage objects for quota checking
                    chat_messages = [
                        ChatMessage(role=msg["role"], content=msg["content"], name=msg.get("name"))
                        for msg in messages
                    ]
                    
                    request = ChatRequest(
                        messages=chat_messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        **kwargs
                    )
                    
                    # Check quotas BEFORE making the expensive LLM call
                    quota_check_result = await self._check_quotas_before_request(
                        user_id, config_id, request, db_session
                    )
                    
                except LLMDepartmentQuotaExceededError:
                    # Re-raise quota errors immediately
                    raise
                except Exception as e:
                    # For other errors, log but continue (graceful degradation)
                    self.logger.error(f"Quota check failed (allowing request): {str(e)}")
            else:
                self.logger.info(f"Bypassing quota check for user {user_id} (admin override)")
            
            # =============================================================================
            # STEP 3: PREPARE LLM REQUEST
            # =============================================================================
            
            # Convert message dictionaries to ChatMessage objects
            chat_messages = [
                ChatMessage(role=msg["role"], content=msg["content"], name=msg.get("name"))
                for msg in messages
            ]
            
            # Create chat request
            request = ChatRequest(
                messages=chat_messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            # Get provider
            provider = self._get_provider(config)
            
            # =============================================================================
            # STEP 4: PREPARE USAGE LOGGING DATA
            # =============================================================================
            
            total_chars = sum(len(msg["content"]) for msg in messages)
            request_data = {
                "messages_count": len(messages),
                "total_chars": total_chars,
                "parameters": {
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "model_override": model,
                    "bypass_quota": bypass_quota,
                    **kwargs
                }
            }
            
            # Record request start time
            request_started_at = datetime.utcnow()
            performance_data = {
                "request_started_at": request_started_at.isoformat(),
            }
            
            # =============================================================================
            # STEP 5: SEND REQUEST TO LLM PROVIDER
            # =============================================================================
            
            try:
                self.logger.info(f"Sending chat request via {provider.provider_name} (config: {config.name})")
                
                # Send the actual request
                response = await provider.send_chat_request(request)
                
                # Record completion time
                request_completed_at = datetime.utcnow()
                performance_data.update({
                    "request_completed_at": request_completed_at.isoformat(),
                    "response_time_ms": response.response_time_ms
                })
                
                # =============================================================================
                # STEP 6: RECORD QUOTA USAGE (NEW!)
                # =============================================================================
                
                if not bypass_quota:
                    try:
                        quota_usage_result = await self._record_quota_usage(
                            user_id, config_id, response, db_session
                        )
                        
                        if quota_usage_result["success"]:
                            self.logger.info(f"Quota usage recorded: {quota_usage_result.get('updated_quotas', [])} quotas updated")
                        
                    except Exception as quota_error:
                        # Log error but don't fail the request
                        self.logger.error(f"Failed to record quota usage (non-critical): {str(quota_error)}")
                
                # =============================================================================
                # STEP 7: LOG SUCCESSFUL USAGE
                # =============================================================================
                
                response_data = {
                    "success": True,
                    "content": response.content,
                    "content_length": len(response.content),
                    "model": response.model,
                    "provider": response.provider,
                    "token_usage": response.usage,
                    "cost": response.cost,
                    "error_type": None,
                    "error_message": None,
                    "http_status_code": 200,
                    "raw_metadata": response.raw_response or {},
                    "quota_check_passed": quota_check_result is not None,
                    "quota_details": quota_check_result.quota_details if quota_check_result else {}
                }
                
                try:
                    await usage_service.log_llm_request_async(
                        user_id=user_id,
                        llm_config_id=config_id,
                        request_data=request_data,
                        response_data=response_data,
                        performance_data=performance_data,
                        session_id=session_id,
                        request_id=request_id,
                        ip_address=ip_address,
                        user_agent=user_agent
                    )
                    self.logger.debug(f"Usage logged for user {user_id}: {response.usage.get('total_tokens', 0)} tokens, ${response.cost:.4f if response.cost else 0:.4f}")
                    
                except Exception as logging_error:
                    self.logger.error(f"Failed to log usage (non-critical): {str(logging_error)}")
                
                return response
                
            except Exception as e:
                # =============================================================================
                # STEP 8: HANDLE ERRORS AND LOG FAILED USAGE
                # =============================================================================
                
                request_completed_at = datetime.utcnow()
                performance_data.update({
                    "request_completed_at": request_completed_at.isoformat(),
                    "response_time_ms": int((request_completed_at - request_started_at).total_seconds() * 1000)
                })
                
                # Determine error type and status code
                error_type = type(e).__name__
                http_status_code = None
                
                if isinstance(e, LLMProviderError):
                    http_status_code = e.status_code
                elif isinstance(e, LLMDepartmentQuotaExceededError):
                    http_status_code = 429  # Too Many Requests
                
                response_data = {
                    "success": False,
                    "content": "",
                    "content_length": 0,
                    "model": model or config.default_model,
                    "provider": provider.provider_name,
                    "token_usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
                    "cost": None,
                    "error_type": error_type,
                    "error_message": str(e),
                    "http_status_code": http_status_code,
                    "raw_metadata": {},
                    "quota_check_passed": False,
                    "quota_details": quota_check_result.quota_details if quota_check_result else {}
                }
                
                # Log failed usage
                try:
                    await usage_service.log_llm_request_async(
                        user_id=user_id,
                        llm_config_id=config_id,
                        request_data=request_data,
                        response_data=response_data,
                        performance_data=performance_data,
                        session_id=session_id,
                        request_id=request_id,
                        ip_address=ip_address,
                        user_agent=user_agent
                    )
                    self.logger.debug(f"Failed usage logged for user {user_id}: {error_type}")
                    
                except Exception as logging_error:
                    self.logger.error(f"Failed to log error usage (non-critical): {str(logging_error)}")
                
                # Re-raise the original error
                self.logger.error(f"Chat request failed: {str(e)}")
                raise
    
    # =============================================================================
    # QUOTA STATUS METHODS (NEW!)
    # =============================================================================
    
    async def get_user_quota_status(self, user_id: int) -> Dict[str, Any]:
        """
        Get quota status for a user's department.
        
        Args:
            user_id: User to get quota status for
            
        Returns:
            Dictionary with quota status information
        """
        with next(get_db()) as db_session:
            try:
                # Get user and department
                user, department = await self._get_user_with_department(user_id, db_session)
                
                # Get quota service
                quota_service = get_quota_service(db_session)
                
                # Get comprehensive quota status
                status = await quota_service.get_department_quota_status(department.id)
                
                # Add user-specific information
                status["user_id"] = user_id
                status["user_email"] = user.email
                status["user_name"] = f"{user.first_name} {user.last_name}".strip()
                
                return status
                
            except LLMUserNotFoundError as e:
                return {
                    "user_id": user_id,
                    "error": str(e),
                    "department_id": None,
                    "overall_status": "error"
                }
    
    async def check_user_can_use_config(self, user_id: int, config_id: int) -> Dict[str, Any]:
        """
        Check if a user can use a specific LLM configuration based on quotas.
        
        Args:
            user_id: User to check
            config_id: LLM configuration to check
            
        Returns:
            Dictionary with availability information
        """
        with next(get_db()) as db_session:
            try:
                # Create a minimal test request
                test_messages = [ChatMessage("user", "test")]
                test_request = ChatRequest(messages=test_messages, max_tokens=100)
                
                # Check quotas
                quota_result = await self._check_quotas_before_request(
                    user_id, config_id, test_request, db_session
                )
                
                return {
                    "user_id": user_id,
                    "config_id": config_id,
                    "can_use": quota_result.allowed,
                    "message": quota_result.message,
                    "quota_details": quota_result.quota_details
                }
                
            except LLMDepartmentQuotaExceededError as e:
                return {
                    "user_id": user_id,
                    "config_id": config_id,
                    "can_use": False,
                    "message": str(e),
                    "quota_details": e.quota_check_result.quota_details if e.quota_check_result else {}
                }
            except Exception as e:
                return {
                    "user_id": user_id,
                    "config_id": config_id,
                    "can_use": False,
                    "message": f"Error checking availability: {str(e)}",
                    "quota_details": {}
                }
    
    # =============================================================================
    # EXISTING METHODS (SAME AS ORIGINAL)
    # =============================================================================
    
    async def test_configuration(
        self, 
        config: Optional[LLMConfiguration] = None,
        config_id: Optional[int] = None,
        test_message: str = "Hello! This is a test.",
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """Test a specific LLM configuration."""
        # Get configuration if not provided
        if config is None:
            if config_id is None:
                raise LLMServiceError("Either config or config_id must be provided")
                
            with next(get_db()) as db_session:
                config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
                if not config:
                    raise LLMServiceError(f"LLM configuration {config_id} not found")
        
        # Get provider and test
        provider = self._get_provider(config)
        
        try:
            test_request = ChatRequest(
                messages=[ChatMessage("user", test_message)],
                max_tokens=50
            )
            
            start_time = time.time()
            response = await provider.send_chat_request(test_request)
            response_time = int((time.time() - start_time) * 1000)
            
            return {
                "success": True,
                "message": "Test successful - provider is responding correctly",
                "response_time_ms": response_time,
                "model": response.model,
                "provider": response.provider,
                "cost": response.cost,
                "tested_at": datetime.utcnow(),
                "test_response_preview": response.content[:100] + "..." if len(response.content) > 100 else response.content
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Test failed: {str(e)}",
                "error_type": type(e).__name__,
                "tested_at": datetime.utcnow(),
                "error_details": {"error": str(e)}
            }
    
    async def get_available_models(self, config_id: int) -> List[str]:
        """Get available models for a configuration."""
        with next(get_db()) as db_session:
            config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            if not config:
                raise LLMServiceError(f"LLM configuration {config_id} not found")
            
            return config.get_model_list()
    
    async def estimate_request_cost(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        max_tokens: Optional[int] = None
    ) -> Optional[float]:
        """Estimate the cost of a chat request."""
        with next(get_db()) as db_session:
            config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            if not config:
                raise LLMServiceError(f"LLM configuration {config_id} not found")
        
        # Convert to chat messages
        chat_messages = [
            ChatMessage(role=msg["role"], content=msg["content"])
            for msg in messages
        ]
        
        request = ChatRequest(
            messages=chat_messages,
            model=model,
            max_tokens=max_tokens
        )
        
        provider = self._get_provider(config)
        return provider.estimate_cost(request)

# =============================================================================
# SERVICE INSTANCE WITH QUOTA ENFORCEMENT
# =============================================================================

# Create the new quota-enforced service instance
quota_enforced_llm_service = QuotaEnforcedLLMService()

# For backward compatibility, also expose as llm_service
# This allows existing code to work without changes
llm_service = quota_enforced_llm_service
