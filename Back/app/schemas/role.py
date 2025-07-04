# AI Dock Role Schemas
# These define the structure for role API requests and responses

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

# =============================================================================
# ROLE DROPDOWN SCHEMA
# =============================================================================

class RoleDropdownOption(BaseModel):
    """
    Schema for role dropdown selection.
    
    Learning: This follows the same pattern as DepartmentDropdownOption,
    providing consistent API design across different entity types.
    
    Purpose: Provides role data formatted for frontend dropdown components
    """
    
    value: int = Field(
        description="Role ID for form submission",
        example=2
    )
    
    label: str = Field(
        description="Human-readable role name for display",
        example="Standard User"
    )
    
    name: str = Field(
        description="Role system name for reference",
        example="user"
    )

    class Config:
        """Pydantic configuration for this schema."""
        orm_mode = True
        json_schema_extra = {
            "example": {
                "value": 2,
                "label": "Standard User", 
                "name": "user"
            }
        }

# =============================================================================
# DETAILED ROLE RESPONSE SCHEMA
# =============================================================================

class RoleResponse(BaseModel):
    """
    Schema for detailed role information.
    
    Learning: This provides complete role data for admin management,
    while RoleDropdownOption provides minimal data for form dropdowns.
    """
    
    id: int = Field(description="Unique role identifier")
    name: str = Field(description="Role system name")
    display_name: str = Field(description="Human-readable role name")
    description: Optional[str] = Field(description="Role description")
    level: int = Field(description="Role hierarchy level")
    is_active: bool = Field(description="Whether role is currently active")
    is_system_role: bool = Field(description="Whether this is a built-in system role")
    permissions: Dict[str, Any] = Field(description="Role permissions as JSON object")
    created_at: datetime = Field(description="When the role was created")
    updated_at: datetime = Field(description="When the role was last updated")

    class Config:
        """Allow the schema to work with SQLAlchemy models."""
        orm_mode = True
        json_schema_extra = {
            "example": {
                "id": 2,
                "name": "user",
                "display_name": "Standard User",
                "description": "Basic AI chat access with personal usage tracking",
                "level": 2,
                "is_active": True,
                "is_system_role": True,
                "permissions": {
                    "can_use_ai_chat": True,
                    "can_access_ai_history": True
                },
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-06-01T15:45:00Z"
            }
        }

# =============================================================================
# ROLE CREATE/UPDATE SCHEMAS
# =============================================================================

class RoleCreateRequest(BaseModel):
    """
    Schema for creating new roles.
    
    Learning: Separating create/update schemas allows different
    validation rules and required fields for each operation.
    """
    
    name: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Unique role system name"
    )
    
    display_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Human-readable role name for display"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Detailed description of role responsibilities"
    )
    
    level: int = Field(
        1,
        ge=1,
        le=10,
        description="Role hierarchy level (1-10, higher = more permissions)"
    )
    
    is_active: bool = Field(
        True,
        description="Whether the role should be active"
    )
    
    permissions: Dict[str, Any] = Field(
        default_factory=dict,
        description="Role permissions as JSON object"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "analyst",
                "display_name": "Data Analyst",
                "description": "Advanced AI features with usage analytics access",
                "level": 3,
                "is_active": True,
                "permissions": {
                    "can_use_ai_chat": True,
                    "can_use_advanced_ai": True,
                    "can_view_usage_stats": True
                }
            }
        }


class RoleUpdateRequest(BaseModel):
    """
    Schema for updating existing roles.
    
    Learning: All fields optional for updates - only provided fields are changed.
    """
    
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=50,
        description="New role system name"
    )
    
    display_name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100,
        description="New human-readable role name"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="New role description"
    )
    
    level: Optional[int] = Field(
        None,
        ge=1,
        le=10,
        description="New role hierarchy level"
    )
    
    is_active: Optional[bool] = Field(
        None,
        description="New active status"
    )
    
    permissions: Optional[Dict[str, Any]] = Field(
        None,
        description="New permissions object"
    )

# =============================================================================
# ROLE LISTING SCHEMAS
# =============================================================================

class RoleListResponse(BaseModel):
    """
    Schema for paginated role listings.
    
    Learning: Follows the same pagination pattern as other entity lists.
    """
    
    roles: List[RoleResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_previous_page: bool

    class Config:
        json_schema_extra = {
            "example": {
                "roles": [],  # Would contain RoleResponse objects
                "total_count": 5,
                "page": 1,
                "page_size": 20,
                "total_pages": 1,
                "has_next_page": False,
                "has_previous_page": False
            }
        }
