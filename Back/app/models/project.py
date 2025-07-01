# AI Dock Project Model - Simplified Folder System
# Database model for simple project folders that organize conversations with default assistants

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Index, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, Dict, Any, List

from ..core.database import Base

# Association table for many-to-many relationship between projects and conversations
project_conversations = Table(
    'project_conversations',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id', ondelete="CASCADE"), primary_key=True),
    Column('conversation_id', Integer, ForeignKey('conversations.id', ondelete="CASCADE"), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False)
)

class Project(Base):
    """
    Project model - simplified folder system for organizing conversations.
    
    Each project is now a simple folder with:
    - A name and optional description
    - A default assistant that gets used for new conversations in this folder
    - Visual customization (color, icon)
    - Simple folder-like organization
    
    Think of projects as "folders" - a Research folder, a Coding folder, etc.
    Each folder has a default assistant that new chats will use.
    
    Table: projects
    Purpose: Simple folder organization with default assistants
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "projects"
    
    # =============================================================================
    # COLUMNS (DATABASE FIELDS)
    # =============================================================================
    
    # Primary Key - unique identifier for each project folder
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique project folder identifier"
    )
    
    # Project Folder Identification and Description
    name = Column(
        String(100),                # Keep names concise but descriptive
        nullable=False,             # Every folder must have a name
        index=True,                 # Index for fast searching
        comment="Human-readable name for the project folder (e.g., 'Research', 'Coding', 'Writing')"
    )
    
    description = Column(
        String(500),                # Brief description of folder's purpose
        nullable=True,              # Optional field
        comment="Brief description of what this folder is for"
    )
    
    # Default Assistant Integration - SIMPLIFIED APPROACH
    # Instead of complex system prompts, each folder has a default assistant
    default_assistant_id = Column(
        Integer,
        ForeignKey('assistants.id'),
        nullable=True,              # Optional - can have folders without default assistants
        index=True,                 # Index for fast assistant lookups
        comment="Default assistant that gets used for new conversations in this folder"
    )
    
    # Visual customization
    color = Column(
        String(20),                 # Hex color code or color name
        nullable=True,
        default="#3B82F6",          # Default blue color
        comment="Color for the folder in the UI"
    )
    
    icon = Column(
        String(50),                 # Icon name or emoji
        nullable=True,
        default="📁",               # Default folder emoji
        comment="Icon or emoji representing the folder"
    )
    
    # =============================================================================
    # OWNERSHIP AND ACCESS CONTROL
    # =============================================================================
    
    # Foreign key to User - who owns this folder?
    user_id = Column(
        Integer,
        ForeignKey('users.id', ondelete="CASCADE"),     # References the 'id' column in 'users' table
        nullable=False,             # Every folder must have an owner
        index=True,                 # Index for fast user lookups
        comment="Foreign key to the user who created this folder"
    )
    
    # Status Control
    is_active = Column(
        Boolean,
        default=True,               # New folders are active by default
        nullable=False,
        index=True,                 # Index for filtering active folders
        comment="Whether this folder is active and available for use"
    )
    
    is_archived = Column(
        Boolean,
        default=False,              # New folders are not archived
        nullable=False,
        index=True,                 # Index for filtering archived folders
        comment="Whether this folder is archived (hidden from main view)"
    )
    
    is_favorited = Column(
        Boolean,
        default=False,              # New folders are not favorited
        nullable=False,
        comment="Whether this folder is marked as a favorite"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    # Timestamps for tracking creation and updates
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),  # Database sets this automatically
        nullable=False,
        comment="When this folder was created"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),        # Update this every time record changes
        nullable=False,
        comment="When this folder was last updated"
    )
    
    last_accessed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this folder was last accessed/used"
    )
    
    # =============================================================================
    # RELATIONSHIPS (SQLALCHEMY CONNECTIONS TO OTHER TABLES)
    # =============================================================================
    
    # Relationship to User - the owner of this folder
    user = relationship(
        "User",
        back_populates="projects",      # User model will have a 'projects' attribute
        lazy="select"                   # Load user data when needed
    )
    
    # Relationship to Default Assistant
    default_assistant = relationship(
        "Assistant",
        foreign_keys=[default_assistant_id],
        lazy="select"
    )
    
    # Many-to-many relationship to Conversations
    conversations = relationship(
        "Conversation",
        secondary=project_conversations,
        back_populates="projects",
        lazy="select"
    )
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """
        String representation of the Project folder object.
        This is what you see when you print(project) or in debugger.
        """
        return f"<ProjectFolder(id={self.id}, name='{self.name}', user_id={self.user_id})>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        return f"{self.name} (by {self.user.username if self.user else 'Unknown'})"
    
    # =============================================================================
    # PROPERTY METHODS - SIMPLIFIED
    # =============================================================================
    
    @property
    def display_name(self) -> str:
        """
        Get the display name for this folder.
        """
        return self.name or "Untitled Folder"
    
    @property
    def short_description(self) -> str:
        """
        Get a shortened description for list views.
        """
        if not self.description:
            return "No description"
        
        # Truncate to 100 characters for list views
        return self.description[:100] + "..." if len(self.description) > 100 else self.description
    
    @property
    def conversation_count(self) -> int:
        """
        Get the number of conversations in this folder.
        This is a synchronous property - use get_conversation_count_async for async contexts.
        """
        return len(self.conversations) if self.conversations else 0
    
    async def get_conversation_count_async(self, db_session) -> int:
        """
        Get the number of conversations in this folder (async version).
        
        Args:
            db_session: Database session for async queries
            
        Returns:
            Number of conversations in this folder
        """
        from sqlalchemy import select, func
        from .conversation import Conversation
        
        query = select(func.count(project_conversations.c.conversation_id)).where(
            project_conversations.c.project_id == self.id
        )
        result = await db_session.execute(query)
        return result.scalar() or 0
    
    @property
    def is_new(self) -> bool:
        """
        Check if this folder was created recently (within last 24 hours).
        Useful for showing "new" badges in the UI.
        """
        if not self.created_at:
            return False
        
        from datetime import timedelta
        day_ago = datetime.utcnow() - timedelta(hours=24)
        return self.created_at > day_ago
    
    @property
    def last_activity(self) -> Optional[datetime]:
        """
        Get the timestamp of the last activity in this folder.
        This could be when it was last accessed or when the last conversation was updated.
        """
        # Use last_accessed_at if available, otherwise fall back to updated_at
        return self.last_accessed_at or self.updated_at
    
    @property
    def default_assistant_name(self) -> Optional[str]:
        """
        Get the name of the default assistant for this folder.
        """
        return self.default_assistant.name if self.default_assistant else None
    
    @property
    def has_default_assistant(self) -> bool:
        """
        Check if this folder has a default assistant configured.
        """
        return self.default_assistant_id is not None and self.default_assistant is not None
    
    # =============================================================================
    # FOLDER MANAGEMENT METHODS - SIMPLIFIED
    # =============================================================================
    
    def add_conversation(self, conversation) -> None:
        """
        Add a conversation to this folder.
        
        Args:
            conversation: Conversation object to add
        """
        if conversation not in self.conversations:
            self.conversations.append(conversation)
            self.updated_at = datetime.utcnow()
    
    def remove_conversation(self, conversation) -> None:
        """
        Remove a conversation from this folder.
        
        Args:
            conversation: Conversation object to remove
        """
        if conversation in self.conversations:
            self.conversations.remove(conversation)
            self.updated_at = datetime.utcnow()
    
    def get_recent_conversations(self, limit: int = 10) -> List:
        """
        Get the most recent conversations in this folder.
        
        Args:
            limit: Maximum number of conversations to return
            
        Returns:
            List of recent conversations, sorted by update time
        """
        if not self.conversations:
            return []
        
        # Sort by updated_at in descending order (most recent first)
        sorted_convs = sorted(
            self.conversations, 
            key=lambda c: c.updated_at or c.created_at, 
            reverse=True
        )
        
        return sorted_convs[:limit]
    
    # =============================================================================
    # ACCESS CONTROL METHODS - SIMPLIFIED
    # =============================================================================
    
    def can_be_used_by(self, user) -> bool:
        """
        Check if a user can use this folder.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can use this folder
        """
        return (
            self.is_active and 
            not self.is_archived and 
            self.user_id == user.id
        )
    
    def can_be_edited_by(self, user) -> bool:
        """
        Check if a user can edit this folder.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can edit this folder
        """
        return self.user_id == user.id
    
    def can_be_deleted_by(self, user) -> bool:
        """
        Check if a user can delete this folder.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can delete this folder
        """
        return self.user_id == user.id
    
    # =============================================================================
    # STATUS MANAGEMENT METHODS
    # =============================================================================
    
    def activate(self) -> None:
        """Activate this folder."""
        self.is_active = True
        self.updated_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """Deactivate this folder."""
        self.is_active = False
        self.updated_at = datetime.utcnow()
    
    def archive(self) -> None:
        """Archive this folder."""
        self.is_archived = True
        self.updated_at = datetime.utcnow()
    
    def unarchive(self) -> None:
        """Unarchive this folder."""
        self.is_archived = False
        self.updated_at = datetime.utcnow()
    
    def toggle_favorite(self) -> None:
        """Toggle favorite status of this folder."""
        self.is_favorited = not self.is_favorited
        self.updated_at = datetime.utcnow()
    
    def mark_accessed(self) -> None:
        """Mark this folder as accessed (update last_accessed_at)."""
        self.last_accessed_at = datetime.utcnow()
    
    def set_default_assistant(self, assistant_id: Optional[int]) -> None:
        """
        Set the default assistant for this folder.
        
        Args:
            assistant_id: ID of the assistant to set as default (None to remove)
        """
        self.default_assistant_id = assistant_id
        self.updated_at = datetime.utcnow()
    
    # =============================================================================
    # VALIDATION METHODS
    # =============================================================================
    
    def validate_name(self) -> bool:
        """
        Validate folder name format.
        
        Returns:
            True if name is valid
        """
        if not self.name:
            return False
        
        # Name should be 1-100 characters, not just whitespace
        name = self.name.strip()
        return 1 <= len(name) <= 100
    
    def is_valid(self) -> bool:
        """
        Check if this folder is valid.
        
        Returns:
            True if all validation checks pass
        """
        return self.validate_name()
    
    # =============================================================================
    # SERIALIZATION METHODS - SIMPLIFIED
    # =============================================================================
    
    def to_dict(self, include_sensitive: bool = False, include_conversations: bool = False) -> Dict[str, Any]:
        """
        Convert folder to dictionary for API responses.
        
        Args:
            include_sensitive: Whether to include sensitive data
            include_conversations: Whether to include conversation list
            
        Returns:
            Dictionary representation of the folder
        """
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "icon": self.icon,
            "user_id": self.user_id,
            "is_active": self.is_active,
            "is_archived": self.is_archived,
            "is_favorited": self.is_favorited,
            "conversation_count": self.conversation_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_accessed_at": self.last_accessed_at.isoformat() if self.last_accessed_at else None,
            "default_assistant_id": self.default_assistant_id,
            "default_assistant_name": self.default_assistant_name,
            "has_default_assistant": self.has_default_assistant
        }
        
        if include_conversations and self.conversations:
            data["conversations"] = [
                {
                    "id": conv.id,
                    "title": conv.title,
                    "message_count": conv.message_count,
                    "updated_at": conv.updated_at.isoformat() if conv.updated_at else None
                }
                for conv in self.conversations
            ]
        
        return data
    
    async def to_dict_async(self, db_session, include_sensitive: bool = False, include_conversations: bool = False) -> Dict[str, Any]:
        """
        Convert folder to dictionary using async methods.
        
        Args:
            db_session: Database session for async queries
            include_sensitive: Whether to include sensitive data
            include_conversations: Whether to include conversation list
            
        Returns:
            Dictionary representation of the folder
        """
        data = self.to_dict(include_sensitive=include_sensitive, include_conversations=include_conversations)
        
        # Update conversation count with async method
        data["conversation_count"] = await self.get_conversation_count_async(db_session)
        
        return data


# =============================================================================
# MODEL INDEXES FOR PERFORMANCE
# =============================================================================

# Create indexes for common query patterns
# These will be created automatically when the table is created

# Index for finding user's folders
Index('idx_project_user_active', Project.user_id, Project.is_active)

# Index for searching folders by name
Index('idx_project_name_active', Project.name, Project.is_active)

# Index for ordering by creation time
Index('idx_project_created', Project.created_at.desc())

# Index for ordering by last activity
Index('idx_project_last_accessed', Project.last_accessed_at.desc())

# Index for archived folders
Index('idx_project_archived', Project.user_id, Project.is_archived)

# Index for favorited folders
Index('idx_project_favorited', Project.user_id, Project.is_favorited)

# Index for default assistant lookups
Index('idx_project_default_assistant', Project.default_assistant_id)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_default_project(user_id: int, name: str = "General", assistant_id: Optional[int] = None) -> Project:
    """
    Create a default folder for a new user.
    
    Args:
        user_id: ID of the user who will own this folder
        name: Name for the folder
        assistant_id: Optional default assistant ID
        
    Returns:
        Project object with default configuration
    """
    return Project(
        name=name,
        description=f"General folder for organizing {name.lower()} conversations.",
        default_assistant_id=assistant_id,
        color="#3B82F6",
        icon="📁",
        user_id=user_id,
        is_active=True
    )

def create_sample_projects(user_id: int, general_assistant_id: Optional[int] = None) -> List[Project]:
    """
    Create a set of sample folders for demonstration purposes.
    
    Args:
        user_id: ID of the user who will own these folders
        general_assistant_id: Optional general assistant ID to use as default
        
    Returns:
        List of sample Project objects
    """
    projects = []
    
    # General folder
    projects.append(Project(
        name="General",
        description="General conversations and discussions.",
        default_assistant_id=general_assistant_id,
        color="#3B82F6",
        icon="💬",
        user_id=user_id,
        is_active=True
    ))
    
    # Work folder
    projects.append(Project(
        name="Work",
        description="Work-related conversations and projects.",
        default_assistant_id=general_assistant_id,
        color="#059669",
        icon="💼",
        user_id=user_id,
        is_active=True
    ))
    
    # Research folder
    projects.append(Project(
        name="Research",
        description="Research and learning conversations.",
        default_assistant_id=general_assistant_id,
        color="#7C3AED",
        icon="🔬",
        user_id=user_id,
        is_active=True
    ))
    
    # Coding folder
    projects.append(Project(
        name="Coding",
        description="Programming and development discussions.",
        default_assistant_id=general_assistant_id,
        color="#DC2626",
        icon="💻",
        user_id=user_id,
        is_active=True
    ))
    
    return projects

# =============================================================================
# DEBUGGING INFORMATION
# =============================================================================

if __name__ == "__main__":
    print(f"📁 Project Model Information:")
    print(f"   Table: {Project.__tablename__}")
    print(f"   Columns: {[column.name for column in Project.__table__.columns]}")
    print(f"   Relationships: user (many-to-one), conversations (many-to-many)")
    print(f"   Association Table: {project_conversations.name}")
    print(f"   Indexes: user_active, name_active, created_date, last_accessed, archived, favorited")