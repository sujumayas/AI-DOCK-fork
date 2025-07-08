# 🏢 Department Schemas
# Pydantic schemas for department management API

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal

# =============================================================================
# DEPARTMENT REQUEST SCHEMAS (WHAT FRONTEND SENDS)
# =============================================================================

class DepartmentCreate(BaseModel):
    """
    Schema for creating a new department.
    
    Learning: This defines exactly what data an admin must provide to create a department.
    Pydantic will automatically validate this data and return helpful errors.
    """
    
    name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Department name (Engineering, Sales, Marketing, etc.)",
        example="Engineering"
    )
    
    code: str = Field(
        ...,
        min_length=2,
        max_length=10,
        description="Short department code for IDs and reporting",
        example="ENG"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Detailed description of department responsibilities",
        example="Software development, DevOps, and technical infrastructure"
    )
    
    monthly_budget: Decimal = Field(
        Decimal('1000.00'),
        ge=Decimal('0.00'),
        le=Decimal('999999.99'),
        description="Monthly AI usage budget in USD",
        example=5000.00
    )
    
    manager_email: Optional[str] = Field(
        None,
        max_length=255,
        description="Email of department manager or head",
        example="eng-manager@company.com"
    )
    
    location: Optional[str] = Field(
        None,
        max_length=200,
        description="Physical location or office of the department",
        example="Tech Building, Floor 3"
    )
    
    cost_center: Optional[str] = Field(
        None,
        max_length=50,
        description="Cost center or billing code for accounting",
        example="CC-ENG-001"
    )
    
    parent_id: Optional[int] = Field(
        None,
        description="Parent department ID for hierarchy support",
        example=None
    )

    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        """
        Validate department code format.
        
        Learning: Custom validators let us add business rules for data validation.
        """
        if v:
            # Convert to uppercase and remove spaces
            v = v.upper().replace(' ', '')
            
            # Check if it contains only alphanumeric characters
            if not v.isalnum():
                raise ValueError('Department code can only contain letters and numbers')
                
        return v

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        """Validate department name."""
        if v:
            # Capitalize first letter of each word
            v = v.strip().title()
            
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Engineering",
                "code": "ENG",
                "description": "Software development, DevOps, and technical infrastructure",
                "monthly_budget": 5000.00,
                "manager_email": "eng-manager@company.com",
                "location": "Tech Building, Floor 3",
                "cost_center": "CC-ENG-001",
                "parent_id": None
            }
        }


class DepartmentUpdate(BaseModel):
    """
    Schema for updating an existing department.
    
    Note: All fields are optional since admins might want to update just one field.
    """
    
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100,
        description="New department name"
    )
    
    code: Optional[str] = Field(
        None,
        min_length=2,
        max_length=10,
        description="New department code"
    )
    
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="New department description"
    )
    
    monthly_budget: Optional[Decimal] = Field(
        None,
        ge=Decimal('0.00'),
        le=Decimal('999999.99'),
        description="New monthly AI usage budget in USD"
    )
    
    manager_email: Optional[str] = Field(
        None,
        max_length=255,
        description="New manager email"
    )
    
    location: Optional[str] = Field(
        None,
        max_length=200,
        description="New department location"
    )
    
    cost_center: Optional[str] = Field(
        None,
        max_length=50,
        description="New cost center code"
    )
    
    parent_id: Optional[int] = Field(
        None,
        description="New parent department ID"
    )

    @field_validator('code')
    @classmethod
    def validate_code(cls, v):
        """Same code validation as create."""
        if v is not None:
            v = v.upper().replace(' ', '')
            if not v.isalnum():
                raise ValueError('Department code can only contain letters and numbers')
        return v

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        """Same name validation as create."""
        if v is not None:
            v = v.strip().title()
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Engineering & Technology",
                "monthly_budget": 6000.00,
                "manager_email": "new-manager@company.com"
            }
        }


# =============================================================================
# DEPARTMENT RESPONSE SCHEMAS (WHAT API SENDS BACK)
# =============================================================================

class DepartmentResponse(BaseModel):
    """
    Schema for department data in API responses.
    
    This defines exactly what department information gets sent back to the client.
    """
    
    id: int
    name: str
    code: str
    description: Optional[str]
    monthly_budget: Decimal
    manager_email: Optional[str]
    location: Optional[str]
    cost_center: Optional[str]
    parent_id: Optional[int]
    
    # Metadata
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    
    # Computed fields (populated by service layer)
    full_path: Optional[str] = None
    user_count: Optional[int] = None
    active_user_count: Optional[int] = None
    monthly_usage: Optional[Decimal] = None
    budget_utilization: Optional[float] = None

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Engineering",
                "code": "ENG",
                "description": "Software development, DevOps, and technical infrastructure",
                "monthly_budget": 5000.00,
                "manager_email": "eng-manager@company.com",
                "location": "Tech Building, Floor 3",
                "cost_center": "CC-ENG-001",
                "parent_id": None,
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-06-01T15:45:00Z",
                "created_by": "admin",
                "full_path": "Engineering",
                "user_count": 45,
                "active_user_count": 42,
                "monthly_usage": 2750.50,
                "budget_utilization": 55.01
            }
        }


class DepartmentWithStats(BaseModel):
    """
    Extended department response with additional statistics.
    
    Learning: Sometimes we need different levels of detail for different API endpoints.
    This schema includes everything from DepartmentResponse plus extra analytics.
    """
    
    # Base department info
    id: int
    name: str
    code: str
    description: Optional[str]
    monthly_budget: Decimal
    manager_email: Optional[str]
    location: Optional[str]
    cost_center: Optional[str]
    parent_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    
    # Statistics
    user_count: int = 0
    active_user_count: int = 0
    admin_user_count: int = 0
    
    # Usage statistics
    monthly_usage: Decimal = Decimal('0.00')
    monthly_requests: int = 0
    monthly_tokens: int = 0
    budget_utilization: float = 0.0
    
    # Hierarchy info
    full_path: str = ""
    children_count: int = 0
    
    # Recent activity
    last_activity_at: Optional[datetime] = None
    active_users_today: int = 0

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Engineering",
                "code": "ENG",
                "description": "Software development, DevOps, and technical infrastructure",
                "monthly_budget": 5000.00,
                "manager_email": "eng-manager@company.com",
                "location": "Tech Building, Floor 3",
                "cost_center": "CC-ENG-001",
                "parent_id": None,
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-06-01T15:45:00Z",
                "created_by": "admin",
                "user_count": 45,
                "active_user_count": 42,
                "admin_user_count": 3,
                "monthly_usage": 2750.50,
                "monthly_requests": 1250,
                "monthly_tokens": 125000,
                "budget_utilization": 55.01,
                "full_path": "Engineering",
                "children_count": 4,
                "last_activity_at": "2024-06-09T14:30:00Z",
                "active_users_today": 12
            }
        }


class DepartmentListResponse(BaseModel):
    """
    Schema for paginated list of departments.
    
    Learning: Same pagination pattern as users - consistent API design.
    """
    
    departments: List[DepartmentWithStats]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_previous_page: bool

    class Config:
        json_schema_extra = {
            "example": {
                "departments": [],  # Would contain DepartmentWithStats objects
                "total_count": 25,
                "page": 1,
                "page_size": 20,
                "total_pages": 2,
                "has_next_page": True,
                "has_previous_page": False
            }
        }


# =============================================================================
# SEARCH AND FILTER SCHEMAS
# =============================================================================

class DepartmentSearchFilters(BaseModel):
    """
    Schema for department search and filtering parameters.
    """
    
    # Text search
    search_query: Optional[str] = Field(
        None,
        description="Search in name, code, and description fields",
        example="eng"
    )
    
    # Filter by hierarchy
    parent_id: Optional[int] = Field(
        None,
        description="Filter by parent department ID (use 0 for top-level departments)"
    )
    
    # Filter by budget range
    min_budget: Optional[Decimal] = Field(
        None,
        ge=Decimal('0.00'),
        description="Filter departments with budget >= this amount"
    )
    
    max_budget: Optional[Decimal] = Field(
        None,
        ge=Decimal('0.00'),
        description="Filter departments with budget <= this amount"
    )
    
    # Filter by usage
    min_utilization: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Filter departments with budget utilization >= this percentage"
    )
    
    max_utilization: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Filter departments with budget utilization <= this percentage"
    )
    
    # Date range filters
    created_after: Optional[datetime] = Field(
        None,
        description="Filter departments created after this date"
    )
    
    created_before: Optional[datetime] = Field(
        None,
        description="Filter departments created before this date"
    )
    
    # Pagination
    page: int = Field(
        1,
        ge=1,
        description="Page number for pagination"
    )
    
    page_size: int = Field(
        20,
        ge=1,
        le=100,
        description="Number of departments per page"
    )
    
    # Sorting
    sort_by: Optional[str] = Field(
        "name",
        description="Field to sort by",
        example="name"
    )
    
    sort_order: Optional[str] = Field(
        "asc",
        description="Sort order: 'asc' or 'desc'",
        example="asc"
    )

    @field_validator('sort_order')
    @classmethod
    def validate_sort_order(cls, v):
        """Ensure sort order is valid."""
        if v is not None and v.lower() not in ['asc', 'desc']:
            raise ValueError("sort_order must be 'asc' or 'desc'")
        return v.lower() if v else v

    class Config:
        json_schema_extra = {
            "example": {
                "search_query": "eng",
                "min_budget": 1000.00,
                "max_budget": 10000.00,
                "page": 1,
                "page_size": 20,
                "sort_by": "name",
                "sort_order": "asc"
            }
        }


# =============================================================================
# SPECIALIZED OPERATION SCHEMAS
# =============================================================================

class DepartmentBudgetUpdate(BaseModel):
    """
    Schema specifically for budget updates.
    
    Learning: Separate schemas for specific operations provide better validation.
    """
    
    monthly_budget: Decimal = Field(
        ...,
        ge=Decimal('0.00'),
        le=Decimal('999999.99'),
        description="New monthly budget amount"
    )
    
    reason: Optional[str] = Field(
        None,
        max_length=200,
        description="Reason for budget change (for audit trail)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "monthly_budget": 7500.00,
                "reason": "Increased team size and AI usage requirements"
            }
        }


class DepartmentBulkAction(BaseModel):
    """
    Schema for bulk operations on multiple departments.
    """
    
    department_ids: List[int] = Field(
        ...,
        description="List of department IDs to perform action on",
        example=[1, 2, 3]
    )
    
    action: str = Field(
        ...,
        description="Action to perform: 'activate', 'deactivate', 'delete'",
        example="activate"
    )

    @field_validator('action')
    @classmethod
    def validate_action(cls, v):
        """Validate action is allowed."""
        allowed_actions = ['activate', 'deactivate', 'delete']
        if v not in allowed_actions:
            raise ValueError(f'Action must be one of: {", ".join(allowed_actions)}')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "department_ids": [1, 2, 3],
                "action": "activate"
            }
        }


# =============================================================================
# UTILITY SCHEMAS
# =============================================================================

class DepartmentDropdownOption(BaseModel):
    """
    Simple schema for department dropdown options.
    
    Learning: Sometimes we need very simple data structures for UI components.
    """
    
    value: int = Field(description="Department ID")
    label: str = Field(description="Department display name")
    code: Optional[str] = Field(description="Department code")

    class Config:
        json_schema_extra = {
            "example": {
                "value": 1,
                "label": "Engineering",
                "code": "ENG"
            }
        }


class DepartmentHierarchy(BaseModel):
    """
    Schema for department hierarchy visualization.
    """
    
    id: int
    name: str
    code: str
    level: int = Field(description="Hierarchy level (0 = top level)")
    parent_id: Optional[int]
    children: List['DepartmentHierarchy'] = Field(default_factory=list)
    user_count: int = 0
    total_budget: Decimal = Decimal('0.00')

    class Config:
        from_attributes = True


# Enable forward references for recursive models
DepartmentHierarchy.update_forward_refs()


# =============================================================================
# SUCCESS AND ERROR RESPONSES
# =============================================================================

class DepartmentOperationResponse(BaseModel):
    """
    Response schema for department operations.
    """
    
    success: bool = True
    message: str
    department: Optional[DepartmentResponse] = None
    affected_users: Optional[int] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Department created successfully",
                "department": None,  # Would contain DepartmentResponse
                "affected_users": 0
            }
        }


class DepartmentInitializationResponse(BaseModel):
    """
    Response schema for default department initialization.
    """
    
    success: bool = True
    message: str
    created_count: int
    skipped_count: int
    total_departments: int
    created_departments: List[str] = Field(description="Names of created departments")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Default departments initialization completed",
                "created_count": 5,
                "skipped_count": 0,
                "total_departments": 5,
                "created_departments": ["Engineering", "Sales", "Marketing", "HR", "Finance"]
            }
        }
