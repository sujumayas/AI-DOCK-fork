# AI Dock Manager API Module
# Department-scoped management endpoints for department managers

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime
import logging

# Import core dependencies
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services.manager_service import get_manager_service, ManagerService
from . import users, quotas

# Set up logging
logger = logging.getLogger(__name__)

# Create the main manager router
router = APIRouter(prefix="/manager", tags=["Manager - Department Management"])

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
# UNIFIED DASHBOARD ENDPOINT
# =============================================================================

@router.get(
    "/dashboard",
    response_model=Dict[str, Any],
    summary="Get Comprehensive Department Dashboard",
    description="Get unified dashboard data for the manager's department including users, quotas, and usage analytics"
)
async def get_department_dashboard(
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Get comprehensive dashboard data for the manager's department.
    
    **Manager Permissions Required:** `can_view_department_usage`
    
    **Department Scoping:** Only returns data for manager's department
    
    **Returns:**
    - Department information
    - User statistics (total, active, by role)
    - Quota statistics (total, active, exceeded, cost limits)
    - Usage statistics (requests, tokens, cost, trends)
    - Recent activity (latest AI requests)
    
    **Dashboard Sections:**
    1. **Department Overview**: Basic department info
    2. **User Management**: User counts and role distribution
    3. **Quota Health**: Quota status and budget tracking
    4. **Usage Analytics**: 30-day usage trends and metrics
    5. **Recent Activity**: Latest AI requests and responses
    
    **Example Response:**
    ```json
    {
        "department": {
            "id": 1,
            "name": "Engineering",
            "description": "Software Development Team"
        },
        "user_stats": {
            "total_users": 25,
            "active_users": 23,
            "users_by_role": [...]
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
        "recent_activity": [...]
    }
    ```
    
    **Learning:** This unified dashboard endpoint demonstrates how to
    aggregate data from multiple services (users, quotas, usage) into
    a single comprehensive API response. This pattern is common in
    enterprise dashboards where managers need a complete overview.
    """
    try:
        # Get comprehensive dashboard data from the service
        dashboard_data = manager_service.get_department_dashboard_data(current_manager)
        
        logger.info(f"Manager {current_manager.email} accessed department dashboard for {dashboard_data.get('department', {}).get('name', 'Unknown')}")
        
        return dashboard_data
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} dashboard validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating manager dashboard for {current_manager.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the department dashboard"
        )

# =============================================================================
# INCLUDE SUB-ROUTERS
# =============================================================================

# Include sub-routers for different management areas
router.include_router(users.router)   # /manager/users/
router.include_router(quotas.router)  # /manager/quotas/

# This creates the complete manager API with the following endpoints:
#
# UNIFIED DASHBOARD:
# - GET    /manager/dashboard           - Comprehensive department dashboard
#
# USER MANAGEMENT (/manager/users/):
# - GET    /manager/users/              - List department users
# - POST   /manager/users/              - Create department user  
# - GET    /manager/users/{user_id}     - Get specific department user
# - PUT    /manager/users/{user_id}     - Update department user
# - POST   /manager/users/{user_id}/activate   - Activate department user
# - POST   /manager/users/{user_id}/deactivate - Deactivate department user
# - GET    /manager/users/statistics    - Get department user statistics
#
# QUOTA MANAGEMENT (/manager/quotas/):
# - GET    /manager/quotas/             - List department quotas
# - POST   /manager/quotas/             - Create department quota
# - GET    /manager/quotas/{quota_id}   - Get specific department quota
# - PUT    /manager/quotas/{quota_id}   - Update department quota
# - POST   /manager/quotas/{quota_id}/reset - Reset department quota
# - GET    /manager/quotas/dashboard    - Get quota-specific dashboard data
# - GET    /manager/quotas/statistics   - Get department quota statistics
#
# All endpoints automatically enforce department scoping - managers can only
# access and modify data within their assigned department.
#
# The unified /manager/dashboard endpoint aggregates data from all services
# to provide a comprehensive overview for department managers.
