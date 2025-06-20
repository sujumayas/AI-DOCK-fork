# AI Dock LLM Configuration Schemas
# These define the data validation and serialization for LLM configurations

from pydantic import BaseModel, Field, validator, HttpUrl
from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import datetime
import enum

from ..models.llm_config import LLMProvider

# =============================================================================
# ENUMS AND BASE SCHEMAS
# =============================================================================

class LLMProviderSchema(str, enum.Enum):
    """
    Pydantic enum for LLM providers.
    This mirrors the SQLAlchemy enum but for API validation.
    """
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    MISTRAL = "mistral"
    COHERE = "cohere"
    HUGGINGFACE = "huggingface"
    AZURE_OPENAI = "azure_openai"
    CUSTOM = "custom"

# =============================================================================
# SIMPLIFIED INPUT SCHEMAS (NEW - USER FRIENDLY)
# =============================================================================

class LLMConfigurationSimpleCreate(BaseModel):
    """
    Simplified schema for creating LLM configurations with just the essentials.
    
    This is the new user-friendly approach - admins only need to provide:
    1. Provider type (OpenAI, Claude, etc.)
    2. Configuration name 
    3. API key
    4. Optional description
    
    Everything else gets smart defaults based on the provider!
    """
    
    # Required fields (the essentials)
    provider: LLMProviderSchema = Field(
        ...,
        description="LLM provider type",
        example=LLMProviderSchema.OPENAI
    )
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Configuration name",
        example="OpenAI Production"
    )
    
    api_key: str = Field(
        ...,
        min_length=1,
        description="API key for authentication",
        example="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    )
    
    # Optional field
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional description",
        example="Primary OpenAI configuration for the team"
    )
    
    @validator('name')
    def validate_name(cls, v):
        """Validate configuration name format."""
        if not v or not v.strip():
            raise ValueError('Configuration name cannot be empty')
        return v.strip()
    
    @validator('api_key')
    def validate_api_key(cls, v):
        """Validate API key format (basic check)."""
        if not v or not v.strip():
            raise ValueError('API key cannot be empty')
        
        v = v.strip()
        
        if len(v) < 10:
            raise ValueError('API key seems too short')
            
        return v
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "provider": "openai",
                "name": "OpenAI Production",
                "api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                "description": "Primary OpenAI configuration for our team"
            }
        }

# =============================================================================
# PROVIDER SMART DEFAULTS
# =============================================================================

def get_provider_smart_defaults(provider: LLMProviderSchema) -> Dict[str, Any]:
    """
    Get smart defaults for a provider to minimize user configuration.
    
    This function encapsulates our knowledge about each provider's
    best practices, so users don't need to research API endpoints,
    models, or cost structures.
    
    Args:
        provider: The LLM provider to get defaults for
        
    Returns:
        Dictionary with smart defaults for the provider
    """
    
    if provider == LLMProviderSchema.OPENAI:
        return {
            "api_endpoint": "https://api.openai.com/v1",
            "api_version": None,  # OpenAI doesn't require version in URL
            "default_model": "gpt-4",
            "available_models": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
            "model_parameters": {
                "temperature": 0.7,
                "max_tokens": 4000
            },
            "rate_limit_rpm": 3000,
            "rate_limit_tpm": 90000,
            "cost_per_1k_input_tokens": 0.030000,
            "cost_per_1k_output_tokens": 0.060000,
            "priority": 10,
            "custom_headers": {},
            "provider_settings": {"timeout": 30}
        }
    
    elif provider == LLMProviderSchema.ANTHROPIC:
        return {
            "api_endpoint": "https://api.anthropic.com",
            "api_version": "2023-06-01",
            "default_model": "claude-3-sonnet-20240229",
            "available_models": [
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229", 
                "claude-3-haiku-20240307",
                "claude-3-5-sonnet-20240620"
            ],
            "model_parameters": {
                "temperature": 0.7,
                "max_tokens": 4000
            },
            "rate_limit_rpm": 1000,
            "rate_limit_tpm": 40000,
            "cost_per_1k_input_tokens": 0.015000,
            "cost_per_1k_output_tokens": 0.075000,
            "priority": 20,
            "custom_headers": {"anthropic-version": "2023-06-01"},
            "provider_settings": {"timeout": 60}
        }
    
    elif provider == LLMProviderSchema.GOOGLE:
        return {
            "api_endpoint": "https://generativelanguage.googleapis.com",
            "api_version": "v1",
            "default_model": "gemini-1.5-pro",
            "available_models": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
            "model_parameters": {"temperature": 0.7, "max_tokens": 4000},
            "rate_limit_rpm": 300,
            "rate_limit_tpm": 30000,
            "cost_per_1k_input_tokens": 0.001250,
            "cost_per_1k_output_tokens": 0.005000,
            "priority": 30,
            "custom_headers": {},
            "provider_settings": {"timeout": 30}
        }
    
    elif provider == LLMProviderSchema.MISTRAL:
        return {
            "api_endpoint": "https://api.mistral.ai",
            "api_version": None,
            "default_model": "mistral-large-latest",
            "available_models": ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
            "model_parameters": {"temperature": 0.7, "max_tokens": 4000},
            "rate_limit_rpm": 1000,
            "rate_limit_tpm": 50000,
            "cost_per_1k_input_tokens": 0.008000,
            "cost_per_1k_output_tokens": 0.024000,
            "priority": 40,
            "custom_headers": {},
            "provider_settings": {"timeout": 30}
        }
    
    elif provider == LLMProviderSchema.AZURE_OPENAI:
        return {
            "api_endpoint": "https://your-resource.openai.azure.com",
            "api_version": "2023-05-15",
            "default_model": "gpt-4",
            "available_models": ["gpt-4", "gpt-35-turbo"],
            "model_parameters": {"temperature": 0.7, "max_tokens": 4000},
            "rate_limit_rpm": 2000,
            "rate_limit_tpm": 60000,
            "cost_per_1k_input_tokens": 0.030000,
            "cost_per_1k_output_tokens": 0.060000,
            "priority": 15,
            "custom_headers": {},
            "provider_settings": {"timeout": 30}
        }
    
    else:  # CUSTOM or unknown providers
        return {
            "api_endpoint": "https://your-custom-endpoint.com",
            "api_version": None,
            "default_model": "your-model",
            "available_models": ["your-model"],
            "model_parameters": {"temperature": 0.7, "max_tokens": 4000},
            "rate_limit_rpm": 100,
            "rate_limit_tpm": 10000,
            "cost_per_1k_input_tokens": 0.010000,
            "cost_per_1k_output_tokens": 0.020000,
            "priority": 100,
            "custom_headers": {},
            "provider_settings": {"timeout": 30}
        }

# =============================================================================
# INPUT SCHEMAS (FOR CREATING/UPDATING CONFIGURATIONS)
# =============================================================================

class LLMConfigurationCreate(BaseModel):
    """
    Schema for creating a new LLM configuration.
    
    This defines what data is required when an admin creates
    a new LLM provider configuration through the API.
    """
    
    # Basic identification
    name: str = Field(
        ...,  # Required field
        min_length=1,
        max_length=100,
        description="Human-readable name for this configuration",
        example="OpenAI GPT-4 Production"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Description of this configuration's purpose",
        example="Production OpenAI configuration with GPT-4 access"
    )
    
    # Provider configuration
    provider: LLMProviderSchema = Field(
        ...,
        description="LLM provider type",
        example=LLMProviderSchema.OPENAI
    )
    
    api_endpoint: HttpUrl = Field(
        ...,
        description="Base URL for the provider's API",
        example="https://api.openai.com/v1"
    )
    
    api_key: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="API key for authentication (will be encrypted when stored)",
        example="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    )
    
    api_version: Optional[str] = Field(
        None,
        max_length=20,
        description="API version to use",
        example="2023-05-15"
    )
    
    # Model configuration
    default_model: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Default model name to use",
        example="gpt-4"
    )
    
    available_models: Optional[List[str]] = Field(
        None,
        description="List of available model names",
        example=["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"]
    )
    
    # Fixed: Renamed from model_config to model_parameters to avoid Pydantic v2 conflict
    model_parameters: Optional[Dict[str, Any]] = Field(
        None,
        description="Model configuration parameters",
        example={"temperature": 0.7, "max_tokens": 4000}
    )
    
    # Rate limiting
    rate_limit_rpm: Optional[int] = Field(
        None,
        ge=0,  # Greater than or equal to 0
        description="Rate limit: requests per minute",
        example=3000
    )
    
    rate_limit_tpm: Optional[int] = Field(
        None,
        ge=0,
        description="Rate limit: tokens per minute",
        example=90000
    )
    
    daily_quota: Optional[int] = Field(
        None,
        ge=0,
        description="Maximum requests per day",
        example=10000
    )
    
    monthly_budget_usd: Optional[Decimal] = Field(
        None,
        ge=0,
        decimal_places=2,
        description="Monthly budget limit in USD",
        example=1000.00
    )
    
    # Cost tracking
    cost_per_1k_input_tokens: Optional[Decimal] = Field(
        None,
        ge=0,
        decimal_places=6,
        description="Cost per 1000 input tokens in USD",
        example=0.030000
    )
    
    cost_per_1k_output_tokens: Optional[Decimal] = Field(
        None,
        ge=0,
        decimal_places=6,
        description="Cost per 1000 output tokens in USD",
        example=0.060000
    )
    
    cost_per_request: Optional[Decimal] = Field(
        None,
        ge=0,
        decimal_places=6,
        description="Fixed cost per request in USD",
        example=0.001000
    )
    
    # Status and controls
    is_active: bool = Field(
        True,
        description="Whether this configuration is currently active"
    )
    
    is_public: bool = Field(
        True,
        description="Whether regular users can use this configuration"
    )
    
    priority: int = Field(
        100,
        ge=0,
        le=1000,
        description="Priority order (lower numbers = higher priority)"
    )
    
    # Additional settings
    custom_headers: Optional[Dict[str, str]] = Field(
        None,
        description="Custom HTTP headers for API requests",
        example={"Organization": "org-123"}
    )
    
    provider_settings: Optional[Dict[str, Any]] = Field(
        None,
        description="Provider-specific configuration settings",
        example={"timeout": 30, "retries": 3}
    )
    
    # =============================================================================
    # VALIDATION METHODS
    # =============================================================================
    
    @validator('name')
    def validate_name(cls, v):
        """Validate configuration name format."""
        if not v or not v.strip():
            raise ValueError('Configuration name cannot be empty')
        return v.strip()
    
    @validator('api_key')
    def validate_api_key(cls, v):
        """Validate API key format (basic check)."""
        if not v or not v.strip():
            raise ValueError('API key cannot be empty')
        
        # Remove whitespace
        v = v.strip()
        
        # Basic length check
        if len(v) < 10:
            raise ValueError('API key seems too short')
            
        return v
    
    @validator('default_model')
    def validate_default_model(cls, v):
        """Validate default model name."""
        if not v or not v.strip():
            raise ValueError('Default model cannot be empty')
        return v.strip()
    
    @validator('available_models')
    def validate_available_models(cls, v, values):
        """Validate that default_model is in available_models if provided."""
        if v is None:
            return v
            
        # Remove empty strings and duplicates
        v = list(set([model.strip() for model in v if model and model.strip()]))
        
        # Check that default model is in the list
        default_model = values.get('default_model')
        if default_model and default_model not in v:
            v.append(default_model)
            
        return v
    
    @validator('custom_headers')
    def validate_custom_headers(cls, v):
        """Validate custom headers format."""
        if v is None:
            return v
            
        # Ensure all keys and values are strings
        validated = {}
        for key, value in v.items():
            if not isinstance(key, str) or not isinstance(value, str):
                raise ValueError('Custom headers must be string key-value pairs')
            validated[key.strip()] = value.strip()
            
        return validated
    
    class Config:
        """Pydantic configuration."""
        schema_extra = {
            "example": {
                "name": "OpenAI GPT-4 Production",
                "description": "Primary OpenAI configuration for production use",
                "provider": "openai",
                "api_endpoint": "https://api.openai.com/v1",
                "api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                "api_version": "2023-05-15",
                "default_model": "gpt-4",
                "available_models": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"],
                "model_parameters": {
                    "temperature": 0.7,
                    "max_tokens": 4000,
                    "top_p": 1.0
                },
                "rate_limit_rpm": 3000,
                "rate_limit_tpm": 90000,
                "daily_quota": 10000,
                "monthly_budget_usd": 1000.00,
                "cost_per_1k_input_tokens": 0.030000,
                "cost_per_1k_output_tokens": 0.060000,
                "is_active": True,
                "is_public": True,
                "priority": 10
            }
        }

class LLMConfigurationUpdate(BaseModel):
    """
    Schema for updating an existing LLM configuration.
    
    All fields are optional since we support partial updates.
    """
    
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Human-readable name for this configuration"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Description of this configuration's purpose"
    )
    
    api_endpoint: Optional[HttpUrl] = Field(
        None,
        description="Base URL for the provider's API"
    )
    
    api_key: Optional[str] = Field(
        None,
        min_length=1,
        max_length=500,
        description="API key for authentication"
    )
    
    api_version: Optional[str] = Field(
        None,
        max_length=20,
        description="API version to use"
    )
    
    default_model: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        description="Default model name to use"
    )
    
    available_models: Optional[List[str]] = Field(
        None,
        description="List of available model names"
    )
    
    # Fixed: Renamed from model_config to model_parameters
    model_parameters: Optional[Dict[str, Any]] = Field(
        None,
        description="Model configuration parameters"
    )
    
    rate_limit_rpm: Optional[int] = Field(None, ge=0)
    rate_limit_tpm: Optional[int] = Field(None, ge=0)
    daily_quota: Optional[int] = Field(None, ge=0)
    monthly_budget_usd: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    
    cost_per_1k_input_tokens: Optional[Decimal] = Field(None, ge=0, decimal_places=6)
    cost_per_1k_output_tokens: Optional[Decimal] = Field(None, ge=0, decimal_places=6)
    cost_per_request: Optional[Decimal] = Field(None, ge=0, decimal_places=6)
    
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0, le=1000)
    
    custom_headers: Optional[Dict[str, str]] = None
    provider_settings: Optional[Dict[str, Any]] = None
    
    # Apply same validators as Create schema
    @validator('name')
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Configuration name cannot be empty')
        return v.strip() if v else v
    
    @validator('api_key')
    def validate_api_key(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('API key cannot be empty')
            v = v.strip()
            if len(v) < 10:
                raise ValueError('API key seems too short')
        return v
    
    @validator('default_model')
    def validate_default_model(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Default model cannot be empty')
        return v.strip() if v else v

# =============================================================================
# OUTPUT SCHEMAS (FOR API RESPONSES)
# =============================================================================

class LLMConfigurationResponse(BaseModel):
    """
    Schema for LLM configuration API responses.
    
    This defines what data is returned when someone requests
    configuration information. Notice we DON'T include the API key!
    """
    
    id: int = Field(description="Unique configuration identifier")
    name: str = Field(description="Configuration name")
    description: Optional[str] = Field(description="Configuration description")
    
    provider: LLMProviderSchema = Field(description="LLM provider type")
    provider_name: str = Field(description="Human-readable provider name")
    
    api_endpoint: str = Field(description="API endpoint URL")
    api_version: Optional[str] = Field(description="API version")
    
    # Model info
    default_model: str = Field(description="Default model name")
    available_models: Optional[List[str]] = Field(description="Available models")
    # Fixed: Renamed from model_config to model_parameters
    model_parameters: Optional[Dict[str, Any]] = Field(description="Model configuration")
    
    # Rate limiting info
    rate_limit_rpm: Optional[int] = Field(description="Requests per minute limit")
    rate_limit_tpm: Optional[int] = Field(description="Tokens per minute limit")
    daily_quota: Optional[int] = Field(description="Daily request quota")
    monthly_budget_usd: Optional[Decimal] = Field(description="Monthly budget in USD")
    
    # Cost info
    cost_per_1k_input_tokens: Optional[Decimal] = Field(description="Input token cost per 1K")
    cost_per_1k_output_tokens: Optional[Decimal] = Field(description="Output token cost per 1K")
    cost_per_request: Optional[Decimal] = Field(description="Fixed cost per request")
    estimated_cost_per_request: Optional[float] = Field(description="Estimated typical request cost")
    
    # Status
    is_active: bool = Field(description="Whether configuration is active")
    is_public: bool = Field(description="Whether available to regular users")
    priority: int = Field(description="Priority order")
    
    # Metadata
    created_at: datetime = Field(description="When configuration was created")
    updated_at: datetime = Field(description="When configuration was last updated")
    last_tested_at: Optional[datetime] = Field(description="When last tested")
    last_test_result: Optional[str] = Field(description="Last test result")
    
    # Computed properties
    is_rate_limited: bool = Field(description="Whether rate limiting is enabled")
    has_cost_tracking: bool = Field(description="Whether cost tracking is enabled")
    
    # Custom settings (safe to expose)
    custom_headers: Optional[Dict[str, str]] = Field(description="Custom headers")
    provider_settings: Optional[Dict[str, Any]] = Field(description="Provider settings")
    
    class Config:
        """Allow conversion from SQLAlchemy models."""
        from_attributes = True
        
        schema_extra = {
            "example": {
                "id": 1,
                "name": "OpenAI GPT-4 Production",
                "description": "Primary OpenAI configuration",
                "provider": "openai",
                "provider_name": "OpenAI",
                "api_endpoint": "https://api.openai.com/v1",
                "api_version": "2023-05-15",
                "default_model": "gpt-4",
                "available_models": ["gpt-3.5-turbo", "gpt-4"],
                "is_active": True,
                "is_public": True,
                "priority": 10,
                "rate_limit_rpm": 3000,
                "cost_per_1k_input_tokens": 0.030000,
                "estimated_cost_per_request": 0.075,
                "is_rate_limited": True,
                "has_cost_tracking": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
        }

class LLMConfigurationSummary(BaseModel):
    """
    Schema for LLM configuration summary (list views).
    
    Lighter version with just the essential information
    for displaying in lists or dropdowns.
    """
    
    id: int
    name: str
    provider: LLMProviderSchema
    provider_name: str
    default_model: str
    is_active: bool
    is_public: bool
    priority: int
    estimated_cost_per_request: Optional[float]
    
    class Config:
        from_attributes = True

# =============================================================================
# SPECIAL PURPOSE SCHEMAS
# =============================================================================

class LLMConfigurationTest(BaseModel):
    """
    Schema for testing LLM configuration connectivity.
    """
    
    test_message: str = Field(
        "Hello, this is a test message.",
        max_length=200,
        description="Test message to send to the LLM"
    )
    
    timeout_seconds: int = Field(
        30,
        ge=5,
        le=120,
        description="Timeout for the test request"
    )

class LLMConfigurationTestResult(BaseModel):
    """
    Schema for LLM configuration test results.
    """
    
    success: bool = Field(description="Whether the test was successful")
    message: str = Field(description="Result message or error description")
    response_time_ms: Optional[int] = Field(description="Response time in milliseconds")
    tested_at: datetime = Field(description="When the test was performed")
    error_details: Optional[Dict[str, Any]] = Field(description="Detailed error information")

class LLMProviderInfo(BaseModel):
    """
    Schema for LLM provider information (for UI dropdowns).
    """
    
    value: LLMProviderSchema = Field(description="Provider enum value")
    name: str = Field(description="Human-readable provider name")
    description: str = Field(description="Provider description")
    default_endpoint: str = Field(description="Default API endpoint")
    documentation_url: Optional[str] = Field(description="Link to provider documentation")
    
    class Config:
        schema_extra = {
            "example": {
                "value": "openai",
                "name": "OpenAI",
                "description": "OpenAI GPT models including GPT-3.5 and GPT-4",
                "default_endpoint": "https://api.openai.com/v1",
                "documentation_url": "https://platform.openai.com/docs"
            }
        }

# =============================================================================
# CONVERSION FUNCTIONS
# =============================================================================

def convert_simple_to_full_create(simple_data: LLMConfigurationSimpleCreate) -> LLMConfigurationCreate:
    """
    Convert simplified creation data to full LLMConfigurationCreate.
    
    This function applies smart defaults based on the provider type,
    so users only need to specify the essentials.
    
    Args:
        simple_data: Simplified configuration data from user
        
    Returns:
        Full LLMConfigurationCreate with smart defaults applied
    """
    # Get smart defaults for the provider
    defaults = get_provider_smart_defaults(simple_data.provider)
    
    # Merge user data with smart defaults
    full_data = {
        # User-provided data (takes precedence)
        "name": simple_data.name,
        "description": simple_data.description,
        "provider": simple_data.provider,
        "api_key": simple_data.api_key,
        
        # Smart defaults from provider knowledge
        "api_endpoint": defaults["api_endpoint"],
        "api_version": defaults["api_version"],
        "default_model": defaults["default_model"],
        "available_models": defaults["available_models"],
        "model_parameters": defaults["model_parameters"],
        "rate_limit_rpm": defaults["rate_limit_rpm"],
        "rate_limit_tpm": defaults["rate_limit_tpm"],
        "cost_per_1k_input_tokens": defaults["cost_per_1k_input_tokens"],
        "cost_per_1k_output_tokens": defaults["cost_per_1k_output_tokens"],
        "priority": defaults["priority"],
        "custom_headers": defaults["custom_headers"],
        "provider_settings": defaults["provider_settings"],
        
        # Standard defaults
        "daily_quota": None,
        "monthly_budget_usd": None,
        "cost_per_request": None,
        "is_active": True,
        "is_public": True
    }
    
    # Create and return the full configuration
    return LLMConfigurationCreate(**full_data)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_provider_info_list() -> List[LLMProviderInfo]:
    """
    Get information about all supported LLM providers.
    
    Returns:
        List of provider information for UI dropdowns
    """
    return [
        LLMProviderInfo(
            value=LLMProviderSchema.OPENAI,
            name="OpenAI",
            description="OpenAI GPT models including GPT-3.5 and GPT-4",
            default_endpoint="https://api.openai.com/v1",
            documentation_url="https://platform.openai.com/docs"
        ),
        LLMProviderInfo(
            value=LLMProviderSchema.ANTHROPIC,
            name="Anthropic (Claude)",
            description="Anthropic Claude models for advanced reasoning",
            default_endpoint="https://api.anthropic.com",
            documentation_url="https://docs.anthropic.com"
        ),
        LLMProviderInfo(
            value=LLMProviderSchema.GOOGLE,
            name="Google (Gemini)",
            description="Google Gemini models for multimodal AI",
            default_endpoint="https://generativelanguage.googleapis.com",
            documentation_url="https://ai.google.dev"
        ),
        LLMProviderInfo(
            value=LLMProviderSchema.MISTRAL,
            name="Mistral AI",
            description="Mistral open and commercial models",
            default_endpoint="https://api.mistral.ai",
            documentation_url="https://docs.mistral.ai"
        ),
        LLMProviderInfo(
            value=LLMProviderSchema.COHERE,
            name="Cohere",
            description="Cohere language models for enterprise",
            default_endpoint="https://api.cohere.ai",
            documentation_url="https://docs.cohere.ai"
        ),
        LLMProviderInfo(
            value=LLMProviderSchema.AZURE_OPENAI,
            name="Azure OpenAI",
            description="OpenAI models hosted on Microsoft Azure",
            default_endpoint="https://{resource}.openai.azure.com",
            documentation_url="https://docs.microsoft.com/azure/cognitive-services/openai/"
        ),
        LLMProviderInfo(
            value=LLMProviderSchema.CUSTOM,
            name="Custom Provider",
            description="Custom or self-hosted LLM endpoints",
            default_endpoint="https://your-custom-endpoint.com",
            documentation_url=None
        )
    ]
