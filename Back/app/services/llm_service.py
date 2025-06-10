# AI Dock LLM Integration Service WITH QUOTA ENFORCEMENT
# This service handles communication with external LLM providers AND enforces department quotas

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
        Get available models for a configuration.
        
        Args:
            config_id: ID of the configuration
            
        Returns:
            List of available model names
        """
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
# SERVICE INSTANCE
# =============================================================================

# Create global service instance
# This follows the same pattern as other services in our app
llm_service = LLMService()
