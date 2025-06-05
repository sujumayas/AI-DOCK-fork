# AI Dock Admin Service
# This contains all business logic for admin user management operations

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, asc
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging

from ..models.user import User
from ..models.role import Role
from ..models.department import Department
from ..schemas.admin import (
    UserCreateRequest, UserUpdateRequest, UserPasswordUpdate,
    UserResponse, UserListResponse, UserSearchFilters,
    BulkUserAction, BulkUserOperation, BulkOperationResult,
    UserStatsResponse
)
from ..core.security import get_password_hash, verify_password
from ..core.database import get_db

# Set up logging for this service
logger = logging.getLogger(__name__)

class AdminService:
    """
    Service class for admin user management operations.
    
    This class contains all the business logic for managing users.
    It's separated from the API endpoints to make the code more testable
    and reusable.
    
    Learning: Service classes are a common pattern in web applications.
    They handle the "what" (business logic) while controllers handle the "how" (HTTP).
    """
    
    def __init__(self, db: Session):
        """
        Initialize the admin service with a database session.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
    
    # =============================================================================
    # USER CREATION METHODS
    # =============================================================================
    
    def create_user(self, user_data: UserCreateRequest, created_by_admin_id: int) -> UserResponse:
        """
        Create a new user account.
        
        Args:
            user_data: Validated user creation data
            created_by_admin_id: ID of the admin creating this user
            
        Returns:
            UserResponse with the created user data
            
        Raises:
            ValueError: If user validation fails
            
        Learning: This shows how to handle database transactions safely.
        If anything fails, the entire operation is rolled back.
        """
        logger.info(f"Creating new user: {user_data.username} by admin {created_by_admin_id}")
        
        try:
            # Check if email or username already exists
            existing_user = self.db.query(User).filter(
                or_(
                    User.email == user_data.email,
                    User.username == user_data.username
                )
            ).first()
            
            if existing_user:
                if existing_user.email == user_data.email:
                    raise ValueError(f"User with email {user_data.email} already exists")
                else:
                    raise ValueError(f"User with username {user_data.username} already exists")
            
            # Validate that the role exists
            role = self.db.query(Role).filter(Role.id == user_data.role_id).first()
            if not role:
                raise ValueError(f"Role with ID {user_data.role_id} does not exist")
            
            # Validate department if provided
            department = None
            if user_data.department_id:
                department = self.db.query(Department).filter(
                    Department.id == user_data.department_id
                ).first()
                if not department:
                    raise ValueError(f"Department with ID {user_data.department_id} does not exist")
            
            # Hash the password securely
            password_hash = get_password_hash(user_data.password)
            
            # Create the new user object
            new_user = User(
                email=user_data.email,
                username=user_data.username,
                full_name=user_data.full_name,
                password_hash=password_hash,
                role_id=user_data.role_id,
                department_id=user_data.department_id,
                job_title=user_data.job_title,
                is_active=user_data.is_active,
                is_admin=user_data.is_admin,
                bio=user_data.bio,
                is_verified=True,  # Admin-created users are auto-verified
            )
            
            # Add to database and commit
            self.db.add(new_user)
            self.db.commit()
            self.db.refresh(new_user)  # Get the ID and other generated fields
            
            logger.info(f"Successfully created user {new_user.id}: {new_user.username}")
            
            # Return the user data (without password hash)
            return self._user_to_response(new_user)
            
        except Exception as e:
            logger.error(f"Failed to create user {user_data.username}: {str(e)}")
            self.db.rollback()  # Undo any database changes
            raise
    
    # =============================================================================
    # USER RETRIEVAL METHODS
    # =============================================================================
    
    def get_user_by_id(self, user_id: int) -> Optional[UserResponse]:
        """
        Get a user by their ID.
        
        Args:
            user_id: ID of the user to retrieve
            
        Returns:
            UserResponse if user found, None otherwise
            
        Learning: joinedload is used to efficiently load related data
        (role and department) in a single database query.
        """
        user = self.db.query(User).options(
            joinedload(User.role),
            joinedload(User.department)
        ).filter(User.id == user_id).first()
        
        if user:
            return self._user_to_response(user)
        return None
    
    def get_user_by_username(self, username: str) -> Optional[UserResponse]:
        """
        Get a user by their username.
        
        Args:
            username: Username to search for
            
        Returns:
            UserResponse if user found, None otherwise
        """
        user = self.db.query(User).options(
            joinedload(User.role),
            joinedload(User.department)
        ).filter(User.username == username).first()
        
        if user:
            return self._user_to_response(user)
        return None
    
    def get_user_by_email(self, email: str) -> Optional[UserResponse]:
        """
        Get a user by their email address.
        
        Args:
            email: Email address to search for
            
        Returns:
            UserResponse if user found, None otherwise
        """
        user = self.db.query(User).options(
            joinedload(User.role),
            joinedload(User.department)
        ).filter(User.email == email).first()
        
        if user:
            return self._user_to_response(user)
        return None
    
    # =============================================================================
    # USER SEARCH AND LISTING METHODS
    # =============================================================================
    
    def search_users(self, filters: UserSearchFilters) -> UserListResponse:
        """
        Search and filter users with pagination.
        
        Args:
            filters: Search filters and pagination parameters
            
        Returns:
            UserListResponse with matching users and pagination info
            
        Learning: This shows how to build complex database queries
        with multiple optional filters and pagination.
        """
        logger.info(f"Searching users with filters: {filters.dict()}")
        
        # Start with base query including related data
        query = self.db.query(User).options(
            joinedload(User.role),
            joinedload(User.department)
        )
        
        # Apply text search filter
        if filters.search_query:
            search_term = f"%{filters.search_query}%"
            query = query.filter(
                or_(
                    User.username.ilike(search_term),
                    User.full_name.ilike(search_term),
                    User.email.ilike(search_term),
                    User.job_title.ilike(search_term)
                )
            )
        
        # Apply role filters
        if filters.role_id:
            query = query.filter(User.role_id == filters.role_id)
        
        if filters.role_name:
            query = query.join(Role).filter(Role.name.ilike(f"%{filters.role_name}%"))
        
        # Apply department filters
        if filters.department_id:
            query = query.filter(User.department_id == filters.department_id)
        
        if filters.department_name:
            query = query.join(Department).filter(
                Department.name.ilike(f"%{filters.department_name}%")
            )
        
        # Apply status filters
        if filters.is_active is not None:
            query = query.filter(User.is_active == filters.is_active)
        
        if filters.is_admin is not None:
            query = query.filter(User.is_admin == filters.is_admin)
        
        if filters.is_verified is not None:
            query = query.filter(User.is_verified == filters.is_verified)
        
        # Apply date range filters
        if filters.created_after:
            query = query.filter(User.created_at >= filters.created_after)
        
        if filters.created_before:
            query = query.filter(User.created_at <= filters.created_before)
        
        # Get total count before applying pagination
        total_count = query.count()
        
        # Apply sorting
        sort_column = getattr(User, filters.sort_by, User.created_at)
        if filters.sort_order == 'asc':
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))
        
        # Apply pagination
        offset = (filters.page - 1) * filters.page_size
        users = query.offset(offset).limit(filters.page_size).all()
        
        # Calculate pagination info
        total_pages = (total_count + filters.page_size - 1) // filters.page_size
        has_next_page = filters.page < total_pages
        has_previous_page = filters.page > 1
        
        # Convert users to response format
        user_responses = [self._user_to_response(user) for user in users]
        
        return UserListResponse(
            users=user_responses,
            total_count=total_count,
            page=filters.page,
            page_size=filters.page_size,
            total_pages=total_pages,
            has_next_page=has_next_page,
            has_previous_page=has_previous_page
        )
    
    # =============================================================================
    # USER UPDATE METHODS
    # =============================================================================
    
    def update_user(self, user_id: int, update_data: UserUpdateRequest, 
                   updated_by_admin_id: int) -> UserResponse:
        """
        Update an existing user's information.
        
        Args:
            user_id: ID of the user to update
            update_data: Fields to update
            updated_by_admin_id: ID of the admin making the update
            
        Returns:
            UserResponse with updated user data
            
        Raises:
            ValueError: If user not found or validation fails
            
        Learning: This shows how to handle partial updates where
        only provided fields are changed.
        """
        logger.info(f"Updating user {user_id} by admin {updated_by_admin_id}")
        
        try:
            # Get the existing user
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError(f"User with ID {user_id} not found")
            
            # Check for conflicts with new email/username
            if update_data.email and update_data.email != user.email:
                existing = self.db.query(User).filter(
                    and_(User.email == update_data.email, User.id != user_id)
                ).first()
                if existing:
                    raise ValueError(f"Email {update_data.email} is already in use")
            
            if update_data.username and update_data.username != user.username:
                existing = self.db.query(User).filter(
                    and_(User.username == update_data.username, User.id != user_id)
                ).first()
                if existing:
                    raise ValueError(f"Username {update_data.username} is already in use")
            
            # Validate role if being changed
            if update_data.role_id and update_data.role_id != user.role_id:
                role = self.db.query(Role).filter(Role.id == update_data.role_id).first()
                if not role:
                    raise ValueError(f"Role with ID {update_data.role_id} does not exist")
            
            # Validate department if being changed
            if update_data.department_id and update_data.department_id != user.department_id:
                dept = self.db.query(Department).filter(
                    Department.id == update_data.department_id
                ).first()
                if not dept:
                    raise ValueError(f"Department with ID {update_data.department_id} does not exist")
            
            # Update fields that were provided
            update_fields = update_data.dict(exclude_unset=True)  # Only fields that were set
            for field, value in update_fields.items():
                setattr(user, field, value)
            
            # Update the timestamp
            user.updated_at = datetime.utcnow()
            
            # Commit changes
            self.db.commit()
            self.db.refresh(user)
            
            logger.info(f"Successfully updated user {user_id}")
            
            # Return updated user data
            return self._user_to_response(user)
            
        except Exception as e:
            logger.error(f"Failed to update user {user_id}: {str(e)}")
            self.db.rollback()
            raise
    
    def update_user_password(self, user_id: int, password_data: UserPasswordUpdate,
                           updated_by_admin_id: int) -> bool:
        """
        Update a user's password.
        
        Args:
            user_id: ID of the user whose password to update
            password_data: New password data
            updated_by_admin_id: ID of the admin making the change
            
        Returns:
            True if password was updated successfully
            
        Raises:
            ValueError: If user not found or validation fails
            
        Learning: Password updates are handled separately for security.
        This allows different logging and potentially different permissions.
        """
        logger.info(f"Updating password for user {user_id} by admin {updated_by_admin_id}")
        
        try:
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError(f"User with ID {user_id} not found")
            
            # Hash the new password
            new_password_hash = get_password_hash(password_data.new_password)
            
            # Update password
            user.password_hash = new_password_hash
            user.updated_at = datetime.utcnow()
            
            self.db.commit()
            
            logger.info(f"Successfully updated password for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update password for user {user_id}: {str(e)}")
            self.db.rollback()
            raise
    
    # =============================================================================
    # USER ACTIVATION/DEACTIVATION METHODS
    # =============================================================================
    
    def activate_user(self, user_id: int, activated_by_admin_id: int) -> UserResponse:
        """
        Activate a user account.
        
        Args:
            user_id: ID of the user to activate
            activated_by_admin_id: ID of the admin activating the user
            
        Returns:
            UserResponse with updated user data
        """
        logger.info(f"Activating user {user_id} by admin {activated_by_admin_id}")
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        user.is_active = True
        user.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(user)
        
        return self._user_to_response(user)
    
    def deactivate_user(self, user_id: int, deactivated_by_admin_id: int) -> UserResponse:
        """
        Deactivate a user account.
        
        Args:
            user_id: ID of the user to deactivate
            deactivated_by_admin_id: ID of the admin deactivating the user
            
        Returns:
            UserResponse with updated user data
        """
        logger.info(f"Deactivating user {user_id} by admin {deactivated_by_admin_id}")
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        user.is_active = False
        user.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(user)
        
        return self._user_to_response(user)
    
    # =============================================================================
    # USER DELETION METHODS
    # =============================================================================
    
    def delete_user(self, user_id: int, deleted_by_admin_id: int) -> bool:
        """
        Delete a user account.
        
        Args:
            user_id: ID of the user to delete
            deleted_by_admin_id: ID of the admin deleting the user
            
        Returns:
            True if user was deleted successfully
            
        Raises:
            ValueError: If user not found or cannot be deleted
            
        Learning: Be careful with deletions in production!
        Often it's better to "soft delete" (mark as deleted) rather than
        actually removing data from the database.
        """
        logger.info(f"Deleting user {user_id} by admin {deleted_by_admin_id}")
        
        try:
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError(f"User with ID {user_id} not found")
            
            # Prevent admins from deleting themselves
            if user_id == deleted_by_admin_id:
                raise ValueError("You cannot delete your own account")
            
            # For safety, prevent deletion of the last admin user
            if user.is_admin:
                admin_count = self.db.query(User).filter(User.is_admin == True).count()
                if admin_count <= 1:
                    raise ValueError("Cannot delete the last admin user")
            
            # Delete the user
            self.db.delete(user)
            self.db.commit()
            
            logger.info(f"Successfully deleted user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete user {user_id}: {str(e)}")
            self.db.rollback()
            raise
    
    # =============================================================================
    # BULK OPERATIONS METHODS
    # =============================================================================
    
    def perform_bulk_operation(self, operation: BulkUserOperation, 
                             performed_by_admin_id: int) -> BulkOperationResult:
        """
        Perform bulk operations on multiple users.
        
        Args:
            operation: Bulk operation to perform
            performed_by_admin_id: ID of admin performing the operation
            
        Returns:
            BulkOperationResult with success/failure details
            
        Learning: Bulk operations require careful error handling.
        We want to process as many users as possible and report
        detailed results for each one.
        """
        logger.info(f"Performing bulk {operation.action} on {len(operation.user_ids)} users")
        
        successful_user_ids = []
        failed_operations = []
        
        for user_id in operation.user_ids:
            try:
                if operation.action == BulkUserAction.ACTIVATE:
                    self.activate_user(user_id, performed_by_admin_id)
                    successful_user_ids.append(user_id)
                    
                elif operation.action == BulkUserAction.DEACTIVATE:
                    self.deactivate_user(user_id, performed_by_admin_id)
                    successful_user_ids.append(user_id)
                    
                elif operation.action == BulkUserAction.DELETE:
                    self.delete_user(user_id, performed_by_admin_id)
                    successful_user_ids.append(user_id)
                    
                elif operation.action == BulkUserAction.CHANGE_ROLE:
                    update_data = UserUpdateRequest(role_id=operation.new_role_id)
                    self.update_user(user_id, update_data, performed_by_admin_id)
                    successful_user_ids.append(user_id)
                    
                elif operation.action == BulkUserAction.CHANGE_DEPARTMENT:
                    update_data = UserUpdateRequest(department_id=operation.new_department_id)
                    self.update_user(user_id, update_data, performed_by_admin_id)
                    successful_user_ids.append(user_id)
                    
            except Exception as e:
                failed_operations.append({
                    "user_id": user_id,
                    "error": str(e)
                })
        
        # Generate summary message
        total_requested = len(operation.user_ids)
        successful_count = len(successful_user_ids)
        failed_count = len(failed_operations)
        
        summary_message = (
            f"Successfully {operation.action} {successful_count} out of {total_requested} users."
        )
        if failed_count > 0:
            summary_message += f" {failed_count} operations failed."
        
        return BulkOperationResult(
            total_requested=total_requested,
            successful_count=successful_count,
            failed_count=failed_count,
            successful_user_ids=successful_user_ids,
            failed_operations=failed_operations,
            summary_message=summary_message
        )
    
    # =============================================================================
    # STATISTICS AND DASHBOARD METHODS
    # =============================================================================
    
    def get_user_statistics(self) -> UserStatsResponse:
        """
        Get comprehensive user statistics for the admin dashboard.
        
        Returns:
            UserStatsResponse with all user statistics
            
        Learning: Dashboard statistics often require aggregation queries.
        These can be expensive, so in production you might cache these results.
        """
        logger.info("Generating user statistics")
        
        try:
            # Basic counts
            total_users = self.db.query(User).count()
            active_users = self.db.query(User).filter(User.is_active == True).count()
            inactive_users = total_users - active_users
            admin_users = self.db.query(User).filter(User.is_admin == True).count()
            verified_users = self.db.query(User).filter(User.is_verified == True).count()
            unverified_users = total_users - verified_users
            
            # Time-based counts
            one_week_ago = datetime.utcnow() - timedelta(days=7)
            one_month_ago = datetime.utcnow() - timedelta(days=30)
            
            new_users_this_week = self.db.query(User).filter(
                User.created_at >= one_week_ago
            ).count()
            
            new_users_this_month = self.db.query(User).filter(
                User.created_at >= one_month_ago
            ).count()
            
            recent_logins_count = self.db.query(User).filter(
                User.last_login_at >= one_week_ago
            ).count()
            
            # Users by role - using a simpler approach
            users_by_role = {}
            try:
                # Get all roles
                roles = self.db.query(Role).all()
                for role in roles:
                    user_count = self.db.query(User).filter(User.role_id == role.id).count()
                    users_by_role[role.name] = user_count
            except Exception as e:
                logger.warning(f"Failed to get users by role: {e}")
                users_by_role = {}
            
            # Users by department - using a simpler approach
            users_by_department = {}
            try:
                # Check if Department table exists by trying to query it
                dept_exists = True
                try:
                    self.db.query(Department).first()
                except Exception:
                    dept_exists = False
                
                if dept_exists:
                    # Get all departments
                    departments = self.db.query(Department).all()
                    for dept in departments:
                        user_count = self.db.query(User).filter(User.department_id == dept.id).count()
                        users_by_department[dept.name] = user_count
                    
                    # Count users with no department
                    no_dept_count = self.db.query(User).filter(User.department_id == None).count()
                    if no_dept_count > 0:
                        users_by_department["No Department"] = no_dept_count
                else:
                    # Department table doesn't exist, just count all users as "No Department"
                    users_by_department["No Department"] = total_users
            except Exception as e:
                logger.warning(f"Failed to get users by department: {e}")
                users_by_department = {"No Department": total_users}
            
            return UserStatsResponse(
                total_users=total_users,
                active_users=active_users,
                inactive_users=inactive_users,
                admin_users=admin_users,
                verified_users=verified_users,
                unverified_users=unverified_users,
                new_users_this_week=new_users_this_week,
                new_users_this_month=new_users_this_month,
                users_by_role=users_by_role,
                users_by_department=users_by_department,
                recent_logins_count=recent_logins_count
            )
        except Exception as e:
            logger.error(f"Failed to generate user statistics: {e}")
            # Return default values so the endpoint doesn't fail
            return UserStatsResponse(
                total_users=0,
                active_users=0,
                inactive_users=0,
                admin_users=0,
                verified_users=0,
                unverified_users=0,
                new_users_this_week=0,
                new_users_this_month=0,
                users_by_role={},
                users_by_department={},
                recent_logins_count=0
            )
    
    # =============================================================================
    # HELPER METHODS
    # =============================================================================
    
    def _user_to_response(self, user: User) -> UserResponse:
        """
        Convert a User model to UserResponse schema.
        
        Args:
            user: User model instance
            
        Returns:
            UserResponse with populated data
            
        Learning: Helper methods like this keep the main methods clean
        and ensure consistent data formatting.
        """
        return UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            job_title=user.job_title,
            is_active=user.is_active,
            is_admin=user.is_admin,
            is_verified=user.is_verified,
            bio=user.bio,
            role_id=user.role_id,
            department_id=user.department_id,
            role_name=user.role.name if user.role else None,
            department_name=user.department.name if user.department else None,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at,
            display_name=user.display_name,
            account_age_days=user.account_age_days
        )
    
    def check_admin_permissions(self, admin_user_id: int, required_permission: str) -> bool:
        """
        Check if an admin user has a specific permission.
        
        Args:
            admin_user_id: ID of the admin user
            required_permission: Permission to check
            
        Returns:
            True if admin has permission, False otherwise
            
        Learning: Always check permissions in the service layer
        to ensure security even if API layer checks are bypassed.
        """
        admin_user = self.db.query(User).options(
            joinedload(User.role)
        ).filter(User.id == admin_user_id).first()
        
        if not admin_user or not admin_user.is_active:
            return False
        
        return admin_user.has_permission(required_permission)

# =============================================================================
# HELPER FUNCTIONS FOR DEPENDENCY INJECTION
# =============================================================================

def get_admin_service(db: Session = None) -> AdminService:
    """
    Factory function to create AdminService instances.
    
    Args:
        db: Database session (if None, will get from dependency)
        
    Returns:
        AdminService instance
        
    Learning: Factory functions make it easy to inject dependencies
    and create service instances in FastAPI endpoints.
    """
    if db is None:
        db = next(get_db())
    
    return AdminService(db)
