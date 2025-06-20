# AI Dock Chat Conversation Model
# Specialized model for linking chats with conversations and assistants

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, Dict, Any, List

from ..core.database import Base

class ChatConversation(Base):
    """
    ChatConversation model - bridges Chat and Conversation with Assistant integration.
    
    This model provides an enhanced conversation experience by combining:
    - Chat organization features (folders, colors, favorites)
    - Conversation messages and history
    - Custom assistant integration
    - Enhanced metadata tracking
    
    Purpose:
    - Each ChatConversation represents a unique chat thread
    - Can be associated with a custom assistant for specialized behavior
    - Provides unified access to both chat metadata and conversation messages
    - Supports the full custom assistants workflow
    
    Table: chat_conversations
    """
    
    # =============================================================================
    # TABLE CONFIGURATION
    # =============================================================================
    
    __tablename__ = "chat_conversations"
    
    # =============================================================================
    # CORE IDENTIFICATION
    # =============================================================================
    
    # Primary Key
    id = Column(
        Integer, 
        primary_key=True, 
        index=True,
        comment="Unique identifier for this chat conversation"
    )
    
    # User Ownership - every chat conversation belongs to a user
    user_id = Column(
        Integer, 
        ForeignKey("users.id"), 
        nullable=False, 
        index=True,
        comment="ID of the user who owns this chat conversation"
    )
    
    # Assistant Integration - core feature for custom assistants
    assistant_id = Column(
        Integer, 
        ForeignKey("assistants.id"), 
        nullable=True,  # Can be null for general conversations
        index=True,
        comment="Optional: ID of the custom assistant used in this chat"
    )
    
    # =============================================================================
    # CONVERSATION METADATA
    # =============================================================================
    
    # Display Information
    title = Column(
        String(255), 
        nullable=False, 
        index=True,
        comment="Title or name of this chat conversation"
    )
    
    description = Column(
        Text, 
        nullable=True,
        comment="Optional description of the chat conversation purpose"
    )
    
    # Status Management
    is_active = Column(
        Boolean, 
        default=True, 
        nullable=False,
        index=True,
        comment="Whether this chat conversation is active (not deleted)"
    )
    
    # =============================================================================
    # CONVERSATION STATISTICS (DENORMALIZED FOR PERFORMANCE)
    # =============================================================================
    
    # Message tracking
    message_count = Column(
        Integer, 
        default=0, 
        nullable=False,
        comment="Total number of messages in this conversation"
    )
    
    # Activity tracking
    last_message_at = Column(
        DateTime(timezone=True), 
        nullable=True,
        comment="Timestamp of the most recent message"
    )
    
    # =============================================================================
    # TIMESTAMPS
    # =============================================================================
    
    created_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False,
        comment="When this chat conversation was created"
    )
    
    updated_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False,
        comment="When this chat conversation was last updated"
    )
    
    # =============================================================================
    # RELATIONSHIPS
    # =============================================================================
    
    # User relationship
    user = relationship(
        "User", 
        back_populates="chat_conversations"
    )
    
    # Assistant relationship
    assistant = relationship(
        "Assistant", 
        back_populates="chat_conversations"
    )
    
    # Connection to the underlying conversation
    conversation_id = Column(
        Integer, 
        ForeignKey("conversations.id"), 
        nullable=True,  # Can create chat before conversation exists
        unique=True,    # One-to-one relationship
        comment="Link to the underlying conversation record"
    )
    
    conversation = relationship(
        "Conversation", 
        uselist=False,  # One-to-one relationship
        cascade="all, delete-orphan",
        single_parent=True  # Allows delete-orphan on many-to-one side
    )
    
    # =============================================================================
    # MODEL METHODS
    # =============================================================================
    
    def __repr__(self) -> str:
                return f"<ChatConversation(id={self.id}, title='{self.title}', assistant='{self.assistant.name if self.assistant else 'None'}')>"
    def __str__(self) -> str:        
        return f"{self.title} ({self.message_count} messages)"    
    # =============================================================================    # PROPERTY METHODS
    # =============================================================================
    
    @property
    def display_title(self) -> str:
        """
        Get the display title for this chat conversation.
        Falls back to conversation title if needed.
        """
        if self.title and self.title.strip():
            return self.title
        if self.conversation and self.conversation.title:
            return self.conversation.title
        return f"Chat {self.id}"
    
    @property
    def assistant_name(self) -> Optional[str]:
        """
        Get the name of the associated assistant.
        """
        return self.assistant.name if self.assistant else None
    
    @property
    def has_assistant(self) -> bool:
        """
        Check if this chat conversation uses a custom assistant.
        """
        return self.assistant_id is not None and self.assistant is not None
    
    @property
    def status_label(self) -> str:
        """
        Get a human-readable status label.
        """
        if not self.is_active:
            return "Inactive"
        if self.has_assistant:
            return f"Using {self.assistant_name}"
        return "General Chat"
    
    # =============================================================================
    # ASSISTANT INTEGRATION METHODS
    # =============================================================================
    
    def set_assistant(self, assistant_id: Optional[int]) -> None:
        """
        Associate this chat conversation with a custom assistant.
        
        Args:
            assistant_id: ID of the assistant to use (None to remove)
        """
        self.assistant_id = assistant_id
        self.updated_at = datetime.utcnow()
        
        # Update the underlying conversation if it exists
        if self.conversation:
            self.conversation.set_assistant(assistant_id)
    
    def get_system_prompt(self) -> Optional[str]:
        """
        Get the system prompt for this chat conversation.
        
        Returns:
            System prompt from assistant or None
        """
        if self.assistant and self.assistant.system_prompt:
            return self.assistant.system_prompt
        return None
    
    def get_model_preferences(self) -> Dict[str, Any]:
        """
        Get LLM model preferences for this chat conversation.
        
        Returns:
            Dictionary of model preferences from assistant or defaults
        """
        if self.assistant:
            return self.assistant.get_effective_model_preferences()
        
        # Default preferences
        return {
            "model": "gpt-3.5-turbo",
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 1.0,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        }
    
    def can_use_assistant(self, assistant) -> bool:
        """
        Check if this chat conversation can use the specified assistant.
        
        Args:
            assistant: Assistant object to check
            
        Returns:
            True if the assistant can be used
        """
        if not assistant or not assistant.is_active:
            return False
        
        # Assistant must belong to the same user
        return assistant.user_id == self.user_id
    
    # =============================================================================
    # CONVERSATION MANAGEMENT METHODS
    # =============================================================================
    
    def ensure_conversation(self) -> "Conversation":
        """
        Ensure this chat conversation has an underlying Conversation record.
        Creates one if it doesn't exist.
        
        Returns:
            The associated Conversation object
        """
        if not self.conversation:
            from .conversation import Conversation
            
            # Create a new conversation
            self.conversation = Conversation(
                user_id=self.user_id,
                assistant_id=self.assistant_id,
                title=self.title,
                is_active=self.is_active
            )
        
        return self.conversation
    
    def sync_with_conversation(self) -> None:
        """
        Synchronize statistics with the underlying conversation.
        """
        if self.conversation:
            # Update message count and timing
            self.message_count = self.conversation.message_count
            self.last_message_at = self.conversation.last_message_at
            
            # Sync title if needed
            if not self.title or self.title.strip() == "":
                self.title = self.conversation.title
            
            self.updated_at = datetime.utcnow()
    
    def update_activity(self) -> None:
        """
        Update activity timestamps and sync with conversation.
        """
        self.updated_at = datetime.utcnow()
        
        # Update conversation statistics
        if self.conversation:
            self.conversation.update_stats()
            self.sync_with_conversation()
    
    # =============================================================================
    # STATUS MANAGEMENT METHODS
    # =============================================================================
    
    def activate(self) -> None:
        """
        Activate this chat conversation.
        """
        self.is_active = True
        self.updated_at = datetime.utcnow()
        
        if self.conversation:
            self.conversation.is_active = True
    
    def deactivate(self) -> None:
        """
        Deactivate this chat conversation (soft delete).
        """
        self.is_active = False
        self.updated_at = datetime.utcnow()
        
        if self.conversation:
            self.conversation.is_active = False
    
    # =============================================================================
    # SERIALIZATION METHODS
    # =============================================================================
    
    def to_dict(self, include_conversation: bool = False, include_messages: bool = False) -> Dict[str, Any]:
        """
        Convert chat conversation to dictionary for API responses.
        
        Args:
            include_conversation: Whether to include conversation details
            include_messages: Whether to include conversation messages
            
        Returns:
            Dictionary representation
        """
        data = {
            "id": self.id,
            "title": self.title,
            "display_title": self.display_title,
            "description": self.description,
            "user_id": self.user_id,
            "assistant_id": self.assistant_id,
            "assistant_name": self.assistant_name,
            "has_assistant": self.has_assistant,
            "status_label": self.status_label,
            "is_active": self.is_active,
            "message_count": self.message_count,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "conversation_id": self.conversation_id
        }
        
        # Include conversation details if requested
        if include_conversation and self.conversation:
            data["conversation"] = self.conversation.to_dict()
        
        # Include messages if requested
        if include_messages and self.conversation:
            data["messages"] = [msg.to_dict() for msg in self.conversation.messages]
        
        return data
    
    # =============================================================================
    # CLASS METHODS FOR QUERIES
    # =============================================================================
    
    @classmethod
    def create_with_assistant(cls, user_id: int, assistant_id: int, title: str, 
                            description: str = None) -> "ChatConversation":
        """
        Create a new chat conversation with an assistant.
        
        Args:
            user_id: ID of the user creating the chat
            assistant_id: ID of the assistant to use
            title: Title for the chat conversation
            description: Optional description
            
        Returns:
            New ChatConversation instance
        """
        return cls(
            user_id=user_id,
            assistant_id=assistant_id,
            title=title,
            description=description,
            is_active=True
        )
    
    @classmethod
    def get_user_chats(cls, db_session, user_id: int, assistant_id: Optional[int] = None,
                      include_inactive: bool = False) -> List["ChatConversation"]:
        """
        Get chat conversations for a specific user.
        
        Args:
            db_session: Database session
            user_id: ID of the user
            assistant_id: Optional assistant filter
            include_inactive: Whether to include inactive chats
            
        Returns:
            List of ChatConversation objects
        """
        query = db_session.query(cls).filter(cls.user_id == user_id)
        
        if assistant_id is not None:
            query = query.filter(cls.assistant_id == assistant_id)
        
        if not include_inactive:
            query = query.filter(cls.is_active == True)
        
        return query.order_by(cls.updated_at.desc()).all()
    
    @classmethod
    def get_assistant_chats(cls, db_session, assistant_id: int, 
                          include_inactive: bool = False) -> List["ChatConversation"]:
        """
        Get all chat conversations using a specific assistant.
        
        Args:
            db_session: Database session
            assistant_id: ID of the assistant
            include_inactive: Whether to include inactive chats
            
        Returns:
            List of ChatConversation objects
        """
        query = db_session.query(cls).filter(cls.assistant_id == assistant_id)
        
        if not include_inactive:
            query = query.filter(cls.is_active == True)
        
        return query.order_by(cls.updated_at.desc()).all()

# =============================================================================
# PERFORMANCE INDEXES
# =============================================================================

# Indexes for efficient querying
Index('idx_chat_conversation_user', ChatConversation.user_id)
Index('idx_chat_conversation_assistant', ChatConversation.assistant_id)
Index('idx_chat_conversation_user_assistant', ChatConversation.user_id, ChatConversation.assistant_id)
Index('idx_chat_conversation_user_updated', ChatConversation.user_id, ChatConversation.updated_at.desc())
Index('idx_chat_conversation_assistant_updated', ChatConversation.assistant_id, ChatConversation.updated_at.desc())
Index('idx_chat_conversation_active', ChatConversation.is_active)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_chat_with_assistant(db_session, user_id: int, assistant_id: int, 
                              title: str, description: str = None) -> ChatConversation:
    """
    Helper function to create a new chat conversation with an assistant.
    
    Args:
        db_session: Database session
        user_id: ID of the user
        assistant_id: ID of the assistant
        title: Chat title
        description: Optional description
        
    Returns:
        Created ChatConversation instance
    """
    chat = ChatConversation.create_with_assistant(
        user_id=user_id,
        assistant_id=assistant_id,
        title=title,
        description=description
    )
    
    db_session.add(chat)
    db_session.commit()
    
    return chat
