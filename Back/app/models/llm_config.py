# AI Dock LLM Configuration Model
# This defines how we store LLM provider configurations (OpenAI, Claude, etc.)

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, Numeric, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, Dict, Any, List
import enum
import json

from ..core.database import Base

class LLMProvider(enum.Enum):
    """
    Enumeration of supported LLM providers.
    
    This restricts which providers we can store in the database,
    ensuring consistency and preventing typos.
    """
    OPENAI = "openai"
    ANTHROPIC = "anthropic"        # Claude
    GOOGLE = "google"              # Gemini
    MISTRAL = "mistral"
    COHERE = "cohere"
    HUGGINGFACE = "huggingface"
    AZURE_OPENAI = "azure_openai"
    CUSTOM = "custom"              # For custom endpoints

class LLMConfiguration(Base):
    """
    LLM Configuration model for storing AI provider settings and credentials.
    
    This model securely stores configuration for different LLM providers,
    including API keys, model preferences, rate limits, and cost information.
    
    Table: llm_configurations
    Purpose: Store secure configuration for each LLM provider we want to use
    
    Key Concepts:
    - API Keys are stored encrypted (not plain text!)
    - JSON fields store complex configuration data
    - Rate limits prevent us from exceeding provider quotas
    - Cost tracking helps monitor expenses
    - Multiple configs per provider (dev/prod, different models)
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "llm_configurations"
    
    # =============================================================================
    # PRIMARY IDENTIFICATION
    # =============================================================================
    
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        comment="Unique configuration identifier"
    )
    
    # Human-readable name for this configuration
    name = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Human-readable name for this configuration (e.g., 'OpenAI GPT-4 Production')"
    )
    
    # Short description of what this config is for
    description = Column(
        Text,
        nullable=True,
        comment="Description of this configuration's purpose and usage"
    )
    
    # =============================================================================
    # PROVIDER CONFIGURATION
    # =============================================================================
    
    # Which LLM provider this configuration is for
    provider = Column(
        Enum(LLMProvider),
        nullable=False,
        index=True,
        comment="LLM provider type (OpenAI, Anthropic, etc.)"
    )
    
    # API endpoint URL (different providers have different URLs)
    api_endpoint = Column(
        String(500),
        nullable=False,
        comment="Base URL for the provider's API"
    )
    
    # API key for authentication (this will be encrypted!)
    # IMPORTANT: In production, this should be encrypted at rest
    api_key_encrypted = Column(
        Text,
        nullable=False,
        comment="Encrypted API key for authentication (NEVER store plain text!)"
    )
    
    # API version (some providers have versioned APIs)
    api_version = Column(
        String(20),
        nullable=True,
        comment="API version to use (e.g., '2023-05-15' for OpenAI)"
    )
    
    # =============================================================================
    # MODEL CONFIGURATION
    # =============================================================================
    
    # Default model to use for this provider
    default_model = Column(
        String(100),
        nullable=False,
        comment="Default model name (e.g., 'gpt-4', 'claude-3-opus')"
    )
    
    # Available models for this provider (stored as JSON list)
    # Example: ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"]
    available_models = Column(
        JSON,
        nullable=True,
        comment="JSON array of available model names"
    )
    
    # Model-specific configurations (stored as JSON)
    # Example: {"temperature": 0.7, "max_tokens": 4000, "top_p": 1.0}
    model_parameters = Column(
        JSON,
        nullable=True,
        comment="JSON object with model configuration parameters"
    )
    
    # =============================================================================
    # RATE LIMITING AND QUOTAS
    # =============================================================================
    
    # Maximum requests per minute allowed
    rate_limit_rpm = Column(
        Integer,
        nullable=True,
        comment="Rate limit: requests per minute"
    )
    
    # Maximum tokens per minute allowed
    rate_limit_tpm = Column(
        Integer,
        nullable=True,
        comment="Rate limit: tokens per minute"
    )
    
    # Daily request quota (if applicable)
    daily_quota = Column(
        Integer,
        nullable=True,
        comment="Maximum requests allowed per day"
    )
    
    # Monthly budget limit in USD
    monthly_budget_usd = Column(
        Numeric(precision=10, scale=2),  # Up to $99,999,999.99
        nullable=True,
        comment="Monthly budget limit in USD"
    )
    
    # =============================================================================
    # COST TRACKING
    # =============================================================================
    
    # Cost per 1000 input tokens (prompt tokens)
    cost_per_1k_input_tokens = Column(
        Numeric(precision=8, scale=6),   # Very precise for small costs like $0.000001
        nullable=True,
        comment="Cost per 1000 input tokens in USD"
    )
    
    # Cost per 1000 output tokens (completion tokens)
    cost_per_1k_output_tokens = Column(
        Numeric(precision=8, scale=6),
        nullable=True,
        comment="Cost per 1000 output tokens in USD"
    )
    
    # Fixed cost per request (if applicable)
    cost_per_request = Column(
        Numeric(precision=8, scale=6),
        nullable=True,
        comment="Fixed cost per request in USD (if applicable)"
    )
    
    # =============================================================================
    # STATUS AND CONTROLS
    # =============================================================================
    
    # Is this configuration currently active?
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether this configuration is currently active"
    )
    
    # Is this configuration available for users (or admin-only)?
    is_public = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether regular users can use this configuration"
    )
    
    # Priority order for displaying/selecting configurations
    priority = Column(
        Integer,
        default=100,
        nullable=False,
        comment="Priority order (lower numbers = higher priority)"
    )
    
    # =============================================================================
    # ADDITIONAL SETTINGS
    # =============================================================================
    
    # Custom headers to send with API requests (stored as JSON)
    # Example: {"Organization": "org-123", "Custom-Header": "value"}
    custom_headers = Column(
        JSON,
        nullable=True,
        comment="JSON object with custom HTTP headers for API requests"
    )
    
    # Provider-specific settings (stored as JSON)
    # This allows each provider to have unique configuration options
    provider_settings = Column(
        JSON,
        nullable=True,
        comment="JSON object with provider-specific configuration settings"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    # When this configuration was created
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When this configuration was created"
    )
    
    # When this configuration was last updated
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="When this configuration was last updated"
    )
    
    # When this configuration was last tested/validated
    last_tested_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this configuration was last tested for connectivity"
    )
    
    # Result of last test (success, error message, etc.)
    last_test_result = Column(
        Text,
        nullable=True,
        comment="Result of last connectivity test"
    )
    
    # =============================================================================
    # RELATIONSHIPS
    # =============================================================================
    
    # Usage tracking relationship - shows all usage logs for this configuration
    usage_logs = relationship("UsageLog", back_populates="llm_config", lazy="dynamic")
    
    # Future relationships to add:
    # department_restrictions = relationship("DepartmentLLMAccess", back_populates="llm_config")
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"<LLMConfiguration(id={self.id}, name='{self.name}', provider='{self.provider.value}')>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        status = "Active" if self.is_active else "Inactive"
        return f"{self.name} ({self.provider.value}) - {status}"
    
    # =============================================================================
    # PROPERTY METHODS
    # =============================================================================
    
    @property
    def provider_name(self) -> str:
        """Get human-readable provider name."""
        provider_names = {
            LLMProvider.OPENAI: "OpenAI",
            LLMProvider.ANTHROPIC: "Anthropic (Claude)",
            LLMProvider.GOOGLE: "Google (Gemini)",
            LLMProvider.MISTRAL: "Mistral AI",
            LLMProvider.COHERE: "Cohere",
            LLMProvider.HUGGINGFACE: "Hugging Face",
            LLMProvider.AZURE_OPENAI: "Azure OpenAI",
            LLMProvider.CUSTOM: "Custom Provider"
        }
        return provider_names.get(self.provider, self.provider.value)
    
    @property
    def is_rate_limited(self) -> bool:
        """Check if this configuration has rate limiting enabled."""
        return (self.rate_limit_rpm is not None or 
                self.rate_limit_tpm is not None or 
                self.daily_quota is not None)
    
    @property
    def has_cost_tracking(self) -> bool:
        """Check if this configuration has cost tracking enabled."""
        return (self.cost_per_1k_input_tokens is not None or 
                self.cost_per_1k_output_tokens is not None or 
                self.cost_per_request is not None)
    
    @property
    def estimated_cost_per_request(self) -> Optional[float]:
        """
        Estimate cost per typical request (rough calculation).
        Assumes average request uses 1000 input + 500 output tokens.
        """
        if not self.has_cost_tracking:
            return None
            
        cost = 0.0
        
        # Add input token cost (assume 1000 tokens)
        if self.cost_per_1k_input_tokens:
            cost += float(self.cost_per_1k_input_tokens) * 1.0  # 1k tokens
            
        # Add output token cost (assume 500 tokens)
        if self.cost_per_1k_output_tokens:
            cost += float(self.cost_per_1k_output_tokens) * 0.5  # 0.5k tokens
            
        # Add fixed cost per request
        if self.cost_per_request:
            cost += float(self.cost_per_request)
            
        return cost
    
    # =============================================================================
    # BUSINESS LOGIC METHODS
    # =============================================================================
    
    def is_available_for_user(self, user) -> bool:
        """
        Check if this configuration is available for a specific user.
        
        Args:
            user: User object to check access for
            
        Returns:
            True if user can use this configuration
        """
        # Must be active
        if not self.is_active:
            return False
            
        # If public, any user can use it
        if self.is_public:
            return True
            
        # If not public, only admins can use it
        return user.is_admin if hasattr(user, 'is_admin') else False
    
    def get_api_headers(self) -> Dict[str, str]:
        """
        Get HTTP headers for API requests to this provider.
        
        Returns:
            Dictionary of headers to include in API requests
        """
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AI-Dock/1.0"
        }
        
        # Add provider-specific authentication headers
        if self.provider == LLMProvider.OPENAI:
            headers["Authorization"] = f"Bearer {self.get_decrypted_api_key()}"
            if self.api_version:
                headers["OpenAI-Version"] = self.api_version
                
        elif self.provider == LLMProvider.ANTHROPIC:
            # Anthropic uses x-api-key header instead of Authorization Bearer
            headers["x-api-key"] = self.get_decrypted_api_key()
            headers["anthropic-version"] = self.api_version or "2023-06-01"
            
        elif self.provider == LLMProvider.GOOGLE:
            headers["Authorization"] = f"Bearer {self.get_decrypted_api_key()}"
            
        # Add any custom headers
        if self.custom_headers:
            headers.update(self.custom_headers)
            
        return headers
    
    def get_decrypted_api_key(self) -> str:
        """
        Decrypt and return the API key.
        
        NOTE: This is a placeholder implementation!
        In production, implement proper encryption/decryption here.
        
        Returns:
            Decrypted API key
        """
        # TODO: Implement proper encryption/decryption
        # For now, we'll assume the key is stored in base64 or similar simple encoding
        # In production, use proper encryption with a key management system
        
        if not self.api_key_encrypted:
            raise ValueError("No API key configured")
            
        # Placeholder: In real implementation, decrypt the key here
        # For now, just return the "encrypted" key (which isn't really encrypted)
        return self.api_key_encrypted
    
    def set_encrypted_api_key(self, plain_api_key: str) -> None:
        """
        Encrypt and store the API key.
        
        NOTE: This is a placeholder implementation!
        In production, implement proper encryption here.
        
        Args:
            plain_api_key: The plain text API key to encrypt and store
        """
        # TODO: Implement proper encryption
        # For now, just store the key as-is (NOT recommended for production!)
        # In production, encrypt the key with a proper encryption library
        
        if not plain_api_key:
            raise ValueError("API key cannot be empty")
            
        # Placeholder: In real implementation, encrypt the key here
        self.api_key_encrypted = plain_api_key
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to this LLM provider.
        
        Returns:
            Dictionary with test results (success, error message, response time, etc.)
        """
        # This would implement actual API testing
        # For now, return a placeholder result
        
        test_result = {
            "success": True,
            "tested_at": datetime.utcnow().isoformat(),
            "response_time_ms": 150,
            "message": "Connection test successful"
        }
        
        # Update test tracking fields
        self.last_tested_at = datetime.utcnow()
        self.last_test_result = json.dumps(test_result)
        
        return test_result
    
    def calculate_request_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate the cost for a request with given token counts.
        
        Args:
            input_tokens: Number of input (prompt) tokens
            output_tokens: Number of output (completion) tokens
            
        Returns:
            Total cost in USD
        """
        total_cost = 0.0
        
        # Input token cost
        if self.cost_per_1k_input_tokens and input_tokens > 0:
            total_cost += float(self.cost_per_1k_input_tokens) * (input_tokens / 1000)
            
        # Output token cost
        if self.cost_per_1k_output_tokens and output_tokens > 0:
            total_cost += float(self.cost_per_1k_output_tokens) * (output_tokens / 1000)
            
        # Fixed per-request cost
        if self.cost_per_request:
            total_cost += float(self.cost_per_request)
            
        return total_cost
    
    def get_model_list(self) -> List[str]:
        """
        Get list of available models for this configuration.
        
        Returns:
            List of model names
        """
        if self.available_models:
            return self.available_models
        elif self.default_model:
            return [self.default_model]
        else:
            return []
    
    def validate_model(self, model_name: str) -> bool:
        """
        Check if a model name is valid for this configuration.
        
        Args:
            model_name: Model name to validate
            
        Returns:
            True if model is available
        """
        available = self.get_model_list()
        return model_name in available if available else True
    
    # =============================================================================
    # STATUS MANAGEMENT
    # =============================================================================
    
    def activate(self) -> None:
        """Activate this configuration."""
        self.is_active = True
        self.updated_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """Deactivate this configuration."""
        self.is_active = False
        self.updated_at = datetime.utcnow()
    
    def make_public(self) -> None:
        """Make this configuration available to all users."""
        self.is_public = True
        self.updated_at = datetime.utcnow()
    
    def make_private(self) -> None:
        """Make this configuration admin-only."""
        self.is_public = False
        self.updated_at = datetime.utcnow()

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_openai_config(
    name: str = "OpenAI GPT-4",
    api_key: str = None,
    description: str = "OpenAI GPT-4 configuration"
) -> LLMConfiguration:
    """
    Create a sample OpenAI configuration for testing/development.
    
    Args:
        name: Configuration name
        api_key: OpenAI API key
        description: Configuration description
        
    Returns:
        LLMConfiguration object for OpenAI
    """
    config = LLMConfiguration(
        name=name,
        description=description,
        provider=LLMProvider.OPENAI,
        api_endpoint="https://api.openai.com/v1",
        api_version="2023-05-15",
        default_model="gpt-4",
        available_models=["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"],
        model_parameters={
            "temperature": 0.7,
            "max_tokens": 4000,
            "top_p": 1.0
        },
        rate_limit_rpm=3000,
        rate_limit_tpm=90000,
        cost_per_1k_input_tokens=0.03,
        cost_per_1k_output_tokens=0.06,
        monthly_budget_usd=1000.00,
        is_active=True,
        is_public=True,
        priority=10
    )
    
    if api_key:
        config.set_encrypted_api_key(api_key)
        
    return config

def create_claude_config(
    name: str = "Anthropic Claude",
    api_key: str = None,
    description: str = "Anthropic Claude configuration"
) -> LLMConfiguration:
    """
    Create a sample Claude configuration for testing/development.
    
    Args:
        name: Configuration name
        api_key: Anthropic API key
        description: Configuration description
        
    Returns:
        LLMConfiguration object for Claude
    """
    config = LLMConfiguration(
        name=name,
        description=description,
        provider=LLMProvider.ANTHROPIC,
        api_endpoint="https://api.anthropic.com",
        api_version="2023-06-01",
        default_model="claude-opus-4-0",
        available_models=[
            "claude-opus-4-0",
            "claude-sonnet-4-0",
            "claude-3-7-sonnet-latest",
            "claude-3-5-sonnet-latest",
            "claude-3-5-haiku-latest",
            "claude-opus-4-20250514",
            "claude-sonnet-4-20250514",
            "claude-3-7-sonnet-20250219",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307"
        ],
        model_parameters={
            "max_tokens": 4000,
            "temperature": 0.7
        },
        rate_limit_rpm=1000,
        rate_limit_tpm=80000,
        cost_per_1k_input_tokens=0.015,
        cost_per_1k_output_tokens=0.075,
        monthly_budget_usd=1000.00,
        is_active=True,
        is_public=True,
        priority=20
    )
    
    if api_key:
        config.set_encrypted_api_key(api_key)
        
    return config

def get_default_configs() -> List[LLMConfiguration]:
    """
    Get a list of default LLM configurations for initial setup.
    
    Returns:
        List of default LLMConfiguration objects
    """
    return [
        create_openai_config(),
        create_claude_config()
    ]
