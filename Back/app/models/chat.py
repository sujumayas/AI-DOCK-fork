"""
Chat Model for AI Dock App

This module defines the database model for individual chats that can be organized into folders.
Integrates with the existing conversation system while adding folder organization capabilities.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class Chat(Base):
    """
    Chat model for organizing conversations into folders.
    
    This model provides a layer of abstraction over the Conversation model,
    allowing users to organize their chats into folders for better management.
    
    Features:
    - Folder organization support
    - User ownership and isolation
    - Integration with existing conversation system
    - Chat metadata and properties
    - Soft deletion support
    - Audit trail
    """
    __tablename__ = "chats"

    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # User ownership - every chat belongs to a specific user
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Folder organization - chats can be organized into folders
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True, index=True)
    
    # Integration with existing conversation system
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True, unique=True)
    
    # Chat properties
    color = Column(String(7), nullable=True, default="#3B82F6")  # Hex color code
    icon = Column(String(50), nullable=True, default="message-circle")  # Icon identifier
    is_pinned = Column(Boolean, nullable=False, default=False)   # Pinned chats
    is_favorite = Column(Boolean, nullable=False, default=False) # Favorite chats
    sort_order = Column(Integer, nullable=False, default=0)      # Custom sorting
    
    # Chat statistics (denormalized for performance)
    message_count = Column(Integer, nullable=False, default=0)
    last_activity_at = Column(DateTime, nullable=True)
    
    # LLM context information
    last_model_used = Column(String(100), nullable=True)
    total_tokens_used = Column(Integer, nullable=False, default=0)
    estimated_cost = Column(String(20), nullable=True, default="$0.00")
    
    # Status and lifecycle
    is_active = Column(Boolean, nullable=False, default=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    
    # Audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="chats")
    creator = relationship("User", foreign_keys=[created_by])
    folder = relationship("Folder", back_populates="chats")
    conversation = relationship("Conversation", uselist=False)

    def __repr__(self):
        return f"<Chat(id={self.id}, title='{self.title}', folder_id={self.folder_id})>"

    @property
    def folder_path(self) -> str:
        """
        Get the full folder path for this chat.
        
        Returns:
            str: Full folder path or 'Root' if no folder
        """
        if self.folder:
            return self.folder.full_path
        return "Root"

    @property
    def display_title(self) -> str:
        """
        Get the display title for this chat.
        Falls back to conversation title if chat title is empty.
        
        Returns:
            str: Display title for the chat
        """
        if self.title and self.title.strip():
            return self.title
        if self.conversation and self.conversation.title:
            return self.conversation.title
        return f"Chat {self.id}"

    @property
    def status_label(self) -> str:
        """
        Get a human-readable status label for this chat.
        
        Returns:
            str: Status label
        """
        if not self.is_active:
            return "Deleted"
        if self.is_archived:
            return "Archived"
        if self.is_pinned:
            return "Pinned"
        if self.is_favorite:
            return "Favorite"
        return "Active"

    @property
    def activity_summary(self) -> Dict[str, Any]:
        """
        Get an activity summary for this chat.
        
        Returns:
            Dict[str, Any]: Activity summary with metrics
        """
        return {
            "message_count": self.message_count,
            "last_activity": self.last_activity_at.isoformat() if self.last_activity_at else None,
            "total_tokens": self.total_tokens_used,
            "estimated_cost": self.estimated_cost,
            "last_model": self.last_model_used,
            "days_since_activity": (
                (datetime.utcnow() - self.last_activity_at).days
                if self.last_activity_at else None
            )
        }

    def to_dict(self, include_conversation: bool = False, include_folder: bool = False) -> Dict[str, Any]:
        """
        Convert chat to dictionary representation.
        
        Args:
            include_conversation: Whether to include conversation data
            include_folder: Whether to include folder information
            
        Returns:
            Dict[str, Any]: Dictionary representation of the chat
        """
        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "display_title": self.display_title,
            "user_id": self.user_id,
            "folder_id": self.folder_id,
            "conversation_id": self.conversation_id,
            "color": self.color,
            "icon": self.icon,
            "is_pinned": self.is_pinned,
            "is_favorite": self.is_favorite,
            "sort_order": self.sort_order,
            "message_count": self.message_count,
            "last_activity_at": self.last_activity_at.isoformat() if self.last_activity_at else None,
            "last_model_used": self.last_model_used,
            "total_tokens_used": self.total_tokens_used,
            "estimated_cost": self.estimated_cost,
            "is_active": self.is_active,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "folder_path": self.folder_path,
            "status_label": self.status_label,
            "activity_summary": self.activity_summary
        }
        
        if include_conversation and self.conversation:
            data["conversation"] = self.conversation.to_dict()
        
        if include_folder and self.folder:
            data["folder"] = self.folder.to_dict()
        
        return data

    def update_activity(self, model_used: Optional[str] = None, tokens_used: int = 0, cost: str = "$0.00"):
        """
        Update chat activity metrics.
        
        Args:
            model_used: The LLM model used in this interaction
            tokens_used: Number of tokens consumed
            cost: Estimated cost of the interaction
        """
        self.last_activity_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        
        if model_used:
            self.last_model_used = model_used
        
        self.total_tokens_used += tokens_used
        
        # Update estimated cost (simplified - in production, use proper decimal arithmetic)
        if cost and cost != "$0.00":
            self.estimated_cost = cost

    def sync_with_conversation(self):
        """
        Synchronize chat statistics with the associated conversation.
        """
        if self.conversation:
            # Update message count
            self.message_count = self.conversation.message_count
            
            # Update last activity
            if self.conversation.last_message_at:
                self.last_activity_at = self.conversation.last_message_at
            
            # Update model used
            if self.conversation.model_used:
                self.last_model_used = self.conversation.model_used
            
            # Sync title if chat title is empty
            if not self.title or self.title.strip() == "":
                self.title = self.conversation.title
            
            self.updated_at = datetime.utcnow()

    def move_to_folder(self, folder_id: Optional[int]):
        """
        Move this chat to a different folder.
        
        Args:
            folder_id: ID of the destination folder (None for root level)
        """
        self.folder_id = folder_id
        self.updated_at = datetime.utcnow()

    def toggle_pin(self):
        """Toggle the pinned status of this chat."""
        self.is_pinned = not self.is_pinned
        self.updated_at = datetime.utcnow()

    def toggle_favorite(self):
        """Toggle the favorite status of this chat."""
        self.is_favorite = not self.is_favorite
        self.updated_at = datetime.utcnow()

    def archive(self):
        """Archive this chat."""
        self.is_archived = True
        self.updated_at = datetime.utcnow()

    def unarchive(self):
        """Unarchive this chat."""
        self.is_archived = False
        self.updated_at = datetime.utcnow()

    def soft_delete(self):
        """Soft delete this chat."""
        self.is_active = False
        self.updated_at = datetime.utcnow()

    def restore(self):
        """Restore a soft-deleted chat."""
        self.is_active = True
        self.is_archived = False
        self.updated_at = datetime.utcnow()

    @classmethod
    def create_from_conversation(cls, db_session, conversation_id: int, user_id: int, 
                               folder_id: Optional[int] = None, created_by: Optional[int] = None) -> 'Chat':
        """
        Create a new chat from an existing conversation.
        
        Args:
            db_session: Database session
            conversation_id: ID of the conversation to wrap
            user_id: ID of the user who owns the chat
            folder_id: ID of the folder to place the chat in
            created_by: ID of the user creating the chat
            
        Returns:
            Chat: Newly created chat instance
        """
        from .conversation import Conversation
        
        # Get the conversation
        conversation = db_session.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Create the chat
        chat = cls(
            title=conversation.title,
            user_id=user_id,
            folder_id=folder_id,
            conversation_id=conversation_id,
            created_by=created_by or user_id
        )
        
        # Sync initial statistics
        chat.sync_with_conversation()
        
        db_session.add(chat)
        db_session.commit()
        
        return chat

    @classmethod
    def get_user_chats(cls, db_session, user_id: int, folder_id: Optional[int] = None,
                      include_archived: bool = False, include_deleted: bool = False) -> List['Chat']:
        """
        Get chats for a specific user, optionally filtered by folder.
        
        Args:
            db_session: Database session
            user_id: ID of the user
            folder_id: ID of the folder to filter by (None for root level)
            include_archived: Whether to include archived chats
            include_deleted: Whether to include soft-deleted chats
            
        Returns:
            List[Chat]: List of matching chats
        """
        query = db_session.query(cls).filter(cls.user_id == user_id)
        
        # Filter by folder
        if folder_id is None:
            query = query.filter(cls.folder_id.is_(None))
        else:
            query = query.filter(cls.folder_id == folder_id)
        
        # Filter by status
        if not include_deleted:
            query = query.filter(cls.is_active == True)
        
        if not include_archived:
            query = query.filter(cls.is_archived == False)
        
        # Order by pinned first, then by last activity
        query = query.order_by(
            cls.is_pinned.desc(),
            cls.last_activity_at.desc().nullslast(),
            cls.created_at.desc()
        )
        
        return query.all()


# Performance indexes for efficient querying
Index('idx_chat_user_folder', Chat.user_id, Chat.folder_id)
Index('idx_chat_user_activity', Chat.user_id, Chat.last_activity_at.desc())
Index('idx_chat_user_pinned', Chat.user_id, Chat.is_pinned.desc())
Index('idx_chat_user_status', Chat.user_id, Chat.is_active, Chat.is_archived)
Index('idx_chat_folder_sort', Chat.folder_id, Chat.sort_order, Chat.is_pinned.desc())
