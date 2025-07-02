# AI Dock Project Service
# Business logic for project management and operations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, desc, func, and_, or_, update
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import json
import logging

# Setup logging for project service
logger = logging.getLogger(__name__)

from ..models.project import Project
from ..models.conversation import Conversation
from ..models.user import User

class ProjectService:
    """
    Service for managing project operations.
    
    Key Responsibilities:
    - Create, read, update, delete projects
    - Validate user ownership and permissions
    - Manage project-conversation relationships
    - Handle project archiving and favorites
    - Provide project statistics and analytics
    """
    
    def __init__(self, db: AsyncSession):
        """
        Initialize the project service with database session.
        
        Args:
            db: Async database session for operations
        """
        self.db = db
    
    # =============================================================================
    # PROJECT CRUD OPERATIONS
    # =============================================================================
    
    async def create_project(self, project_data: Dict[str, Any], user_id: int) -> Project:
        """
        Create a new project for a user.
        
        Args:
            project_data: Dictionary with project information
            user_id: ID of the user creating the project
            
        Returns:
            Newly created Project object
            
        Raises:
            ValueError: If project data is invalid
        """
        try:
            # Validate required fields
            if not project_data.get('name'):
                raise ValueError("Project name is required")
            
            # Set defaults for optional fields
            project_data.setdefault('description', '')
            project_data.setdefault('color', '#3B82F6')
            project_data.setdefault('icon', '📁')
            project_data.setdefault('is_active', True)
            project_data.setdefault('is_archived', False)
            project_data.setdefault('is_favorited', False)
            
            # Create project object
            project = Project(
                name=project_data['name'],
                description=project_data['description'],
                default_assistant_id=project_data.get('default_assistant_id'),
                color=project_data['color'],
                icon=project_data['icon'],
                user_id=user_id,
                is_active=project_data['is_active'],
                is_archived=project_data['is_archived'],
                is_favorited=project_data['is_favorited']
            )
            
            # Validate project data
            if not project.is_valid():
                raise ValueError("Invalid project data")
            
            # Save to database
            self.db.add(project)
            await self.db.commit()
            await self.db.refresh(project)
            
            logger.info(f"Created project '{project.name}' for user {user_id}")
            return project
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating project: {str(e)}")
            raise
    
    async def get_project_by_id(self, project_id: int, user_id: int) -> Optional[Project]:
        """
        Get a project by ID, ensuring user ownership.
        
        Args:
            project_id: ID of the project to retrieve
            user_id: ID of the user requesting the project
            
        Returns:
            Project object if found and owned by user, None otherwise
        """
        try:
            # Get the project with all relationships loaded
            query = select(Project).options(
                selectinload(Project.conversations),
                selectinload(Project.user)
            ).where(
                and_(
                    Project.id == project_id,
                    Project.user_id == user_id,
                    Project.is_active == True
                )
            )
            
            result = await self.db.execute(query)
            project = result.scalar_one_or_none()
            
            if project:
                # Update the access timestamp
                update_stmt = update(Project).where(
                    Project.id == project_id
                ).values(
                    last_accessed_at=func.now(),
                    updated_at=func.now()
                )
                await self.db.execute(update_stmt)
                
                # Commit the timestamp update
                await self.db.commit()
                
                # Update the in-memory object to reflect the change
                project.last_accessed_at = datetime.utcnow()
                project.updated_at = datetime.utcnow()
            
            return project
            
        except Exception as e:
            logger.error(f"Error getting project {project_id}: {str(e)}")
            await self.db.rollback()
            return None
    
    async def get_user_projects(
        self, 
        user_id: int, 
        include_archived: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> List[Project]:
        """
        Get all projects for a user.
        
        Args:
            user_id: ID of the user
            include_archived: Whether to include archived projects
            limit: Maximum number of projects to return
            offset: Number of projects to skip
            
        Returns:
            List of user's projects
        """
        try:
            query = select(Project).options(
                selectinload(Project.conversations)
            ).where(
                and_(
                    Project.user_id == user_id,
                    Project.is_active == True
                )
            )
            
            if not include_archived:
                query = query.where(Project.is_archived == False)
            
            # Order by favorites first, then by last activity
            query = query.order_by(
                desc(Project.is_favorited),
                desc(Project.last_accessed_at),
                desc(Project.updated_at)
            ).limit(limit).offset(offset)
            
            result = await self.db.execute(query)
            projects = result.scalars().all()
            
            return list(projects)
            
        except Exception as e:
            logger.error(f"Error getting user projects: {str(e)}")
            return []
    
    async def update_project(
        self, 
        project_id: int, 
        project_data: Dict[str, Any], 
        user_id: int
    ) -> Optional[Project]:
        """
        Update a project with new data.
        
        Args:
            project_id: ID of the project to update
            project_data: Dictionary with updated project information
            user_id: ID of the user updating the project
            
                Returns:
            Updated Project object if successful, None otherwise
        """
        try:
            # Get existing project
            project = await self.get_project_by_id(project_id, user_id)
            if not project:
                return None

            # Update fields that are provided
            if 'name' in project_data:
                project.name = project_data['name']
            if 'description' in project_data:
                project.description = project_data['description']
            if 'default_assistant_id' in project_data:
                project.default_assistant_id = project_data['default_assistant_id']
            if 'color' in project_data:
                project.color = project_data['color']
            if 'icon' in project_data:
                project.icon = project_data['icon']
            if 'is_favorited' in project_data:
                project.is_favorited = project_data['is_favorited']
            
            # Validate updated project data
            if not project.is_valid():
                raise ValueError("Invalid project data after update")

            project.updated_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(project)

            logger.info(f"Updated project {project_id} for user {user_id}")
            return project
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating project {project_id}: {str(e)}")
            return None
    
    async def delete_project(self, project_id: int, user_id: int) -> bool:
        """
        Delete a project (soft delete by deactivating).
        
        Args:
            project_id: ID of the project to delete
            user_id: ID of the user deleting the project
            
        Returns:
            True if successful, False otherwise
        """
        try:
            project = await self.get_project_by_id(project_id, user_id)
            if not project:
                return False
            
            # Soft delete by deactivating
            project.deactivate()
            await self.db.commit()
            
            logger.info(f"Deleted project {project_id} for user {user_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting project {project_id}: {str(e)}")
            return False
    
    # =============================================================================
    # PROJECT-CONVERSATION MANAGEMENT
    # =============================================================================
    
    async def add_conversation_to_project(
        self, 
        project_id: int, 
        conversation_id: int, 
        user_id: int
    ) -> bool:
        """
        Add a conversation to a project.
        
        Args:
            project_id: ID of the project
            conversation_id: ID of the conversation to add
            user_id: ID of the user performing the action
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get project and validate ownership
            project = await self.get_project_by_id(project_id, user_id)
            if not project:
                return False
            
            # Get conversation and validate ownership
            conversation_query = select(Conversation).where(
                and_(
                    Conversation.id == conversation_id,
                    Conversation.user_id == user_id,
                    Conversation.is_active == True
                )
            )
            result = await self.db.execute(conversation_query)
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                return False
            
            # Add conversation to project
            project.add_conversation(conversation)
            await self.db.commit()
            
            logger.info(f"Added conversation {conversation_id} to project {project_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error adding conversation to project: {str(e)}")
            return False
    
    async def remove_conversation_from_project(
        self, 
        project_id: int, 
        conversation_id: int, 
        user_id: int
    ) -> bool:
        """
        Remove a conversation from a project.
        
        Args:
            project_id: ID of the project
            conversation_id: ID of the conversation to remove
            user_id: ID of the user performing the action
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get project and validate ownership
            project = await self.get_project_by_id(project_id, user_id)
            if not project:
                return False
            
            # Find conversation in project
            conversation = None
            for conv in project.conversations:
                if conv.id == conversation_id:
                    conversation = conv
                    break
            
            if not conversation:
                return False
            
            # Remove conversation from project
            project.remove_conversation(conversation)
            await self.db.commit()
            
            logger.info(f"Removed conversation {conversation_id} from project {project_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error removing conversation from project: {str(e)}")
            return False
    
    async def get_project_conversations(
        self, 
        project_id: int, 
        user_id: int,
        limit: int = 20
    ) -> List[Conversation]:
        """
        Get conversations associated with a project.
        
        Args:
            project_id: ID of the project
            user_id: ID of the user requesting conversations
            limit: Maximum number of conversations to return
            
        Returns:
            List of conversations in the project
        """
        try:
            # Get the project with conversations loaded properly
            query = select(Project).options(
                selectinload(Project.conversations).selectinload(Conversation.assistant),
                selectinload(Project.conversations).selectinload(Conversation.projects),
                selectinload(Project.conversations).selectinload(Conversation.user)
            ).where(
                and_(
                    Project.id == project_id,
                    Project.user_id == user_id,
                    Project.is_active == True
                )
            )
            
            result = await self.db.execute(query)
            project = result.scalar_one_or_none()
            
            if not project:
                return []
            
            return project.get_recent_conversations(limit)
            
        except Exception as e:
            logger.error(f"Error getting project conversations: {str(e)}")
            return []
    
    # =============================================================================
    # PROJECT STATUS MANAGEMENT
    # =============================================================================
    
    async def archive_project(self, project_id: int, user_id: int) -> bool:
        """
        Archive a project (hide from main view but keep data).
        
        Args:
            project_id: ID of the project to archive
            user_id: ID of the user archiving the project
            
        Returns:
            True if successful, False otherwise
        """
        try:
            project = await self.get_project_by_id(project_id, user_id)
            if not project:
                return False
            
            project.archive()
            await self.db.commit()
            
            logger.info(f"Archived project {project_id} for user {user_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error archiving project {project_id}: {str(e)}")
            return False
    
    async def unarchive_project(self, project_id: int, user_id: int) -> bool:
        """
        Unarchive a project (restore to main view).
        
        Args:
            project_id: ID of the project to unarchive
            user_id: ID of the user unarchiving the project
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get archived project
            query = select(Project).where(
                and_(
                    Project.id == project_id,
                    Project.user_id == user_id,
                    Project.is_active == True,
                    Project.is_archived == True
                )
            )
            result = await self.db.execute(query)
            project = result.scalar_one_or_none()
            
            if not project:
                return False
            
            project.unarchive()
            await self.db.commit()
            
            logger.info(f"Unarchived project {project_id} for user {user_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error unarchiving project {project_id}: {str(e)}")
            return False
    
    async def toggle_project_favorite(self, project_id: int, user_id: int) -> bool:
        """
        Toggle the favorite status of a project.
        
        Args:
            project_id: ID of the project
            user_id: ID of the user toggling favorite
            
        Returns:
            True if successful, False otherwise
        """
        try:
            project = await self.get_project_by_id(project_id, user_id)
            if not project:
                return False
            
            project.toggle_favorite()
            await self.db.commit()
            
            logger.info(f"Toggled favorite for project {project_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error toggling project favorite: {str(e)}")
            return False
    
    # =============================================================================
    # PROJECT STATISTICS AND ANALYTICS
    # =============================================================================
    
    async def get_project_stats(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """
        Get statistics for a project.
        
        Args:
            project_id: ID of the project
            user_id: ID of the user requesting stats
            
        Returns:
            Dictionary with project statistics
        """
        try:
            project = await self.get_project_by_id(project_id, user_id)
            if not project:
                return {}

            # Use async method for conversation count
            conversation_count = await project.get_conversation_count_async(self.db)
            
            stats = {
                'id': project.id,
                'name': project.name,
                'conversation_count': conversation_count,
                'created_at': project.created_at,
                'updated_at': project.updated_at,
                'last_accessed_at': project.last_accessed_at,
                'last_activity': project.last_activity,
                'is_favorited': project.is_favorited,
                'is_archived': project.is_archived,
                'days_since_created': (datetime.utcnow() - project.created_at).days if project.created_at else 0,
                'has_default_assistant': bool(project.default_assistant_id),
                'default_assistant_name': project.default_assistant.name if project.default_assistant else None
            }
            
            # Calculate activity metrics
            if project.conversations:
                total_messages = sum(conv.message_count for conv in project.conversations)
                stats['total_messages'] = total_messages
                stats['avg_messages_per_conversation'] = total_messages / len(project.conversations)
                
                # Recent activity (last 7 days)
                week_ago = datetime.utcnow() - timedelta(days=7)
                recent_conversations = [
                    conv for conv in project.conversations 
                    if conv.updated_at and conv.updated_at > week_ago
                ]
                stats['conversations_last_week'] = len(recent_conversations)
            else:
                stats.update({
                    'total_messages': 0,
                    'avg_messages_per_conversation': 0,
                    'conversations_last_week': 0
                })
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting project stats: {str(e)}")
            return {}
    
    async def get_user_project_summary(self, user_id: int) -> Dict[str, Any]:
        """
        Get summary statistics for all user projects.
        
        Args:
            user_id: ID of the user
            
        Returns:
            Dictionary with user project summary
        """
        try:
            # Get all user projects
            projects = await self.get_user_projects(user_id, include_archived=True)
            
            total_projects = len(projects)
            active_projects = len([p for p in projects if not p.is_archived])
            archived_projects = len([p for p in projects if p.is_archived])
            favorited_projects = len([p for p in projects if p.is_favorited])
            
            # Calculate total conversations using loaded relationships
            total_conversations = sum(len(p.conversations) if hasattr(p, 'conversations') and p.conversations else 0 for p in projects)
            
            # Recent activity
            week_ago = datetime.utcnow() - timedelta(days=7)
            recently_active = len([
                p for p in projects 
                if p.last_activity and p.last_activity > week_ago
            ])
            
            summary = {
                'user_id': user_id,
                'total_projects': total_projects,
                'active_projects': active_projects,
                'archived_projects': archived_projects,
                'favorited_projects': favorited_projects,
                'total_conversations': total_conversations,
                'recently_active_projects': recently_active,
                'avg_conversations_per_project': total_conversations / total_projects if total_projects > 0 else 0
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting user project summary: {str(e)}")
            return {}
    
    # =============================================================================
    # PROJECT SEARCH AND FILTERING
    # =============================================================================
    
    async def search_projects(
        self, 
        user_id: int, 
        query: str, 
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Project]:
        """
        Search projects by name or description.
        
        Args:
            user_id: ID of the user
            query: Search query string
            filters: Optional filters (archived, favorited, etc.)
            
        Returns:
            List of matching projects
        """
        try:
            base_query = select(Project).options(
                selectinload(Project.conversations)
            ).where(
                and_(
                    Project.user_id == user_id,
                    Project.is_active == True
                )
            )
            
            # Add text search
            if query:
                search_filter = or_(
                    Project.name.ilike(f"%{query}%"),
                    Project.description.ilike(f"%{query}%")
                )
                base_query = base_query.where(search_filter)
            
            # Apply filters
            if filters:
                if 'archived' in filters:
                    base_query = base_query.where(Project.is_archived == filters['archived'])
                if 'favorited' in filters:
                    base_query = base_query.where(Project.is_favorited == filters['favorited'])
            
            # Order by relevance and activity
            base_query = base_query.order_by(
                desc(Project.is_favorited),
                desc(Project.last_accessed_at),
                desc(Project.updated_at)
            ).limit(20)
            
            result = await self.db.execute(base_query)
            projects = result.scalars().all()
            
            return list(projects)
            
        except Exception as e:
            logger.error(f"Error searching projects: {str(e)}")
            return []