"""
Assistant schemas for AI Dock Custom Assistants feature.

These Pydantic models define the structure and validation rules for:
- Creating and updating custom AI assistants
- Managing assistant conversations
- Data validation and API contracts
- Error handling for assistant operations

🎓 LEARNING: Custom Assistants Data Flow
======================================
The Custom Assistants feature enables users to create specialized AI personas:

1. **Assistant Creation**: User defines name, description, system prompt, model preferences
2. **Conversation Integration**: Assistants can be used in chat conversations
3. **Personalization**: Each user has their own private assistants
4. **Validation**: Ensures data integrity and security

Think of assistants as "AI characters" - a Data Analyst assistant, Creative Writer, etc.
Each has its own personality (system prompt) and preferences (temperature, model).

Why separate schemas from models?
- Models = Database structure (SQLAlchemy)
- Schemas = API contracts (Pydantic)
- Validation = Ensure data quality before hitting database
- Security = Control what data can be sent/received
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

# Import related schemas for composition
from .conversation import ConversationSummary, ConversationDetail


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class AssistantStatus(str, Enum):
    """
    Status options for assistants.
    
    🎓 LEARNING: Enum vs String Fields
    ================================
    Using Enums provides:
    - Type safety (can't use invalid values)
    - Clear documentation of valid options
    - IDE autocompletion
    - Automatic validation by Pydantic
    """
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"


class ModelProvider(str, Enum):
    """Supported LLM providers for assistant preferences."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE = "azure"
    CUSTOM = "custom"


# Validation constants
MAX_ASSISTANT_NAME_LENGTH = 100
MAX_ASSISTANT_DESCRIPTION_LENGTH = 500
MAX_SYSTEM_PROMPT_LENGTH = 8000
MIN_SYSTEM_PROMPT_LENGTH = 10
MAX_ASSISTANTS_PER_USER = 50


# =============================================================================
# CORE ASSISTANT SCHEMAS
# =============================================================================

class AssistantBase(BaseModel):
    """
    Base schema for assistant data shared across create/update operations.
    
    🎓 LEARNING: Schema Inheritance Pattern
    =====================================
    By creating a base schema, we can:
    - Share common fields between Create/Update schemas
    - Avoid code duplication
    - Ensure consistency across operations
    - Make changes in one place
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=MAX_ASSISTANT_NAME_LENGTH,
        description="Human-readable name for the assistant (e.g., 'Data Analyst', 'Creative Writer')",
        example="Data Analyst Pro"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=MAX_ASSISTANT_DESCRIPTION_LENGTH,
        description="Brief description of what this assistant does and its personality",
        example="Specialized in analyzing datasets, creating visualizations, and providing statistical insights."
    )
    
    system_prompt: str = Field(
        ...,
        min_length=MIN_SYSTEM_PROMPT_LENGTH,
        max_length=MAX_SYSTEM_PROMPT_LENGTH,
        description="The system prompt that defines this assistant's behavior and personality",
        example="You are a skilled data analyst. Help users analyze data, create visualizations, and interpret statistics. Always ask clarifying questions about the data context and goals."
    )
    
    model_preferences: Optional[Dict[str, Any]] = Field(
        default=None,
        description="JSON object storing LLM preferences: temperature, max_tokens, model, etc.",
        example={
            "model": "gpt-4",
            "temperature": 0.3,
            "max_tokens": 3000,
            "top_p": 1.0,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        }
    )
    
    @validator('name')
    def validate_name(cls, v):
        """
        Validate assistant name format and content.
        
        🎓 LEARNING: Input Sanitization
        ==============================
        Always validate user input to prevent:
        - XSS attacks (malicious scripts)
        - Data corruption (invalid characters)
        - Poor user experience (confusing names)
        """
        if not v or not v.strip():
            raise ValueError('Assistant name cannot be empty or just whitespace')
        
        # Remove extra whitespace
        v = v.strip()
        
        # Check for reasonable characters
        if not all(c.isalnum() or c.isspace() or c in '-_()[]{}!?.' for c in v):
            raise ValueError('Assistant name contains invalid characters')
        
        return v
    
    @validator('description')
    def validate_description(cls, v):
        """Validate description content if provided."""
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None  # Convert empty string to None
        return v
    
    @validator('system_prompt')
    def validate_system_prompt(cls, v):
        """
        Validate system prompt content and security.
        
        🎓 LEARNING: Prompt Injection Protection
        =======================================
        System prompts are critical for AI behavior. We must:
        - Ensure minimum content (not just whitespace)
        - Check for prompt injection attempts
        - Maintain reasonable length limits
        - Preserve user intent while ensuring safety
        """
        if not v or not v.strip():
            raise ValueError('System prompt cannot be empty or just whitespace')
        
        v = v.strip()
        
        # Basic prompt injection checks
        dangerous_patterns = [
            'ignore previous instructions',
            'ignore the above',
            'disregard the above',
            'forget everything',
            'new instructions:',
        ]
        
        v_lower = v.lower()
        for pattern in dangerous_patterns:
            if pattern in v_lower:
                raise ValueError(f'System prompt contains potentially unsafe content: "{pattern}"')
        
        return v
    
    @validator('model_preferences')
    def validate_model_preferences(cls, v):
        """
        Validate model preferences structure and values.
        
        🎓 LEARNING: Configuration Validation
        ====================================
        Model preferences control AI behavior, so validate:
        - Temperature in valid range (0-2)
        - Max tokens as positive integer
        - Model name from supported list
        - No dangerous or invalid configurations
        """
        if v is None:
            return v
        
        if not isinstance(v, dict):
            raise ValueError('Model preferences must be a dictionary')
        
        # Validate temperature
        if 'temperature' in v:
            temp = v['temperature']
            if not isinstance(temp, (int, float)):
                raise ValueError('Temperature must be a number')
            if not 0 <= temp <= 2:
                raise ValueError('Temperature must be between 0 and 2')
        
        # Validate max_tokens
        if 'max_tokens' in v:
            tokens = v['max_tokens']
            if not isinstance(tokens, int):
                raise ValueError('Max tokens must be an integer')
            if tokens <= 0:
                raise ValueError('Max tokens must be positive')
            if tokens > 32000:  # Reasonable upper limit
                raise ValueError('Max tokens cannot exceed 32,000')
        
        # Validate model name if provided
        if 'model' in v:
            model = v['model']
            if not isinstance(model, str) or not model.strip():
                raise ValueError('Model must be a non-empty string')
        
        return v


class AssistantCreate(AssistantBase):
    """
    Schema for creating a new assistant.
    
    🎓 LEARNING: Creation Schema Design
    =================================
    Creation schemas should:
    - Include all required fields for new records
    - Provide sensible defaults where possible
    - Validate business rules specific to creation
    - Be permissive (user can iterate and improve)
    """
    pass  # Inherits all fields from AssistantBase
    
    class Config:
        schema_extra = {
            "example": {
                "name": "Creative Writing Assistant",
                "description": "Helps with creative writing, storytelling, character development, and narrative structure.",
                "system_prompt": "You are a creative writing assistant. Help users with storytelling, character development, plot ideas, and creative content. Be imaginative, inspiring, and supportive of creative expression. Ask questions to understand the genre, audience, and style preferences.",
                "model_preferences": {
                    "model": "gpt-4",
                    "temperature": 0.9,
                    "max_tokens": 4000,
                    "top_p": 1.0,
                    "frequency_penalty": 0.1,
                    "presence_penalty": 0.1
                }
            }
        }


class AssistantUpdate(BaseModel):
    """
    Schema for updating an existing assistant.
    
    🎓 LEARNING: Update Schema Pattern
    =================================
    Update schemas differ from create schemas:
    - All fields are optional (partial updates)
    - Can't change ownership or system-generated fields
    - May have different validation rules
    - Should preserve existing data if field not provided
    """
    name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=MAX_ASSISTANT_NAME_LENGTH,
        description="Updated name for the assistant"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=MAX_ASSISTANT_DESCRIPTION_LENGTH,
        description="Updated description"
    )
    
    system_prompt: Optional[str] = Field(
        None,
        min_length=MIN_SYSTEM_PROMPT_LENGTH,
        max_length=MAX_SYSTEM_PROMPT_LENGTH,
        description="Updated system prompt"
    )
    
    model_preferences: Optional[Dict[str, Any]] = Field(
        None,
        description="Updated model preferences"
    )
    
    is_active: Optional[bool] = Field(
        None,
        description="Whether to activate/deactivate the assistant"
    )
    
    # Apply same validators as base schema
    _validate_name = validator('name', allow_reuse=True)(AssistantBase.validate_name)
    _validate_description = validator('description', allow_reuse=True)(AssistantBase.validate_description)
    _validate_system_prompt = validator('system_prompt', allow_reuse=True)(AssistantBase.validate_system_prompt)
    _validate_model_preferences = validator('model_preferences', allow_reuse=True)(AssistantBase.validate_model_preferences)
    
    class Config:
        schema_extra = {
            "example": {
                "name": "Advanced Data Analyst",
                "description": "Enhanced with statistical analysis and machine learning capabilities.",
                "system_prompt": "You are an expert data analyst with advanced statistical knowledge. Help users with complex data analysis, statistical modeling, and machine learning insights. Always explain your methodology.",
                "model_preferences": {
                    "temperature": 0.2,
                    "max_tokens": 4000
                },
                "is_active": True
            }
        }


class AssistantResponse(BaseModel):
    """
    Schema for assistant API responses.
    
    🎓 LEARNING: Response Schema Design
    ==================================
    Response schemas should include:
    - All data frontend needs for display
    - Computed fields (conversation_count, status_label)
    - Metadata (timestamps, owner info)
    - Safe data only (no sensitive internal details)
    """
    id: int = Field(..., description="Unique assistant identifier")
    name: str = Field(..., description="Assistant name")
    description: Optional[str] = Field(None, description="Assistant description")
    system_prompt: str = Field(..., description="System prompt defining assistant behavior")
    system_prompt_preview: str = Field(..., description="Truncated system prompt for list views")
    model_preferences: Dict[str, Any] = Field(..., description="LLM model preferences")
    user_id: int = Field(..., description="ID of the user who owns this assistant")
    is_active: bool = Field(..., description="Whether assistant is active")
    conversation_count: int = Field(..., description="Number of conversations using this assistant")
    
    # Timestamps
    created_at: datetime = Field(..., description="When assistant was created")
    updated_at: datetime = Field(..., description="When assistant was last updated")
    
    # Computed properties for UI
    is_new: bool = Field(..., description="Whether assistant was created recently (last 24 hours)")
    status_label: str = Field(..., description="Human-readable status")
    has_custom_preferences: bool = Field(..., description="Whether assistant has custom model preferences")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "id": 123,
                "name": "Data Analyst Pro",
                "description": "Specialized in analyzing datasets and providing statistical insights.",
                "system_prompt": "You are a skilled data analyst. Help users analyze data, create visualizations...",
                "system_prompt_preview": "You are a skilled data analyst. Help users analyze data, create...",
                "model_preferences": {
                    "model": "gpt-4",
                    "temperature": 0.3,
                    "max_tokens": 3000
                },
                "user_id": 456,
                "is_active": True,
                "conversation_count": 7,
                "created_at": "2025-06-18T10:00:00Z",
                "updated_at": "2025-06-18T14:30:00Z",
                "is_new": False,
                "status_label": "Active",
                "has_custom_preferences": True
            }
        }


class AssistantSummary(BaseModel):
    """
    Lightweight assistant summary for list views and dropdowns.
    
    🎓 LEARNING: Performance Optimization
    ===================================
    Not all API endpoints need full data. Summary schemas provide:
    - Faster API responses (less data transfer)
    - Reduced database load (fewer joins)
    - Better user experience (faster page loads)
    - Bandwidth savings for mobile users
    """
    id: int = Field(..., description="Assistant ID")
    name: str = Field(..., description="Assistant name")
    description: Optional[str] = Field(None, description="Brief description")
    system_prompt_preview: str = Field(..., description="Preview of system prompt")
    is_active: bool = Field(..., description="Whether assistant is active")
    conversation_count: int = Field(..., description="Number of conversations")
    created_at: datetime = Field(..., description="Creation timestamp")
    is_new: bool = Field(..., description="Whether created recently")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# =============================================================================
# CONVERSATION SCHEMAS WITH ASSISTANT INTEGRATION
# =============================================================================

class AssistantConversationCreate(BaseModel):
    """
    Schema for creating a conversation with a specific assistant.
    
    🎓 LEARNING: Feature Integration
    ===============================
    When adding assistants to conversations, we need:
    - Clear association between conversation and assistant
    - Validation that user owns the assistant
    - Optional conversation metadata
    - Fallback behavior if assistant unavailable
    """
    assistant_id: int = Field(..., description="ID of the assistant to use")
    title: Optional[str] = Field(
        None,
        max_length=255,
        description="Optional conversation title (auto-generated if not provided)"
    )
    first_message: Optional[str] = Field(
        None,
        min_length=1,
        max_length=10000,
        description="Optional first message to start the conversation"
    )
    
    @validator('title')
    def validate_title(cls, v):
        """Validate conversation title if provided."""
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "assistant_id": 123,
                "title": "Q3 Sales Data Analysis",
                "first_message": "I have the Q3 sales data and need to identify trends and insights."
            }
        }


class AssistantConversationResponse(BaseModel):
    """
    Schema for conversation responses with assistant information.
    
    🎓 LEARNING: Rich Response Data
    =============================
    Include assistant context in conversation responses so frontend can:
    - Display which assistant is being used
    - Show assistant-specific UI elements
    - Enable assistant switching
    - Provide context about AI behavior
    """
    id: int = Field(..., description="Conversation ID")
    title: str = Field(..., description="Conversation title")
    user_id: int = Field(..., description="Owner user ID")
    
    # Assistant information
    assistant_id: Optional[int] = Field(None, description="Associated assistant ID")
    assistant_name: Optional[str] = Field(None, description="Assistant name for display")
    assistant_description: Optional[str] = Field(None, description="Assistant description")
    
    # Conversation metadata
    message_count: int = Field(..., description="Number of messages")
    last_message_at: Optional[datetime] = Field(None, description="Last message timestamp")
    is_active: bool = Field(..., description="Whether conversation is active")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "id": 789,
                "title": "Data Analysis Session",
                "user_id": 456,
                "assistant_id": 123,
                "assistant_name": "Data Analyst Pro",
                "assistant_description": "Specialized in data analysis and statistics",
                "message_count": 12,
                "last_message_at": "2025-06-18T15:45:00Z",
                "is_active": True,
                "created_at": "2025-06-18T10:00:00Z",
                "updated_at": "2025-06-18T15:45:00Z"
            }
        }


# =============================================================================
# LIST AND FILTER SCHEMAS
# =============================================================================

class AssistantListRequest(BaseModel):
    """
    Schema for requesting assistant lists with filtering and pagination.
    
    🎓 LEARNING: API Pagination and Filtering
    ========================================
    Production APIs need:
    - Pagination (don't load all records at once)
    - Filtering (find specific assistants)
    - Sorting (order by name, date, usage)
    - Search (fuzzy matching on names/descriptions)
    """
    limit: int = Field(
        20,
        ge=1,
        le=100,
        description="Maximum assistants to return"
    )
    offset: int = Field(
        0,
        ge=0,
        description="Number of assistants to skip"
    )
    search: Optional[str] = Field(
        None,
        max_length=100,
        description="Search query for name or description"
    )
    status_filter: Optional[AssistantStatus] = Field(
        None,
        description="Filter by assistant status"
    )
    sort_by: Optional[str] = Field(
        "updated_at",
        description="Field to sort by (name, created_at, updated_at, conversation_count)"
    )
    sort_order: Optional[str] = Field(
        "desc",
        description="Sort order (asc or desc)"
    )
    include_inactive: bool = Field(
        False,
        description="Whether to include inactive assistants"
    )
    
    @validator('search')
    def validate_search(cls, v):
        """Validate search query."""
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
        return v
    
    @validator('sort_by')
    def validate_sort_by(cls, v):
        """Validate sort field."""
        allowed_fields = ['name', 'created_at', 'updated_at', 'conversation_count']
        if v not in allowed_fields:
            raise ValueError(f'Sort by must be one of: {", ".join(allowed_fields)}')
        return v
    
    @validator('sort_order')
    def validate_sort_order(cls, v):
        """Validate sort order."""
        if v not in ['asc', 'desc']:
            raise ValueError('Sort order must be "asc" or "desc"')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "limit": 20,
                "offset": 0,
                "search": "data analyst",
                "status_filter": "active",
                "sort_by": "updated_at",
                "sort_order": "desc",
                "include_inactive": False
            }
        }


class AssistantListResponse(BaseModel):
    """
    Schema for assistant list responses with pagination info.
    
    🎓 LEARNING: Pagination Response Pattern
    =======================================
    Paginated responses should always include:
    - The actual data (assistants list)
    - Pagination metadata (total, has_more)
    - Filter/search context
    - Performance info (query time, etc.)
    """
    assistants: List[AssistantSummary] = Field(..., description="List of assistants")
    total_count: int = Field(..., description="Total number of assistants matching filters")
    limit: int = Field(..., description="Requested limit")
    offset: int = Field(..., description="Requested offset")
    has_more: bool = Field(..., description="Whether there are more results available")
    filters_applied: Dict[str, Any] = Field(..., description="Summary of applied filters")
    
    class Config:
        schema_extra = {
            "example": {
                "assistants": [
                    {
                        "id": 123,
                        "name": "Data Analyst Pro",
                        "description": "Specialized in data analysis",
                        "system_prompt_preview": "You are a skilled data analyst...",
                        "is_active": True,
                        "conversation_count": 7,
                        "created_at": "2025-06-18T10:00:00Z",
                        "is_new": False
                    }
                ],
                "total_count": 15,
                "limit": 20,
                "offset": 0,
                "has_more": False,
                "filters_applied": {
                    "search": None,
                    "status_filter": "active",
                    "include_inactive": False
                }
            }
        }


# =============================================================================
# OPERATION RESULT SCHEMAS
# =============================================================================

class AssistantOperationResponse(BaseModel):
    """
    Generic response schema for assistant operations (create, update, delete).
    
    🎓 LEARNING: Consistent Operation Responses
    ==========================================
    Standardized responses help frontend handle operations consistently:
    - Always know if operation succeeded
    - Get helpful messages for user feedback
    - Receive updated data when appropriate
    - Handle errors gracefully
    """
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    assistant_id: Optional[int] = Field(None, description="ID of affected assistant")
    assistant: Optional[AssistantResponse] = Field(None, description="Updated assistant data")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Assistant updated successfully",
                "assistant_id": 123,
                "assistant": {
                    "id": 123,
                    "name": "Updated Data Analyst",
                    "description": "Enhanced with new capabilities"
                }
            }
        }


class AssistantStatsResponse(BaseModel):
    """
    Schema for assistant statistics and usage analytics.
    
    🎓 LEARNING: Analytics and Insights
    ==================================
    Statistics help users understand:
    - Which assistants are most useful
    - Usage patterns over time
    - System health and performance
    - Opportunities for optimization
    """
    total_assistants: int = Field(..., description="Total number of assistants for user")
    active_assistants: int = Field(..., description="Number of active assistants")
    total_conversations: int = Field(..., description="Total conversations using assistants")
    most_used_assistant: Optional[Dict[str, Any]] = Field(
        None,
        description="Information about most frequently used assistant"
    )
    recent_activity: List[Dict[str, Any]] = Field(
        ...,
        description="Recent assistant-related activity"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "total_assistants": 8,
                "active_assistants": 6,
                "total_conversations": 45,
                "most_used_assistant": {
                    "id": 123,
                    "name": "Data Analyst Pro",
                    "conversation_count": 15
                },
                "recent_activity": [
                    {
                        "type": "conversation_created",
                        "assistant_name": "Creative Writer",
                        "timestamp": "2025-06-18T15:30:00Z"
                    }
                ]
            }
        }


# =============================================================================
# ERROR SCHEMAS
# =============================================================================

class AssistantErrorResponse(BaseModel):
    """
    Error response schema for assistant operations.
    
    🎓 LEARNING: Comprehensive Error Handling
    ========================================
    Good error responses provide:
    - Clear error classification
    - Actionable error messages
    - Context about what went wrong
    - Suggestions for resolution
    - Debug information for developers
    """
    error_type: str = Field(..., description="Type of error (validation, permission, not_found, etc.)")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    assistant_id: Optional[int] = Field(None, description="ID of assistant related to error")
    field_errors: Optional[Dict[str, List[str]]] = Field(
        None,
        description="Field-specific validation errors"
    )
    suggestions: Optional[List[str]] = Field(
        None,
        description="Suggestions for resolving the error"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "error_type": "validation_error",
                "message": "Assistant data contains validation errors",
                "details": {
                    "invalid_fields": ["system_prompt", "model_preferences"],
                    "error_count": 2
                },
                "assistant_id": None,
                "field_errors": {
                    "system_prompt": ["System prompt is too short (minimum 10 characters)"],
                    "model_preferences": ["Temperature must be between 0 and 2"]
                },
                "suggestions": [
                    "Provide a more detailed system prompt describing the assistant's role",
                    "Check temperature value in model preferences",
                    "Review the assistant creation guidelines"
                ]
            }
        }


class AssistantPermissionError(BaseModel):
    """Specific error schema for permission-related issues."""
    error_type: str = Field(default="permission_denied", description="Error type")
    message: str = Field(..., description="Permission error message")
    assistant_id: int = Field(..., description="ID of assistant user tried to access")
    required_permission: str = Field(..., description="Permission that was required")
    
    class Config:
        schema_extra = {
            "example": {
                "error_type": "permission_denied",
                "message": "You don't have permission to modify this assistant",
                "assistant_id": 123,
                "required_permission": "assistant:edit"
            }
        }


# =============================================================================
# BULK OPERATIONS SCHEMAS
# =============================================================================

class AssistantBulkAction(BaseModel):
    """Schema for bulk operations on assistants."""
    assistant_ids: List[int] = Field(..., description="List of assistant IDs")
    action: str = Field(..., description="Action to perform (activate, deactivate, delete)")
    
    @validator('assistant_ids')
    def validate_assistant_ids(cls, v):
        """Validate assistant IDs list."""
        if len(v) == 0:
            raise ValueError('At least one assistant ID is required')
        if len(v) > 20:
            raise ValueError('Cannot perform bulk operations on more than 20 assistants at once')
        if len(set(v)) != len(v):
            raise ValueError('Duplicate assistant IDs are not allowed')
        return v
    
    @validator('action')
    def validate_action(cls, v):
        """Validate bulk action type."""
        allowed_actions = ['activate', 'deactivate', 'delete']
        if v not in allowed_actions:
            raise ValueError(f'Action must be one of: {", ".join(allowed_actions)}')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "assistant_ids": [123, 124, 125],
                "action": "deactivate"
            }
        }


class AssistantBulkResponse(BaseModel):
    """Response schema for bulk operations."""
    success: bool = Field(..., description="Whether bulk operation succeeded")
    message: str = Field(..., description="Overall operation result message")
    total_requested: int = Field(..., description="Total assistants requested for operation")
    successful_count: int = Field(..., description="Number of assistants successfully processed")
    failed_count: int = Field(..., description="Number of assistants that failed")
    failed_assistants: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Details about assistants that failed"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "Bulk deactivation completed",
                "total_requested": 3,
                "successful_count": 3,
                "failed_count": 0,
                "failed_assistants": None
            }
        }


# =============================================================================
# EXPORT/IMPORT SCHEMAS
# =============================================================================

class AssistantExport(BaseModel):
    """Schema for exporting assistant configurations."""
    name: str = Field(..., description="Assistant name")
    description: Optional[str] = Field(None, description="Assistant description")
    system_prompt: str = Field(..., description="System prompt")
    model_preferences: Dict[str, Any] = Field(..., description="Model preferences")
    export_version: str = Field(default="1.0", description="Export format version")
    exported_at: datetime = Field(..., description="Export timestamp")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AssistantImport(BaseModel):
    """Schema for importing assistant configurations."""
    name: str = Field(..., description="Assistant name")
    description: Optional[str] = Field(None, description="Assistant description")
    system_prompt: str = Field(..., description="System prompt")
    model_preferences: Optional[Dict[str, Any]] = Field(None, description="Model preferences")
    
    # Apply same validation as creation
    _validate_name = validator('name', allow_reuse=True)(AssistantBase.validate_name)
    _validate_description = validator('description', allow_reuse=True)(AssistantBase.validate_description)
    _validate_system_prompt = validator('system_prompt', allow_reuse=True)(AssistantBase.validate_system_prompt)
    _validate_model_preferences = validator('model_preferences', allow_reuse=True)(AssistantBase.validate_model_preferences)


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def create_assistant_response_from_model(assistant_model) -> AssistantResponse:
    """
    Utility function to convert an Assistant model instance to AssistantResponse.
    
    Args:
        assistant_model: SQLAlchemy Assistant model instance
        
    Returns:
        AssistantResponse schema instance
        
    🎓 LEARNING: Model-to-Schema Conversion
    =====================================
    This utility helps maintain consistency when converting database
    models to API responses, ensuring all computed fields are properly set.
    """
    return AssistantResponse(
        id=assistant_model.id,
        name=assistant_model.name,
        description=assistant_model.description,
        system_prompt=assistant_model.system_prompt,
        system_prompt_preview=assistant_model.system_prompt_preview,
        model_preferences=assistant_model.get_effective_model_preferences(),
        user_id=assistant_model.user_id,
        is_active=assistant_model.is_active,
        conversation_count=assistant_model.conversation_count,
        created_at=assistant_model.created_at,
        updated_at=assistant_model.updated_at,
        is_new=assistant_model.is_new,
        status_label="Active" if assistant_model.is_active else "Inactive",
        has_custom_preferences=bool(assistant_model.model_preferences)
    )


def validate_assistant_ownership(assistant_model, user_id: int) -> bool:
    """
    Utility function to validate assistant ownership.
    
    Args:
        assistant_model: Assistant model instance
        user_id: ID of user to check ownership for
        
    Returns:
        True if user owns the assistant
        
    🎓 LEARNING: Security Validation
    ===============================
    Always validate ownership before allowing operations.
    This prevents users from accessing/modifying assistants they don't own.
    """
    return assistant_model.user_id == user_id


# =============================================================================
# DEBUGGING AND TESTING SCHEMAS
# =============================================================================

if __name__ == "__main__":
    # Quick validation tests
    print("🧪 Testing Assistant Schemas...")
    
    # Test valid assistant creation
    try:
        assistant_data = {
            "name": "Test Assistant",
            "description": "A test assistant for validation",
            "system_prompt": "You are a helpful test assistant.",
            "model_preferences": {
                "temperature": 0.7,
                "max_tokens": 2000
            }
        }
        assistant = AssistantCreate(**assistant_data)
        print("✅ Valid assistant creation schema works")
    except Exception as e:
        print(f"❌ Assistant creation validation failed: {e}")
    
    # Test invalid data
    try:
        invalid_assistant = AssistantCreate(
            name="",  # Invalid: empty name
            system_prompt="Short",  # Invalid: too short
        )
        print("❌ Validation should have failed but didn't")
    except Exception as e:
        print("✅ Validation correctly caught invalid data")
    
    print("🎯 Assistant schemas loaded successfully!")
