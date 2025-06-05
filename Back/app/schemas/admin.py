# AI Dock Admin Schemas
# These define the structure for admin API requests and responses

from pydantic import BaseModel, EmailStr, validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# =============================================================================
# USER MANAGEMENT SCHEMAS
# =============================================================================

class UserCreateRequest(BaseModel):
    """
    Schema for creating a new user through admin interface.
    
    This defines exactly what data an admin must provide to create a user.
    Pydantic will automatically validate this data and return helpful errors.
    """
    
    # Required fields for creating a user
    email: EmailStr = Field(
        ...,  # ... means required field
        description="User's email address (must be valid email format)",
        example="john.doe@company.com"
    )
    
    username: str = Field(
        ..., 
        min_length=3,
        max_length=50,
        description="Unique username for the user",
        example="john.doe"
    )
    
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="User's full display name",
        example="John Doe"
    )
    
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="User's initial password (will be hashed)",
        example="SecurePassword123!"
    )
    
    role_id: int = Field(
        ...,
        description="ID of the role to assign to this user",
        example=2
    )
    
    # Optional fields
    department_id: Optional[int] = Field(
        None,
        description="ID of the department to assign user to (optional)",
        example=1
    )
    
    job_title: Optional[str] = Field(
        None,
        max_length=100,
        description="User's job title or position",
        example="Senior Developer"
    )
    
    is_active: bool = Field(
        True,
        description="Whether the user account should be active",
        example=True
    )
    
    is_admin: bool = Field(
        False,
        description="Whether the user should have admin privileges",
        example=False
    )
    
    bio: Optional[str] = Field(
        None,
        max_length=500,
        description="Brief bio or description of the user",
        example="Experienced full-stack developer with expertise in Python and React"
    )

    @validator('username')
    def validate_username(cls, v):
        """
        Custom validation for username format.
        
        Learning: Pydantic validators let us add custom validation logic
        beyond basic type checking.
        """
        if not v.replace('_', '').replace('-', '').replace('.', '').isalnum():
            raise ValueError('Username can only contain letters, numbers, hyphens, underscores, and dots')
        return v.lower()  # Store usernames in lowercase
    
    @validator('password')
    def validate_password_strength(cls, v):
        """
        Validate password meets security requirements.
        
        Learning: This shows how to implement business rules in schemas.
        """
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        # Check for at least one uppercase, lowercase, and digit
        has_upper = any(c.isupper() for c in v)
        has_lower = any(c.islower() for c in v)
        has_digit = any(c.isdigit() for c in v)
        
        if not (has_upper and has_lower and has_digit):
            raise ValueError('Password must contain at least one uppercase letter, one lowercase letter, and one number')
        
        return v

    class Config:
        """
        Pydantic configuration for this schema.
        
        Learning: Config classes let us customize how Pydantic behaves.
        """
        # Generate example JSON for API documentation
        schema_extra = {
            "example": {
                "email": "jane.smith@company.com",
                "username": "jane.smith",
                "full_name": "Jane Smith",
                "password": "SecurePass123!",
                "role_id": 2,
                "department_id": 1,
                "job_title": "Senior Data Analyst",
                "is_active": True,
                "is_admin": False,
                "bio": "Data analyst with 5 years experience in business intelligence"
            }
        }


class UserUpdateRequest(BaseModel):
    """
    Schema for updating an existing user.
    
    Note: All fields are optional since admins might want to update just one field.
    The API will only update fields that are provided.
    """
    
    # All fields are optional for updates
    email: Optional[EmailStr] = Field(
        None,
        description="New email address for the user"
    )
    
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=50,
        description="New username for the user"
    )
    
    full_name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100,
        description="New full name for the user"
    )
    
    role_id: Optional[int] = Field(
        None,
        description="New role ID to assign to the user"
    )
    
    department_id: Optional[int] = Field(
        None,
        description="New department ID to assign to the user"
    )
    
    job_title: Optional[str] = Field(
        None,
        max_length=100,
        description="New job title for the user"
    )
    
    is_active: Optional[bool] = Field(
        None,
        description="Whether the user account should be active"
    )
    
    is_admin: Optional[bool] = Field(
        None,
        description="Whether the user should have admin privileges"
    )
    
    bio: Optional[str] = Field(
        None,
        max_length=500,
        description="New bio for the user"
    )
    
    # Note: We don't allow password updates here for security
    # Password changes should go through a separate endpoint

    @validator('username')
    def validate_username(cls, v):
        """Same username validation as create."""
        if v is not None:
            if not v.replace('_', '').replace('-', '').replace('.', '').isalnum():
                raise ValueError('Username can only contain letters, numbers, hyphens, underscores, and dots')
            return v.lower()
        return v

    class Config:
        schema_extra = {
            "example": {
                "full_name": "Jane Smith-Johnson",
                "job_title": "Senior Data Analyst",
                "department_id": 2,
                "is_active": True
            }
        }


class UserPasswordUpdate(BaseModel):
    """
    Separate schema for password updates (more secure).
    
    Learning: Separating password updates is a security best practice.
    It allows different permissions and logging for password changes.
    """
    
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New password for the user"
    )
    
    # Optional: Require admin to provide their own password for confirmation
    admin_password_confirmation: Optional[str] = Field(
        None,
        description="Admin's password for additional security verification"
    )

    @validator('new_password')
    def validate_password_strength(cls, v):
        """Same password validation as create."""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        has_upper = any(c.isupper() for c in v)
        has_lower = any(c.islower() for c in v)
        has_digit = any(c.isdigit() for c in v)
        
        if not (has_upper and has_lower and has_digit):
            raise ValueError('Password must contain at least one uppercase letter, one lowercase letter, and one number')
        
        return v


# =============================================================================
# RESPONSE SCHEMAS (WHAT THE API SENDS BACK)
# =============================================================================

class UserResponse(BaseModel):
    """
    Schema for user data in API responses.
    
    This defines exactly what user information gets sent back to the client.
    Notice we NEVER include the password hash for security!
    """
    
    id: int
    email: str
    username: str
    full_name: Optional[str]
    job_title: Optional[str]
    is_active: bool
    is_admin: bool
    is_verified: bool
    bio: Optional[str]
    
    # Foreign key IDs
    role_id: int
    department_id: Optional[int]
    
    # Related object information (populated by the service layer)
    role_name: Optional[str] = None
    department_name: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]
    
    # Computed fields
    display_name: Optional[str] = None
    account_age_days: Optional[int] = None

    class Config:
        """
        Allow the schema to work with SQLAlchemy models.
        
        Learning: orm_mode=True tells Pydantic to read data from object attributes
        instead of just dictionaries. This lets us pass User model objects directly.
        """
        orm_mode = True
        schema_extra = {
            "example": {
                "id": 1,
                "email": "jane.smith@company.com",
                "username": "jane.smith",
                "full_name": "Jane Smith",
                "job_title": "Senior Data Analyst",
                "is_active": True,
                "is_admin": False,
                "is_verified": True,
                "bio": "Data analyst with 5 years experience",
                "role_id": 2,
                "department_id": 1,
                "role_name": "Standard User",
                "department_name": "Engineering",
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-06-01T15:45:00Z",
                "last_login_at": "2024-06-03T09:15:00Z",
                "display_name": "Jane Smith",
                "account_age_days": 139
            }
        }


class UserListResponse(BaseModel):
    """
    Schema for paginated list of users.
    
    Learning: Pagination is essential for large datasets. Instead of returning
    all 10,000 users at once, we return them in chunks with navigation info.
    """
    
    users: List[UserResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_previous_page: bool

    class Config:
        schema_extra = {
            "example": {
                "users": [
                    # Would contain UserResponse objects
                ],
                "total_count": 150,
                "page": 1,
                "page_size": 20,
                "total_pages": 8,
                "has_next_page": True,
                "has_previous_page": False
            }
        }


# =============================================================================
# SEARCH AND FILTER SCHEMAS
# =============================================================================

class UserSearchFilters(BaseModel):
    """
    Schema for user search and filtering parameters.
    
    Learning: This shows how to handle complex search queries with multiple filters.
    All fields are optional so users can mix and match filters.
    """
    
    # Text search
    search_query: Optional[str] = Field(
        None,
        description="Search in username, full_name, and email fields",
        example="john"
    )
    
    # Filter by role
    role_id: Optional[int] = Field(
        None,
        description="Filter by specific role ID"
    )
    
    role_name: Optional[str] = Field(
        None,
        description="Filter by role name (admin, user, etc.)"
    )
    
    # Filter by department
    department_id: Optional[int] = Field(
        None,
        description="Filter by specific department ID"
    )
    
    department_name: Optional[str] = Field(
        None,
        description="Filter by department name"
    )
    
    # Filter by status
    is_active: Optional[bool] = Field(
        None,
        description="Filter by active/inactive status"
    )
    
    is_admin: Optional[bool] = Field(
        None,
        description="Filter by admin status"
    )
    
    is_verified: Optional[bool] = Field(
        None,
        description="Filter by verification status"
    )
    
    # Date range filters
    created_after: Optional[datetime] = Field(
        None,
        description="Filter users created after this date"
    )
    
    created_before: Optional[datetime] = Field(
        None,
        description="Filter users created before this date"
    )
    
    # Pagination
    page: int = Field(
        1,
        ge=1,  # Greater than or equal to 1
        description="Page number for pagination"
    )
    
    page_size: int = Field(
        20,
        ge=1,
        le=100,  # Maximum 100 items per page
        description="Number of users per page"
    )
    
    # Sorting
    sort_by: Optional[str] = Field(
        "created_at",
        description="Field to sort by",
        example="username"
    )
    
    sort_order: Optional[str] = Field(
        "desc",
        description="Sort order: 'asc' or 'desc'",
        example="asc"
    )

    @validator('sort_order')
    def validate_sort_order(cls, v):
        """Ensure sort order is valid."""
        if v is not None and v.lower() not in ['asc', 'desc']:
            raise ValueError("sort_order must be 'asc' or 'desc'")
        return v.lower() if v else v

    class Config:
        schema_extra = {
            "example": {
                "search_query": "john",
                "role_name": "user",
                "department_name": "Engineering",
                "is_active": True,
                "page": 1,
                "page_size": 20,
                "sort_by": "username",
                "sort_order": "asc"
            }
        }


# =============================================================================
# BULK OPERATIONS SCHEMAS
# =============================================================================

class BulkUserAction(str, Enum):
    """
    Enum for bulk actions that can be performed on multiple users.
    
    Learning: Enums prevent typos and make APIs more predictable.
    """
    ACTIVATE = "activate"
    DEACTIVATE = "deactivate"
    DELETE = "delete"
    CHANGE_ROLE = "change_role"
    CHANGE_DEPARTMENT = "change_department"


class BulkUserOperation(BaseModel):
    """
    Schema for bulk operations on multiple users.
    
    Learning: Bulk operations are efficient for mass changes.
    """
    
    user_ids: List[int] = Field(
        ...,
        description="List of user IDs to perform action on",
        example=[1, 2, 3, 4, 5]
    )
    
    action: BulkUserAction = Field(
        ...,
        description="Action to perform on the selected users"
    )
    
    # Optional parameters based on action
    new_role_id: Optional[int] = Field(
        None,
        description="New role ID (required for change_role action)"
    )
    
    new_department_id: Optional[int] = Field(
        None,
        description="New department ID (required for change_department action)"
    )

    @validator('new_role_id')
    def validate_role_for_change_role(cls, v, values):
        """Ensure role_id is provided for change_role action."""
        if values.get('action') == BulkUserAction.CHANGE_ROLE and v is None:
            raise ValueError('new_role_id is required for change_role action')
        return v

    @validator('new_department_id')
    def validate_department_for_change_department(cls, v, values):
        """Ensure department_id is provided for change_department action."""
        if values.get('action') == BulkUserAction.CHANGE_DEPARTMENT and v is None:
            raise ValueError('new_department_id is required for change_department action')
        return v


class BulkOperationResult(BaseModel):
    """
    Schema for bulk operation results.
    
    Learning: Always provide detailed feedback for bulk operations
    so admins know what succeeded and what failed.
    """
    
    total_requested: int = Field(
        description="Total number of users in the operation"
    )
    
    successful_count: int = Field(
        description="Number of users successfully processed"
    )
    
    failed_count: int = Field(
        description="Number of users that failed to process"
    )
    
    successful_user_ids: List[int] = Field(
        description="IDs of users that were successfully processed"
    )
    
    failed_operations: List[Dict[str, Any]] = Field(
        description="Details of failed operations"
    )
    
    summary_message: str = Field(
        description="Human-readable summary of the operation"
    )

    class Config:
        schema_extra = {
            "example": {
                "total_requested": 5,
                "successful_count": 4,
                "failed_count": 1,
                "successful_user_ids": [1, 2, 3, 4],
                "failed_operations": [
                    {
                        "user_id": 5,
                        "error": "User not found"
                    }
                ],
                "summary_message": "Successfully activated 4 out of 5 users. 1 user failed: User not found."
            }
        }


# =============================================================================
# COMMON RESPONSE SCHEMAS
# =============================================================================

class SuccessResponse(BaseModel):
    """
    Generic success response schema.
    
    Learning: Consistent response format makes APIs easier to use.
    """
    
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "message": "User created successfully",
                "data": {
                    "user_id": 123
                }
            }
        }


class ErrorResponse(BaseModel):
    """
    Generic error response schema.
    
    Learning: Consistent error format helps frontend developers
    handle errors gracefully.
    """
    
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "success": False,
                "error": "User with this email already exists",
                "details": {
                    "field": "email",
                    "provided_value": "john@company.com"
                },
                "error_code": "DUPLICATE_EMAIL"
            }
        }


# =============================================================================
# STATISTICS AND DASHBOARD SCHEMAS
# =============================================================================

class UserStatsResponse(BaseModel):
    """
    Schema for user statistics (admin dashboard).
    
    Learning: Dashboard APIs often need aggregated statistics
    rather than detailed user data.
    """
    
    total_users: int
    active_users: int
    inactive_users: int
    admin_users: int
    verified_users: int
    unverified_users: int
    new_users_this_week: int
    new_users_this_month: int
    
    # Users by role
    users_by_role: Dict[str, int] = Field(
        description="Count of users grouped by role name"
    )
    
    # Users by department  
    users_by_department: Dict[str, int] = Field(
        description="Count of users grouped by department name"
    )
    
    # Recent activity
    recent_logins_count: int = Field(
        description="Number of users who logged in within last 7 days"
    )

    class Config:
        schema_extra = {
            "example": {
                "total_users": 150,
                "active_users": 142,
                "inactive_users": 8,
                "admin_users": 5,
                "verified_users": 145,
                "unverified_users": 5,
                "new_users_this_week": 3,
                "new_users_this_month": 12,
                "users_by_role": {
                    "admin": 5,
                    "manager": 15,
                    "user": 125,
                    "guest": 5
                },
                "users_by_department": {
                    "Engineering": 80,
                    "Sales": 25,
                    "Marketing": 20,
                    "HR": 15,
                    "Finance": 10
                },
                "recent_logins_count": 95
            }
        }
