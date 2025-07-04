"""
Chat API Model Schemas

Model-specific schemas for the Chat API endpoints, extracted from the main chat.py file
for better modularity and maintainability.
"""

from pydantic import BaseModel, Field
from typing import List, Optional

# =============================================================================
# UNIFIED MODEL INFO SCHEMA
# =============================================================================

class UnifiedModelInfo(BaseModel):
    """A single model in the unified list with provider information."""
    id: str = Field(description="Unique model identifier")
    display_name: str = Field(description="Human-readable model name") 
    provider: str = Field(description="Provider name (OpenAI, Anthropic, etc.)")
    config_id: int = Field(description="Configuration ID this model belongs to")
    config_name: str = Field(description="Configuration name")
    is_default: bool = Field(description="Whether this is the default model for its config")
    cost_tier: str = Field(description="Cost tier: low, medium, high")
    capabilities: List[str] = Field(description="Model capabilities")
    is_recommended: bool = Field(description="Whether this model is recommended")
    relevance_score: Optional[int] = Field(None, description="Smart filtering relevance score (0-100)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "gpt-4o",
                "display_name": "GPT-4o",
                "provider": "OpenAI",
                "config_id": 1,
                "config_name": "OpenAI Production",
                "is_default": True,
                "cost_tier": "high",
                "capabilities": ["reasoning", "coding", "creative-writing"],
                "is_recommended": True,
                "relevance_score": 95
            }
        }
