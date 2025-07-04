"""
Chat API Response Schemas

Response schemas for the Chat API endpoints, extracted from the main chat.py file
for better modularity and maintainability.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from .models import UnifiedModelInfo

# =============================================================================
# MAIN CHAT RESPONSE SCHEMA
# =============================================================================

class ChatResponse(BaseModel):
    """Schema for chat responses to frontend."""
    
    content: str = Field(description="AI response content")
    model: str = Field(description="Model that generated the response")
    provider: str = Field(description="AI provider used")
    
    # Usage and cost information
    usage: Dict[str, int] = Field(description="Token usage information")
    cost: Optional[float] = Field(description="Estimated cost in USD")
    response_time_ms: Optional[int] = Field(description="Response time in milliseconds")
    
    # Metadata
    timestamp: str = Field(description="Response timestamp")
    
    # Model validation information
    model_requested: Optional[str] = Field(None, description="Model originally requested by user")
    model_changed: Optional[bool] = Field(None, description="Whether the model was changed during validation")
    model_change_reason: Optional[str] = Field(None, description="Reason why model was changed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "content": "Hello! I'm doing well, thank you for asking. How can I help you today?",
                "model": "gpt-4",
                "provider": "OpenAI",
                "usage": {
                    "input_tokens": 12,
                    "output_tokens": 23,
                    "total_tokens": 35
                },
                "cost": 0.0012,
                "response_time_ms": 1500,
                "timestamp": "2024-01-01T12:00:00Z",
                "model_requested": "gpt-4-turbo",
                "model_changed": True,
                "model_change_reason": "Model 'gpt-4-turbo' not available, using 'gpt-4' instead"
            }
        }

# =============================================================================
# CONFIGURATION TESTING RESPONSE SCHEMA
# =============================================================================

class ConfigTestResponse(BaseModel):
    """Schema for configuration test results."""
    success: bool = Field(description="Whether test was successful")
    message: str = Field(description="Test result message")
    response_time_ms: Optional[int] = Field(description="Response time in milliseconds")
    model: Optional[str] = Field(description="Model used in test")
    cost: Optional[float] = Field(description="Test cost")
    error_type: Optional[str] = Field(description="Error type if failed")

# =============================================================================
# COST ESTIMATION RESPONSE SCHEMA
# =============================================================================

class CostEstimateResponse(BaseModel):
    """Schema for cost estimation responses."""
    estimated_cost: Optional[float] = Field(description="Estimated cost in USD")
    has_cost_tracking: bool = Field(description="Whether cost tracking is available")
    message: str = Field(description="Explanation of estimate")

# =============================================================================
# DYNAMIC MODELS RESPONSE SCHEMA
# =============================================================================

class DynamicModelsResponse(BaseModel):
    """Response schema for dynamic models endpoint."""
    models: List[str] = Field(description="List of available model names")
    default_model: str = Field(description="Recommended default model")
    provider: str = Field(description="Provider name")
    cached: bool = Field(description="Whether this data was returned from cache")
    fetched_at: str = Field(description="When this data was fetched")
    cache_expires_at: Optional[str] = Field(None, description="When cache expires")
    config_id: int = Field(description="Configuration ID")
    config_name: str = Field(description="Configuration name")
    
    # Optional fields for metadata
    total_models_available: Optional[int] = Field(None, description="Total models from provider")
    chat_models_available: Optional[int] = Field(None, description="Number of chat-capable models")
    error: Optional[str] = Field(None, description="Error message if fallback was used")
    fallback: Optional[bool] = Field(None, description="Whether fallback was used")
    note: Optional[str] = Field(None, description="Additional information")
    
    class Config:
        json_schema_extra = {
            "example": {
                "models": ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
                "default_model": "gpt-4-turbo",
                "provider": "OpenAI",
                "cached": False,
                "fetched_at": "2024-01-01T12:00:00Z",
                "cache_expires_at": "2024-01-01T13:00:00Z",
                "config_id": 1,
                "config_name": "OpenAI GPT-4 Production",
                "total_models_available": 12,
                "chat_models_available": 4
            }
        }

# =============================================================================
# UNIFIED MODELS RESPONSE SCHEMA
# =============================================================================

class UnifiedModelsResponse(BaseModel):
    """Response with all models from all providers combined."""
    models: List[UnifiedModelInfo] = Field(description="All available models from all providers")
    total_models: int = Field(description="Total number of models")
    total_configs: int = Field(description="Number of configurations")
    default_model_id: Optional[str] = Field(description="Recommended default model ID")
    default_config_id: Optional[int] = Field(description="Configuration ID for default model")
    cached: bool = Field(description="Whether any data was cached")
    providers: List[str] = Field(description="List of available providers")
    
    # Smart filtering metadata
    filtering_applied: bool = Field(description="Whether smart filtering was applied")
    original_total_models: Optional[int] = Field(None, description="Total models before filtering")
    
    class Config:
        json_schema_extra = {
            "example": {
                "models": [
                    {
                        "id": "gpt-4o",
                        "display_name": "GPT-4o",
                        "provider": "OpenAI",
                        "config_id": 1,
                        "config_name": "OpenAI Production",
                        "is_default": True,
                        "cost_tier": "high",
                        "capabilities": ["reasoning", "coding"],
                        "is_recommended": True,
                        "relevance_score": 95
                    }
                ],
                "total_models": 12,
                "total_configs": 3,
                "default_model_id": "gpt-4o",
                "default_config_id": 1,
                "cached": True,
                "providers": ["OpenAI", "Anthropic", "Google"],
                "filtering_applied": True,
                "original_total_models": 45
            }
        }
