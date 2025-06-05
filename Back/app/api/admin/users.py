# AI Dock Admin User Management API
# These endpoints allow administrators to manage users through HTTP requests

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.role import PermissionConstants
from ...services.admin_service import AdminService
from ...schemas.admin import (
    UserCreateRequest, UserUpdateRequest, UserPasswordUpdate,
    UserResponse, UserListResponse, UserSearchFilters,
    BulkUserOperation, BulkOperationResult,
    UserStatsResponse, SuccessResponse, ErrorResponse
)

# Set up logging
logger = logging.getLogger(__name__)

# Create router for admin user management endpoints
# prefix="/users" means all endpoints start with /admin/users/
router = APIRouter(prefix="/users", tags=["Admin - User Management"])

# =============================================================================
# DEPENDENCY FUNCTIONS
# =============================================================================

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensure the current user is an admin.
    
    This is a dependency that can be used on any endpoint that requires admin access.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        User object if they are an admin
        
    Raises:
        HTTPException: 403 if user is not an admin
        
    Learning: Dependencies in FastAPI are reusable components that can be
    injected into multiple endpoints. This keeps our code DRY.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated"
        )
    
    if not current_user.can_access_admin_panel():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have admin privileges"
        )
    
    return current_user

def get_admin_service(db: Session = Depends(get_db)) -> AdminService:
    """
    Create an AdminService instance.
    
    Args:
        db: Database session from dependency injection
        
    Returns:
        AdminService instance
        
    Learning: This dependency pattern makes our endpoints clean and testable.
    """
    return AdminService(db)

def require_permission(permission: str):
    """
    Decorator factory for permission checking.
    
    Args:
        permission: Required permission string
        
    Returns:
        Dependency function that checks the permission
        
    Learning: This is an advanced pattern for creating reusable permission checks.
    """
    def permission_checker(
        current_user: User = Depends(get_admin_user),
        admin_service: AdminService = Depends(get_admin_service)
    ) -> User:
        if not admin_service.check_admin_permissions(current_user.id, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have the required permission: {permission}"
            )
        return current_user
    
    return permission_checker

# =============================================================================
# USER CREATION ENDPOINTS
# =============================================================================

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Create a new user account. Requires admin privileges."
)
async def create_user(
    user_data: UserCreateRequest,
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_CREATE_USERS))
):
    """
    Create a new user account.
    
    This endpoint allows admins to create new user accounts with specified
    roles and departments.
    
    **Required Permission:** `can_create_users`
    
    **Request Body:**
    - email: Valid email address (unique)
    - username: Unique username
    - full_name: User's display name
    - password: Initial password (will be hashed)
    - role_id: ID of role to assign
    - department_id: ID of department to assign (optional)
    - Other optional profile fields
    
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
        "department_id": 1
    }
    ```
    
    Learning: Notice how we use dependency injection to get the admin service
    and check permissions. The endpoint itself is clean and focused.
    """
    try:
        logger.info(f"Admin {current_admin.username} creating user: {user_data.username}")
        
        new_user = admin_service.create_user(user_data, current_admin.id)
        
        return new_user
        
    except ValueError as e:
        # ValueError from our service layer becomes a 400 Bad Request
        logger.warning(f"User creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Unexpected errors become 500 Internal Server Error
        logger.error(f"Unexpected error creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the user"
        )

# =============================================================================
# USER RETRIEVAL ENDPOINTS
# =============================================================================

@router.get(
    "/search",
    response_model=UserListResponse,
    summary="Search and list users",
    description="Search users with filters and pagination. Requires admin privileges."
)
async def search_users(
    # Query parameters for search and filtering
    search_query: Optional[str] = Query(None, description="Search in username, name, email"),
    role_id: Optional[int] = Query(None, description="Filter by role ID"),
    role_name: Optional[str] = Query(None, description="Filter by role name"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    department_name: Optional[str] = Query(None, description="Filter by department name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_admin: Optional[bool] = Query(None, description="Filter by admin status"),
    is_verified: Optional[bool] = Query(None, description="Filter by verified status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    
    # Dependencies
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_VIEW_USERS))
):
    """
    Search and filter users with pagination.
    
    **Required Permission:** `can_view_users`
    
    **Query Parameters:**
    - search_query: Text search across username, full_name, email
    - role_id/role_name: Filter by user role
    - department_id/department_name: Filter by department
    - is_active/is_admin/is_verified: Filter by boolean flags
    - page/page_size: Pagination controls
    - sort_by/sort_order: Sorting options
    
    **Returns:**
    - UserListResponse with matching users and pagination info
    
    **Example URL:**
    ```
    /admin/users/search?search_query=john&role_name=user&page=1&page_size=20
    ```
    
    Learning: Using Query parameters makes the API flexible and user-friendly.
    Users can combine any filters they want.
    """
    try:
        # Build filters object from query parameters
        filters = UserSearchFilters(
            search_query=search_query,
            role_id=role_id,
            role_name=role_name,
            department_id=department_id,
            department_name=department_name,
            is_active=is_active,
            is_admin=is_admin,
            is_verified=is_verified,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        result = admin_service.search_users(filters)
        
        logger.info(f"User search by {current_admin.username}: {result.total_count} results")
        
        return result
        
    except Exception as e:
        logger.error(f"Error searching users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while searching users"
        )

@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve a specific user by their ID. Requires admin privileges."
)
async def get_user(
    user_id: int = Path(..., description="ID of the user to retrieve"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_VIEW_USERS))
):
    """
    Get a user by their ID.
    
    **Required Permission:** `can_view_users`
    
    **Path Parameters:**
    - user_id: Unique identifier of the user
    
    **Returns:**
    - UserResponse with user data
    
    **Example:**
    ```
    GET /admin/users/123
    ```
    
    Learning: Path parameters are perfect for resource IDs.
    FastAPI automatically validates that user_id is an integer.
    """
    try:
        user = admin_service.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        return user
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except Exception as e:
        logger.error(f"Error retrieving user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the user"
        )

# =============================================================================
# USER UPDATE ENDPOINTS
# =============================================================================

@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user information",
    description="Update user profile information. Requires admin privileges."
)
async def update_user(
    user_id: int = Path(..., description="ID of the user to update"),
    update_data: UserUpdateRequest = ...,
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_EDIT_USERS))
):
    """
    Update user information.
    
    **Required Permission:** `can_edit_users`
    
    **Path Parameters:**
    - user_id: ID of user to update
    
    **Request Body:**
    - Any fields from UserUpdateRequest (all optional)
    - Only provided fields will be updated
    
    **Returns:**
    - UserResponse with updated user data
    
    **Example:**
    ```json
    {
        "full_name": "John Smith",
        "job_title": "Senior Developer",
        "department_id": 2
    }
    ```
    
    Learning: PUT is typically used for updates. We only update
    fields that are provided in the request body.
    """
    try:
        updated_user = admin_service.update_user(user_id, update_data, current_admin.id)
        
        logger.info(f"User {user_id} updated by admin {current_admin.username}")
        
        return updated_user
        
    except ValueError as e:
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

@router.put(
    "/{user_id}/password",
    response_model=SuccessResponse,
    summary="Update user password",
    description="Update a user's password. Requires admin privileges."
)
async def update_user_password(
    user_id: int = Path(..., description="ID of the user whose password to update"),
    password_data: UserPasswordUpdate = ...,
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_EDIT_USERS))
):
    """
    Update a user's password.
    
    **Required Permission:** `can_edit_users`
    
    **Path Parameters:**
    - user_id: ID of user whose password to update
    
    **Request Body:**
    - new_password: New password (will be validated and hashed)
    
    **Returns:**
    - SuccessResponse confirming password update
    
    Learning: Password updates are separate from other user updates
    for security reasons. This allows different logging and permissions.
    """
    try:
        success = admin_service.update_user_password(user_id, password_data, current_admin.id)
        
        if success:
            logger.info(f"Password updated for user {user_id} by admin {current_admin.username}")
            return SuccessResponse(
                message=f"Password updated successfully for user {user_id}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update password"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating password for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the password"
        )

# =============================================================================
# USER ACTIVATION/DEACTIVATION ENDPOINTS
# =============================================================================

@router.post(
    "/{user_id}/activate",
    response_model=UserResponse,
    summary="Activate user account",
    description="Activate a user account. Requires admin privileges."
)
async def activate_user(
    user_id: int = Path(..., description="ID of the user to activate"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_EDIT_USERS))
):
    """
    Activate a user account.
    
    **Required Permission:** `can_edit_users`
    
    **Path Parameters:**
    - user_id: ID of user to activate
    
    **Returns:**
    - UserResponse with updated user data
    
    Learning: Using POST for actions (like activate/deactivate) is a common
    REST pattern when the action doesn't fit neatly into CRUD operations.
    """
    try:
        activated_user = admin_service.activate_user(user_id, current_admin.id)
        
        logger.info(f"User {user_id} activated by admin {current_admin.username}")
        
        return activated_user
        
    except ValueError as e:
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
    summary="Deactivate user account",
    description="Deactivate a user account. Requires admin privileges."
)
async def deactivate_user(
    user_id: int = Path(..., description="ID of the user to deactivate"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_EDIT_USERS))
):
    """
    Deactivate a user account.
    
    **Required Permission:** `can_edit_users`
    
    **Path Parameters:**
    - user_id: ID of user to deactivate
    
    **Returns:**
    - UserResponse with updated user data
    
    Learning: Deactivation is usually preferred over deletion
    as it preserves data while preventing access.
    """
    try:
        deactivated_user = admin_service.deactivate_user(user_id, current_admin.id)
        
        logger.info(f"User {user_id} deactivated by admin {current_admin.username}")
        
        return deactivated_user
        
    except ValueError as e:
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
# USER DELETION ENDPOINTS
# =============================================================================

@router.delete(
    "/{user_id}",
    response_model=SuccessResponse,
    summary="Delete user account",
    description="Permanently delete a user account. Requires admin privileges. Use with caution!"
)
async def delete_user(
    user_id: int = Path(..., description="ID of the user to delete"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_DELETE_USERS))
):
    """
    Delete a user account permanently.
    
    **⚠️ WARNING:** This action cannot be undone!
    
    **Required Permission:** `can_delete_users`
    
    **Path Parameters:**
    - user_id: ID of user to delete
    
    **Returns:**
    - SuccessResponse confirming deletion
    
    **Safety Features:**
    - Admins cannot delete themselves
    - Cannot delete the last admin user
    
    Learning: DELETE operations should be protected and logged.
    Consider "soft delete" (marking as deleted) instead of hard delete
    for production systems.
    """
    try:
        success = admin_service.delete_user(user_id, current_admin.id)
        
        if success:
            logger.warning(f"User {user_id} DELETED by admin {current_admin.username}")
            return SuccessResponse(
                message=f"User {user_id} has been permanently deleted"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user"
            )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the user"
        )

# =============================================================================
# BULK OPERATIONS ENDPOINTS
# =============================================================================

@router.post(
    "/bulk",
    response_model=BulkOperationResult,
    summary="Perform bulk operations on multiple users",
    description="Perform actions on multiple users at once. Requires admin privileges."
)
async def bulk_user_operations(
    operation: BulkUserOperation,
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_EDIT_USERS))
):
    """
    Perform bulk operations on multiple users.
    
    **Required Permission:** `can_edit_users` (or `can_delete_users` for delete operations)
    
    **Request Body:**
    - user_ids: List of user IDs to operate on
    - action: Action to perform (activate, deactivate, delete, change_role, change_department)
    - new_role_id: Required for change_role action
    - new_department_id: Required for change_department action
    
    **Returns:**
    - BulkOperationResult with detailed success/failure information
    
    **Example:**
    ```json
    {
        "user_ids": [1, 2, 3, 4],
        "action": "activate"
    }
    ```
    
    Learning: Bulk operations are efficient for managing many users,
    but require careful error handling since some operations might
    succeed while others fail.
    """
    try:
        # Additional permission check for delete operations
        if operation.action == "delete":
            if not admin_service.check_admin_permissions(
                current_admin.id, 
                PermissionConstants.CAN_DELETE_USERS
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to delete users"
                )
        
        result = admin_service.perform_bulk_operation(operation, current_admin.id)
        
        logger.info(
            f"Bulk {operation.action} by {current_admin.username}: "
            f"{result.successful_count}/{result.total_requested} successful"
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error in bulk operation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during the bulk operation"
        )

# =============================================================================
# STATISTICS AND DASHBOARD ENDPOINTS
# =============================================================================

@router.get(
    "/statistics",
    response_model=UserStatsResponse,
    summary="Get user statistics",
    description="Get comprehensive user statistics for admin dashboard. Requires admin privileges."
)
async def get_user_statistics(
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_VIEW_USERS))
):
    """
    Get comprehensive user statistics for the admin dashboard.
    
    **Required Permission:** `can_view_users`
    
    **Returns:**
    - UserStatsResponse with counts, breakdowns, and trends
    
    **Includes:**
    - Total user counts by status
    - Users by role and department
    - Recent activity metrics
    - New user trends
    
    Learning: Statistics endpoints are common for admin dashboards.
    They often involve complex aggregation queries that might be
    expensive, so consider caching in production.
    """
    try:
        stats = admin_service.get_user_statistics()
        
        logger.info(f"User statistics requested by admin {current_admin.username}")
        
        return stats
        
    except Exception as e:
        logger.error(f"Error generating user statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating user statistics"
        )

# =============================================================================
# HELPER ENDPOINTS
# =============================================================================

@router.get(
    "/username/{username}",
    response_model=UserResponse,
    summary="Get user by username",
    description="Retrieve a user by their username. Requires admin privileges."
)
async def get_user_by_username(
    username: str = Path(..., description="Username to search for"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_VIEW_USERS))
):
    """
    Get a user by their username.
    
    **Required Permission:** `can_view_users`
    
    **Path Parameters:**
    - username: Username to search for
    
    **Returns:**
    - UserResponse with user data
    
    Learning: Sometimes you need multiple ways to look up the same resource.
    Having both ID and username lookup endpoints is common.
    """
    try:
        user = admin_service.get_user_by_username(username)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with username '{username}' not found"
            )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user by username {username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the user"
        )

@router.get(
    "/email/{email}",
    response_model=UserResponse,
    summary="Get user by email",
    description="Retrieve a user by their email address. Requires admin privileges."
)
async def get_user_by_email(
    email: str = Path(..., description="Email address to search for"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: User = Depends(require_permission(PermissionConstants.CAN_VIEW_USERS))
):
    """
    Get a user by their email address.
    
    **Required Permission:** `can_view_users`
    
    **Path Parameters:**
    - email: Email address to search for
    
    **Returns:**
    - UserResponse with user data
    
    Learning: Email lookup is often needed for admin support tasks.
    """
    try:
        user = admin_service.get_user_by_email(email)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with email '{email}' not found"
            )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user by email {email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving the user"
        )
