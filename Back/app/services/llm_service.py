# AI Dock LLM Integration Service WITH QUOTA ENFORCEMENT
# This service handles communication with external LLM providers AND enforces department quotas

import asyncio
import httpx
import json
import time
from typing import Dict, Any, Optional, List, Union
from datetime import datetime, timedelta
import logging
from abc import ABC, abstractmethod
from decimal import Decimal

# Database and configuration imports
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..core.database import get_async_session, get_db
from ..models.llm_config import LLMConfiguration, LLMProvider
from ..models.user import User
from ..models.department import Department
from ..schemas.llm_config import LLMConfigurationResponse

# Import usage service for logging (existing)
from .usage_service import usage_service

# Import quota service for enforcement (NEW!)
from .quota_service import get_quota_service, QuotaService, QuotaCheckResult, QuotaViolationType

# =============================================================================
# EXCEPTIONS AND ERROR HANDLING
# =============================================================================

class LLMServiceError(Exception):
    """Base exception for LLM service errors."""
    pass

class LLMProviderError(LLMServiceError):
    """Error from external LLM provider (API issues, rate limits, etc.)."""
    
    def __init__(self, message: str, provider: str, status_code: Optional[int] = None, error_details: Optional[Dict] = None):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code
        self.error_details = error_details or {}

class LLMConfigurationError(LLMServiceError):
    """Error with LLM configuration (invalid settings, missing API keys, etc.)."""
    pass

class LLMQuotaExceededError(LLMServiceError):
    """Error when usage quota is exceeded."""
    pass

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
# DATA CLASSES FOR CHAT INTERACTIONS
# =============================================================================

class ChatMessage:
    """
    Represents a single chat message.
    
    This is our internal format - we'll convert to/from provider formats.
    """
    
    def __init__(self, role: str, content: str, name: Optional[str] = None):
        """
        Initialize a chat message.
        
        Args:
            role: 'user', 'assistant', or 'system'
            content: The message content
            name: Optional name for the message sender
        """
        self.role = role
        self.content = content
        self.name = name
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        message = {
            "role": self.role,
            "content": self.content
        }
        if self.name:
            message["name"] = self.name
        return message

class ChatRequest:
    """
    Represents a complete chat request to an LLM.
    """
    
    def __init__(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ):
        """
        Initialize a chat request.
        
        Args:
            messages: List of chat messages
            model: Model to use (overrides configuration default)
            temperature: Response randomness (0.0 to 1.0)
            max_tokens: Maximum tokens in response
            **kwargs: Additional provider-specific parameters
        """
        self.messages = messages
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.extra_params = kwargs
        self.timestamp = datetime.utcnow()

class ChatResponse:
    """
    Represents a response from an LLM provider.
    
    This is our unified response format regardless of provider.
    """
    
    def __init__(
        self,
        content: str,
        model: str,
        provider: str,
        usage: Optional[Dict[str, int]] = None,
        cost: Optional[float] = None,
        response_time_ms: Optional[int] = None,
        raw_response: Optional[Dict] = None
    ):
        """
        Initialize a chat response.
        
        Args:
            content: The LLM's response text
            model: Model that generated the response
            provider: Provider that was used
            usage: Token usage information (input_tokens, output_tokens, total_tokens)
            cost: Estimated cost of the request
            response_time_ms: Time taken for the request
            raw_response: Original provider response (for debugging)
        """
        self.content = content
        self.model = model
        self.provider = provider
        self.usage = usage or {}
        self.cost = cost
        self.response_time_ms = response_time_ms
        self.raw_response = raw_response
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format for API responses."""
        return {
            "content": self.content,
            "model": self.model,
            "provider": self.provider,
            "usage": self.usage,
            "cost": self.cost,
            "response_time_ms": self.response_time_ms,
            "timestamp": self.timestamp.isoformat()
        }

# =============================================================================
# PROVIDER ABSTRACTION
# =============================================================================

class BaseLLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    
    This defines the interface that all providers must implement.
    Each provider (OpenAI, Claude, etc.) will have its own class.
    """
    
    def __init__(self, config: LLMConfiguration):
        """
        Initialize the provider with configuration.
        
        Args:
            config: LLM configuration from database
        """
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Get the human-readable provider name."""
        pass
    
    @abstractmethod
    async def send_chat_request(self, request: ChatRequest) -> ChatResponse:
        """
        Send a chat request to the provider.
        
        Args:
            request: Chat request to send
            
        Returns:
            Chat response from the provider
            
        Raises:
            LLMProviderError: If the provider returns an error
            LLMConfigurationError: If configuration is invalid
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test connection to the provider.
        
        Returns:
            Test result dictionary with success status and details
        """
        pass
    
    @abstractmethod
    def estimate_cost(self, request: ChatRequest) -> Optional[float]:
        """
        Estimate the cost of a request before sending it.
        
        Args:
            request: Chat request to estimate
            
        Returns:
            Estimated cost in USD, or None if cost tracking not available
        """
        pass
    
    # =============================================================================
    # COMMON HELPER METHODS
    # =============================================================================
    
    def _get_http_client(self, timeout: int = 30) -> httpx.AsyncClient:
        """
        Get configured HTTP client for API requests.
        
        Args:
            timeout: Request timeout in seconds
            
        Returns:
            Configured HTTP client
        """
        return httpx.AsyncClient(
            timeout=timeout,
            headers=self.config.get_api_headers(),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
    
    def _calculate_actual_cost(self, usage: Dict[str, int]) -> Optional[float]:
        """
        Calculate actual cost based on token usage.
        
        Args:
            usage: Token usage dictionary
            
        Returns:
            Actual cost in USD, or None if cost tracking not available
        """
        if not self.config.has_cost_tracking:
            return None
            
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        
        return self.config.calculate_request_cost(input_tokens, output_tokens)
    
    def _validate_configuration(self) -> None:
        """
        Validate that the configuration is valid for this provider.
        
        Raises:
            LLMConfigurationError: If configuration is invalid
        """
        if not self.config.is_active:
            raise LLMConfigurationError(f"Configuration '{self.config.name}' is not active")
        
        if not self.config.api_key_encrypted:
            raise LLMConfigurationError(f"No API key configured for '{self.config.name}'")
        
        if not self.config.api_endpoint:
            raise LLMConfigurationError(f"No API endpoint configured for '{self.config.name}'")

# =============================================================================
# OPENAI PROVIDER IMPLEMENTATION
# =============================================================================

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
# CLAUDE/ANTHROPIC PROVIDER IMPLEMENTATION
# =============================================================================

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

# =============================================================================
# MAIN LLM SERVICE CLASS
# =============================================================================

class LLMService:
    """
    Main LLM service that manages all providers and handles chat requests.
    
    This service now includes quota enforcement to ensure departments
    don't exceed their spending/usage limits.
    
    Flow:
    1. User makes chat request
    2. Look up user's department
    3. Check if department has quota remaining
    4. If yes: proceed with LLM request and record usage
    5. If no: block request and return quota error
    """
    
    def __init__(self):
        """Initialize the LLM service."""
        self.logger = logging.getLogger(__name__)
        self._provider_cache: Dict[int, BaseLLMProvider] = {}
    
    def _get_provider_class(self, provider_type: LLMProvider) -> type:
        """
        Get the provider class for a given provider type.
        
        Args:
            provider_type: The LLM provider enum
            
        Returns:
            Provider class to instantiate
        """
        provider_classes = {
            LLMProvider.OPENAI: OpenAIProvider,
            LLMProvider.ANTHROPIC: AnthropicProvider,
            # Future providers:
            # LLMProvider.GOOGLE: GoogleProvider,
            # LLMProvider.MISTRAL: MistralProvider,
        }
        
        provider_class = provider_classes.get(provider_type)
        if not provider_class:
            raise LLMServiceError(f"Unsupported provider: {provider_type}")
        
        return provider_class
    
    def _create_config_from_data(self, config_data: Dict[str, Any]) -> LLMConfiguration:
        """
        Create a temporary LLMConfiguration object from extracted data.
        
        This avoids SQLAlchemy session issues by creating a detached object
        that doesn't need database access.
        
        Args:
            config_data: Dictionary with configuration data
            
        Returns:
            LLMConfiguration object populated with data
        """
        config = LLMConfiguration()
        
        # Set all the attributes from the data
        for key, value in config_data.items():
            setattr(config, key, value)
        
        return config
    
    # =============================================================================
    # USER AND DEPARTMENT LOOKUP METHODS (NEW!)
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
    # QUOTA CHECKING METHODS (NEW!)
    # =============================================================================
    
    async def _check_quotas_before_request(
        self,
        user_id: int,
        config_id: int,
        request: ChatRequest,
        db_session: Session,
        config_data: Dict[str, Any]
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
        
        # LLM configuration already retrieved and validated above
        # Use the extracted config_data to avoid session issues
        
        # Get quota service
        quota_service = get_quota_service(db_session)
        
        # Create a temporary config object for estimation (avoiding detached instance)
        temp_config = self._create_config_from_data(config_data)
        provider = self._get_provider(temp_config)
        estimated_cost = provider.estimate_cost(request)
        
        # Estimate tokens (rough calculation)
        total_chars = sum(len(msg.content) for msg in request.messages)
        estimated_tokens = total_chars // 4  # Rough estimate: 1 token ≈ 4 chars
        
        # Add estimated output tokens
        model_params = config_data.get('model_parameters') or {}
        max_tokens = request.max_tokens or model_params.get("max_tokens", 1000)
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
    
    def _record_quota_usage_improved(
        self,
        user_id: int,
        config_id: int,
        response: ChatResponse,
        db_session: Session
    ) -> Dict[str, Any]:
        """
        IMPROVED: Record actual usage against department quotas (RELIABLE).
        
        This version fixes quota recording by using direct database operations
        without async complications.
        """
        self.logger.info(f"🎯 Recording quota usage for user {user_id} (IMPROVED)")
        
        try:
            # Get user and department with explicit error handling
            user = db_session.query(User).filter(User.id == user_id).first()
            if not user:
                self.logger.error(f"User {user_id} not found for quota recording")
                return {"success": False, "error": "User not found"}
            
            if not user.department_id:
                self.logger.error(f"User {user_id} has no department")
                return {"success": False, "error": "User has no department"}
            
            department = db_session.query(Department).filter(Department.id == user.department_id).first()
            if not department:
                self.logger.error(f"Department {user.department_id} not found")
                return {"success": False, "error": "Department not found"}
            
            # Get applicable quotas directly
            from ..models.quota import DepartmentQuota, QuotaStatus, QuotaType
            
            applicable_quotas = db_session.query(DepartmentQuota).filter(
                DepartmentQuota.department_id == department.id,
                or_(
                    DepartmentQuota.llm_config_id == config_id,
                    DepartmentQuota.llm_config_id.is_(None)
                ),
                DepartmentQuota.status == QuotaStatus.ACTIVE
            ).all()
            
            if not applicable_quotas:
                self.logger.info(f"No applicable quotas for department {department.name}")
                return {"success": True, "updated_quotas": []}
            
            # Extract usage data
            actual_cost = Decimal(str(response.cost)) if response.cost else None
            total_tokens = response.usage.get("total_tokens")
            
            updated_quotas = []
            
            # Update each applicable quota
            for quota in applicable_quotas:
                usage_amount = Decimal('0')
                
                if quota.quota_type == QuotaType.COST and actual_cost is not None:
                    usage_amount = actual_cost
                elif quota.quota_type == QuotaType.TOKENS and total_tokens is not None:
                    usage_amount = Decimal(str(total_tokens))
                elif quota.quota_type == QuotaType.REQUESTS:
                    usage_amount = Decimal('1')
                
                if usage_amount > 0:
                    old_usage = quota.current_usage
                    quota.current_usage += usage_amount
                    
                    # Update status if exceeded
                    if quota.current_usage >= quota.limit_value:
                        quota.status = QuotaStatus.EXCEEDED
                    
                    updated_quotas.append({
                        "quota_id": quota.id,
                        "quota_name": quota.name,
                        "usage_before": float(old_usage),
                        "usage_after": float(quota.current_usage),
                        "usage_added": float(usage_amount)
                    })
                    
                    self.logger.info(f"✅ Updated quota {quota.name}: {old_usage} → {quota.current_usage}")
            
            # Commit changes
            db_session.commit()
            
            self.logger.info(f"🎉 Successfully updated {len(updated_quotas)} quota(s)")
            
            return {
                "success": True,
                "updated_quotas": updated_quotas,
                "department_id": department.id
            }
            
        except Exception as e:
            db_session.rollback()
            self.logger.error(f"❌ Quota recording error: {str(e)}")
            return {"success": False, "error": str(e)}


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
    
    def _get_provider(self, config: LLMConfiguration) -> BaseLLMProvider:
        """
        Get or create a provider instance for the given configuration.
        
        Args:
            config: LLM configuration
            
        Returns:
            Provider instance
        """
        # Check cache first (avoid recreating providers)
        if config.id in self._provider_cache:
            cached_provider = self._provider_cache[config.id]
            # Verify the cached provider is still using current config
            if cached_provider.config.updated_at == config.updated_at:
                return cached_provider
        
        # Create new provider instance
        provider_class = self._get_provider_class(config.provider)
        provider = provider_class(config)
        
        # Cache it for future use
        self._provider_cache[config.id] = provider
        
        return provider
    
    async def send_chat_request(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        user_id: int,  # Added for usage logging
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        session_id: Optional[str] = None,  # Added for session tracking
        request_id: Optional[str] = None,  # Added for request tracing
        ip_address: Optional[str] = None,  # Added for client tracking
        user_agent: Optional[str] = None,  # Added for client info
        assistant_id: Optional[int] = None,  # 🤖 NEW: Assistant ID for logging
        bypass_quota: bool = False,  # NEW: Allow admins to bypass quotas
        **kwargs
    ) -> ChatResponse:
        """
        Send a chat request with quota enforcement and assistant support.
        
        🤖 STEP 6: LLM Service Integration (UPDATED FOR ASSISTANTS)
        ==========================================================
        This method now includes:
        - Quota checking BEFORE the LLM request
        - Quota usage recording AFTER the LLM request
        - Assistant context logging for analytics
        - Enhanced usage tracking with assistant information
        
        Args:
            config_id: ID of the LLM configuration to use
            messages: List of message dictionaries (role, content) - may include assistant system prompts
            user_id: ID of user making the request (for usage tracking)
            model: Override model (optional, may come from assistant preferences)
            temperature: Override temperature (optional, may come from assistant preferences)
            max_tokens: Override max tokens (optional, may come from assistant preferences)
            session_id: Session identifier for grouping requests (optional)
            request_id: Unique request identifier for tracing (optional)
            ip_address: Client IP address (optional)
            user_agent: Client user agent string (optional)
            assistant_id: ID of custom assistant being used (optional, for logging)
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
        # STEP 1: GET CONFIGURATION AND VALIDATE (WITHIN SESSION CONTEXT)
        # =============================================================================
        
        # Get database session
        with next(get_db()) as db_session:
            
            # Get configuration and ensure it's loaded within the session
            config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            if not config:
                raise LLMServiceError(f"LLM configuration {config_id} not found")
            
            if not config.is_active:
                raise LLMServiceError(f"LLM configuration '{config.name}' is not active")
            
            # Extract config data while in session to avoid detached instance issues
            config_data = {
                'id': config.id,
                'name': config.name,
                'provider': config.provider,
                'api_endpoint': config.api_endpoint,
                'api_key_encrypted': config.api_key_encrypted,
                'default_model': config.default_model,
                'model_parameters': config.model_parameters,
                'cost_per_1k_input_tokens': config.cost_per_1k_input_tokens,
                'cost_per_1k_output_tokens': config.cost_per_1k_output_tokens,
                'cost_per_request': config.cost_per_request,
                'custom_headers': config.custom_headers,
                'is_active': config.is_active,
                'updated_at': config.updated_at
            }
            
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
                        user_id, config_id, request, db_session, config_data
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
            # STEP 3: PREPARE AND SEND LLM REQUEST
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
            
            # Get provider using config_data to avoid session issues
            final_config = self._create_config_from_data(config_data)
            provider = self._get_provider(final_config)
            
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
                self.logger.info(f"Sending chat request via {provider.provider_name} (config: {config_data['name']})")
                
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
                        quota_usage_result = self._record_quota_usage_improved(
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
                    self.logger.info(f"🔍 DEBUG: About to call usage_service.log_llm_request_isolated for user {user_id}, request_id {request_id}")
                    # 🔧 FIX: Use ISOLATED logging with separate database session
                    # This ensures usage logging is NOT affected by main transaction rollbacks
                    await usage_service.log_llm_request_isolated(
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
                    # Fixed f-string formatting
                    cost_display = f"${response.cost:.4f}" if response.cost else "$0.0000"
                    self.logger.info(f"✅ DEBUG: Usage logging isolated call completed for user {user_id}: {response.usage.get('total_tokens', 0)} tokens, {cost_display}")
                    
                except Exception as logging_error:
                    self.logger.error(f"❌ DEBUG: Failed to log usage (non-critical): {str(logging_error)}")
                    import traceback
                    self.logger.error(f"❌ DEBUG: Usage logging traceback: {traceback.format_exc()}")
                
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
                    "model": model or config_data['default_model'],
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
                
                # Log failed usage with isolated session
                try:
                    # 🔧 FIX: Use isolated logging for error cases too
                    await usage_service.log_llm_request_isolated(
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
                    self.logger.info(f"✅ DEBUG: Failed usage logging isolated call completed for user {user_id}: {error_type}")
                    
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
    
    async def test_configuration(
        self, 
        config: Optional[LLMConfiguration] = None,
        config_id: Optional[int] = None,
        test_message: str = "Hello! This is a test.",
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """
        Test a specific LLM configuration.
        
        Args:
            config: LLM configuration object (if provided directly)
            config_id: ID of the configuration to test (if config not provided)
            test_message: Message to send for testing
            timeout_seconds: Timeout for the test
            
        Returns:
            Test result dictionary
        """
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
        """
        Get available models for a configuration (legacy method).
        
        Args:
            config_id: ID of the configuration
            
        Returns:
            List of available model names from configuration
        """
        with next(get_db()) as db_session:
            config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            if not config:
                raise LLMServiceError(f"LLM configuration {config_id} not found")
            
            return config.get_model_list()
    
    async def get_dynamic_models(self, config_id: int, use_cache: bool = True, show_all_models: bool = False) -> Dict[str, Any]:
        """
        🆕 NEW: Get available models directly from the LLM provider's API with smart filtering.
        
        This fetches real-time model information from providers like OpenAI and applies
        intelligent filtering to show only relevant, recent, and useful models.
        
        Args:
            config_id: ID of the LLM configuration
            use_cache: Whether to use cached results (default: True)
            show_all_models: If True, bypasses filtering for debugging (admin-only, default: False)
            
        Returns:
            Dictionary with filtered models, metadata, and caching info
            
        Example Response (Regular User):
            {
                "models": ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
                "default_model": "gpt-4o",
                "provider": "OpenAI",
                "cached": False,
                "fetched_at": "2024-01-01T12:00:00Z",
                "filter_metadata": {
                    "total_raw_models": 58,
                    "total_filtered_models": 8,
                    "filter_level": "recommended",
                    "filtering_applied": true
                }
            }
            
        Example Response (Admin with show_all_models=True):
            {
                "models": ["gpt-4o", "gpt-4-turbo", ..., "gpt-3.5-turbo-0613", ...],
                "filter_metadata": {
                    "filtering_applied": false,
                    "filter_level": "show_all"
                }
            }
        """
        with next(get_db()) as db_session:
            # Get and validate configuration
            config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            if not config:
                raise LLMServiceError(f"LLM configuration {config_id} not found")
            
            if not config.is_active:
                raise LLMServiceError(f"Configuration '{config.name}' is not active")
            
            # Create provider instance
            provider = self._get_provider(config)
            
            # Check cache first (if enabled)
            cache_key = f"models_{config_id}"
            cached_result = None
            
            if use_cache:
                cached_result = await self._get_cached_models(cache_key)
                if cached_result:
                    self.logger.info(f"Returning cached models for config {config_id}")
                    return cached_result
            
            # Fetch fresh models from provider
            try:
                self.logger.info(f"Fetching dynamic models from {provider.provider_name} for config {config_id}")
                
                if config.provider == LLMProvider.OPENAI:
                    models_data = await self._fetch_openai_models(provider, show_all_models)
                elif config.provider == LLMProvider.ANTHROPIC:
                    models_data = await self._fetch_anthropic_models(provider)
                else:
                    # Fallback to configuration-defined models for other providers
                    models_data = {
                        "models": config.get_model_list(),
                        "default_model": config.default_model,
                        "provider": provider.provider_name,
                        "note": "Using configuration-defined models (dynamic fetching not implemented for this provider)",
                        "filter_metadata": {
                            "filtering_applied": False,
                            "filter_level": "configuration_defined",
                            "total_raw_models": len(config.get_model_list()),
                            "total_filtered_models": len(config.get_model_list())
                        }
                    }
                
                # Add metadata
                models_data.update({
                    "cached": False,
                    "fetched_at": datetime.utcnow().isoformat(),
                    "cache_expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                    "config_id": config_id,
                    "config_name": config.name
                })
                
                # Cache the result
                if use_cache:
                    await self._cache_models(cache_key, models_data)
                
                return models_data
                
            except Exception as e:
                self.logger.error(f"Failed to fetch dynamic models: {str(e)}")
                
                # Graceful fallback to configuration models
                fallback_data = {
                    "models": config.get_model_list(),
                    "default_model": config.default_model,
                    "provider": provider.provider_name,
                    "cached": False,
                    "fetched_at": datetime.utcnow().isoformat(),
                    "error": f"Failed to fetch from provider: {str(e)}",
                    "fallback": True,
                    "config_id": config_id,
                    "config_name": config.name
                }
                
                return fallback_data
    
    async def _fetch_openai_models(self, provider: BaseLLMProvider, show_all_models: bool = False) -> Dict[str, Any]:
        """
        Fetch available models from OpenAI API with intelligent filtering.
        
        Makes a request to OpenAI's /models endpoint and applies smart filtering
        to show only relevant, recent, and useful models for chat completion.
        
        Args:
            provider: OpenAI provider instance
            
        Returns:
            Dictionary with filtered OpenAI models and metadata
        """
        async with provider._get_http_client() as client:
            self.logger.info("Fetching models from OpenAI API with intelligent filtering...")
            
            response = await client.get(
                f"{provider.config.api_endpoint}/models"
            )
            
            if response.status_code != 200:
                raise LLMProviderError(
                    f"OpenAI models API returned {response.status_code}",
                    provider=provider.provider_name,
                    status_code=response.status_code
                )
            
            data = response.json()
            
            # Extract all models
            all_models = [model["id"] for model in data.get("data", [])]
            
            # 🆕 INTELLIGENT FILTERING: Import and use the new filtering system
            from .model_filter import OpenAIModelFilter, ModelFilterLevel
            
            filter_engine = OpenAIModelFilter()
            
            # 🛡️ ADMIN CONTROL: Choose filtering level based on show_all_models flag
            if show_all_models:
                filter_level = ModelFilterLevel.SHOW_ALL  # No filtering for admin debugging
                self.logger.info("Admin requested all models - bypassing filtering")
            else:
                filter_level = ModelFilterLevel.RECOMMENDED  # Smart filtering for regular users
                self.logger.info("Applying recommended model filtering for user")
            
            # Apply intelligent filtering based on admin preference
            filtered_models, filter_metadata = filter_engine.filter_models(
                all_models, 
                filter_level
            )
            
            # Use first filtered model as default, or fall back to config default
            default_model = (
                filtered_models[0] if filtered_models 
                else provider.config.default_model
            )
            
            # Log filtering results for debugging
            self.logger.info(
                f"Model filtering applied: {filter_metadata['total_raw_models']} → "
                f"{filter_metadata['total_filtered_models']} models "
                f"(filtered out {filter_metadata['filtered_out_count']} irrelevant/deprecated models)"
            )
            
            return {
                "models": filtered_models,
                "default_model": default_model,
                "provider": "OpenAI",
                "total_models_available": len(all_models),
                "filtered_models_count": len(filtered_models),
                "filter_metadata": filter_metadata,
                "filtering_applied": True
            }
    
    async def _fetch_anthropic_models(self, provider: BaseLLMProvider) -> Dict[str, Any]:
        """
        Fetch available models from Anthropic API.
        
        Note: Anthropic doesn't have a public models endpoint like OpenAI,
        so we return known Claude models with real-time availability checking.
        
        Args:
            provider: Anthropic provider instance
            
        Returns:
            Dictionary with Claude models and metadata
        """
        # Known Claude models (Anthropic doesn't have a public models endpoint)
        known_claude_models = [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229", 
            "claude-3-haiku-20240307",
            "claude-3-5-sonnet-20240620"
        ]
        
        # Test connectivity to ensure API key is valid
        test_result = await provider.test_connection()
        if not test_result["success"]:
            raise LLMProviderError(
                f"Cannot connect to Anthropic API: {test_result['message']}",
                provider=provider.provider_name
            )
        
        return {
            "models": known_claude_models,
            "default_model": provider.config.default_model or "claude-3-sonnet-20240229",
            "provider": "Anthropic (Claude)",
            "note": "Claude models verified through API connectivity test"
        }
    
    # =============================================================================
    # CACHING METHODS (Simple in-memory cache for now)
    # =============================================================================
    
    _models_cache: Dict[str, Dict[str, Any]] = {}  # Simple in-memory cache
    
    async def _get_cached_models(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        Get cached model data if available and not expired.
        
        Args:
            cache_key: Cache key to look up
            
        Returns:
            Cached data if available and fresh, None otherwise
        """
        if cache_key not in self._models_cache:
            return None
        
        cached_data = self._models_cache[cache_key]
        
        # Check if cache is expired (1 hour TTL)
        cache_time = datetime.fromisoformat(cached_data.get("fetched_at", ""))
        if datetime.utcnow() - cache_time > timedelta(hours=1):
            # Cache expired, remove it
            del self._models_cache[cache_key]
            return None
        
        # Return cached data with updated cache flag
        cached_data["cached"] = True
        return cached_data
    
    async def _cache_models(self, cache_key: str, models_data: Dict[str, Any]) -> None:
        """
        Cache model data for future use.
        
        Args:
            cache_key: Cache key to store under
            models_data: Model data to cache
        """
        # Store a copy to avoid modifying the original
        self._models_cache[cache_key] = models_data.copy()
        
        self.logger.debug(f"Cached models for key: {cache_key}")
    
    async def clear_models_cache(self) -> int:
        """
        Clear all cached model data.
        
        Returns:
            Number of cache entries cleared
        """
        count = len(self._models_cache)
        self._models_cache.clear()
        self.logger.info(f"Cleared {count} model cache entries")
        return count
    
    async def estimate_request_cost(
        self,
        config_id: int,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        max_tokens: Optional[int] = None
    ) -> Optional[float]:
        """
        Estimate the cost of a chat request.
        
        Args:
            config_id: ID of the LLM configuration
            messages: Messages to estimate cost for
            model: Model to use (optional)
            max_tokens: Max tokens for response (optional)
            
        Returns:
            Estimated cost in USD, or None if cost tracking not available
        """
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
    # 🚀 NEW: STREAMING CHAT REQUEST METHOD
    # =============================================================================
    
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
    ):
        """
        🚀 Stream a chat request with quota enforcement and usage tracking.
        
        This method provides the same business logic as send_chat_request() but
        yields streaming chunks instead of returning a single response.
        
        🎓 Learning Goals:
        - Understand async generators for streaming responses
        - See how to maintain quota checking in streaming context
        - Learn streaming error handling patterns
        - Practice real-time usage tracking
        
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
            bypass_quota: If True, skip quota checking (admin only)
            **kwargs: Additional provider-specific parameters
            
        Yields:
            Dict[str, Any]: Streaming chunks with content, metadata, and final stats
            
        Raises:
            LLMDepartmentQuotaExceededError: If quota is exceeded
            LLMUserNotFoundError: If user/department not found
            LLMServiceError: If configuration not found or request fails
        """
        
        self.logger.info(f"Processing STREAMING chat request for user {user_id}, config {config_id}")
        
        # =============================================================================
        # STEP 1: CONFIGURATION VALIDATION (Same as regular chat)
        # =============================================================================
        
        # 🔧 FIX: Use isolated database session for configuration validation
        # This prevents the main session from being rolled back
        with next(get_db()) as db_session:
            
            # Get and validate configuration
            config = db_session.query(LLMConfiguration).filter(LLMConfiguration.id == config_id).first()
            if not config:
                raise LLMServiceError(f"LLM configuration {config_id} not found")
            
            if not config.is_active:
                raise LLMServiceError(f"LLM configuration '{config.name}' is not active")
            
            # Extract config data to avoid session issues
            config_data = {
                'id': config.id,
                'name': config.name,
                'provider': config.provider,
                'api_endpoint': config.api_endpoint,
                'api_key_encrypted': config.api_key_encrypted,
                'default_model': config.default_model,
                'model_parameters': config.model_parameters,
                'cost_per_1k_input_tokens': config.cost_per_1k_input_tokens,
                'cost_per_1k_output_tokens': config.cost_per_1k_output_tokens,
                'cost_per_request': config.cost_per_request,
                'custom_headers': config.custom_headers,
                'is_active': config.is_active,
                'updated_at': config.updated_at
            }
            
            # =============================================================================
            # STEP 2: QUOTA CHECKING (Same as regular chat)
            # =============================================================================
            
            quota_check_result = None
            if not bypass_quota:
                try:
                    # Convert messages for quota checking
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
                    
                    # Check quotas BEFORE streaming
                    quota_check_result = await self._check_quotas_before_request(
                        user_id, config_id, request, db_session, config_data
                    )
                    
                except LLMDepartmentQuotaExceededError:
                    # Re-raise quota errors immediately
                    raise
                except Exception as e:
                    # For other errors, log but continue (graceful degradation)
                    self.logger.error(f"Quota check failed for streaming (allowing request): {str(e)}")
            else:
                self.logger.info(f"Bypassing quota check for streaming user {user_id} (admin override)")
            
            # =============================================================================
            # STEP 3: PREPARE STREAMING REQUEST
            # =============================================================================
            
            # Convert messages to ChatMessage objects
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
            
            # Get provider instance
            final_config = self._create_config_from_data(config_data)
            provider = self._get_provider(final_config)
            
            # =============================================================================
            # STEP 4: PREPARE USAGE LOGGING DATA (Same as regular chat)
            # =============================================================================
            
            total_chars = sum(len(msg["content"]) for msg in messages)
            request_data = {
                "messages_count": len(messages),
                "total_chars": total_chars,
                "streaming": True,  # 🆕 Mark as streaming request
                "parameters": {
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "model_override": model,
                    "bypass_quota": bypass_quota,
                    **kwargs
                }
            }
            
            request_started_at = datetime.utcnow()
            performance_data = {
                "request_started_at": request_started_at.isoformat(),
                "streaming": True
            }
            
            # =============================================================================
            # STEP 5: START STREAMING (Provider-specific logic)
            # =============================================================================
            
            accumulated_content = ""
            accumulated_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
            chunk_count = 0
            
            try:
                self.logger.info(f"Starting streaming chat via {provider.provider_name} (config: {config_data['name']})")
                
                # 🎯 Stream from provider (different logic per provider)
                async for chunk_data in self._stream_from_provider(provider, request):
                    
                    # 📦 Process and yield each chunk
                    chunk_count += 1
                    chunk_content = chunk_data.get("content", "")
                    accumulated_content += chunk_content
                    
                    # Update usage if available in chunk
                    if "usage" in chunk_data:
                        accumulated_usage.update(chunk_data["usage"])
                    
                    # 🏁 If final chunk, prepare usage logging and yield
                    if chunk_data.get("is_final"):
                        self.logger.info(f"🔍 DEBUG: Received final chunk for user {user_id}, preparing usage logging")
                        
                        # Calculate final response data for usage logging
                        request_completed_at = datetime.utcnow()
                        total_response_time_ms = int((request_completed_at - request_started_at).total_seconds() * 1000)
                        
                        performance_data.update({
                            "request_completed_at": request_completed_at.isoformat(),
                            "response_time_ms": total_response_time_ms,
                            "chunks_sent": chunk_count
                        })
                        
                        # Create final response object for usage recording
                        final_response = ChatResponse(
                            content=accumulated_content,
                            model=model or config_data['default_model'],
                            provider=provider.provider_name,
                            usage=accumulated_usage,
                            cost=self._calculate_streaming_cost(accumulated_usage, final_config),
                            response_time_ms=total_response_time_ms
                        )
                        
                        # Prepare response data for usage logging
                        response_data = {
                            "success": True,
                            "content": accumulated_content,
                            "content_length": len(accumulated_content),
                            "model": final_response.model,
                            "provider": final_response.provider,
                            "token_usage": final_response.usage,
                            "cost": final_response.cost,
                            "error_type": None,
                            "error_message": None,
                            "http_status_code": 200,
                            "streaming": True,
                            "chunks_sent": chunk_count,
                            "raw_metadata": {},
                            "quota_check_passed": quota_check_result is not None,
                            "quota_details": quota_check_result.quota_details if quota_check_result else {}
                        }
                        
                        # 🔧 FIX: Start background usage logging task BEFORE yielding final chunk
                        # This ensures usage logging happens even if client disconnects immediately
                        self.logger.info(f"🔧 Starting background usage logging for streaming user {user_id}, request_id {request_id}")
                        
                        # Create background task for usage logging
                        asyncio.create_task(
                            self._log_streaming_usage_background(
                                user_id=user_id,
                                config_id=config_id,
                                request_data=request_data,
                                response_data=response_data,
                                performance_data=performance_data,
                                session_id=session_id,
                                request_id=request_id,
                                ip_address=ip_address,
                                user_agent=user_agent,
                                final_response=final_response,
                                bypass_quota=bypass_quota,
                                db_session=db_session
                            )
                        )
                        
                        # 📡 Yield final formatted chunk
                        yield {
                            "content": chunk_content,
                            "is_final": True,
                            "model": chunk_data.get("model"),
                            "provider": provider.provider_name,
                            "chunk_index": chunk_count - 1,
                            "timestamp": datetime.utcnow().isoformat(),
                            "usage": chunk_data.get("usage"),
                            "cost": chunk_data.get("cost"),
                            "response_time_ms": chunk_data.get("response_time_ms")
                        }
                        
                        break
                    else:
                        # 📡 Yield regular formatted chunk
                        yield {
                            "content": chunk_content,
                            "is_final": False,
                            "model": chunk_data.get("model"),
                            "provider": provider.provider_name,
                            "chunk_index": chunk_count - 1,
                            "timestamp": datetime.utcnow().isoformat(),
                            "usage": None,
                            "cost": None,
                            "response_time_ms": None
                        }
                
                # =============================================================================
                # STEP 6: STREAMING COMPLETED (Usage logging now handled in background task)
                # =============================================================================
                
                self.logger.info(f"Streaming completed successfully for user {user_id}: {chunk_count} chunks sent")
                
            except Exception as e:
                # =============================================================================
                # STEP 7: HANDLE STREAMING ERRORS
                # =============================================================================
                
                # 🔍 DEBUG: Add logging to see if we reach error handling
                self.logger.error(f"🔍 DEBUG: Streaming error occurred for user {user_id}: {str(e)}")
                import traceback
                self.logger.error(f"🔍 DEBUG: Streaming error traceback: {traceback.format_exc()}")
                
                request_completed_at = datetime.utcnow()
                error_response_time_ms = int((request_completed_at - request_started_at).total_seconds() * 1000)
                
                performance_data.update({
                    "request_completed_at": request_completed_at.isoformat(),
                    "response_time_ms": error_response_time_ms,
                    "chunks_sent": chunk_count,
                    "error_during_streaming": True
                })
                
                # Determine error type and status code
                error_type = type(e).__name__
                http_status_code = None
                
                if isinstance(e, LLMProviderError):
                    http_status_code = e.status_code
                elif isinstance(e, LLMDepartmentQuotaExceededError):
                    http_status_code = 429
                
                response_data = {
                    "success": False,
                    "content": accumulated_content,  # Include partial content
                    "content_length": len(accumulated_content),
                    "model": model or config_data['default_model'],
                    "provider": provider.provider_name,
                    "token_usage": accumulated_usage,
                    "cost": None,
                    "error_type": error_type,
                    "error_message": str(e),
                    "http_status_code": http_status_code,
                    "streaming": True,
                    "chunks_sent": chunk_count,
                    "partial_response": len(accumulated_content) > 0,
                    "raw_metadata": {},
                    "quota_check_passed": False,
                    "quota_details": quota_check_result.quota_details if quota_check_result else {}
                }
                
                # 🔧 FIX: Start background error logging task
                asyncio.create_task(
                    self._log_streaming_usage_background(
                        user_id=user_id,
                        config_id=config_id,
                        request_data=request_data,
                        response_data=response_data,
                        performance_data=performance_data,
                        session_id=session_id,
                        request_id=request_id,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        final_response=None,  # No final response for errors
                        bypass_quota=bypass_quota,
                        db_session=db_session
                    )
                )
                
                # Re-raise the original error
                self.logger.error(f"Streaming chat request failed: {str(e)}")
                raise
    
    async def _stream_from_provider(
        self, 
        provider: BaseLLMProvider, 
        request: ChatRequest
    ):
        """
        🎯 Stream responses from the specific LLM provider.
        
        This method handles provider-specific streaming logic. Different providers
        have different streaming APIs and response formats.
        
        🎓 Learning: Each AI provider has different streaming implementations:
        - OpenAI: Server-Sent Events with "data: [DONE]" termination
        - Anthropic: Different streaming format
        - Others: May not support streaming at all
        
        Args:
            provider: The LLM provider to stream from
            request: The chat request to stream
            
        Yields:
            Dict[str, Any]: Streaming chunks with content and metadata
        """
        
        if isinstance(provider, OpenAIProvider):
            # 🔥 OpenAI supports native streaming
            async for chunk in self._stream_openai_request(provider, request):
                yield chunk
                
        elif isinstance(provider, AnthropicProvider):
            # 🚧 Anthropic streaming - implement if they add streaming support
            # For now, simulate streaming by chunking a regular response
            async for chunk in self._simulate_streaming_response(provider, request):
                yield chunk
                
        else:
            # 🚧 Other providers - simulate streaming
            async for chunk in self._simulate_streaming_response(provider, request):
                yield chunk
    
    async def _stream_openai_request(
        self, 
        provider: OpenAIProvider, 
        request: ChatRequest
    ):
        """
        🔥 Stream responses from OpenAI using their native streaming API.
        
        OpenAI supports real streaming via Server-Sent Events. We set stream=True
        in the request and process the SSE chunks.
        
        🎓 Learning: OpenAI streaming format:
        data: {"choices": [{"delta": {"content": "Hello"}}]}
        data: {"choices": [{"delta": {"content": " world"}}]}
        data: [DONE]
        
        Args:
            provider: OpenAI provider instance
            request: Chat request to stream
            
        Yields:
            Dict[str, Any]: Streaming chunks with OpenAI content
        """
        
        provider._validate_configuration()
        
        # Build OpenAI streaming request
        payload = {
            "model": request.model or provider.config.default_model,
            "messages": [msg.to_dict() for msg in request.messages],
            "stream": True  # 🔥 Enable streaming
        }
        
        # Add optional parameters
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        elif provider.config.model_parameters and "temperature" in provider.config.model_parameters:
            payload["temperature"] = provider.config.model_parameters["temperature"]
        
        if request.max_tokens is not None:
            payload["max_tokens"] = request.max_tokens
        elif provider.config.model_parameters and "max_tokens" in provider.config.model_parameters:
            payload["max_tokens"] = provider.config.model_parameters["max_tokens"]
        
        payload.update(request.extra_params)
        
        start_time = time.time()
        
        async with provider._get_http_client() as client:
            try:
                provider.logger.info(f"Starting OpenAI streaming request: model={payload['model']}")
                
                # 📡 Make streaming request
                async with client.stream(
                    "POST",
                    f"{provider.config.api_endpoint}/chat/completions",
                    json=payload
                ) as response:
                    
                    if response.status_code != 200:
                        await provider._handle_error_response(response)
                    
                    # 📥 Process streaming response
                    accumulated_content = ""
                    model_name = payload["model"]
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix
                            
                            if data_str.strip() == "[DONE]":
                                # 🏁 Streaming finished
                                response_time_ms = int((time.time() - start_time) * 1000)
                                
                                # Calculate final usage and cost
                                final_usage = self._estimate_usage_from_content(accumulated_content, payload)
                                final_cost = provider._calculate_actual_cost(final_usage)
                                
                                yield {
                                    "content": "",
                                    "is_final": True,
                                    "model": model_name,
                                    "provider": provider.provider_name,
                                    "usage": final_usage,
                                    "cost": final_cost,
                                    "response_time_ms": response_time_ms,
                                    "timestamp": datetime.utcnow().isoformat()
                                }
                                break
                            
                            try:
                                # 📦 Parse JSON chunk
                                chunk_data = json.loads(data_str)
                                
                                # Extract content from OpenAI chunk format
                                choices = chunk_data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    
                                    if content:
                                        accumulated_content += content
                                        
                                        # 📤 Yield content chunk
                                        yield {
                                            "content": content,
                                            "is_final": False,
                                            "model": model_name,
                                            "provider": provider.provider_name,
                                            "timestamp": datetime.utcnow().isoformat()
                                        }
                                
                            except json.JSONDecodeError:
                                # Skip malformed chunks
                                continue
                            
            except httpx.TimeoutException:
                raise LLMProviderError(
                    "Streaming request timed out",
                    provider=provider.provider_name,
                    error_details={"timeout": True, "streaming": True}
                )
            except httpx.RequestError as e:
                raise LLMProviderError(
                    f"Network error during streaming: {str(e)}",
                    provider=provider.provider_name,
                    error_details={"network_error": str(e), "streaming": True}
                )
    
    async def _simulate_streaming_response(
        self, 
        provider: BaseLLMProvider, 
        request: ChatRequest
    ):
        """
        🚧 Simulate streaming for providers that don't support native streaming.
        
        This method gets the full response from the provider and then chunks it
        into smaller pieces to simulate streaming. This provides a consistent
        streaming experience even with non-streaming providers.
        
        🎓 Learning: Not all AI providers support streaming, so we can simulate it
        by breaking a complete response into word-by-word or sentence-by-sentence chunks.
        
        Args:
            provider: Provider instance
            request: Chat request
            
        Yields:
            Dict[str, Any]: Simulated streaming chunks
        """
        
        provider.logger.info(f"Simulating streaming for {provider.provider_name} (no native streaming support)")
        
        try:
            # Get the full response first
            full_response = await provider.send_chat_request(request)
            
            # Split content into words for simulated streaming
            words = full_response.content.split()
            
            # Yield each word as a chunk
            for i, word in enumerate(words):
                # Add space after word (except for the last word)
                content = word + (" " if i < len(words) - 1 else "")
                
                yield {
                    "content": content,
                    "is_final": False,
                    "model": full_response.model,
                    "provider": full_response.provider,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Small delay to simulate typing
                await asyncio.sleep(0.05)  # 50ms delay between words
            
            # Send final chunk with complete metadata
            yield {
                "content": "",
                "is_final": True,
                "model": full_response.model,
                "provider": full_response.provider,
                "usage": full_response.usage,
                "cost": full_response.cost,
                "response_time_ms": full_response.response_time_ms,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            # Re-raise with streaming context
            provider.logger.error(f"Error in simulated streaming: {str(e)}")
            raise
    
    def _calculate_streaming_cost(
        self, 
        usage: Dict[str, int], 
        config: LLMConfiguration
    ) -> Optional[float]:
        """
        Calculate cost for streaming response based on token usage.
        
        Args:
            usage: Token usage dictionary
            config: LLM configuration
            
        Returns:
            Calculated cost or None if cost tracking not available
        """
        if not config.cost_per_1k_input_tokens or not config.cost_per_1k_output_tokens:
            return None
        
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        
        input_cost = (input_tokens / 1000.0) * float(config.cost_per_1k_input_tokens)
        output_cost = (output_tokens / 1000.0) * float(config.cost_per_1k_output_tokens)
        
        return input_cost + output_cost
    
    def _estimate_usage_from_content(
        self, 
        content: str, 
        request_payload: Dict[str, Any]
    ) -> Dict[str, int]:
        """
        Estimate token usage from content when streaming doesn't provide usage info.
        
        Args:
            content: The generated content
            request_payload: Original request payload
            
        Returns:
            Estimated usage dictionary
        """
        # Rough estimation: 1 token ≈ 4 characters for English
        output_tokens = len(content) // 4
        
        # Estimate input tokens from original messages
        input_content = ""
        for msg in request_payload.get("messages", []):
            input_content += msg.get("content", "")
        
        input_tokens = len(input_content) // 4
        
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens
        }
    
    async def _log_streaming_usage_background(
        self,
        user_id: int,
        config_id: int,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        performance_data: Dict[str, Any],
        session_id: Optional[str],
        request_id: Optional[str],
        ip_address: Optional[str],
        user_agent: Optional[str],
        final_response: Optional[ChatResponse],
        bypass_quota: bool,
        db_session: Session
    ) -> None:
        """
        🔧 Background task for logging streaming usage.
        
        This method runs as a background task to ensure usage logging happens
        even if the client disconnects immediately after receiving the final chunk.
        
        Args:
            user_id: User making the request
            config_id: LLM configuration used
            request_data: Request data for logging
            response_data: Response data for logging
            performance_data: Performance metrics
            session_id: Session identifier
            request_id: Request identifier
            ip_address: Client IP address
            user_agent: Client user agent
            final_response: Final chat response (None for errors)
            bypass_quota: Whether quota checking was bypassed
            db_session: Database session (for quota recording)
        """
        try:
            self.logger.info(f"🔧 [BACKGROUND] Starting background usage logging for user {user_id}, request_id {request_id}")
            
            # Record quota usage if not bypassed and we have a final response
            if not bypass_quota and final_response:
                try:
                    quota_usage_result = self._record_quota_usage_improved(
                        user_id, config_id, final_response, db_session
                    )
                    
                    if quota_usage_result["success"]:
                        self.logger.info(f"🔧 [BACKGROUND] Streaming quota usage recorded: {quota_usage_result.get('updated_quotas', [])} quotas updated")
                    
                except Exception as quota_error:
                    self.logger.error(f"🔧 [BACKGROUND] Failed to record streaming quota usage (non-critical): {str(quota_error)}")
            
            # 🔧 FIX: Use SYNCHRONOUS usage logging instead of async
            # This prevents the "greenlet_spawn has not been called" error
            try:
                # Use the synchronous version of usage logging
                usage_service.log_llm_request_sync(
                    db_session=next(get_db()),  # Get a fresh synchronous session
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
                
                cost_display = f"${final_response.cost:.4f}" if final_response and final_response.cost else "$0.0000"
                tokens = final_response.usage.get('total_tokens', 0) if final_response else 0
                self.logger.info(f"✅ [BACKGROUND] Streaming usage logging completed for user {user_id}: {tokens} tokens, {cost_display}")
                
            except Exception as logging_error:
                self.logger.error(f"❌ [BACKGROUND] Failed to log streaming usage (non-critical): {str(logging_error)}")
                import traceback
                self.logger.error(f"❌ [BACKGROUND] Usage logging traceback: {traceback.format_exc()}")
            
        except Exception as e:
            self.logger.error(f"❌ [BACKGROUND] Background usage logging failed for user {user_id}: {str(e)}")
            import traceback
            self.logger.error(f"❌ [BACKGROUND] Background logging traceback: {traceback.format_exc()}")
            # Don't re-raise - background tasks should not break the main flow

# =============================================================================
# SERVICE INSTANCE
# =============================================================================

# Create global service instance
# This follows the same pattern as other services in our app
llm_service = LLMService()
