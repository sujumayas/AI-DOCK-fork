# AI Dock Role Model
# This defines user roles and their permissions in the system

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

from ..core.database import Base

class RoleType(Enum):
    """
    Predefined role types for the AI Dock system.
    
    Using an Enum ensures we only have valid role types and prevents typos.
    Think of this as a "dropdown list" of allowed roles.
    """
    ADMIN = "admin"           # Full system access
    MANAGER = "manager"       # Department management + user access
    ANALYST = "analyst"       # Advanced AI features + reports
    USER = "user"            # Basic AI chat access
    GUEST = "guest"          # Limited read-only access

class Role(Base):
    """
    Role model representing user roles and permissions.
    
    Roles define what users can do in the system:
    - Admins can manage everything
    - Managers can manage their department 
    - Users can access AI chat features
    - Guests have read-only access
    
    Table: roles
    Purpose: Define user permissions and access levels
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "roles"
    
    # =============================================================================
    # COLUMNS (DATABASE FIELDS)
    # =============================================================================
    
    # Primary Key - unique identifier for each role
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique role identifier"
    )
    
    # Role name (admin, manager, user, etc.)
    name = Column(
        String(50),
        unique=True,                # Each role name must be unique
        index=True,
        nullable=False,
        comment="Role name (admin, manager, user, etc.)"
    )
    
    # Human-friendly role title for display
    display_name = Column(
        String(100),
        nullable=False,
        comment="Human-friendly role title for UI display"
    )
    
    # Detailed description of what this role can do
    description = Column(
        Text,
        nullable=True,
        comment="Detailed description of role responsibilities and permissions"
    )
    
    # Role hierarchy level (higher numbers = more permissions)
    # This helps us check "is user X allowed to manage user Y?"
    level = Column(
        Integer,
        default=1,
        nullable=False,
        comment="Role hierarchy level (higher = more permissions)"
    )
    
    # Is this role currently active/available for assignment?
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether this role is currently active"
    )
    
    # Is this a built-in system role that can't be deleted?
    is_system_role = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this is a built-in system role"
    )
    
    # =============================================================================
    # PERMISSIONS (JSON FIELD)
    # =============================================================================
    
    # Store permissions as JSON for flexibility
    # This allows us to easily add new permissions without changing the database
    permissions = Column(
        JSON,
        default=dict,               # Empty dict by default
        nullable=False,
        comment="JSON object containing role permissions"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the role was created"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="When the role was last updated"
    )
    
    # Who created this role (for audit trail)
    created_by = Column(
        String(100),
        nullable=True,
        comment="Username of who created this role"
    )
    
    # =============================================================================
    # RELATIONSHIPS
    # =============================================================================
    
    # One role can be assigned to many users
    # This creates a "one-to-many" relationship
    # We'll add this after we update the User model
    # users = relationship("User", back_populates="role")
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"<Role(id={self.id}, name='{self.name}', level={self.level})>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        return f"{self.display_name} ({self.name})"
    
    # =============================================================================
    # PERMISSION CHECKING METHODS
    # =============================================================================
    
    def has_permission(self, permission: str) -> bool:
        """
        Check if this role has a specific permission.
        
        Args:
            permission: Permission to check (e.g., 'can_manage_users')
            
        Returns:
            True if role has permission, False otherwise
            
        Example:
            admin_role.has_permission('can_delete_users')  # True
            user_role.has_permission('can_delete_users')   # False
        """
        if not self.permissions:
            return False
        return self.permissions.get(permission, False)
    
    def add_permission(self, permission: str) -> None:
        """
        Add a permission to this role.
        
        Args:
            permission: Permission name to add
        """
        if not self.permissions:
            self.permissions = {}
        self.permissions[permission] = True
    
    def remove_permission(self, permission: str) -> None:
        """
        Remove a permission from this role.
        
        Args:
            permission: Permission name to remove
        """
        if self.permissions and permission in self.permissions:
            del self.permissions[permission]
    
    def can_manage_role(self, other_role: 'Role') -> bool:
        """
        Check if this role can manage another role.
        Higher level roles can manage lower level roles.
        
        Args:
            other_role: The role to check if we can manage
            
        Returns:
            True if this role can manage the other role
        """
        return self.level > other_role.level
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    def get_all_permissions(self) -> List[str]:
        """
        Get a list of all permissions this role has.
        
        Returns:
            List of permission names
        """
        if not self.permissions:
            return []
        return [perm for perm, enabled in self.permissions.items() if enabled]
    
    def copy_permissions_from(self, other_role: 'Role') -> None:
        """
        Copy all permissions from another role.
        
        Args:
            other_role: Role to copy permissions from
        """
        if other_role.permissions:
            self.permissions = other_role.permissions.copy()
    
    @classmethod
    def get_role_hierarchy(cls) -> Dict[str, int]:
        """
        Get the standard role hierarchy mapping.
        
        Returns:
            Dictionary mapping role names to their levels
        """
        return {
            RoleType.GUEST.value: 1,
            RoleType.USER.value: 2,
            RoleType.ANALYST.value: 3,
            RoleType.MANAGER.value: 4,
            RoleType.ADMIN.value: 5
        }

# =============================================================================
# PERMISSION CONSTANTS
# =============================================================================

class PermissionConstants:
    """
    Define all available permissions in the system.
    
    This makes it easy to see all permissions and prevents typos.
    Like having a "master list" of what users can do.
    """
    
    # =============================================================================
    # USER MANAGEMENT PERMISSIONS
    # =============================================================================
    CAN_VIEW_USERS = "can_view_users"
    CAN_CREATE_USERS = "can_create_users"
    CAN_EDIT_USERS = "can_edit_users"
    CAN_DELETE_USERS = "can_delete_users"
    CAN_MANAGE_USER_ROLES = "can_manage_user_roles"
    
    # =============================================================================
    # DEPARTMENT MANAGEMENT PERMISSIONS
    # =============================================================================
    CAN_VIEW_DEPARTMENTS = "can_view_departments"
    CAN_CREATE_DEPARTMENTS = "can_create_departments"
    CAN_EDIT_DEPARTMENTS = "can_edit_departments"
    CAN_DELETE_DEPARTMENTS = "can_delete_departments"
    CAN_MANAGE_DEPARTMENT_USERS = "can_manage_department_users"
    
    # =============================================================================
    # AI/LLM ACCESS PERMISSIONS
    # =============================================================================
    CAN_USE_AI_CHAT = "can_use_ai_chat"
    CAN_USE_ADVANCED_AI = "can_use_advanced_ai"
    CAN_ACCESS_AI_HISTORY = "can_access_ai_history"
    CAN_CONFIGURE_AI_PROVIDERS = "can_configure_ai_providers"
    
    # =============================================================================
    # QUOTA AND USAGE PERMISSIONS
    # =============================================================================
    CAN_VIEW_USAGE_STATS = "can_view_usage_stats"
    CAN_VIEW_ALL_USAGE = "can_view_all_usage"
    CAN_MANAGE_QUOTAS = "can_manage_quotas"
    CAN_OVERRIDE_QUOTAS = "can_override_quotas"
    
    # =============================================================================
    # DEPARTMENT-SCOPED PERMISSIONS (for managers)
    # =============================================================================
    CAN_MANAGE_DEPARTMENT_QUOTAS = "can_manage_department_quotas"
    CAN_VIEW_DEPARTMENT_USAGE = "can_view_department_usage"
    CAN_CREATE_DEPARTMENT_USERS = "can_create_department_users"
    CAN_RESET_DEPARTMENT_QUOTAS = "can_reset_department_quotas"
    
    # =============================================================================
    # SYSTEM ADMINISTRATION PERMISSIONS
    # =============================================================================
    CAN_VIEW_ADMIN_PANEL = "can_view_admin_panel"
    CAN_MANAGE_SYSTEM_SETTINGS = "can_manage_system_settings"
    CAN_VIEW_SYSTEM_LOGS = "can_view_system_logs"
    CAN_MANAGE_ROLES = "can_manage_roles"
    
    @classmethod
    def get_all_permissions(cls) -> List[str]:
        """Get a list of all available permissions."""
        return [
            value for name, value in cls.__dict__.items()
            if isinstance(value, str) and name.startswith('CAN_')
        ]
    
    @classmethod
    def get_permissions_by_category(cls) -> Dict[str, List[str]]:
        """Get permissions organized by category."""
        return {
            "User Management": [
                cls.CAN_VIEW_USERS,
                cls.CAN_CREATE_USERS,
                cls.CAN_EDIT_USERS,
                cls.CAN_DELETE_USERS,
                cls.CAN_MANAGE_USER_ROLES,
            ],
            "Department Management": [
                cls.CAN_VIEW_DEPARTMENTS,
                cls.CAN_CREATE_DEPARTMENTS,
                cls.CAN_EDIT_DEPARTMENTS,
                cls.CAN_DELETE_DEPARTMENTS,
                cls.CAN_MANAGE_DEPARTMENT_USERS,
            ],
            "AI/LLM Access": [
                cls.CAN_USE_AI_CHAT,
                cls.CAN_USE_ADVANCED_AI,
                cls.CAN_ACCESS_AI_HISTORY,
                cls.CAN_CONFIGURE_AI_PROVIDERS,
            ],
            "Usage & Quotas": [
                cls.CAN_VIEW_USAGE_STATS,
                cls.CAN_VIEW_ALL_USAGE,
                cls.CAN_MANAGE_QUOTAS,
                cls.CAN_OVERRIDE_QUOTAS,
            ],
            "Department Management (Manager-Only)": [
                cls.CAN_MANAGE_DEPARTMENT_QUOTAS,
                cls.CAN_VIEW_DEPARTMENT_USAGE,
                cls.CAN_CREATE_DEPARTMENT_USERS,
                cls.CAN_RESET_DEPARTMENT_QUOTAS,
            ],
            "System Administration": [
                cls.CAN_VIEW_ADMIN_PANEL,
                cls.CAN_MANAGE_SYSTEM_SETTINGS,
                cls.CAN_VIEW_SYSTEM_LOGS,
                cls.CAN_MANAGE_ROLES,
            ],
        }

# =============================================================================
# HELPER FUNCTIONS FOR CREATING DEFAULT ROLES
# =============================================================================

def create_default_roles() -> List[Role]:
    """
    Create the default system roles with appropriate permissions.
    
    This function sets up the basic roles every AI Dock installation needs.
    """
    roles = []
    
    # =============================================================================
    # ADMIN ROLE - Can do everything
    # =============================================================================
    admin_role = Role(
        name=RoleType.ADMIN.value,
        display_name="System Administrator",
        description="Full system access with all permissions",
        level=5,
        is_system_role=True,
        permissions={perm: True for perm in PermissionConstants.get_all_permissions()},
        created_by="system"
    )
    roles.append(admin_role)
    
    # =============================================================================
    # MANAGER ROLE - Can manage department users and quotas
    # =============================================================================
    manager_role = Role(
        name=RoleType.MANAGER.value,
        display_name="Department Manager",
        description="Can manage department users, quotas, and view usage reports",
        level=4,
        is_system_role=True,
        permissions={
            # User management (department-scoped)
            PermissionConstants.CAN_VIEW_USERS: True,
            PermissionConstants.CAN_EDIT_USERS: True,
            PermissionConstants.CAN_CREATE_DEPARTMENT_USERS: True,
            PermissionConstants.CAN_MANAGE_DEPARTMENT_USERS: True,
            PermissionConstants.CAN_VIEW_DEPARTMENTS: True,
            
            # Quota management (department-scoped)
            PermissionConstants.CAN_MANAGE_DEPARTMENT_QUOTAS: True,
            PermissionConstants.CAN_VIEW_DEPARTMENT_USAGE: True,
            PermissionConstants.CAN_RESET_DEPARTMENT_QUOTAS: True,
            
            # AI access
            PermissionConstants.CAN_USE_AI_CHAT: True,
            PermissionConstants.CAN_USE_ADVANCED_AI: True,
            PermissionConstants.CAN_ACCESS_AI_HISTORY: True,
            
            # Reporting
            PermissionConstants.CAN_VIEW_USAGE_STATS: True,
        },
        created_by="system"
    )
    roles.append(manager_role)
    
    # =============================================================================
    # ANALYST ROLE - Advanced AI access with reporting
    # =============================================================================
    analyst_role = Role(
        name=RoleType.ANALYST.value,
        display_name="Data Analyst",
        description="Advanced AI features with usage analytics access",
        level=3,
        is_system_role=True,
        permissions={
            PermissionConstants.CAN_VIEW_USERS: True,
            PermissionConstants.CAN_USE_AI_CHAT: True,
            PermissionConstants.CAN_USE_ADVANCED_AI: True,
            PermissionConstants.CAN_ACCESS_AI_HISTORY: True,
            PermissionConstants.CAN_VIEW_USAGE_STATS: True,
        },
        created_by="system"
    )
    roles.append(analyst_role)
    
    # =============================================================================
    # USER ROLE - Basic AI access
    # =============================================================================
    user_role = Role(
        name=RoleType.USER.value,
        display_name="Standard User",
        description="Basic AI chat access with personal usage tracking",
        level=2,
        is_system_role=True,
        permissions={
            PermissionConstants.CAN_USE_AI_CHAT: True,
            PermissionConstants.CAN_ACCESS_AI_HISTORY: True,
        },
        created_by="system"
    )
    roles.append(user_role)
    
    # =============================================================================
    # GUEST ROLE - Limited read-only access
    # =============================================================================
    guest_role = Role(
        name=RoleType.GUEST.value,
        display_name="Guest User",
        description="Limited read-only access for temporary users",
        level=1,
        is_system_role=True,
        permissions={
            # Guests get very minimal permissions
        },
        created_by="system"
    )
    roles.append(guest_role)
    
    return roles

def get_default_user_role() -> str:
    """Get the default role name for new users."""
    return RoleType.USER.value

def get_admin_role() -> str:
    """Get the admin role name."""
    return RoleType.ADMIN.value
