# AI Dock Manager Quota Management API
# Department-scoped quota management endpoints for department managers

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.quota import QuotaType, QuotaPeriod, QuotaStatus
from ...models.role import PermissionConstants
from ...services.manager_service import get_manager_service, ManagerService
from ...schemas.quota import (
    QuotaCreateRequest, QuotaUpdateRequest, QuotaResponse,
    convert_quota_to_response
)

# Set up logging
logger = logging.getLogger(__name__)

# Create router for manager quota management endpoints
# prefix="/quotas" means all endpoints start with /manager/quotas/
router = APIRouter(prefix="/quotas", tags=["Manager - Quota Management"])

# =============================================================================
# DEPENDENCY FUNCTIONS
# =============================================================================

def get_manager_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensure the current user is a manager with proper permissions.
    
    This dependency validates that:
    1. User is active
    2. User has manager role 
    3. User is assigned to a department
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        User object if they are a valid manager
        
    Raises:
        HTTPException: 403 if user is not a valid manager
        
    Learning: Reusing the same dependency pattern ensures
    consistent security validation across all manager endpoints.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated"
        )
    
    if not current_user.role or current_user.role.name != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager role required for this operation"
        )
    
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager must be assigned to a department"
        )
    
    return current_user

def get_manager_service_dep(db: Session = Depends(get_db)) -> ManagerService:
    """Get a ManagerService instance via dependency injection"""
    return get_manager_service(db)

# =============================================================================
# QUOTA LISTING AND SEARCH ENDPOINTS
# =============================================================================

@router.get(
    "/",
    response_model=Dict[str, Any],
    summary="List Department Quotas",
    description="Get quotas for the manager's department with filtering and pagination"
)
async def list_department_quotas(
    # Filtering parameters
    quota_type: Optional[QuotaType] = Query(None, description="Filter by quota type"),
    quota_period: Optional[QuotaPeriod] = Query(None, description="Filter by quota period"),
    status: Optional[QuotaStatus] = Query(None, description="Filter by quota status"),
    is_exceeded: Optional[bool] = Query(None, description="Filter by exceeded status"),
    
    # Pagination parameters
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    
    # Dependencies
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Get quotas for the manager's department with filtering and pagination.
    
    **Manager Permissions Required:** `can_view_department_usage`
    
    **Department Scoping:** Only returns quotas from the manager's department
    
    **Query Parameters:**
    - quota_type: Filter by type (cost, tokens, requests)
    - quota_period: Filter by period (daily, weekly, monthly, yearly)
    - status: Filter by status (active, inactive, suspended)
    - is_exceeded: Filter by whether quota is currently exceeded
    - page/page_size: Pagination controls
    
    **Returns:**
    - Department quotas with pagination metadata
    - Department information
    - Quota summary statistics
    
    **Example:**
    ```
    GET /manager/quotas/?quota_type=cost&quota_period=monthly&page=1&page_size=20
    ```
    
    Learning: Quota management follows the same department scoping pattern
    as user management, ensuring managers can only see their department's quotas.
    """
    try:
        result = manager_service.get_department_quotas(
            manager=current_manager,
            quota_type=quota_type,
            quota_period=quota_period,
            status=status,
            is_exceeded=is_exceeded,
            page=page,
            page_size=page_size
        )
        
        # Convert DepartmentQuota objects to QuotaResponse for JSON serialization
        quota_responses = []
        for quota in result["quotas"]:
            quota_responses.append(convert_quota_to_response(
                quota,
                department_name=quota.department.name if quota.department else None,
                llm_config_name=quota.llm_config.name if quota.llm_config else "All Providers"
            ))
        
        # Return structured response
        return {
            "quotas": quota_responses,
            "pagination": {
                "total_count": result["total_count"],
                "page": result["page"],
                "page_size": result["page_size"],
                "total_pages": result["total_pages"],
                "has_next": result["has_next"],
                "has_previous": result["has_previous"]
            },
            "department": result["department"],
            "summary": result["summary"]
        }
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} - quota list validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error listing department quotas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving department quotas"
        )

@router.get(
    "/{quota_id}",
    response_model=QuotaResponse,
    summary="Get Department Quota",
    description="Get a specific quota from the manager's department"
)
async def get_department_quota(
    quota_id: int = Path(..., description="ID of the quota to retrieve"),
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Get a specific quota from the manager's department.
    
    **Manager Permissions Required:** `can_view_department_usage`
    
    **Department Scoping:** Only returns quota if it belongs to the manager's department
    
    **Path Parameters:**
    - quota_id: Unique identifier of the quota
    
    **Returns:**
    - QuotaResponse with quota data
    
    **Example:**
    ```
    GET /manager/quotas/123
    ```
    
    Learning: Individual quota lookups also enforce department scoping,
    preventing managers from accessing quotas from other departments.
    """
    try:
        # Use the service to get department quotas and find the specific one
        result = manager_service.get_department_quotas(
            manager=current_manager,
            page=1,
            page_size=1000  # Large number to get all quotas for ID lookup
        )
        
        # Find the specific quota
        target_quota = None
        for quota in result["quotas"]:
            if quota.id == quota_id:
                target_quota = quota
                break
        
        if not target_quota:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Quota {quota_id} not found in your department"
            )
        
        return convert_quota_to_response(
            target_quota,
            department_name=target_quota.department.name if target_quota.department else None,
            llm_config_name=target_quota.llm_config.name if target_quota.llm_config else "All Providers"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} - quota get validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error retrieving quota {quota_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the quota"
        )

# =============================================================================
# QUOTA CREATION ENDPOINTS
# =============================================================================

@router.post(
    "/",
    response_model=QuotaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Department Quota",
    description="Create a new quota for the manager's department"
)
async def create_department_quota(
    quota_data: QuotaCreateRequest,
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Create a new quota for the manager's department.
    
    **Manager Permissions Required:** `can_manage_department_quotas`
    
    **Department Scoping:** Quota is automatically assigned to manager's department
    
    **Request Body:**
    - quota_type: Type of quota (cost, tokens, requests)
    - quota_period: Reset period (daily, weekly, monthly, yearly)
    - limit_value: Maximum allowed value
    - name: Human-readable quota name
    - description: Optional quota description
    - llm_config_id: Optional LLM provider restriction
    - is_enforced: Whether to enforce the quota (default: true)
    
    **Security Features:**
    - Quota is automatically assigned to manager's department
    - Manager cannot create quotas for other departments
    - Prevents duplicate quotas (same type + period + LLM config)
    
    **Returns:**
    - QuotaResponse with created quota data
    
    **Example:**
    ```json
    {
        "quota_type": "cost",
        "quota_period": "monthly",
        "limit_value": 1000.0,
        "name": "Monthly AI Spending Limit",
        "description": "Maximum monthly spending on AI services",
        "is_enforced": true
    }
    ```
    
    Learning: Like user creation, quota creation automatically enforces
    department assignment to ensure managers can only create quotas for their department.
    """
    try:
        new_quota = manager_service.create_department_quota(
            manager=current_manager,
            quota_data=quota_data
        )
        
        return convert_quota_to_response(
            new_quota,
            department_name=new_quota.department.name if new_quota.department else None,
            llm_config_name=new_quota.llm_config.name if new_quota.llm_config else "All Providers"
        )
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} quota creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating quota: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the quota"
        )

# =============================================================================
# QUOTA UPDATE ENDPOINTS
# =============================================================================

@router.put(
    "/{quota_id}",
    response_model=QuotaResponse,
    summary="Update Department Quota",
    description="Update a quota in the manager's department"
)
async def update_department_quota(
    quota_id: int = Path(..., description="ID of the quota to update"),
    update_data: QuotaUpdateRequest = ...,
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Update a quota in the manager's department.
    
    **Manager Permissions Required:** `can_manage_department_quotas`
    
    **Department Scoping:** Can only update quotas in manager's department
    
    **Path Parameters:**
    - quota_id: ID of quota to update
    
    **Request Body:**
    - Any fields from QuotaUpdateRequest (all optional)
    - Only provided fields will be updated
    
    **Security Features:**
    - Manager cannot update quotas in other departments
    - Manager cannot transfer quotas to other departments
    
    **Returns:**
    - QuotaResponse with updated quota data
    
    **Example:**
    ```json
    {
        "limit_value": 1500.0,
        "name": "Updated Monthly AI Spending Limit",
        "is_enforced": true
    }
    ```
    
    Learning: Update operations maintain department scoping boundaries,
    ensuring managers cannot modify quotas outside their authority.
    """
    try:
        updated_quota = manager_service.update_department_quota(
            manager=current_manager,
            quota_id=quota_id,
            update_data=update_data
        )
        
        return convert_quota_to_response(
            updated_quota,
            department_name=updated_quota.department.name if updated_quota.department else None,
            llm_config_name=updated_quota.llm_config.name if updated_quota.llm_config else "All Providers"
        )
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} quota update failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating quota {quota_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the quota"
        )

# =============================================================================
# QUOTA MANAGEMENT OPERATIONS
# =============================================================================

@router.post(
    "/{quota_id}/reset",
    response_model=Dict[str, Any],
    summary="Reset Department Quota",
    description="Reset a quota's usage in the manager's department"
)
async def reset_department_quota(
    quota_id: int = Path(..., description="ID of the quota to reset"),
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Reset a quota's usage in the manager's department.
    
    **Manager Permissions Required:** `can_reset_department_quotas`
    
    **Department Scoping:** Can only reset quotas in manager's department
    
    **Path Parameters:**
    - quota_id: ID of quota to reset
    
    **Operation Details:**
    - Sets current_usage back to 0.0
    - Updates last_reset_at timestamp
    - Reactivates suspended quotas
    
    **Use Cases:**
    - Budget adjustments (department got more funding)
    - Quota period adjustments
    - Resolving quota system errors
    - Emergency quota relief
    
    **Returns:**
    - Success message with reset details
    
    **Example Response:**
    ```json
    {
        "success": true,
        "message": "Quota reset successfully",
        "quota_id": 123,
        "quota_name": "Monthly AI Spending Limit",
        "reset_at": "2025-06-09T14:30:00Z",
        "previous_usage": 850.75,
        "new_usage": 0.0
    }
    ```
    
    Learning: Quota resets provide managers with operational flexibility
    to handle budget adjustments and emergency situations within their department.
    """
    try:
        # Get quota details before reset for response
        result = manager_service.get_department_quotas(
            manager=current_manager,
            page=1,
            page_size=1000
        )
        
        target_quota = None
        for quota in result["quotas"]:
            if quota.id == quota_id:
                target_quota = quota
                break
        
        if not target_quota:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Quota {quota_id} not found in your department"
            )
        
        previous_usage = float(target_quota.current_usage)
        
        # Perform the reset
        reset_quota = manager_service.reset_department_quota(
            manager=current_manager,
            quota_id=quota_id
        )
        
        return {
            "success": True,
            "message": "Quota reset successfully",
            "quota_id": quota_id,
            "quota_name": reset_quota.name,
            "reset_at": datetime.utcnow().isoformat(),
            "previous_usage": previous_usage,
            "new_usage": 0.0,
            "quota_status": reset_quota.status.value if reset_quota.status else "unknown"
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} quota reset failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error resetting quota {quota_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while resetting the quota"
        )

# =============================================================================
# DEPARTMENT ANALYTICS AND DASHBOARD ENDPOINTS
# =============================================================================

@router.get(
    "/dashboard",
    response_model=Dict[str, Any],
    summary="Get Department Quota Dashboard",
    description="Get comprehensive quota and usage dashboard for the manager's department"
)
async def get_department_quota_dashboard(
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Get comprehensive quota and usage dashboard for the manager's department.
    
    **Manager Permissions Required:** `can_view_department_usage`
    
    **Department Scoping:** Only returns data for manager's department
    
    **Returns:**
    - Department information
    - Quota summary statistics
    - Usage statistics and trends
    - Recent activity
    - User statistics
    
    **Dashboard Includes:**
    - Total quotas (active, exceeded, near limit)
    - Monthly cost limits and usage
    - Usage trends over last 30 days
    - Recent AI requests and activity
    - Department user statistics
    
    **Example Response:**
    ```json
    {
        "department": {
            "id": 1,
            "name": "Engineering",
            "description": "Software Development Team"
        },
        "quota_stats": {
            "total_quotas": 5,
            "active_quotas": 4,
            "exceeded_quotas": 1,
            "total_monthly_cost_limit": 5000.0,
            "total_monthly_cost_used": 3250.75
        },
        "usage_stats": {
            "total_requests": 1250,
            "total_tokens": 75000,
            "total_cost": 125.50,
            "daily_trend": [...]
        },
        "user_stats": {
            "total_users": 25,
            "active_users": 23
        }
    }
    ```
    
    Learning: Dashboard endpoints aggregate data from multiple sources
    to provide managers with a comprehensive view of their department's
    AI usage, quota status, and user activity.
    """
    try:
        dashboard_data = manager_service.get_department_dashboard_data(current_manager)
        
        return dashboard_data
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} dashboard error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating quota dashboard: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the quota dashboard"
        )

@router.get(
    "/statistics",
    response_model=Dict[str, Any],
    summary="Get Department Quota Statistics",
    description="Get quota statistics for the manager's department"
)
async def get_department_quota_statistics(
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Get quota statistics for the manager's department.
    
    **Manager Permissions Required:** `can_view_department_usage`
    
    **Department Scoping:** Only returns statistics for manager's department
    
    **Returns:**
    - Quota counts by status and type
    - Cost and usage summaries
    - Department information
    
    **Example Response:**
    ```json
    {
        "department": {
            "id": 1,
            "name": "Engineering"
        },
        "quota_stats": {
            "total_quotas": 5,
            "active_quotas": 4,
            "exceeded_quotas": 1,
            "near_limit_quotas": 1,
            "total_monthly_cost_limit": 5000.0,
            "total_monthly_cost_used": 3250.75
        }
    }
    ```
    
    Learning: Statistics endpoints provide focused data subsets
    that can be used for specific reporting or monitoring needs.
    """
    try:
        dashboard_data = manager_service.get_department_dashboard_data(current_manager)
        
        return {
            "department": dashboard_data["department"],
            "quota_stats": dashboard_data["quota_stats"],
            "last_updated": dashboard_data["last_updated"]
        }
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} quota statistics error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating quota statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating quota statistics"
        )
