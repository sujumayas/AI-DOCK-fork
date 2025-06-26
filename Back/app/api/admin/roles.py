# AI Dock Admin Role Management API
# These endpoints allow administrators to fetch and manage user roles

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.role import Role, PermissionConstants
from ...schemas.role import RoleDropdownOption, RoleResponse

# Set up logging
logger = logging.getLogger(__name__)

# Create router for admin role management endpoints
router = APIRouter(prefix="/roles", tags=["Admin - Role Management"])

# =============================================================================
# DEPENDENCY FUNCTIONS
# =============================================================================

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensure the current user is an admin.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        User object if they are an admin
        
    Raises:
        HTTPException: 403 if user is not an admin
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

# =============================================================================
# ROLE RETRIEVAL ENDPOINTS
# =============================================================================

@router.get(
    "/list",
    response_model=List[RoleDropdownOption],
    summary="Get roles for dropdown selection",
    description="Get all active roles formatted for dropdown components. Requires admin privileges."
)
async def get_roles_for_dropdown(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    Get all active roles formatted for dropdown selection.
    
    **Purpose:** Provides role data for frontend dropdown components
    **Pattern:** Same as department dropdown - consistent API design
    
    **Returns:**
    - List of RoleDropdownOption with value/label pairs
    
    **Example Response:**
    ```json
    [
        {"value": 1, "label": "System Administrator", "name": "admin"},
        {"value": 2, "label": "Standard User", "name": "user"},
        {"value": 3, "label": "Department Manager", "name": "manager"},
        {"value": 4, "label": "Guest User", "name": "guest"}
    ]
    ```
    
    Learning: This endpoint follows the same pattern as departments,
    making the frontend code consistent and predictable.
    """
    try:
        logger.info(f"Fetching roles for dropdown by admin {current_admin.username}")
        
        # Query all active roles from database
        # Order by level (descending) to show higher permissions first
        roles = db.query(Role).filter(
            Role.is_active == True
        ).order_by(Role.level.desc()).all()
        
        # Convert to dropdown format
        role_options = []
        for role in roles:
            role_options.append(RoleDropdownOption(
                value=role.id,
                label=role.display_name,
                name=role.name
            ))
        
        logger.info(f"✅ Found {len(role_options)} active roles for dropdown")
        return role_options
        
    except Exception as e:
        logger.error(f"❌ Error fetching roles for dropdown: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching roles"
        )

@router.get(
    "/",
    response_model=List[RoleResponse],
    summary="Get all roles",
    description="Get detailed information about all roles. Requires admin privileges."
)
async def get_all_roles(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    Get detailed information about all roles.
    
    **Purpose:** Provides complete role data for admin management
    
    **Returns:**
    - List of RoleResponse with full role details including permissions
    
    Learning: This provides more detailed role information compared
    to the dropdown endpoint, which only needs basic display data.
    """
    try:
        logger.info(f"Fetching all roles by admin {current_admin.username}")
        
        # Query all roles (including inactive for admin visibility)
        roles = db.query(Role).order_by(Role.level.desc()).all()
        
        # Convert to response format
        role_responses = []
        for role in roles:
            role_responses.append(RoleResponse(
                id=role.id,
                name=role.name,
                display_name=role.display_name,
                description=role.description,
                level=role.level,
                is_active=role.is_active,
                is_system_role=role.is_system_role,
                permissions=role.permissions or {},
                created_at=role.created_at,
                updated_at=role.updated_at
            ))
        
        logger.info(f"✅ Found {len(role_responses)} total roles")
        return role_responses
        
    except Exception as e:
        logger.error(f"❌ Error fetching all roles: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching roles"
        )

@router.get(
    "/{role_id}",
    response_model=RoleResponse,
    summary="Get role by ID",
    description="Get detailed information about a specific role. Requires admin privileges."
)
async def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    Get detailed information about a specific role.
    
    **Path Parameters:**
    - role_id: ID of the role to retrieve
    
    **Returns:**
    - RoleResponse with full role details
    """
    try:
        logger.info(f"Fetching role {role_id} by admin {current_admin.username}")
        
        # Query specific role
        role = db.query(Role).filter(Role.id == role_id).first()
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        
        # Convert to response format
        role_response = RoleResponse(
            id=role.id,
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            level=role.level,
            is_active=role.is_active,
            is_system_role=role.is_system_role,
            permissions=role.permissions or {},
            created_at=role.created_at,
            updated_at=role.updated_at
        )
        
        logger.info(f"✅ Found role: {role.name}")
        return role_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching role {role_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching the role"
        )

# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@router.get(
    "/permissions/all",
    response_model=List[str],
    summary="Get all available permissions",
    description="Get list of all permissions that can be assigned to roles. Requires admin privileges."
)
async def get_all_permissions(
    current_admin: User = Depends(get_admin_user)
):
    """
    Get list of all available permissions in the system.
    
    **Purpose:** Shows admins what permissions they can assign to roles
    
    **Returns:**
    - List of permission strings
    
    Learning: This helps admins understand what permissions are available
    when creating or modifying roles.
    """
    try:
        logger.info(f"Fetching all permissions by admin {current_admin.username}")
        
        permissions = PermissionConstants.get_all_permissions()
        
        logger.info(f"✅ Found {len(permissions)} available permissions")
        return permissions
        
    except Exception as e:
        logger.error(f"❌ Error fetching permissions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching permissions"
        )

@router.get(
    "/permissions/by-category",
    response_model=dict,
    summary="Get permissions organized by category",
    description="Get permissions grouped by functional category. Requires admin privileges."
)
async def get_permissions_by_category(
    current_admin: User = Depends(get_admin_user)
):
    """
    Get permissions organized by functional category.
    
    **Purpose:** Helps admins understand permission groupings
    
    **Returns:**
    - Dictionary with categories as keys and permission lists as values
    """
    try:
        logger.info(f"Fetching categorized permissions by admin {current_admin.username}")
        
        permissions_by_category = PermissionConstants.get_permissions_by_category()
        
        logger.info(f"✅ Found {len(permissions_by_category)} permission categories")
        return permissions_by_category
        
    except Exception as e:
        logger.error(f"❌ Error fetching categorized permissions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching categorized permissions"
        )
