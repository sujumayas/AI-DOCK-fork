# AI Dock Conversation Schemas
# Pydantic models for conversation API request/response validation

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# =============================================================================
# MESSAGE SCHEMAS
# =============================================================================

class ConversationMessageBase(BaseModel):
    """Base schema for conversation messages"""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    model_used: Optional[str] = Field(None, description="LLM model used for this message")
    tokens_used: Optional[int] = Field(None, description="Tokens consumed")
    cost: Optional[str] = Field(None, description="Cost estimate")
    response_time_ms: Optional[int] = Field(None, description="Response time in milliseconds")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")

class ConversationMessageCreate(ConversationMessageBase):
    """Schema for creating a message"""
    pass

class ConversationMessageResponse(BaseModel):
    """Schema for message responses"""
    id: int
    conversation_id: int
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    model_used: Optional[str] = Field(None, description="LLM model used for this message")
    tokens_used: Optional[int] = Field(None, description="Tokens consumed")
    cost: Optional[str] = Field(None, description="Cost estimate")
    response_time_ms: Optional[int] = Field(None, description="Response time in milliseconds")
    created_at: datetime
    # Map database field 'message_metadata' to API field 'metadata'
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias='message_metadata', description="Additional metadata")

    class Config:
        from_attributes = True
        populate_by_name = True  # Allow both field name and alias

# =============================================================================
# CONVERSATION SCHEMAS
# =============================================================================

class ConversationBase(BaseModel):
    """Base schema for conversations"""
    title: str = Field(..., max_length=255, description="Conversation title")

class ConversationCreate(ConversationBase):
    """Schema for creating a conversation"""
    llm_config_id: Optional[int] = Field(None, description="LLM configuration used")
    model_used: Optional[str] = Field(None, description="Model used in conversation")
    project_id: Optional[int] = Field(None, description="Project/folder to assign conversation to")
    assistant_id: Optional[int] = Field(None, description="Assistant to use for conversation (overrides project default)")

class ConversationUpdate(BaseModel):
    """Schema for updating a conversation"""
    title: Optional[str] = Field(None, max_length=255, description="New conversation title")

class ConversationSummary(ConversationBase):
    """Summary view of a conversation (without messages)"""
    id: int
    created_at: datetime
    updated_at: datetime
    message_count: int
    last_message_at: Optional[datetime]
    model_used: Optional[str]
    project_id: Optional[int] = Field(None, description="Project/folder this conversation belongs to")
    project: Optional[Dict[str, Any]] = Field(None, description="Project details if associated")
    assistant_id: Optional[int] = Field(None, description="Assistant ID if one is assigned")
    assistant: Optional[Dict[str, Any]] = Field(None, description="Assistant details if one is assigned")

    class Config:
        from_attributes = True

class ConversationDetail(ConversationSummary):
    """Detailed view of a conversation (with messages)"""
    messages: List[ConversationMessageResponse]

    class Config:
        from_attributes = True

# =============================================================================
# BULK OPERATION SCHEMAS
# =============================================================================

class ConversationSaveFromMessages(BaseModel):
    """Schema for saving a complete conversation from message list"""
    title: Optional[str] = Field(None, description="Conversation title (auto-generated if not provided)")
    messages: List[ConversationMessageCreate] = Field(..., description="List of messages to save")
    llm_config_id: Optional[int] = Field(None, description="LLM configuration used")
    model_used: Optional[str] = Field(None, description="Primary model used")
    project_id: Optional[int] = Field(None, description="Project/folder to assign conversation to")
    assistant_id: Optional[int] = Field(None, description="Assistant to use for conversation (overrides project default)")

    @field_validator('messages')
    @classmethod
    def validate_messages(cls, v):
        if len(v) < 1:
            raise ValueError('At least one message is required')
        return v

class ConversationBulkDelete(BaseModel):
    """Schema for bulk deleting conversations"""
    conversation_ids: List[int] = Field(..., description="List of conversation IDs to delete")

    @field_validator('conversation_ids')
    @classmethod
    def validate_ids(cls, v):
        if len(v) < 1:
            raise ValueError('At least one conversation ID is required')
        if len(v) > 50:
            raise ValueError('Cannot delete more than 50 conversations at once')
        return v

# =============================================================================
# SEARCH AND FILTER SCHEMAS
# =============================================================================

class ConversationSearchRequest(BaseModel):
    """Schema for conversation search"""
    query: str = Field(..., min_length=1, max_length=100, description="Search query")
    limit: int = Field(20, ge=1, le=100, description="Maximum results to return")

class ConversationListRequest(BaseModel):
    """Schema for listing conversations with pagination"""
    limit: int = Field(50, ge=1, le=100, description="Maximum conversations to return")
    offset: int = Field(0, ge=0, description="Number of conversations to skip")

# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class ConversationListResponse(BaseModel):
    """Response schema for conversation lists"""
    conversations: List[ConversationSummary]
    total_count: int
    limit: int
    offset: int
    has_more: bool

class ConversationStatsResponse(BaseModel):
    """Response schema for conversation statistics"""
    total_conversations: int
    total_messages: int

class ConversationOperationResponse(BaseModel):
    """Generic response for conversation operations"""
    success: bool
    message: str
    conversation_id: Optional[int] = None

# =============================================================================
# ERROR SCHEMAS
# =============================================================================

class ConversationErrorResponse(BaseModel):
    """Error response schema"""
    error: str
    detail: Optional[str] = None
    conversation_id: Optional[int] = None
