# AI Dock Project Model
# Database model for user-created projects that group conversations with custom assistants

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
    Project model - stores user-created projects that group conversations with custom prompts.
    
    Each project represents a workspace with:
    - Custom system prompt defining the project context
    - Multiple conversations grouped together
    - Model preferences specific to the project
    - Private to the user who created it
    
    Think of projects like "workspaces" - a Research Project, 
    a Coding Project, a Writing Project, etc.
    
    Table: projects
    Purpose: Store user-created projects with their configurations and conversation groups
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "projects"
    
    # =============================================================================
    # COLUMNS (DATABASE FIELDS)
    # =============================================================================
    
    # Primary Key - unique identifier for each project
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique project identifier"
    )
    
    # Project Identification and Description
    name = Column(
        String(100),                # Keep names concise but descriptive
        nullable=False,             # Every project must have a name
        index=True,                 # Index for fast searching
        comment="Human-readable name for the project (e.g., 'Research Assistant', 'Code Review')"
    )
    
    description = Column(
        String(500),                # Brief description of project's purpose
        nullable=True,              # Optional field
        comment="Brief description of what this project is for and its purpose"
    )
    
    # Core Project Configuration
    system_prompt = Column(
        Text,                       # Use Text for longer content (no character limit)
        nullable=True,              # System prompt is optional for projects
        comment="The system prompt that defines this project's context and behavior"
    )
    
    # Model Preferences stored as JSON
    # This allows flexible configuration per project
    model_preferences = Column(
        JSON,
        nullable=True,              # Optional - will use defaults if not set
        default={},                 # Empty dict as default
        comment="JSON object storing LLM preferences: temperature, max_tokens, model, etc."
    )
    
    # Visual customization
    color = Column(
        String(20),                 # Hex color code or color name
        nullable=True,
        default="#3B82F6",          # Default blue color
        comment="Color for the project in the UI"
    )
    
    icon = Column(
        String(50),                 # Icon name or emoji
        nullable=True,
        default="💼",               # Default briefcase emoji
        comment="Icon or emoji representing the project"
    )
    
    # =============================================================================
    # OWNERSHIP AND ACCESS CONTROL
    # =============================================================================
    
    # Foreign key to User - who owns this project?
    user_id = Column(
        Integer,
        ForeignKey('users.id', ondelete="CASCADE"),     # References the 'id' column in 'users' table
        nullable=False,             # Every project must have an owner
        index=True,                 # Index for fast user lookups
        comment="Foreign key to the user who created this project"
    )
    
    # Status Control
    is_active = Column(
        Boolean,
        default=True,               # New projects are active by default
        nullable=False,
        index=True,                 # Index for filtering active projects
        comment="Whether this project is active and available for use"
    )
    
    is_archived = Column(
        Boolean,
        default=False,              # New projects are not archived
        nullable=False,
        index=True,                 # Index for filtering archived projects
        comment="Whether this project is archived (hidden from main view)"
    )
    
    is_favorited = Column(
        Boolean,
        default=False,              # New projects are not favorited
        nullable=False,
        comment="Whether this project is marked as a favorite"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    # Timestamps for tracking creation and updates
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),  # Database sets this automatically
        nullable=False,
        comment="When this project was created"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),        # Update this every time record changes
        nullable=False,
        comment="When this project was last updated"
    )
    
    last_accessed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this project was last accessed/used"
    )
    
    # =============================================================================
    # RELATIONSHIPS (SQLALCHEMY CONNECTIONS TO OTHER TABLES)
    # =============================================================================
    
    # Relationship to User - the owner of this project
    user = relationship(
        "User",
        back_populates="projects",      # User model will have a 'projects' attribute
        lazy="select"                   # Load user data when needed
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
        String representation of the Project object.
        This is what you see when you print(project) or in debugger.
        """
        return f"<Project(id={self.id}, name='{self.name}', user_id={self.user_id})>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        return f"{self.name} (by {self.user.username if self.user else 'Unknown'})"
    
    # =============================================================================
    # PROPERTY METHODS
    # =============================================================================
    
    @property
    def display_name(self) -> str:
        """
        Get the display name for this project.
        Returns the name, ensuring it's never empty.
        """
        return self.name or f"Project #{self.id}"
    
    @property
    def short_description(self) -> str:
        """
        Get a shortened version of the description for UI display.
        Truncates to 100 characters with ellipsis.
        """
        if not self.description:
            return "No description provided"
        
        if len(self.description) <= 100:
            return self.description
        
        return self.description[:97] + "..."
    
    @property
    def system_prompt_preview(self) -> str:
        """
        Get a preview of the system prompt for UI display.
        Truncates to 150 characters with ellipsis.
        """
        if not self.system_prompt:
            return "No system prompt defined"
        
        if len(self.system_prompt) <= 150:
            return self.system_prompt
        
        return self.system_prompt[:147] + "..."
    
    @property
    def conversation_count(self) -> int:
        """
        Get the number of conversations associated with this project.
        Note: This property should only be accessed when conversations are already loaded.
        For async contexts, use get_conversation_count_async() instead.
        """
        try:
            # Check if conversations is loaded to avoid triggering lazy load
            if hasattr(self, '_sa_instance_state'):
                from sqlalchemy.orm import object_session
                from sqlalchemy.inspection import inspect
                
                # Get the state of the conversations relationship
                state = inspect(self)
                conversations_state = state.attrs.conversations
                
                # If conversations haven't been loaded yet, return 0 to avoid async issues
                if not conversations_state.loaded_value:
                    return 0
            
            return len(self.conversations) if self.conversations else 0
        except Exception:
            # Fallback to 0 if any issues occur
            return 0

    async def get_conversation_count_async(self, db_session) -> int:
        """
        Asynchronously get the number of conversations associated with this project.
        This method safely counts conversations without triggering lazy loads.
        
        Args:
            db_session: The async database session to use
            
        Returns:
            Number of conversations in this project
        """
        try:
            from sqlalchemy import select, func
            from ..models.conversation import Conversation
            
            # Query to count conversations associated with this project
            query = select(func.count(project_conversations.c.conversation_id)).where(
                project_conversations.c.project_id == self.id
            )
            
            result = await db_session.execute(query)
            count = result.scalar() or 0
            return count
        except Exception as e:
            # Log the error and return 0 as fallback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error counting conversations for project {self.id}: {str(e)}")
            return 0

    @property
    def is_new(self) -> bool:
        """
        Check if this project was created recently (within last 24 hours).
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
        Get the most recent activity time for this project.
        Returns the latest of: last_accessed_at, updated_at, or most recent conversation update.
        """
        times = [self.updated_at]
        
        if self.last_accessed_at:
            times.append(self.last_accessed_at)
        
        if self.conversations:
            for conv in self.conversations:
                if conv.updated_at:
                    times.append(conv.updated_at)
        
        return max(times) if times else None
    
    # =============================================================================
    # MODEL PREFERENCES METHODS
    # =============================================================================
    
    def get_model_preference(self, key: str, default: Any = None) -> Any:
        """
        Get a specific model preference value.
        
        Args:
            key: The preference key (e.g., 'temperature', 'max_tokens')
            default: Default value if key doesn't exist
            
        Returns:
            The preference value or default
            
        Example:
            temperature = project.get_model_preference('temperature', 0.7)
        """
        if not self.model_preferences or not isinstance(self.model_preferences, dict):
            return default
        
        return self.model_preferences.get(key, default)
    
    def set_model_preference(self, key: str, value: Any) -> None:
        """
        Set a specific model preference value.
        
        Args:
            key: The preference key
            value: The preference value
            
        Example:
            project.set_model_preference('temperature', 0.8)
        """
        if not self.model_preferences:
            self.model_preferences = {}
        
        # Ensure we're working with a mutable dict
        preferences = dict(self.model_preferences)
        preferences[key] = value
        self.model_preferences = preferences
    
    def get_effective_model_preferences(self) -> Dict[str, Any]:
        """
        Get the complete model preferences with defaults applied.
        
        Returns:
            Dictionary with all preferences including defaults
        """
        # Default LLM preferences
        defaults = {
            "model": "gpt-3.5-turbo",
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 1.0,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        }
        
        # Merge with user preferences (user preferences override defaults)
        if self.model_preferences and isinstance(self.model_preferences, dict):
            defaults.update(self.model_preferences)
        
        return defaults
    
    # =============================================================================
    # CONVERSATION MANAGEMENT METHODS
    # =============================================================================
    
    def add_conversation(self, conversation) -> None:
        """
        Add a conversation to this project.
        
        Args:
            conversation: Conversation object to add
        """
        if conversation not in self.conversations:
            self.conversations.append(conversation)
            self.updated_at = datetime.utcnow()
    
    def remove_conversation(self, conversation) -> None:
        """
        Remove a conversation from this project.
        
        Args:
            conversation: Conversation object to remove
        """
        if conversation in self.conversations:
            self.conversations.remove(conversation)
            self.updated_at = datetime.utcnow()
    
    def get_recent_conversations(self, limit: int = 10) -> List:
        """
        Get the most recently updated conversations in this project.
        
        Args:
            limit: Maximum number of conversations to return
            
        Returns:
            List of conversations ordered by update time (newest first)
        """
        if not self.conversations:
            return []
        
        # Sort by updated_at descending and take the limit
        sorted_conversations = sorted(
            self.conversations,
            key=lambda c: c.updated_at or datetime.min,
            reverse=True
        )
        
        return sorted_conversations[:limit]
    
    # =============================================================================
    # BUSINESS LOGIC METHODS
    # =============================================================================
    
    def can_be_used_by(self, user) -> bool:
        """
        Check if a specific user can use this project.
        For now, only the owner can use their projects.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can use this project
        """
        if not self.is_active or self.is_archived:
            return False
        
        # Only the owner can use their project
        return self.user_id == user.id
    
    def can_be_edited_by(self, user) -> bool:
        """
        Check if a specific user can edit this project.
        Only the owner can edit their projects.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can edit this project
        """
        return self.user_id == user.id
    
    def can_be_deleted_by(self, user) -> bool:
        """
        Check if a specific user can delete this project.
        Only the owner can delete their projects.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can delete this project
        """
        return self.user_id == user.id
    
    def activate(self) -> None:
        """Activate this project (make it available for use)."""
        self.is_active = True
        self.is_archived = False
        self.updated_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """Deactivate this project (hide from use but don't delete)."""
        self.is_active = False
        self.updated_at = datetime.utcnow()
    
    def archive(self) -> None:
        """Archive this project (hide from main view but keep data)."""
        self.is_archived = True
        self.updated_at = datetime.utcnow()
    
    def unarchive(self) -> None:
        """Unarchive this project (restore to main view)."""
        self.is_archived = False
        self.updated_at = datetime.utcnow()
    
    def toggle_favorite(self) -> None:
        """Toggle the favorite status of this project."""
        self.is_favorited = not self.is_favorited
        self.updated_at = datetime.utcnow()
    
    def mark_accessed(self) -> None:
        """Mark this project as accessed (update last_accessed_at)."""
        self.last_accessed_at = datetime.utcnow()
    
    def update_system_prompt(self, new_prompt: str) -> None:
        """
        Update the system prompt and timestamp.
        
        Args:
            new_prompt: The new system prompt text
        """
        self.system_prompt = new_prompt
        self.updated_at = datetime.utcnow()
    
    # =============================================================================
    # VALIDATION METHODS
    # =============================================================================
    
    def validate_name(self) -> bool:
        """
        Validate project name format.
        
        Returns:
            True if name is valid
        """
        if not self.name:
            return False
        
        # Name should be 1-100 characters, not just whitespace
        name = self.name.strip()
        return 1 <= len(name) <= 100
    
    def validate_model_preferences(self) -> bool:
        """
        Validate model preferences structure.
        
        Returns:
            True if model preferences are valid
        """
        if self.model_preferences is None:
            return True  # Null is allowed
        
        if not isinstance(self.model_preferences, dict):
            return False
        
        # Validate specific preference types if they exist
        preferences = self.model_preferences
        
        # Temperature should be between 0 and 2
        if 'temperature' in preferences:
            temp = preferences['temperature']
            if not isinstance(temp, (int, float)) or not 0 <= temp <= 2:
                return False
        
        # Max tokens should be positive integer
        if 'max_tokens' in preferences:
            tokens = preferences['max_tokens']
            if not isinstance(tokens, int) or tokens <= 0:
                return False
        
        return True
    
    def is_valid(self) -> bool:
        """
        Check if the project data is valid overall.
        
        Returns:
            True if all validation checks pass
        """
        return (
            self.validate_name() and
            self.validate_model_preferences()
        )
    
    # =============================================================================
    # SERIALIZATION METHODS
    # =============================================================================
    
    def to_dict(self, include_sensitive: bool = False, include_conversations: bool = False) -> Dict[str, Any]:
        """
        Convert project to dictionary for API responses.
        
        Args:
            include_sensitive: Whether to include sensitive data like system prompt
            include_conversations: Whether to include conversation list
            
        Returns:
            Dictionary representation of the project
        """
        base_dict = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "icon": self.icon,
            "is_active": self.is_active,
            "is_archived": self.is_archived,
            "is_favorited": self.is_favorited,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_accessed_at": self.last_accessed_at.isoformat() if self.last_accessed_at else None,
            "conversation_count": self.conversation_count,
            "user_id": self.user_id
        }
        
        # Include sensitive data only if requested
        if include_sensitive:
            base_dict.update({
                "system_prompt": self.system_prompt,
                "model_preferences": self.model_preferences or {}
            })
        else:
            # Provide safe previews for public API
            base_dict.update({
                "system_prompt_preview": self.system_prompt_preview,
                "has_custom_preferences": bool(self.model_preferences)
            })
        
        # Include conversations if requested
        if include_conversations and self.conversations:
            base_dict["conversations"] = [
                conv.to_dict() for conv in self.get_recent_conversations()
            ]
        
        return base_dict

    async def to_dict_async(self, db_session, include_sensitive: bool = False, include_conversations: bool = False) -> Dict[str, Any]:
        """
        Convert project to dictionary for API responses with async conversation count.
        
        Args:
            db_session: The async database session to use
            include_sensitive: Whether to include sensitive data like system prompt
            include_conversations: Whether to include conversation list
            
        Returns:
            Dictionary representation of the project
        """
        base_dict = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "icon": self.icon,
            "is_active": self.is_active,
            "is_archived": self.is_archived,
            "is_favorited": self.is_favorited,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_accessed_at": self.last_accessed_at.isoformat() if self.last_accessed_at else None,
            "conversation_count": await self.get_conversation_count_async(db_session),
            "user_id": self.user_id
        }
        
        # Include sensitive data only if requested
        if include_sensitive:
            base_dict.update({
                "system_prompt": self.system_prompt,
                "model_preferences": self.model_preferences or {}
            })
        else:
            # Provide safe previews for public API
            base_dict.update({
                "system_prompt_preview": self.system_prompt_preview,
                "has_custom_preferences": bool(self.model_preferences)
            })
        
        # Include conversations if requested
        if include_conversations and self.conversations:
            base_dict["conversations"] = [
                conv.to_dict() for conv in self.get_recent_conversations()
            ]
        
        return base_dict

    def to_dict_full(self) -> Dict[str, Any]:
        """
        Get complete dictionary representation including sensitive data.
        Use for owner access or administrative purposes.
        """
        return self.to_dict(include_sensitive=True, include_conversations=True)
    
    def to_dict_public(self) -> Dict[str, Any]:
        """
        Get public dictionary representation without sensitive data.
        Use for shared access or public listings.
        """
        return self.to_dict(include_sensitive=False, include_conversations=False)

# =============================================================================
# MODEL INDEXES FOR PERFORMANCE
# =============================================================================

# Create indexes for common query patterns
# These will be created automatically when the table is created

# Index for finding user's projects
Index('idx_project_user_active', Project.user_id, Project.is_active)

# Index for searching projects by name
Index('idx_project_name_active', Project.name, Project.is_active)

# Index for ordering by creation time
Index('idx_project_created', Project.created_at.desc())

# Index for ordering by last activity
Index('idx_project_last_accessed', Project.last_accessed_at.desc())

# Index for archived projects
Index('idx_project_archived', Project.user_id, Project.is_archived)

# Index for favorited projects
Index('idx_project_favorited', Project.user_id, Project.is_favorited)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_default_project(user_id: int, name: str = "General Project") -> Project:
    """
    Create a default project for a new user.
    
    Args:
        user_id: ID of the user who will own this project
        name: Name for the project
        
    Returns:
        Project object with default configuration
    """
    return Project(
        name=name,
        description="A general-purpose project for organizing conversations.",
        system_prompt="You are working within a general project context. Provide helpful and organized responses.",
        model_preferences={
            "temperature": 0.7,
            "max_tokens": 2048,
            "model": "gpt-3.5-turbo"
        },
        color="#3B82F6",
        icon="💼",
        user_id=user_id,
        is_active=True
    )

def create_sample_projects(user_id: int) -> List[Project]:
    """
    Create a set of sample projects for demonstration purposes.
    
    Args:
        user_id: ID of the user who will own these projects
        
    Returns:
        List of sample Project objects
    """
    projects = []
    
    # Research Project
    projects.append(Project(
        name="Research Assistant",
        description="For research tasks, fact-checking, and academic work.",
        system_prompt="You are a research assistant. Help users find information, analyze sources, summarize findings, and maintain academic rigor. Always cite sources when possible and ask for clarification on research scope.",
        model_preferences={
            "temperature": 0.3,  # Lower temperature for more factual responses
            "max_tokens": 3000,
            "model": "gpt-4"
        },
        color="#10B981",
        icon="🔬",
        user_id=user_id,
        is_active=True
    ))
    
    # Coding Project
    projects.append(Project(
        name="Code Development",
        description="For programming tasks, code review, and software development.",
        system_prompt="You are a senior software engineer. Help users with coding problems, code review, architecture decisions, and best practices. Always provide working examples and explain your reasoning.",
        model_preferences={
            "temperature": 0.4,  # Moderate temperature for balanced technical responses
            "max_tokens": 4000,
            "model": "gpt-4"
        },
        color="#8B5CF6",
        icon="💻",
        user_id=user_id,
        is_active=True
    ))
    
    # Creative Writing Project
    projects.append(Project(
        name="Creative Writing",
        description="For creative writing, storytelling, and content creation.",
        system_prompt="You are a creative writing mentor. Help users develop stories, characters, and creative content. Encourage experimentation, provide constructive feedback, and inspire creativity.",
        model_preferences={
            "temperature": 0.9,  # Higher temperature for more creative responses
            "max_tokens": 4000,
            "model": "gpt-4"
        },
        color="#F59E0B",
        icon="✍️",
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