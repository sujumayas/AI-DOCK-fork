# AI Dock User Model
# This defines the database table structure for user accounts

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Optional

from ..core.database import Base

class User(Base):
    """
    User model representing a user account in the AI Dock system.
    
    This class defines both the database table structure AND provides
    methods for working with user data. It's like a "blueprint" for user records.
    
    Table: users
    Purpose: Store user accounts, authentication info, and basic profile data
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    # Tell SQLAlchemy what to name the database table
    __tablename__ = "users"
    
    # =============================================================================
    # COLUMNS (DATABASE FIELDS)
    # =============================================================================
    
    # Primary Key - unique identifier for each user
    # auto-increment means database automatically assigns 1, 2, 3, etc.
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique user identifier"
    )
    
    # Email address - used for login and communication
    email = Column(
        String(255),                # Maximum 255 characters
        unique=True,                # No two users can have same email
        index=True,                 # Create database index for fast lookups
        nullable=False,             # This field is required
        comment="User's email address (login identifier)"
    )
    
    # Username - human-friendly identifier
    username = Column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique username for display and mentions"
    )
    
    # Full name for display purposes
    full_name = Column(
        String(100),
        nullable=True,              # Optional field
        comment="User's full display name"
    )
    
    # Password hash - NEVER store plain text passwords!
    # This stores the bcrypt hash of the password
    password_hash = Column(
        String(255),
        nullable=False,
        comment="Bcrypt hash of user's password"
    )
    
    # Account status flags
    is_active = Column(
        Boolean,
        default=True,               # New users are active by default
        nullable=False,
        comment="Whether the user account is active"
    )
    
    is_verified = Column(
        Boolean,
        default=False,              # Users must verify email first
        nullable=False,
        comment="Whether the user has verified their email"
    )
    
    is_admin = Column(
        Boolean,
        default=False,              # Most users are not admins
        nullable=False,
        comment="Whether the user has admin privileges"
    )
    
    # =============================================================================
    # PROFILE INFORMATION
    # =============================================================================
    
    # Job title or role in the company
    job_title = Column(
        String(100),
        nullable=True,
        comment="User's job title or role"
    )
    
    # Profile picture URL (optional)
    profile_picture_url = Column(
        String(500),
        nullable=True,
        comment="URL to user's profile picture"
    )
    
    # Bio or description
    bio = Column(
        Text,                       # Text type for longer content
        nullable=True,
        comment="User's bio or description"
    )
    
    # Phone number (optional)
    phone = Column(
        String(20),
        nullable=True,
        comment="User's phone number"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    # When the account was created
    # func.now() means "use database's current timestamp"
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),  # Database sets this automatically
        nullable=False,
        comment="When the user account was created"
    )
    
    # When the account was last updated
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),        # Update this every time record changes
        nullable=False,
        comment="When the user account was last updated"
    )
    
    # When user last logged in (helpful for analytics)
    last_login_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the user last logged in"
    )
    
    # =============================================================================
    # FOREIGN KEYS (CONNECTIONS TO OTHER TABLES)
    # =============================================================================
    
    # Foreign key to Role table - which role does this user have?
    # ForeignKey means "this column references the id of another table"
    role_id = Column(
        Integer,
        ForeignKey('roles.id'),     # References the 'id' column in 'roles' table
        nullable=False,             # Every user must have a role
        index=True,                 # Index for fast lookups
        comment="Foreign key to user's role"
    )
    
    # Foreign key to Department table - which department does this user belong to?
    department_id = Column(
        Integer,
        ForeignKey('departments.id'),  # References the 'id' column in 'departments' table
        nullable=True,                 # Department is optional (some users might not have one)
        index=True,
        comment="Foreign key to user's department"
    )
    
    # =============================================================================
    # RELATIONSHIPS (SQLALCHEMY MAGIC - HOW TO ACCESS RELATED DATA)
    # =============================================================================
    
    # Relationship to Role - lets us access user.role.name easily
    # back_populates means the Role model will have a 'users' attribute too
    role = relationship(
        "Role",
        backref="users",            # This creates Role.users automatically
        lazy="select"               # Load role data on demand (async compatible)
    )
    
    # Relationship to Department - lets us access user.department.name
    department = relationship(
        "Department",
        backref="users",            # This creates Department.users automatically  
        lazy="select"               # Load department data on demand (async compatible)
    )
    
    # Usage tracking relationship - shows all LLM interactions by this user
    usage_logs = relationship(
        "UsageLog",
        back_populates="user",
        lazy="dynamic",
        cascade="all, delete-orphan"
    )    
    # Conversation relationship - user's saved conversations
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan", order_by="Conversation.updated_at.desc()")
    
    # Chat conversation relationship - user's enhanced chat conversations with assistants
    chat_conversations = relationship("ChatConversation", back_populates="user", cascade="all, delete-orphan", order_by="ChatConversation.updated_at.desc()")
    
    # File upload relationship - user's uploaded files
    uploaded_files = relationship("FileUpload", back_populates="user", cascade="all, delete-orphan", order_by="FileUpload.upload_date.desc()")
    
    # Assistant relationship - user's custom AI assistants
    assistants = relationship("Assistant", back_populates="user", cascade="all, delete-orphan", order_by="Assistant.created_at.desc()")
    
    # Project relationship - user's projects
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan", order_by="Project.updated_at.desc()")
    
    # Future relationships to add:
    # quota_overrides = relationship("UserQuotaOverride", back_populates="user")
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """
        String representation of the User object.
        This is what you see when you print(user) or in debugger.
        """
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        return f"{self.full_name or self.username} ({self.email})"
    
    # =============================================================================
    # PROPERTY METHODS
    # =============================================================================
    
    @property
    def display_name(self) -> str:
        """
        Get the best display name for this user.
        Returns full_name if available, otherwise username.
        """
        return self.full_name or self.username
    
    @property
    def is_new_user(self) -> bool:
        """
        Check if this is a new user (created within last 7 days).
        Useful for showing welcome messages or tutorials.
        """
        if not self.created_at:
            return False
        
        from datetime import timedelta
        week_ago = datetime.utcnow() - timedelta(days=7)
        return self.created_at > week_ago
    
    @property
    def account_age_days(self) -> int:
        """Get the age of this account in days."""
        if not self.created_at:
            return 0
        
        return (datetime.utcnow() - self.created_at).days
    
    # =============================================================================
    # BUSINESS LOGIC METHODS
    # =============================================================================
    
    def can_access_admin_panel(self) -> bool:
        """
        Check if user can access admin functionality.
        Now uses role-based permissions instead of just is_admin flag.
        """
        if not self.is_active:
            return False
        
        # Check if user has admin role or admin permission
        if self.is_admin:  # Legacy admin flag
            return True
            
        # Check role-based permissions
        if self.role and self.role.has_permission('can_view_admin_panel'):
            return True
            
        return False
    
    def has_permission(self, permission: str) -> bool:
        """
        Check if user has a specific permission through their role.
        
        Args:
            permission: Permission to check (e.g., 'can_manage_users')
            
        Returns:
            True if user has permission, False otherwise
            
        Example:
            if user.has_permission('can_delete_users'):
                # User can delete users
        """
        if not self.is_active:
            return False
            
        # Admin users have all permissions
        if self.is_admin:
            return True
            
        # Check role permissions
        if self.role:
            return self.role.has_permission(permission)
            
        return False
    
    def get_role_name(self) -> str:
        """
        Get the name of the user's role.
        
        Returns:
            Role name or 'No Role' if no role assigned
        """
        return self.role.name if self.role else "No Role"
    
    def get_department_name(self) -> str:
        """
        Get the name of the user's department.
        
        Returns:
            Department name or 'No Department' if no department assigned
        """
        return self.department.name if self.department else "No Department"
    
    def get_department_code(self) -> str:
        """
        Get the code of the user's department.
        
        Returns:
            Department code or 'NONE' if no department assigned
        """
        return self.department.code if self.department else "NONE"
    
    def is_in_department(self, department_name: str) -> bool:
        """
        Check if user belongs to a specific department.
        
        Args:
            department_name: Name of department to check
            
        Returns:
            True if user is in the department
        """
        return (self.department and 
                self.department.name.lower() == department_name.lower())
    
    def can_manage_user(self, other_user: 'User') -> bool:
        """
        Check if this user can manage another user.
        Based on role hierarchy and department membership.
        
        Args:
            other_user: User to check if we can manage
            
        Returns:
            True if this user can manage the other user
        """
        if not self.is_active or not other_user.is_active:
            return False
            
        # Admin can manage everyone
        if self.is_admin:
            return True
            
        # Check role hierarchy
        if self.role and other_user.role:
            return self.role.can_manage_role(other_user.role)
            
        return False
    
    def update_last_login(self) -> None:
        """Update the last_login_at timestamp to now."""
        self.last_login_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """
        Deactivate the user account.
        This doesn't delete the user, just prevents login.
        """
        self.is_active = False
    
    def activate(self) -> None:
        """Activate the user account."""
        self.is_active = True
    
    # =============================================================================
    # VALIDATION METHODS
    # =============================================================================
    
    def validate_email_format(self) -> bool:
        """
        Basic email format validation.
        In production, you'd use a more sophisticated validator.
        """
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(email_pattern, self.email or ""))
    
    def validate_username_format(self) -> bool:
        """
        Validate username format (alphanumeric plus underscore/dash).
        """
        import re
        username_pattern = r'^[a-zA-Z0-9_-]+$'
        return bool(re.match(username_pattern, self.username or ""))

# =============================================================================
# MODEL CONFIGURATION AND CONSTRAINTS
# =============================================================================

# Add any additional table-level constraints here
# For example, composite indexes, check constraints, etc.

# Example of adding a composite index (useful for complex queries):
# Index('idx_user_email_active', User.email, User.is_active)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_sample_user(role_id: int = None, department_id: int = None) -> User:
    """
    Create a sample user for testing/development.
    This is helpful when setting up the database for the first time.
    
    Args:
        role_id: ID of the role to assign (required)
        department_id: ID of the department to assign (optional)
        
    Returns:
        Sample User object
    """
    return User(
        email="admin@aidock.local",
        username="admin",
        full_name="AI Dock Administrator",
        role_id=role_id,            # Now required - must have a role
        department_id=department_id, # Optional - can be None
        is_admin=True,
        is_active=True,
        is_verified=True,
        job_title="System Administrator",
        bio="Default admin user for AI Dock system"
    )

def get_user_stats_summary() -> dict:
    """
    Get a summary of user statistics (for admin dashboard).
    This would typically be implemented as a database query.
    """
    # This is a placeholder - in real implementation, 
    # this would query the database for counts
    return {
        "total_users": 0,
        "active_users": 0,
        "admin_users": 0,
        "verified_users": 0,
        "new_users_this_week": 0
    }
