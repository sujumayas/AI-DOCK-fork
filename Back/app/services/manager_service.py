# AI Dock Manager Service
# Business logic for department managers - handles department-scoped operations

from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import and_, or_, func, desc, asc
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
import logging

from ..models.user import User
from ..models.role import Role, PermissionConstants
from ..models.department import Department
from ..models.quota import DepartmentQuota, QuotaType, QuotaPeriod, QuotaStatus
from ..models.llm_config import LLMConfiguration
from ..models.usage_log import UsageLog
from ..core.security import get_password_hash
from ..schemas.admin import UserCreateRequest, UserUpdateRequest, UserResponse
from ..schemas.quota import QuotaCreateRequest, QuotaUpdateRequest, QuotaResponse

# Set up logging
logger = logging.getLogger(__name__)

class ManagerService:
    """
    Service class for department manager operations.
    
    This service provides department-scoped access to user and quota management.
    Managers can only see and modify data within their own department.
    
    Key Learning: Service Layer Pattern
    - Encapsulates business logic and data access
    - Enforces security boundaries (department scoping)
    - Provides reusable methods for API endpoints
    - Handles complex queries and validations
    """
    
    def __init__(self, db: Session):
        """
        Initialize the manager service.
        
        Args:
            db: Database session for data access
        """
        self.db = db
    
    # =============================================================================
    # AUTHENTICATION AND PERMISSION HELPERS
    # =============================================================================
    
    def verify_manager_permissions(self, manager: User, required_permission: str) -> bool:
        """
        Verify that a user is a manager with the required permission.
        
        Args:
            manager: User object to check
            required_permission: Permission string to verify
            
        Returns:
            True if user has permission, False otherwise
            
        Learning: Always validate permissions at the service layer,
        not just at the API layer. This provides defense in depth.
        """
        if not manager.is_active:
            logger.warning(f"Inactive manager {manager.email} attempted operation")
            return False
        
        if not manager.role or manager.role.name != "manager":
            logger.warning(f"Non-manager {manager.email} attempted manager operation")
            return False
        
        if not manager.role.has_permission(required_permission):
            logger.warning(f"Manager {manager.email} lacks permission: {required_permission}")
            return False
        
        return True
    
    def get_manager_department_id(self, manager: User) -> Optional[int]:
        """
        Get the department ID for a manager.
        
        Args:
            manager: Manager user object
            
        Returns:
            Department ID if manager has one, None otherwise
            
        Learning: Managers must belong to a department to manage it.
        This enforces the business rule that you can only manage your own department.
        """
        if not manager.department_id:
            logger.error(f"Manager {manager.email} has no department assigned")
            return None
        
        return manager.department_id
    
    # =============================================================================
    # DEPARTMENT-SCOPED USER MANAGEMENT
    # =============================================================================
    
    def get_department_users(
        self, 
        manager: User, 
        search_query: Optional[str] = None,
        role_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        Get users in the manager's department with filtering and pagination.
        
        Args:
            manager: Manager requesting the data
            search_query: Text search across username, name, email
            role_id: Filter by role ID
            is_active: Filter by active status
            page: Page number (1-based)
            page_size: Items per page
            sort_by: Field to sort by
            sort_order: Sort order (asc/desc)
            
        Returns:
            Dictionary with users, pagination info, and department details
            
        Learning: Department scoping is enforced by filtering on department_id.
        This ensures managers only see users in their department.
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_VIEW_USERS):
            raise ValueError("Insufficient permissions to view users")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # Build base query with relationships loaded
        query = self.db.query(User).options(
            selectinload(User.role),
            selectinload(User.department)
        ).filter(
            User.department_id == department_id  # 🔒 DEPARTMENT SCOPING ENFORCED HERE
        )
        
        # Apply search filters
        if search_query:
            search_term = f"%{search_query}%"
            query = query.filter(
                or_(
                    User.username.ilike(search_term),
                    User.full_name.ilike(search_term),
                    User.email.ilike(search_term)
                )
            )
        
        if role_id:
            query = query.filter(User.role_id == role_id)
        
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
        
        # Apply sorting
        try:
            sort_column = getattr(User, sort_by, User.created_at)
            if sort_order.lower() == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))
        except AttributeError:
            # Default to created_at if invalid sort field
            query = query.order_by(desc(User.created_at))
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * page_size
        users = query.offset(offset).limit(page_size).all()
        
        # Get department info
        department = self.db.query(Department).filter(Department.id == department_id).first()
        
        # Calculate pagination metadata
        total_pages = (total_count + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        logger.info(f"Manager {manager.email} retrieved {len(users)} users from department {department.name if department else department_id}")
        
        return {
            "users": users,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": has_next,
            "has_previous": has_previous,
            "department": {
                "id": department_id,
                "name": department.name if department else "Unknown Department",
                "description": department.description if department else None
            }
        }
    
    def create_department_user(
        self, 
        manager: User, 
        user_data: UserCreateRequest
    ) -> User:
        """
        Create a new user in the manager's department.
        
        Args:
            manager: Manager creating the user
            user_data: User creation data
            
        Returns:
            Created user object
            
        Raises:
            ValueError: If manager lacks permissions or data is invalid
            
        Learning: Department managers can create users, but they are
        automatically assigned to the manager's department for security.
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_CREATE_DEPARTMENT_USERS):
            raise ValueError("Insufficient permissions to create users")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # Check if user already exists
        existing_user = self.db.query(User).filter(
            or_(User.email == user_data.email, User.username == user_data.username)
        ).first()
        
        if existing_user:
            raise ValueError(f"User with email '{user_data.email}' or username '{user_data.username}' already exists")
        
        # Validate role exists and is appropriate for managers to assign
        if user_data.role_id:
            role = self.db.query(Role).filter(Role.id == user_data.role_id).first()
            if not role:
                raise ValueError(f"Role with ID {user_data.role_id} not found")
            
            # Managers cannot assign roles higher than their own level
            if role.level >= manager.role.level:
                raise ValueError(f"Cannot assign role '{role.name}' - insufficient privileges")
        else:
            # Default to user role if none specified
            role = self.db.query(Role).filter(Role.name == "user").first()
            if not role:
                raise ValueError("Default user role not found")
            user_data.role_id = role.id
        
        # 🔒 FORCE DEPARTMENT ASSIGNMENT - Manager can only create users in their department
        user_data.department_id = department_id
        
        # Create the user
        new_user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            password_hash=get_password_hash(user_data.password),
            role_id=user_data.role_id,
            department_id=department_id,  # Enforced assignment
            job_title=user_data.job_title,
            phone_number=user_data.phone_number,
            is_active=True,
            is_verified=True,  # Manager-created users are auto-verified
            created_by=manager.email,
            created_at=datetime.utcnow()
        )
        
        try:
            self.db.add(new_user)
            self.db.commit()
            self.db.refresh(new_user)
            
            # Load relationships for response
            self.db.query(User).options(
                selectinload(User.role),
                selectinload(User.department)
            ).filter(User.id == new_user.id).first()
            
            logger.info(f"Manager {manager.email} created user {new_user.email} in department {department_id}")
            
            return new_user
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating user: {str(e)}")
            raise ValueError(f"Failed to create user: {str(e)}")
    
    def update_department_user(
        self, 
        manager: User, 
        user_id: int, 
        update_data: UserUpdateRequest
    ) -> User:
        """
        Update a user in the manager's department.
        
        Args:
            manager: Manager performing the update
            user_id: ID of user to update
            update_data: Update data
            
        Returns:
            Updated user object
            
        Learning: Managers can only update users in their department.
        They also cannot elevate users to roles higher than their own.
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_EDIT_USERS):
            raise ValueError("Insufficient permissions to edit users")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # Get the user and verify they're in the manager's department
        user = self.db.query(User).filter(
            and_(
                User.id == user_id,
                User.department_id == department_id  # 🔒 DEPARTMENT SCOPING
            )
        ).first()
        
        if not user:
            raise ValueError(f"User {user_id} not found in your department")
        
        # Prevent managers from editing other managers or admins
        if user.role and user.role.level >= manager.role.level:
            raise ValueError("Cannot edit users with equal or higher privilege level")
        
        # Update fields that were provided
        update_dict = update_data.dict(exclude_unset=True, exclude_none=True)
        
        # Handle role changes with permission checking
        if "role_id" in update_dict:
            new_role = self.db.query(Role).filter(Role.id == update_dict["role_id"]).first()
            if not new_role:
                raise ValueError(f"Role with ID {update_dict['role_id']} not found")
            
            if new_role.level >= manager.role.level:
                raise ValueError(f"Cannot assign role '{new_role.name}' - insufficient privileges")
        
        # 🔒 PREVENT DEPARTMENT TRANSFER - Managers cannot move users between departments
        if "department_id" in update_dict:
            if update_dict["department_id"] != department_id:
                raise ValueError("Cannot transfer users to different departments")
        
        # Apply updates
        for field, value in update_dict.items():
            if hasattr(user, field) and field not in ["password", "password_hash"]:
                setattr(user, field, value)
        
        user.updated_at = datetime.utcnow()
        
        try:
            self.db.commit()
            self.db.refresh(user)
            
            logger.info(f"Manager {manager.email} updated user {user.email}")
            
            return user
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating user {user_id}: {str(e)}")
            raise ValueError(f"Failed to update user: {str(e)}")
    
    # =============================================================================
    # DEPARTMENT-SCOPED QUOTA MANAGEMENT
    # =============================================================================
    
    def get_department_quotas(
        self,
        manager: User,
        quota_type: Optional[QuotaType] = None,
        quota_period: Optional[QuotaPeriod] = None,
        status: Optional[QuotaStatus] = None,
        is_exceeded: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get quotas for the manager's department with filtering and pagination.
        
        Args:
            manager: Manager requesting the data
            quota_type: Filter by quota type
            quota_period: Filter by quota period
            status: Filter by quota status
            is_exceeded: Filter by exceeded status
            page: Page number
            page_size: Items per page
            
        Returns:
            Dictionary with quotas, pagination info, and department details
            
        Learning: Like user management, quota access is scoped to the manager's department.
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_VIEW_DEPARTMENT_USAGE):
            raise ValueError("Insufficient permissions to view department quotas")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # Build base query with relationships
        query = self.db.query(DepartmentQuota).options(
            joinedload(DepartmentQuota.department),
            joinedload(DepartmentQuota.llm_config)
        ).filter(
            DepartmentQuota.department_id == department_id  # 🔒 DEPARTMENT SCOPING
        )
        
        # Apply filters
        if quota_type:
            query = query.filter(DepartmentQuota.quota_type == quota_type)
        
        if quota_period:
            query = query.filter(DepartmentQuota.quota_period == quota_period)
        
        if status:
            query = query.filter(DepartmentQuota.status == status)
        
        if is_exceeded is not None:
            if is_exceeded:
                query = query.filter(DepartmentQuota.current_usage >= DepartmentQuota.limit_value)
            else:
                query = query.filter(DepartmentQuota.current_usage < DepartmentQuota.limit_value)
        
        # Order by creation date (newest first)
        query = query.order_by(desc(DepartmentQuota.created_at))
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * page_size
        quotas = query.offset(offset).limit(page_size).all()
        
        # Get department info
        department = self.db.query(Department).filter(Department.id == department_id).first()
        
        # Calculate pagination metadata
        total_pages = (total_count + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        # Calculate quota summary
        summary = self._calculate_department_quota_summary(department_id)
        
        logger.info(f"Manager {manager.email} retrieved {len(quotas)} quotas for department {department.name if department else department_id}")
        
        return {
            "quotas": quotas,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": has_next,
            "has_previous": has_previous,
            "department": {
                "id": department_id,
                "name": department.name if department else "Unknown Department",
                "description": department.description if department else None
            },
            "summary": summary
        }
    
    def create_department_quota(
        self,
        manager: User,
        quota_data: QuotaCreateRequest
    ) -> DepartmentQuota:
        """
        Create a new quota for the manager's department.
        
        Args:
            manager: Manager creating the quota
            quota_data: Quota creation data
            
        Returns:
            Created quota object
            
        Learning: Managers can create quotas, but only for their own department.
        The department_id is enforced by the service layer.
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_MANAGE_DEPARTMENT_QUOTAS):
            raise ValueError("Insufficient permissions to create quotas")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # 🔒 FORCE DEPARTMENT ASSIGNMENT - Override any department_id in the request
        quota_data.department_id = department_id
        
        # Validate LLM configuration if specified
        if quota_data.llm_config_id:
            llm_config = self.db.query(LLMConfiguration).filter(
                LLMConfiguration.id == quota_data.llm_config_id
            ).first()
            if not llm_config:
                raise ValueError(f"LLM configuration {quota_data.llm_config_id} not found")
        
        # Check for duplicate quotas (same department + type + period + LLM config)
        existing_quota = self.db.query(DepartmentQuota).filter(
            and_(
                DepartmentQuota.department_id == department_id,
                DepartmentQuota.quota_type == quota_data.quota_type,
                DepartmentQuota.quota_period == quota_data.quota_period,
                DepartmentQuota.llm_config_id == quota_data.llm_config_id
            )
        ).first()
        
        if existing_quota:
            raise ValueError(
                f"Quota already exists for {quota_data.quota_type.value} "
                f"({quota_data.quota_period.value}) in your department"
            )
        
        # Create the quota
        new_quota = DepartmentQuota(
            department_id=department_id,  # Enforced assignment
            quota_type=quota_data.quota_type,
            quota_period=quota_data.quota_period,
            limit_value=quota_data.limit_value,
            current_usage=0.0,
            name=quota_data.name,
            description=quota_data.description,
            llm_config_id=quota_data.llm_config_id,
            is_enforced=quota_data.is_enforced,
            status=QuotaStatus.ACTIVE,
            created_by=manager.email,
            created_at=datetime.utcnow(),
            period_start=datetime.utcnow(),
            period_end=self._calculate_period_end(quota_data.quota_period, datetime.utcnow())
        )
        
        try:
            self.db.add(new_quota)
            self.db.commit()
            self.db.refresh(new_quota)
            
            logger.info(f"Manager {manager.email} created quota '{new_quota.name}' for department {department_id}")
            
            return new_quota
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating quota: {str(e)}")
            raise ValueError(f"Failed to create quota: {str(e)}")
    
    def update_department_quota(
        self,
        manager: User,
        quota_id: int,
        update_data: QuotaUpdateRequest
    ) -> DepartmentQuota:
        """
        Update a quota in the manager's department.
        
        Args:
            manager: Manager performing the update
            quota_id: ID of quota to update
            update_data: Update data
            
        Returns:
            Updated quota object
            
        Learning: Quota updates are scoped to the manager's department.
        Managers cannot modify quotas from other departments.
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_MANAGE_DEPARTMENT_QUOTAS):
            raise ValueError("Insufficient permissions to update quotas")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # Get the quota and verify it's in the manager's department
        quota = self.db.query(DepartmentQuota).filter(
            and_(
                DepartmentQuota.id == quota_id,
                DepartmentQuota.department_id == department_id  # 🔒 DEPARTMENT SCOPING
            )
        ).first()
        
        if not quota:
            raise ValueError(f"Quota {quota_id} not found in your department")
        
        # Update fields that were provided
        update_dict = update_data.dict(exclude_unset=True, exclude_none=True)
        
        # 🔒 PREVENT DEPARTMENT TRANSFER - Managers cannot move quotas between departments
        if "department_id" in update_dict:
            if update_dict["department_id"] != department_id:
                raise ValueError("Cannot transfer quotas to different departments")
        
        # Apply updates
        for field, value in update_dict.items():
            if hasattr(quota, field):
                setattr(quota, field, value)
        
        quota.updated_at = datetime.utcnow()
        
        try:
            self.db.commit()
            self.db.refresh(quota)
            
            logger.info(f"Manager {manager.email} updated quota {quota.name}")
            
            return quota
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating quota {quota_id}: {str(e)}")
            raise ValueError(f"Failed to update quota: {str(e)}")
    
    def reset_department_quota(
        self,
        manager: User,
        quota_id: int
    ) -> DepartmentQuota:
        """
        Reset a quota's usage in the manager's department.
        
        Args:
            manager: Manager performing the reset
            quota_id: ID of quota to reset
            
        Returns:
            Reset quota object
            
        Learning: Quota resets allow managers to give their department
        a "fresh start" if needed (e.g., after fixing a budget issue).
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_RESET_DEPARTMENT_QUOTAS):
            raise ValueError("Insufficient permissions to reset quotas")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # Get the quota and verify it's in the manager's department
        quota = self.db.query(DepartmentQuota).filter(
            and_(
                DepartmentQuota.id == quota_id,
                DepartmentQuota.department_id == department_id  # 🔒 DEPARTMENT SCOPING
            )
        ).first()
        
        if not quota:
            raise ValueError(f"Quota {quota_id} not found in your department")
        
        # Store previous usage for logging
        previous_usage = quota.current_usage
        
        # Reset the quota
        quota.current_usage = 0.0
        quota.updated_at = datetime.utcnow()
        quota.last_reset_at = datetime.utcnow()
        
        # If the quota was suspended due to exceeding, reactivate it
        if quota.status == QuotaStatus.SUSPENDED:
            quota.status = QuotaStatus.ACTIVE
        
        try:
            self.db.commit()
            self.db.refresh(quota)
            
            logger.info(
                f"Manager {manager.email} reset quota {quota.name} "
                f"(was: {previous_usage}, now: 0.0)"
            )
            
            return quota
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error resetting quota {quota_id}: {str(e)}")
            raise ValueError(f"Failed to reset quota: {str(e)}")
    
    # =============================================================================
    # DEPARTMENT ANALYTICS AND REPORTING
    # =============================================================================
    
    def get_department_dashboard_data(self, manager: User) -> Dict[str, Any]:
        """
        Get comprehensive dashboard data for the manager's department.
        
        Args:
            manager: Manager requesting the dashboard data
            
        Returns:
            Dictionary with department overview, user stats, quota status, and usage trends
            
        Learning: Dashboard data aggregates information from multiple models
        to provide a comprehensive view of department health and activity.
        """
        # Verify permissions
        if not self.verify_manager_permissions(manager, PermissionConstants.CAN_VIEW_DEPARTMENT_USAGE):
            raise ValueError("Insufficient permissions to view department dashboard")
        
        department_id = self.get_manager_department_id(manager)
        if not department_id:
            raise ValueError("Manager must be assigned to a department")
        
        # Get department info
        department = self.db.query(Department).filter(Department.id == department_id).first()
        
        # User statistics
        user_stats = self._get_department_user_stats(department_id)
        
        # Quota statistics
        quota_stats = self._calculate_department_quota_summary(department_id)
        
        # Usage statistics (last 30 days)
        usage_stats = self._get_department_usage_stats(department_id, days=30)
        
        # Recent activity
        recent_activity = self._get_recent_department_activity(department_id, limit=10)
        
        logger.info(f"Manager {manager.email} accessed department dashboard for {department.name if department else department_id}")
        
        return {
            "department": {
                "id": department_id,
                "name": department.name if department else "Unknown Department",
                "description": department.description if department else None,
                "created_at": department.created_at.isoformat() if (department and department.created_at and hasattr(department.created_at, 'isoformat')) else None
            },
            "user_stats": user_stats,
            "quota_stats": quota_stats,
            "usage_stats": usage_stats,
            "recent_activity": recent_activity,
            "last_updated": datetime.utcnow().isoformat()
        }
    
    # =============================================================================
    # PRIVATE HELPER METHODS
    # =============================================================================
    
    def _get_department_user_stats(self, department_id: int) -> Dict[str, Any]:
        """Get user statistics for a department"""
        # Total users
        total_users = self.db.query(User).filter(User.department_id == department_id).count()
        
        # Active users
        active_users = self.db.query(User).filter(
            and_(User.department_id == department_id, User.is_active == True)
        ).count()
        
        # Users by role
        users_by_role = self.db.query(
            Role.name,
            Role.display_name,
            func.count(User.id).label('count')
        ).join(
            User, Role.id == User.role_id
        ).filter(
            User.department_id == department_id
        ).group_by(
            Role.id, Role.name, Role.display_name
        ).all()
        
        # Recent user activity (users created in last 30 days)
        recent_cutoff = datetime.utcnow() - timedelta(days=30)
        recent_users = self.db.query(User).filter(
            and_(
                User.department_id == department_id,
                User.created_at >= recent_cutoff
            )
        ).count()
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": total_users - active_users,
            "recent_users": recent_users,
            "users_by_role": [
                {
                    "role_name": role.name,
                    "role_display_name": role.display_name,
                    "count": role.count
                }
                for role in users_by_role
            ]
        }
    
    def _calculate_department_quota_summary(self, department_id: int) -> Dict[str, Any]:
        """Calculate quota summary for a department"""
        quotas = self.db.query(DepartmentQuota).filter(
            DepartmentQuota.department_id == department_id
        ).all()
        
        if not quotas:
            return {
                "total_quotas": 0,
                "active_quotas": 0,
                "exceeded_quotas": 0,
                "near_limit_quotas": 0,
                "total_monthly_cost_limit": 0.0,
                "total_monthly_cost_used": 0.0
            }
        
        summary = {
            "total_quotas": len(quotas),
            "active_quotas": 0,
            "exceeded_quotas": 0,
            "near_limit_quotas": 0,
            "total_monthly_cost_limit": 0.0,
            "total_monthly_cost_used": 0.0
        }
        
        for quota in quotas:
            if quota.status == QuotaStatus.ACTIVE:
                summary["active_quotas"] += 1
            
            if quota.is_exceeded():
                summary["exceeded_quotas"] += 1
            elif quota.is_near_limit():
                summary["near_limit_quotas"] += 1
            
            # Sum monthly cost quotas
            if quota.quota_type == QuotaType.COST and quota.quota_period == QuotaPeriod.MONTHLY:
                summary["total_monthly_cost_limit"] += float(quota.limit_value)
                summary["total_monthly_cost_used"] += float(quota.current_usage)
        
        return summary
    
    def _get_department_usage_stats(self, department_id: int, days: int = 30) -> Dict[str, Any]:
        """Get usage statistics for a department over the specified period"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get users in this department
        user_ids = self.db.query(User.id).filter(User.department_id == department_id).subquery()
        
        # Usage logs for department users
        usage_logs = self.db.query(
            func.count(UsageLog.id).label('total_requests'),
            func.sum(UsageLog.total_tokens).label('total_tokens'),
            func.sum(UsageLog.estimated_cost).label('total_cost'),
            func.avg(UsageLog.response_time_ms).label('avg_response_time')
        ).filter(
            and_(
                UsageLog.user_id.in_(user_ids),
                UsageLog.created_at >= cutoff_date
            )
        ).first()
        
        # Daily usage trend
        daily_usage = self.db.query(
            func.date(UsageLog.created_at).label('date'),
            func.count(UsageLog.id).label('requests'),
            func.sum(UsageLog.estimated_cost).label('cost')
        ).filter(
            and_(
                UsageLog.user_id.in_(user_ids),
                UsageLog.created_at >= cutoff_date
            )
        ).group_by(
            func.date(UsageLog.created_at)
        ).order_by(
            func.date(UsageLog.created_at)
        ).all()
        
        return {
            "period_days": days,
            "total_requests": int(usage_logs.total_requests or 0),
            "total_tokens": int(usage_logs.total_tokens or 0),
            "total_cost": float(usage_logs.total_cost or 0),
            "avg_response_time_ms": float(usage_logs.avg_response_time or 0),
            "daily_trend": [
                {
                    "date": day.date.isoformat() if hasattr(day.date, 'isoformat') else str(day.date),
                    "requests": day.requests,
                    "cost": float(day.cost or 0)
                }
                for day in daily_usage
            ]
        }
    
    def _get_recent_department_activity(self, department_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent activity for a department"""
        # Get users in this department
        user_ids = self.db.query(User.id).filter(User.department_id == department_id).subquery()
        
        # Recent usage logs
        recent_logs = self.db.query(UsageLog).options(
            joinedload(UsageLog.user),
            joinedload(UsageLog.llm_config)
        ).filter(
            UsageLog.user_id.in_(user_ids)
        ).order_by(
            desc(UsageLog.created_at)
        ).limit(limit).all()
        
        return [
            {
                "id": log.id,
                "user_name": log.user.full_name if log.user else "Unknown User",
                "user_email": log.user.email if log.user else "unknown",
                "llm_provider": log.llm_config.name if log.llm_config else "Unknown Provider",
                "provider": log.provider,
                "model": log.model,
                "total_tokens": log.total_tokens,
                "estimated_cost": float(log.estimated_cost or 0),
                "success": log.success,
                "created_at": log.created_at.isoformat() if hasattr(log.created_at, 'isoformat') else str(log.created_at)
            }
            for log in recent_logs
        ]
    
    def _calculate_period_end(self, quota_period: QuotaPeriod, start_date: datetime) -> datetime:
        """Calculate the end date for a quota period"""
        if quota_period == QuotaPeriod.DAILY:
            return start_date + timedelta(days=1)
        elif quota_period == QuotaPeriod.WEEKLY:
            return start_date + timedelta(weeks=1)
        elif quota_period == QuotaPeriod.MONTHLY:
            # Add one month (approximately)
            if start_date.month == 12:
                return start_date.replace(year=start_date.year + 1, month=1)
            else:
                return start_date.replace(month=start_date.month + 1)
        elif quota_period == QuotaPeriod.YEARLY:
            return start_date.replace(year=start_date.year + 1)
        else:
            # Default to monthly
            return start_date + timedelta(days=30)

# =============================================================================
# SERVICE FACTORY FUNCTION
# =============================================================================

def get_manager_service(db: Session) -> ManagerService:
    """
    Factory function to create a ManagerService instance.
    
    Args:
        db: Database session
        
    Returns:
        ManagerService instance
        
    Learning: Factory functions are a common pattern for creating
        service instances with dependency injection.
    """
    return ManagerService(db)
