# AI Dock Quota API Schemas
# Pydantic models for quota-related API requests and responses

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime
from enum import Enum

from ..models.quota import QuotaType, QuotaPeriod, QuotaStatus

# =============================================================================
# REQUEST SCHEMAS - WHAT CLIENTS SEND TO THE API
# =============================================================================

class QuotaCreateRequest(BaseModel):
    """
    Schema for creating a new department quota.
    
    This defines what data is required when an admin wants to create
    a new quota through the API.
    """
    
    department_id: int = Field(
        ..., 
        description="ID of the department this quota applies to",
        gt=0
    )
    
    llm_config_id: Optional[int] = Field(
        None,
        description="ID of LLM configuration (null for all providers)",
        gt=0
    )
    
    quota_type: QuotaType = Field(
        ...,
        description="Type of quota: cost, tokens, or requests"
    )
    
    quota_period: QuotaPeriod = Field(
        ...,
        description="Reset period: daily, weekly, monthly, or yearly"
    )
    
    limit_value: Decimal = Field(
        ...,
        description="The quota limit amount",
        gt=0,
        max_digits=15,
        decimal_places=4
    )
    
    name: str = Field(
        ...,
        description="Human-readable name for this quota",
        min_length=1,
        max_length=200
    )
    
    description: Optional[str] = Field(
        None,
        description="Optional description of the quota purpose",
        max_length=500
    )
    
    is_enforced: bool = Field(
        True,
        description="Whether to enforce this quota (block requests when exceeded)"
    )
    
    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v):
        """Ensure name is not just whitespace"""
        if not v or not v.strip():
            raise ValueError('Name cannot be empty or whitespace')
        return v.strip()
    
    class Config:
        json_schema_extra = {
            "example": {
                "department_id": 1,
                "llm_config_id": 1,
                "quota_type": "cost",
                "quota_period": "monthly",
                "limit_value": 1000.00,
                "name": "Engineering OpenAI Monthly Budget",
                "description": "Monthly spending limit for Engineering on OpenAI GPT-4",
                "is_enforced": True
            }
        }

class QuotaUpdateRequest(BaseModel):
    """
    Schema for updating an existing quota.
    
    All fields are optional so admins can update just what they need.
    """
    
    limit_value: Optional[Decimal] = Field(
        None,
        description="New quota limit amount",
        gt=0,
        max_digits=15,
        decimal_places=4
    )
    
    name: Optional[str] = Field(
        None,
        description="New quota name",
        min_length=1,
        max_length=200
    )
    
    description: Optional[str] = Field(
        None,
        description="New quota description",
        max_length=500
    )
    
    is_enforced: Optional[bool] = Field(
        None,
        description="Whether to enforce this quota"
    )
    
    status: Optional[QuotaStatus] = Field(
        None,
        description="New quota status"
    )
    
    quota_period: Optional[QuotaPeriod] = Field(
        None,
        description="New reset period"
    )
    
    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v):
        """Ensure name is not just whitespace if provided"""
        if v is not None and (not v or not v.strip()):
            raise ValueError('Name cannot be empty or whitespace')
        return v.strip() if v else v
    
    class Config:
        json_schema_extra = {
            "example": {
                "limit_value": 1500.00,
                "name": "Engineering OpenAI Monthly Budget (Updated)",
                "is_enforced": True
            }
        }

class QuotaFilterRequest(BaseModel):
    """
    Schema for filtering quotas in list requests.
    
    This allows admins to search and filter quotas by various criteria.
    """
    
    department_id: Optional[int] = Field(
        None,
        description="Filter by department ID",
        gt=0
    )
    
    llm_config_id: Optional[int] = Field(
        None,
        description="Filter by LLM configuration ID",
        gt=0
    )
    
    quota_type: Optional[QuotaType] = Field(
        None,
        description="Filter by quota type"
    )
    
    quota_period: Optional[QuotaPeriod] = Field(
        None,
        description="Filter by reset period"
    )
    
    status: Optional[QuotaStatus] = Field(
        None,
        description="Filter by quota status"
    )
    
    is_enforced: Optional[bool] = Field(
        None,
        description="Filter by enforcement status"
    )
    
    is_exceeded: Optional[bool] = Field(
        None,
        description="Filter by whether quota is exceeded"
    )
    
    search: Optional[str] = Field(
        None,
        description="Search in quota names and descriptions",
        max_length=100
    )
    
    # Pagination
    page: int = Field(
        1,
        description="Page number (1-based)",
        ge=1
    )
    
    page_size: int = Field(
        20,
        description="Number of items per page",
        ge=1,
        le=100
    )
    
    # Sorting
    sort_by: Optional[str] = Field(
        "name",
        description="Field to sort by: name, created_at, limit_value, usage_percentage"
    )
    
    sort_order: Optional[str] = Field(
        "asc",
        description="Sort order: asc or desc"
    )
    
    @field_validator('sort_by')
    @classmethod
    def validate_sort_field(cls, v):
        """Ensure sort field is valid"""
        allowed_fields = {'name', 'created_at', 'limit_value', 'usage_percentage', 'department_name'}
        if v and v not in allowed_fields:
            raise ValueError(f'Sort field must be one of: {", ".join(allowed_fields)}')
        return v
    
    @field_validator('sort_order')
    @classmethod
    def validate_sort_order(cls, v):
        """Ensure sort order is valid"""
        if v and v.lower() not in ['asc', 'desc']:
            raise ValueError('Sort order must be "asc" or "desc"')
        return v.lower() if v else v

# =============================================================================
# RESPONSE SCHEMAS - WHAT THE API SENDS BACK TO CLIENTS
# =============================================================================

class QuotaResponse(BaseModel):
    """
    Schema for quota information in API responses.
    
    This is the standardized format for returning quota data.
    """
    
    id: int
    department_id: int
    department_name: Optional[str] = None
    llm_config_id: Optional[int] = None
    llm_config_name: Optional[str] = None
    
    quota_type: str
    quota_period: str
    
    limit_value: float
    current_usage: float
    remaining_quota: float
    usage_percentage: float
    
    status: str
    is_enforced: bool
    is_exceeded: bool
    is_near_limit: bool
    
    name: str
    description: Optional[str] = None
    
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    next_reset_at: Optional[datetime] = None
    
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "department_id": 1,
                "department_name": "Engineering",
                "llm_config_id": 1,
                "llm_config_name": "OpenAI GPT-4",
                "quota_type": "cost",
                "quota_period": "monthly",
                "limit_value": 1000.00,
                "current_usage": 750.50,
                "remaining_quota": 249.50,
                "usage_percentage": 75.05,
                "status": "active",
                "is_enforced": True,
                "is_exceeded": False,
                "is_near_limit": True,
                "name": "Engineering OpenAI Monthly Budget",
                "description": "Monthly spending limit for Engineering on OpenAI GPT-4",
                "period_start": "2024-06-01T00:00:00Z",
                "period_end": "2024-07-01T00:00:00Z",
                "next_reset_at": "2024-07-01T00:00:00Z",
                "created_by": "admin@company.com",
                "created_at": "2024-05-15T10:30:00Z",
                "updated_at": "2024-06-05T14:20:00Z"
            }
        }

class QuotaListResponse(BaseModel):
    """
    Schema for paginated list of quotas.
    
    This provides both the quota data and pagination metadata.
    """
    
    quotas: List[QuotaResponse]
    
    # Pagination metadata
    total_count: int = Field(description="Total number of quotas matching filters")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Number of items per page")
    total_pages: int = Field(description="Total number of pages")
    has_next: bool = Field(description="Whether there are more pages")
    has_previous: bool = Field(description="Whether there are previous pages")
    
    # Summary statistics
    summary: Dict[str, Any] = Field(description="Summary statistics about the quotas")
    
    class Config:
        json_schema_extra = {
            "example": {
                "quotas": [
                    # QuotaResponse examples would go here
                ],
                "total_count": 45,
                "page": 1,
                "page_size": 20,
                "total_pages": 3,
                "has_next": True,
                "has_previous": False,
                "summary": {
                    "total_quotas": 45,
                    "active_quotas": 42,
                    "exceeded_quotas": 3,
                    "near_limit_quotas": 8,
                    "total_monthly_cost_limit": 25000.00,
                    "total_monthly_cost_used": 18750.50
                }
            }
        }

class DepartmentQuotaStatusResponse(BaseModel):
    """
    Schema for comprehensive department quota status.
    
    This provides a complete overview of all quotas for a department.
    """
    
    department_id: int
    department_name: Optional[str] = None
    last_updated: datetime
    
    overall_status: str = Field(description="Overall status: healthy, warning, exceeded, no_quotas")
    
    # Quota counts
    total_quotas: int
    active_quotas: int
    exceeded_quotas: int
    near_limit_quotas: int
    suspended_quotas: int
    inactive_quotas: int
    
    # Aggregated data by quota type
    quotas_by_type: Dict[str, Dict[str, float]] = Field(
        description="Quota statistics grouped by type (cost, tokens, requests)"
    )
    
    # Individual quota details
    quotas: List[QuotaResponse]
    
    class Config:
        json_schema_extra = {
            "example": {
                "department_id": 1,
                "department_name": "Engineering",
                "last_updated": "2024-06-06T15:30:00Z",
                "overall_status": "warning",
                "total_quotas": 5,
                "active_quotas": 5,
                "exceeded_quotas": 0,
                "near_limit_quotas": 2,
                "suspended_quotas": 0,
                "inactive_quotas": 0,
                "quotas_by_type": {
                    "cost": {
                        "count": 3,
                        "total_limit": 5000.00,
                        "total_usage": 3750.25
                    },
                    "tokens": {
                        "count": 1,
                        "total_limit": 100000,
                        "total_usage": 75000
                    },
                    "requests": {
                        "count": 1,
                        "total_limit": 1000,
                        "total_usage": 850
                    }
                },
                "quotas": []
            }
        }

class QuotaResetResponse(BaseModel):
    """Schema for quota reset operation response"""
    
    success: bool
    message: str
    quota_id: int
    quota_name: str
    reset_at: datetime
    previous_usage: float
    new_usage: float = 0.0
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Quota reset successfully",
                "quota_id": 1,
                "quota_name": "Engineering OpenAI Monthly Budget",
                "reset_at": "2024-06-06T15:45:00Z",
                "previous_usage": 750.50,
                "new_usage": 0.0
            }
        }

class BulkQuotaOperationResponse(BaseModel):
    """Schema for bulk operations on multiple quotas"""
    
    success: bool
    message: str
    total_requested: int
    successful_operations: int
    failed_operations: int
    results: List[Dict[str, Any]]
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Bulk operation completed",
                "total_requested": 5,
                "successful_operations": 4,
                "failed_operations": 1,
                "results": [
                    {"quota_id": 1, "success": True, "message": "Reset successful"},
                    {"quota_id": 2, "success": True, "message": "Reset successful"},
                    {"quota_id": 3, "success": False, "message": "Quota not found"},
                    {"quota_id": 4, "success": True, "message": "Reset successful"},
                    {"quota_id": 5, "success": True, "message": "Reset successful"}
                ]
            }
        }

# =============================================================================
# ERROR RESPONSE SCHEMAS
# =============================================================================

class QuotaErrorResponse(BaseModel):
    """Schema for quota-related error responses"""
    
    error: str = Field(description="Error type")
    message: str = Field(description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(description="When the error occurred")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": "quota_not_found",
                "message": "Quota with ID 123 not found",
                "details": {
                    "requested_id": 123,
                    "available_quotas": [1, 2, 3, 4, 5]
                },
                "timestamp": "2024-06-06T15:30:00Z"
            }
        }

class ValidationErrorResponse(BaseModel):
    """Schema for validation error responses"""
    
    error: str = "validation_error"
    message: str = Field(description="Validation error message")
    field_errors: Dict[str, List[str]] = Field(description="Field-specific validation errors")
    timestamp: datetime = Field(description="When the error occurred")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": "validation_error",
                "message": "Request validation failed",
                "field_errors": {
                    "limit_value": ["must be greater than 0"],
                    "name": ["field required"]
                },
                "timestamp": "2024-06-06T15:30:00Z"
            }
        }

# =============================================================================
# UTILITY FUNCTIONS FOR SCHEMA CONVERSION
# =============================================================================

def convert_quota_to_response(quota, department_name: str = None, llm_config_name: str = None) -> QuotaResponse:
    """
    Convert a DepartmentQuota model instance to a QuotaResponse schema.
    
    Args:
        quota: DepartmentQuota model instance
        department_name: Optional department name
        llm_config_name: Optional LLM configuration name
        
    Returns:
        QuotaResponse with all computed fields
    """
    return QuotaResponse(
        id=quota.id,
        department_id=quota.department_id,
        department_name=department_name or (quota.department.name if hasattr(quota, 'department') and quota.department else None),
        llm_config_id=quota.llm_config_id,
        llm_config_name=llm_config_name or (quota.llm_config.name if hasattr(quota, 'llm_config') and quota.llm_config else "All Providers"),
        quota_type=quota.quota_type.value,
        quota_period=quota.quota_period.value,
        limit_value=float(quota.limit_value),
        current_usage=float(quota.current_usage),
        remaining_quota=float(quota.get_remaining_quota()),
        usage_percentage=quota.get_usage_percentage(),
        status=quota.status.value,
        is_enforced=quota.is_enforced,
        is_exceeded=quota.is_exceeded(),
        is_near_limit=quota.is_near_limit(),
        name=quota.name,
        description=quota.description,
        period_start=quota.period_start,
        period_end=quota.period_end,
        next_reset_at=quota.next_reset_at,
        created_by=quota.created_by,
        created_at=quota.created_at,
        updated_at=quota.updated_at
    )
