"""
Pydantic schemas for data validation.

This package contains all the data models that define:
- What data our API endpoints expect (requests)
- What data our API endpoints return (responses)
- Validation rules for all data

Think of schemas as "contracts" between frontend and backend.
"""

# Import all schemas for easy access
from .auth import *
from .admin import *
from .llm_config import (
    LLMProviderSchema,
    LLMConfigurationCreate,
    LLMConfigurationUpdate,
    LLMConfigurationResponse,
    LLMConfigurationSummary,
    LLMConfigurationTest,
    LLMConfigurationTestResult,
    LLMProviderInfo,
    get_provider_info_list
)
from .quota import (
    QuotaCreateRequest,
    QuotaUpdateRequest,
    QuotaFilterRequest,
    QuotaResponse,
    QuotaListResponse,
    DepartmentQuotaStatusResponse,
    QuotaResetResponse,
    BulkQuotaOperationResponse,
    QuotaErrorResponse,
    ValidationErrorResponse,
    convert_quota_to_response
)
from .department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentWithStats,
    DepartmentListResponse,
    DepartmentSearchFilters,
    DepartmentBudgetUpdate,
    DepartmentBulkAction,
    DepartmentDropdownOption,
    DepartmentHierarchy,
    DepartmentOperationResponse,
    DepartmentInitializationResponse
)

__all__ = [
    # Auth schemas
    "UserLogin",
    "UserResponse", 
    "Token",
    "TokenResponse",
    
    # Admin schemas
    "UserCreateRequest",
    "UserUpdateRequest",
    "UserStatsResponse",
    "RoleResponse",
    "DepartmentResponse",
    
    # LLM Configuration schemas
    "LLMProviderSchema",
    "LLMConfigurationCreate",
    "LLMConfigurationUpdate",
    "LLMConfigurationResponse",
    "LLMConfigurationSummary",
    "LLMConfigurationTest",
    "LLMConfigurationTestResult",
    "LLMProviderInfo",
    "get_provider_info_list",
    
    # Quota schemas
    "QuotaCreateRequest",
    "QuotaUpdateRequest",
    "QuotaFilterRequest",
    "QuotaResponse",
    "QuotaListResponse",
    "DepartmentQuotaStatusResponse",
    "QuotaResetResponse",
    "BulkQuotaOperationResponse",
    "QuotaErrorResponse",
    "ValidationErrorResponse",
    "convert_quota_to_response",
    
    # Department schemas
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "DepartmentWithStats",
    "DepartmentListResponse",
    "DepartmentSearchFilters",
    "DepartmentBudgetUpdate",
    "DepartmentBulkAction",
    "DepartmentDropdownOption",
    "DepartmentHierarchy",
    "DepartmentOperationResponse",
    "DepartmentInitializationResponse",
]
