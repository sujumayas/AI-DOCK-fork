# AI Dock Assistant Model
# Database model for user-created custom AI assistants

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, Dict, Any, List

from ..core.database import Base

class Assistant(Base):
    """
    Assistant model - stores custom AI assistants created by users.
    
    Each assistant represents a unique AI persona with its own:
    - Custom system prompt defining behavior and personality
    - Model preferences (temperature, max tokens, etc.)
    - Separate conversation threads
    - Private to the user who created it
    
    Think of assistants like "AI characters" - a Data Analyst assistant,
    a Creative Writer assistant, a Code Reviewer assistant, etc.
    
    Table: assistants
    Purpose: Store user-created custom AI assistants with their configurations
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "assistants"
    
    # =============================================================================
    # COLUMNS (DATABASE FIELDS)
    # =============================================================================
    
    # Primary Key - unique identifier for each assistant
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique assistant identifier"
    )
    
    # Assistant Identification and Description
    name = Column(
        String(100),                # Keep names concise but descriptive
        nullable=False,             # Every assistant must have a name
        index=True,                 # Index for fast searching
        comment="Human-readable name for the assistant (e.g., 'Data Analyst', 'Creative Writer')"
    )
    
    description = Column(
        String(500),                # Brief description of assistant's purpose
        nullable=True,              # Optional field
        comment="Brief description of what this assistant does and its personality"
    )
    
    # Core Assistant Configuration
    system_prompt = Column(
        Text,                       # Use Text for longer content (no character limit)
        nullable=False,             # System prompt is required
        comment="The system prompt that defines this assistant's behavior and personality"
    )
    
    # Model Preferences stored as JSON
    # This allows flexible configuration per assistant
    model_preferences = Column(
        JSON,
        nullable=True,              # Optional - will use defaults if not set
        default={},                 # Empty dict as default
        comment="JSON object storing LLM preferences: temperature, max_tokens, model, etc."
    )
    
    # =============================================================================
    # OWNERSHIP AND ACCESS CONTROL
    # =============================================================================
    
    # Foreign key to User - who owns this assistant?
    user_id = Column(
        Integer,
        ForeignKey('users.id',ondelete="CASCADE"),     # References the 'id' column in 'users' table
        nullable=False,             # Every assistant must have an owner
        index=True,                 # Index for fast user lookups
        comment="Foreign key to the user who created this assistant"
    )
    
    # Status Control
    is_active = Column(
        Boolean,
        default=True,               # New assistants are active by default
        nullable=False,
        index=True,                 # Index for filtering active assistants
        comment="Whether this assistant is active and available for use"
    )
    
    # =============================================================================
    # METADATA AND TRACKING
    # =============================================================================
    
    # Timestamps for tracking creation and updates
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),  # Database sets this automatically
        nullable=False,
        comment="When this assistant was created"
    )
    
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),        # Update this every time record changes
        nullable=False,
        comment="When this assistant was last updated"
    )
    
    # =============================================================================
    # RELATIONSHIPS (SQLALCHEMY CONNECTIONS TO OTHER TABLES)
    # =============================================================================
    
    # Relationship to User - the owner of this assistant
    user = relationship(
        "User",
        back_populates="assistants",    # User model will have an 'assistants' attribute
        lazy="select"                   # Load user data when needed
    )
    
    # Relationship to Conversations - all conversations using this assistant
    conversations = relationship(
        "Conversation", 
        back_populates="assistant",
        cascade="all, delete-orphan",  # Delete conversations when assistant is deleted
        order_by="Conversation.updated_at.desc()"
    )
    
    # Relationship to ChatConversations - enhanced chat interface support
    chat_conversations = relationship(
        "ChatConversation", 
        back_populates="assistant",
        cascade="all, delete-orphan",  # Delete chat conversations when assistant is deleted
        order_by="ChatConversation.updated_at.desc()"
    )
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
        """
        String representation of the Assistant object.
        This is what you see when you print(assistant) or in debugger.
        """
        return f"<Assistant(id={self.id}, name='{self.name}', user_id={self.user_id})>"
    
    def __str__(self) -> str:
        """Human-friendly string representation."""
        return f"{self.name} (by {self.user.username if self.user else 'Unknown'})"
    
    # =============================================================================
    # PROPERTY METHODS
    # =============================================================================
    
    @property
    def display_name(self) -> str:
        """
        Get the display name for this assistant.
        Returns the name, ensuring it's never empty.
        """
        return self.name or f"Assistant #{self.id}"
    
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
        Get the number of conversations associated with this assistant.
        """
        return len(self.conversations) if self.conversations else 0
    
    @property
    def is_new(self) -> bool:
        """
        Check if this assistant was created recently (within last 24 hours).
        Useful for showing "new" badges in the UI.
        """
        if not self.created_at:
            return False
        
        from datetime import timedelta
        day_ago = datetime.utcnow() - timedelta(hours=24)
        return self.created_at > day_ago
    
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
            temperature = assistant.get_model_preference('temperature', 0.7)
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
            assistant.set_model_preference('temperature', 0.8)
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
    # BUSINESS LOGIC METHODS
    # =============================================================================
    
    def can_be_used_by(self, user) -> bool:
        """
        Check if a specific user can use this assistant.
        For now, only the owner can use their assistants.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can use this assistant
        """
        if not self.is_active:
            return False
        
        # Only the owner can use their assistant
        return self.user_id == user.id
    
    def can_be_edited_by(self, user) -> bool:
        """
        Check if a specific user can edit this assistant.
        Only the owner can edit their assistants.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can edit this assistant
        """
        return self.user_id == user.id
    
    def can_be_deleted_by(self, user) -> bool:
        """
        Check if a specific user can delete this assistant.
        Only the owner can delete their assistants.
        
        Args:
            user: User object to check
            
        Returns:
            True if user can delete this assistant
        """
        return self.user_id == user.id
    
    def activate(self) -> None:
        """Activate this assistant (make it available for use)."""
        self.is_active = True
        self.updated_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """Deactivate this assistant (hide from use but don't delete)."""
        self.is_active = False
        self.updated_at = datetime.utcnow()
    
    def update_system_prompt(self, new_prompt: str) -> None:
        """
        Update the system prompt and timestamp.
        
        Args:
            new_prompt: The new system prompt text
        """
        self.system_prompt = new_prompt
        self.updated_at = datetime.utcnow()
    
    def clone_for_user(self, target_user, new_name: str = None) -> 'Assistant':
        """
        Create a copy of this assistant for another user.
        Useful for sharing assistant templates.
        
        Args:
            target_user: User who will own the cloned assistant
            new_name: Optional new name (defaults to "Copy of {original_name}")
            
        Returns:
            New Assistant object (not yet saved to database)
        """
        clone_name = new_name or f"Copy of {self.name}"
        
        return Assistant(
            name=clone_name,
            description=self.description,
            system_prompt=self.system_prompt,
            model_preferences=self.model_preferences.copy() if self.model_preferences else {},
            user_id=target_user.id,
            is_active=True
        )
    
    # =============================================================================
    # VALIDATION METHODS
    # =============================================================================
    
    def validate_name(self) -> bool:
        """
        Validate assistant name format.
        
        Returns:
            True if name is valid
        """
        if not self.name:
            return False
        
        # Name should be 1-100 characters, not just whitespace
        name = self.name.strip()
        return 1 <= len(name) <= 100
    
    def validate_system_prompt(self) -> bool:
        """
        Validate system prompt content.
        
        Returns:
            True if system prompt is valid
        """
        if not self.system_prompt:
            return False
        
        # System prompt should not be empty or just whitespace
        prompt = self.system_prompt.strip()
        return len(prompt) > 0
    
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
        Check if the assistant data is valid overall.
        
        Returns:
            True if all validation checks pass
        """
        return (
            self.validate_name() and
            self.validate_system_prompt() and
            self.validate_model_preferences()
        )
    
    # =============================================================================
    # SERIALIZATION METHODS
    # =============================================================================
    
    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """
        Convert assistant to dictionary for API responses.
        
        Args:
            include_sensitive: Whether to include sensitive data like system prompt
            
        Returns:
            Dictionary representation of the assistant
        """
        base_dict = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
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
        
        return base_dict
    
    def to_dict_full(self) -> Dict[str, Any]:
        """
        Get complete dictionary representation including sensitive data.
        Use for owner access or administrative purposes.
        """
        return self.to_dict(include_sensitive=True)
    
    def to_dict_public(self) -> Dict[str, Any]:
        """
        Get public dictionary representation without sensitive data.
        Use for shared access or public listings.
        """
        return self.to_dict(include_sensitive=False)

# =============================================================================
# MODEL INDEXES FOR PERFORMANCE
# =============================================================================

# Create indexes for common query patterns
# These will be created automatically when the table is created

# Index for finding user's assistants
Index('idx_assistant_user_active', Assistant.user_id, Assistant.is_active)

# Index for searching assistants by name
Index('idx_assistant_name_active', Assistant.name, Assistant.is_active)

# Index for ordering by creation time
Index('idx_assistant_created', Assistant.created_at.desc())

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_default_assistant(user_id: int, name: str = "General Assistant") -> Assistant:
    """
    Create a default assistant for a new user.
    
    Args:
        user_id: ID of the user who will own this assistant
        name: Name for the assistant
        
    Returns:
        Assistant object with default configuration
    """
    return Assistant(
        name=name,
        description="A helpful AI assistant for general tasks and questions.",
        system_prompt="You are a helpful, knowledgeable, and friendly AI assistant. Provide clear, accurate, and useful responses to help users with their questions and tasks.",
        model_preferences={
            "temperature": 0.7,
            "max_tokens": 2048,
            "model": "gpt-3.5-turbo"
        },
        user_id=user_id,
        is_active=True
    )

def create_sample_assistants(user_id: int) -> List[Assistant]:
    """
    Create a set of sample assistants for demonstration purposes.
    
    Args:
        user_id: ID of the user who will own these assistants
        
    Returns:
        List of sample Assistant objects
    """
    assistants = []
    
    # Data Analyst Assistant
    assistants.append(Assistant(
        name="Data Analyst",
        description="Specialized in data analysis, statistics, and creating insights from datasets.",
        system_prompt="You are a skilled data analyst. Help users analyze data, create visualizations, interpret statistics, and draw meaningful insights. Always ask clarifying questions about the data context and goals.",
        model_preferences={
            "temperature": 0.3,  # Lower temperature for more factual responses
            "max_tokens": 3000,
            "model": "gpt-4"
        },
        user_id=user_id,
        is_active=True
    ))
    
    # Creative Writer Assistant
    assistants.append(Assistant(
        name="Creative Writer",
        description="Helps with creative writing, storytelling, and content creation.",
        system_prompt="You are a creative writing assistant. Help users with storytelling, character development, plot ideas, and creative content. Be imaginative, inspiring, and supportive of creative expression.",
        model_preferences={
            "temperature": 0.9,  # Higher temperature for more creative responses
            "max_tokens": 4000,
            "model": "gpt-4"
        },
        user_id=user_id,
        is_active=True
    ))
    
    # Code Reviewer Assistant
    assistants.append(Assistant(
        name="Code Reviewer",
        description="Focuses on code review, debugging, and programming best practices.",
        system_prompt="You are an experienced software engineer specializing in code review. Help users improve their code quality, find bugs, suggest optimizations, and follow best practices. Always explain your reasoning and provide examples.",
        model_preferences={
            "temperature": 0.4,  # Moderate temperature for balanced technical responses
            "max_tokens": 3000,
            "model": "gpt-4"
        },
        user_id=user_id,
        is_active=True
    ))
    
    return assistants

# =============================================================================
# DEBUGGING INFORMATION
# =============================================================================

if __name__ == "__main__":
    print(f"🤖 Assistant Model Information:")
    print(f"   Table: {Assistant.__tablename__}")
    print(f"   Columns: {[column.name for column in Assistant.__table__.columns]}")
    print(f"   Relationships: user (many-to-one)")
    print(f"   Indexes: user_active, name_active, created_date")
