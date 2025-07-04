"""
Chat API Request Schemas

Request schemas for the Chat API endpoints, extracted from the main chat.py file
for better modularity and maintainability.
"""

from pydantic import BaseModel, Field
from typing import List, Optional

# =============================================================================
# CHAT MESSAGE SCHEMA
# =============================================================================

class ChatMessage(BaseModel):
    """Schema for a single chat message."""
    role: str = Field(description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(description="Message content")
    name: Optional[str] = Field(None, description="Optional sender name")

# =============================================================================
# MAIN CHAT REQUEST SCHEMA
# =============================================================================

class ChatRequest(BaseModel):
    """Schema for chat requests from frontend."""
    
    # Required fields
    config_id: int = Field(description="ID of LLM configuration to use")
    messages: List[ChatMessage] = Field(description="List of chat messages")
    
    # 🤖 Assistant and project integration support
    assistant_id: Optional[int] = Field(None, description="ID of custom assistant to use (optional)")
    conversation_id: Optional[int] = Field(None, description="ID of existing conversation to continue (optional)")
    project_id: Optional[int] = Field(None, description="ID of project context to use (optional)")
    
    # 📁 File attachment support
    file_attachment_ids: Optional[List[int]] = Field(None, description="List of uploaded file IDs to include as context")
    
    # Optional parameters
    model: Optional[str] = Field(None, description="Override model (optional)")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Response randomness (0-2)")
    max_tokens: Optional[int] = Field(None, ge=1, le=32000, description="Maximum response tokens")
    
    class Config:
        json_schema_extra = {
            "example": {
                "config_id": 1,
                "messages": [
                    {"role": "user", "content": "Hello! How are you?"}
                ],
                "assistant_id": 123,
                "conversation_id": 456,
                "project_id": 789,
                "temperature": 0.7,
                "max_tokens": 1000
            }
        }

# =============================================================================
# CONFIGURATION TESTING SCHEMA
# =============================================================================

class ConfigTestRequest(BaseModel):
    """Schema for testing LLM configurations."""
    config_id: int = Field(description="ID of configuration to test")

# =============================================================================
# COST ESTIMATION SCHEMA
# =============================================================================

class CostEstimateRequest(BaseModel):
    """Schema for cost estimation requests."""
    config_id: int = Field(description="ID of LLM configuration")
    messages: List[ChatMessage] = Field(description="Messages to estimate cost for")
    model: Optional[str] = Field(None, description="Model to use")
    max_tokens: Optional[int] = Field(None, description="Maximum response tokens")
