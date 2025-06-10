# AI Dock Manager User Management API
# Department-scoped user management endpoints for department managers

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.role import PermissionConstants
from ...services.manager_service import get_manager_service, ManagerService
from ...schemas.admin import (
    UserCreateRequest, UserUpdateRequest,
    UserResponse, UserListResponse, SuccessResponse
)

# Set up logging
logger = logging.getLogger(__name__)

# Create router for manager user management endpoints
# prefix="/users" means all endpoints start with /manager/users/
router = APIRouter(prefix="/users", tags=["Manager - User Management"])

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
        
    Learning: This dependency enforces manager-level access control
    at the API level, providing the first line of defense.
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
# USER LISTING AND SEARCH ENDPOINTS
# =============================================================================

@router.get(
    "/",
    response_model=Dict[str, Any],
    summary="List Department Users",
    description="Get users in the manager's department with filtering and pagination"
)
async def list_department_users(
    # Search and filtering parameters
    search_query: Optional[str] = Query(None, description="Search in username, name, email"),
    role_id: Optional[int] = Query(None, description="Filter by role ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    
    # Pagination parameters
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    
    # Sorting parameters
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    
    # Dependencies
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Get users in the manager's department with filtering and pagination.
    
    **Manager Permissions Required**
    
    **Department Scoping:** Only returns users from the manager's department
    
    **Query Parameters:**
    - search_query: Text search across username, full_name, email
    - role_id: Filter by user role
    - is_active: Filter by active status
    - page/page_size: Pagination controls
    - sort_by/sort_order: Sorting options
    
    **Returns:**
    - Department users with pagination metadata
    - Department information
    - User statistics summary
    
    **Example:**
    ```
    GET /manager/users/?search_query=john&is_active=true&page=1&page_size=20
    ```
    
    Learning: This endpoint demonstrates department scoping in action.
    Managers automatically only see users from their department.
    """
    try:
        result = manager_service.get_department_users(
            manager=current_manager,
            search_query=search_query,
            role_id=role_id,
            is_active=is_active,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Convert User objects to UserResponse for JSON serialization
        user_responses = []
        for user in result["users"]:
            user_responses.append(UserResponse(
                id=user.id,
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                job_title=user.job_title,
                phone_number=user.phone_number,
                is_active=user.is_active,
                is_verified=user.is_verified,
                role_id=user.role_id,
                role_name=user.role.name if user.role else None,
                role_display_name=user.role.display_name if user.role else None,
                department_id=user.department_id,
                department_name=user.department.name if user.department else None,
                created_at=user.created_at,
                updated_at=user.updated_at,
                last_login_at=user.last_login_at,
                created_by=user.created_by
            ))
        
        # Return structured response
        return {
            "users": user_responses,
            "pagination": {
                "total_count": result["total_count"],
                "page": result["page"],
                "page_size": result["page_size"],
                "total_pages": result["total_pages"],
                "has_next": result["has_next"],
                "has_previous": result["has_previous"]
            },
            "department": result["department"],
            "summary": {
                "total_users_in_department": result["total_count"],
                "users_on_current_page": len(user_responses)
            }
        }
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} - validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error listing department users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving department users"
        )

@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get Department User",
    description="Get a specific user from the manager's department"
)
async def get_department_user(
    user_id: int = Path(..., description="ID of the user to retrieve"),
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep),
    db: Session = Depends(get_db)
):
    """
    Get a specific user from the manager's department.
    
    **Manager Permissions Required**
    
    **Department Scoping:** Only returns user if they're in the manager's department
    
    **Path Parameters:**
    - user_id: Unique identifier of the user
    
    **Returns:**
    - UserResponse with user data
    
    **Example:**
    ```
    GET /manager/users/123
    ```
    
    Learning: Even individual user lookups are scoped to the department.
    Managers cannot access user details from other departments.
    """
    try:
        # Use the service to get department users and find the specific one
        # This ensures department scoping is applied
        result = manager_service.get_department_users(
            manager=current_manager,
            page=1,
            page_size=1000  # Large number to get all users for ID lookup
        )
        
        # Find the specific user
        target_user = None
        for user in result["users"]:
            if user.id == user_id:
                target_user = user
                break
        
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found in your department"
            )
        
        return UserResponse(
            id=target_user.id,
            email=target_user.email,
            username=target_user.username,
            full_name=target_user.full_name,
            job_title=target_user.job_title,
            phone_number=target_user.phone_number,
            is_active=target_user.is_active,
            is_verified=target_user.is_verified,
            role_id=target_user.role_id,
            role_name=target_user.role.name if target_user.role else None,
            role_display_name=target_user.role.display_name if target_user.role else None,
            department_id=target_user.department_id,
            department_name=target_user.department.name if target_user.department else None,
            created_at=target_user.created_at,
            updated_at=target_user.updated_at,
            last_login_at=target_user.last_login_at,
            created_by=target_user.created_by
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} - validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error retrieving user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the user"
        )

# =============================================================================
# USER CREATION ENDPOINTS
# =============================================================================

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Department User",
    description="Create a new user in the manager's department"
)
async def create_department_user(
    user_data: UserCreateRequest,
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Create a new user in the manager's department.
    
    **Manager Permissions Required:** `can_create_department_users`
    
    **Department Scoping:** User is automatically assigned to manager's department
    
    **Request Body:**
    - email: Valid email address (unique)
    - username: Unique username
    - full_name: User's display name
    - password: Initial password (will be hashed)
    - role_id: ID of role to assign (cannot be higher than manager level)
    - Other optional profile fields
    
    **Security Features:**
    - Manager cannot assign roles higher than their own level
    - User is automatically assigned to manager's department
    - Manager-created users are auto-verified
    
    **Returns:**
    - UserResponse with created user data (excluding password)
    
    **Example:**
    ```json
    {
        "email": "john.doe@company.com",
        "username": "john.doe",
        "full_name": "John Doe",
        "password": "SecurePass123!",
        "role_id": 2,
        "job_title": "Developer"
    }
    ```
    
    Learning: Notice how the department_id is automatically set by the service.
    Managers cannot create users in other departments, even if they try.
    """
    try:
        new_user = manager_service.create_department_user(
            manager=current_manager,
            user_data=user_data
        )
        
        return UserResponse(
            id=new_user.id,
            email=new_user.email,
            username=new_user.username,
            full_name=new_user.full_name,
            job_title=new_user.job_title,
            phone_number=new_user.phone_number,
            is_active=new_user.is_active,
            is_verified=new_user.is_verified,
            role_id=new_user.role_id,
            role_name=new_user.role.name if new_user.role else None,
            role_display_name=new_user.role.display_name if new_user.role else None,
            department_id=new_user.department_id,
            department_name=new_user.department.name if new_user.department else None,
            created_at=new_user.created_at,
            updated_at=new_user.updated_at,
            last_login_at=new_user.last_login_at,
            created_by=new_user.created_by
        )
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} user creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the user"
        )

# =============================================================================
# USER UPDATE ENDPOINTS
# =============================================================================

@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update Department User",
    description="Update a user in the manager's department"
)
async def update_department_user(
    user_id: int = Path(..., description="ID of the user to update"),
    update_data: UserUpdateRequest = ...,
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Update a user in the manager's department.
    
    **Manager Permissions Required:** `can_edit_users`
    
    **Department Scoping:** Can only update users in manager's department
    
    **Path Parameters:**
    - user_id: ID of user to update
    
    **Request Body:**
    - Any fields from UserUpdateRequest (all optional)
    - Only provided fields will be updated
    
    **Security Features:**
    - Manager cannot update users in other departments
    - Manager cannot elevate users to roles higher than their own
    - Manager cannot transfer users to other departments
    - Manager cannot edit other managers or admins
    
    **Returns:**
    - UserResponse with updated user data
    
    **Example:**
    ```json
    {
        "full_name": "John Smith",
        "job_title": "Senior Developer",
        "role_id": 2
    }
    ```
    
    Learning: Update operations maintain all the same security boundaries
    as creation operations. The service layer enforces these rules consistently.
    """
    try:
        updated_user = manager_service.update_department_user(
            manager=current_manager,
            user_id=user_id,
            update_data=update_data
        )
        
        return UserResponse(
            id=updated_user.id,
            email=updated_user.email,
            username=updated_user.username,
            full_name=updated_user.full_name,
            job_title=updated_user.job_title,
            phone_number=updated_user.phone_number,
            is_active=updated_user.is_active,
            is_verified=updated_user.is_verified,
            role_id=updated_user.role_id,
            role_name=updated_user.role.name if updated_user.role else None,
            role_display_name=updated_user.role.display_name if updated_user.role else None,
            department_id=updated_user.department_id,
            department_name=updated_user.department.name if updated_user.department else None,
            created_at=updated_user.created_at,
            updated_at=updated_user.updated_at,
            last_login_at=updated_user.last_login_at,
            created_by=updated_user.created_by
        )
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} user update failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the user"
        )

# =============================================================================
# USER ACTIVATION/DEACTIVATION ENDPOINTS
# =============================================================================

@router.post(
    "/{user_id}/activate",
    response_model=UserResponse,
    summary="Activate Department User",
    description="Activate a user in the manager's department"
)
async def activate_department_user(
    user_id: int = Path(..., description="ID of the user to activate"),
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Activate a user in the manager's department.
    
    **Manager Permissions Required:** `can_edit_users`
    
    **Department Scoping:** Can only activate users in manager's department
    
    **Path Parameters:**
    - user_id: ID of user to activate
    
    **Returns:**
    - UserResponse with updated user data
    
    Learning: Activation/deactivation are implemented as specific update
    operations for better auditability and clearer business intent.
    """
    try:
        # Use the update method with is_active=True
        from ...schemas.admin import UserUpdateRequest
        update_data = UserUpdateRequest(is_active=True)
        
        activated_user = manager_service.update_department_user(
            manager=current_manager,
            user_id=user_id,
            update_data=update_data
        )
        
        logger.info(f"Manager {current_manager.email} activated user {user_id}")
        
        return UserResponse(
            id=activated_user.id,
            email=activated_user.email,
            username=activated_user.username,
            full_name=activated_user.full_name,
            job_title=activated_user.job_title,
            phone_number=activated_user.phone_number,
            is_active=activated_user.is_active,
            is_verified=activated_user.is_verified,
            role_id=activated_user.role_id,
            role_name=activated_user.role.name if activated_user.role else None,
            role_display_name=activated_user.role.display_name if activated_user.role else None,
            department_id=activated_user.department_id,
            department_name=activated_user.department.name if activated_user.department else None,
            created_at=activated_user.created_at,
            updated_at=activated_user.updated_at,
            last_login_at=activated_user.last_login_at,
            created_by=activated_user.created_by
        )
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} user activation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error activating user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while activating the user"
        )

@router.post(
    "/{user_id}/deactivate",
    response_model=UserResponse,
    summary="Deactivate Department User",
    description="Deactivate a user in the manager's department"
)
async def deactivate_department_user(
    user_id: int = Path(..., description="ID of the user to deactivate"),
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Deactivate a user in the manager's department.
    
    **Manager Permissions Required:** `can_edit_users`
    
    **Department Scoping:** Can only deactivate users in manager's department
    
    **Path Parameters:**
    - user_id: ID of user to deactivate
    
    **Returns:**
    - UserResponse with updated user data
    
    **Security Note:**
    Deactivation is preferred over deletion as it preserves audit trails
    while preventing the user from accessing the system.
    """
    try:
        # Use the update method with is_active=False
        from ...schemas.admin import UserUpdateRequest
        update_data = UserUpdateRequest(is_active=False)
        
        deactivated_user = manager_service.update_department_user(
            manager=current_manager,
            user_id=user_id,
            update_data=update_data
        )
        
        logger.info(f"Manager {current_manager.email} deactivated user {user_id}")
        
        return UserResponse(
            id=deactivated_user.id,
            email=deactivated_user.email,
            username=deactivated_user.username,
            full_name=deactivated_user.full_name,
            job_title=deactivated_user.job_title,
            phone_number=deactivated_user.phone_number,
            is_active=deactivated_user.is_active,
            is_verified=deactivated_user.is_verified,
            role_id=deactivated_user.role_id,
            role_name=deactivated_user.role.name if deactivated_user.role else None,
            role_display_name=deactivated_user.role.display_name if deactivated_user.role else None,
            department_id=deactivated_user.department_id,
            department_name=deactivated_user.department.name if deactivated_user.department else None,
            created_at=deactivated_user.created_at,
            updated_at=deactivated_user.updated_at,
            last_login_at=deactivated_user.last_login_at,
            created_by=deactivated_user.created_by
        )
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} user deactivation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deactivating user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deactivating the user"
        )

# =============================================================================
# DEPARTMENT STATISTICS ENDPOINTS
# =============================================================================

@router.get(
    "/statistics",
    response_model=Dict[str, Any],
    summary="Get Department User Statistics",
    description="Get user statistics for the manager's department"
)
async def get_department_user_statistics(
    current_manager: User = Depends(get_manager_user),
    manager_service: ManagerService = Depends(get_manager_service_dep)
):
    """
    Get comprehensive user statistics for the manager's department.
    
    **Manager Permissions Required**
    
    **Department Scoping:** Only returns statistics for manager's department
    
    **Returns:**
    - User counts by status (active, inactive, total)
    - User distribution by role
    - Recent user activity
    - Department information
    
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
            "inactive_users": 2,
            "recent_users": 3,
            "users_by_role": [
                {"role_name": "user", "role_display_name": "Standard User", "count": 20},
                {"role_name": "analyst", "role_display_name": "Data Analyst", "count": 3}
            ]
        }
    }
    ```
    
    Learning: Statistics provide managers with insight into their department's
    user composition and activity without exposing data from other departments.
    """
    try:
        dashboard_data = manager_service.get_department_dashboard_data(current_manager)
        
        return {
            "department": dashboard_data["department"],
            "user_stats": dashboard_data["user_stats"],
            "last_updated": dashboard_data["last_updated"]
        }
        
    except ValueError as e:
        logger.warning(f"Manager {current_manager.email} statistics error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating user statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating user statistics"
        )
