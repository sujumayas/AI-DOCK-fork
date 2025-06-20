"""
Folder Model for AI Dock App

This module defines the database model for organizing chats into folders.
Supports hierarchical folder structure with parent-child relationships.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.declarative import declarative_base

from ..core.database import Base


class Folder(Base):
    """
    Folder model for organizing chats into hierarchical structures.
    
    Features:
    - Hierarchical folder structure (parent-child relationships)
    - User ownership and isolation
    - Soft deletion support
    - Audit trail (created/modified timestamps)
    - Flexible metadata storage
    """
    __tablename__ = "folders"

    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # User ownership - every folder belongs to a specific user
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Hierarchical structure - folders can have parent folders
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True, index=True)
    
    # Folder properties
    color = Column(String(7), nullable=True, default="#3B82F6")  # Hex color code
    icon = Column(String(50), nullable=True, default="folder")   # Icon identifier
    sort_order = Column(Integer, nullable=False, default=0)      # For custom sorting
    
    # Status and lifecycle
    is_active = Column(Boolean, nullable=False, default=True)
    is_system = Column(Boolean, nullable=False, default=False)   # System-created folders
    
    # Audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="folders")
    creator = relationship("User", foreign_keys=[created_by])
    
    # Self-referencing relationship for hierarchical structure
    children = relationship(
        "Folder",
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan"
    )
    
    # Relationship to chats in this folder
    chats = relationship("Chat", back_populates="folder", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Folder(id={self.id}, name='{self.name}', user_id={self.user_id})>"

    @property
    def full_path(self) -> str:
        """
        Get the full path of the folder (e.g., 'Work/Projects/AI Development').
        
        Returns:
            str: Full hierarchical path of the folder
        """
        if self.parent:
            return f"{self.parent.full_path}/{self.name}"
        return self.name

    @property
    def depth(self) -> int:
        """
        Get the depth level of the folder in the hierarchy.
        
        Returns:
            int: Depth level (0 for root folders)
        """
        if self.parent:
            return self.parent.depth + 1
        return 0

    @property
    def chat_count(self) -> int:
        """
        Get the number of chats in this folder (direct children only).
        
        Returns:
            int: Number of chats in this folder
        """
        return len([chat for chat in self.chats if chat.is_active])

    @property
    def total_chat_count(self) -> int:
        """
        Get the total number of chats in this folder and all subfolders.
        
        Returns:
            int: Total number of chats recursively
        """
        count = self.chat_count
        for child in self.children:
            if child.is_active:
                count += child.total_chat_count
        return count

    @property
    def has_children(self) -> bool:
        """
        Check if this folder has any child folders.
        
        Returns:
            bool: True if folder has children
        """
        return len([child for child in self.children if child.is_active]) > 0

    def to_dict(self, include_children: bool = False, include_chats: bool = False) -> Dict[str, Any]:
        """
        Convert folder to dictionary representation.
        
        Args:
            include_children: Whether to include child folders
            include_chats: Whether to include chats in this folder
            
        Returns:
            Dict[str, Any]: Dictionary representation of the folder
        """
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "user_id": self.user_id,
            "parent_id": self.parent_id,
            "color": self.color,
            "icon": self.icon,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
            "is_system": self.is_system,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
            "full_path": self.full_path,
            "depth": self.depth,
            "chat_count": self.chat_count,
            "total_chat_count": self.total_chat_count,
            "has_children": self.has_children
        }
        
        if include_children:
            data["children"] = [
                child.to_dict(include_children=True, include_chats=include_chats)
                for child in self.children
                if child.is_active
            ]
        
        if include_chats:
            data["chats"] = [
                chat.to_dict() for chat in self.chats
                if chat.is_active
            ]
        
        return data

    @classmethod
    def create_default_folders(cls, db_session, user_id: int, created_by: int) -> List['Folder']:
        """
        Create default folders for a new user.
        
        Args:
            db_session: Database session
            user_id: ID of the user to create folders for
            created_by: ID of the user creating the folders
            
        Returns:
            List[Folder]: List of created default folders
        """
        default_folders = [
            {
                "name": "General",
                "description": "General conversations and discussions",
                "color": "#3B82F6",
                "icon": "message-circle",
                "sort_order": 1,
                "is_system": True
            },
            {
                "name": "Work",
                "description": "Work-related conversations",
                "color": "#059669", 
                "icon": "briefcase",
                "sort_order": 2,
                "is_system": True
            },
            {
                "name": "Projects",
                "description": "Project-specific discussions",
                "color": "#DC2626",
                "icon": "folder-open",
                "sort_order": 3,
                "is_system": True
            },
            {
                "name": "Research",
                "description": "Research and learning conversations",
                "color": "#7C3AED",
                "icon": "search",
                "sort_order": 4,
                "is_system": True
            }
        ]
        
        created_folders = []
        for folder_data in default_folders:
            folder = cls(
                name=folder_data["name"],
                description=folder_data["description"],
                user_id=user_id,
                color=folder_data["color"],
                icon=folder_data["icon"],
                sort_order=folder_data["sort_order"],
                is_system=folder_data["is_system"],
                created_by=created_by
            )
            db_session.add(folder)
            created_folders.append(folder)
        
        db_session.commit()
        return created_folders

    def soft_delete(self):
        """
        Soft delete the folder and all its chats.
        """
        self.is_active = False
        # Soft delete all chats in this folder
        for chat in self.chats:
            chat.soft_delete()

    def move_to_folder(self, new_parent_id: Optional[int]):
        """
        Move this folder to a new parent folder.
        
        Args:
            new_parent_id: ID of the new parent folder (None for root level)
        """
        self.parent_id = new_parent_id
        self.updated_at = datetime.utcnow()

    def get_breadcrumb(self) -> List[Dict[str, Any]]:
        """
        Get breadcrumb navigation for this folder.
        
        Returns:
            List[Dict[str, Any]]: List of folder path components
        """
        breadcrumb = []
        current = self
        while current:
            breadcrumb.insert(0, {
                "id": current.id,
                "name": current.name,
                "icon": current.icon
            })
            current = current.parent
        return breadcrumb
