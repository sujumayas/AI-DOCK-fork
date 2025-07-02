"""
Project CRUD API endpoints.

This module handles basic Create, Read, Update, Delete operations for projects.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
import logging

from ...core.database import get_async_db
from ...core.security import get_current_user
from ...models.user import User
from ...services.project_service import ProjectService

# Setup logging
logger = logging.getLogger(__name__)

# Create router for project CRUD operations
router = APIRouter(prefix="/projects", tags=["projects"])

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

from pydantic import BaseModel, Field

class ProjectCreate(BaseModel):
    """Request model for creating a project folder."""
    name: str = Field(..., min_length=1, max_length=100, description="Folder name")
    description: Optional[str] = Field(None, max_length=500, description="Folder description")
    default_assistant_id: Optional[int] = Field(None, description="Default assistant ID for new conversations in this folder")
    color: Optional[str] = Field("#3B82F6", max_length=20, description="Folder color")
    icon: Optional[str] = Field("📁", max_length=50, description="Folder icon")
    is_favorited: Optional[bool] = Field(False, description="Whether folder is favorited")

class ProjectUpdate(BaseModel):
    """Request model for updating a project folder."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Folder name")
    description: Optional[str] = Field(None, max_length=500, description="Folder description")
    default_assistant_id: Optional[int] = Field(None, description="Default assistant ID for new conversations in this folder")
    color: Optional[str] = Field(None, max_length=20, description="Folder color")
    icon: Optional[str] = Field(None, max_length=50, description="Folder icon")
    is_favorited: Optional[bool] = Field(None, description="Whether folder is favorited")

class ProjectResponse(BaseModel):
    """Response model for project folder data."""
    id: int
    name: str
    description: Optional[str]
    default_assistant_id: Optional[int]
    default_assistant_name: Optional[str]
    has_default_assistant: bool
    color: Optional[str]
    icon: Optional[str]
    user_id: int
    is_active: bool
    is_archived: bool
    is_favorited: bool
    conversation_count: int
    created_at: str
    updated_at: str
    last_accessed_at: Optional[str]

class ProjectSummary(BaseModel):
    """Summary model for project listing."""
    id: int
    name: str
    description: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    is_favorited: bool
    is_archived: bool
    conversation_count: int
    last_accessed_at: Optional[str]
    default_assistant_id: Optional[int]
    default_assistant_name: Optional[str]
    has_default_assistant: bool

class ProjectListResponse(BaseModel):
    """Response model for project listings."""
    projects: List[ProjectSummary]
    total: int
    has_more: bool

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_project_response(project, include_sensitive: bool = True) -> ProjectResponse:
    """Create a ProjectResponse from a Project model."""
    project_dict = project.to_dict(include_sensitive=include_sensitive)
    return ProjectResponse(**project_dict)

async def create_project_response_async(project, db: AsyncSession, include_sensitive: bool = True) -> ProjectResponse:
    """Create a ProjectResponse from a Project model using async methods."""
    # Get the base dictionary
    project_dict = await project.to_dict_async(db, include_sensitive=include_sensitive)
    
    return ProjectResponse(**project_dict)

def create_project_summary(project) -> ProjectSummary:
    """Create a ProjectSummary from a Project model."""
    return ProjectSummary(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        icon=project.icon,
        is_favorited=project.is_favorited,
        is_archived=project.is_archived,
        conversation_count=len(project.conversations) if hasattr(project, 'conversations') and project.conversations else 0,
        last_accessed_at=project.last_accessed_at.isoformat() if project.last_accessed_at else None
    )

async def create_project_summary_async(project, db: AsyncSession) -> ProjectSummary:
    """Create a ProjectSummary from a Project model using async methods."""
    # Load assistant name if there's a default assistant
    default_assistant_name = None
    if project.default_assistant_id:
        try:
            from sqlalchemy import select
            from ...models.assistant import Assistant
            assistant_query = select(Assistant.name).where(Assistant.id == project.default_assistant_id)
            assistant_result = await db.execute(assistant_query)
            default_assistant_name = assistant_result.scalar_one_or_none()
        except Exception as e:
            logger.warning(f"Failed to load assistant name for ID {project.default_assistant_id}: {str(e)}")
    
    return ProjectSummary(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        icon=project.icon,
        is_favorited=project.is_favorited,
        is_archived=project.is_archived,
        conversation_count=await project.get_conversation_count_async(db),
        last_accessed_at=project.last_accessed_at.isoformat() if project.last_accessed_at else None,
        default_assistant_id=project.default_assistant_id,
        default_assistant_name=default_assistant_name,
        has_default_assistant=bool(project.default_assistant_id)
    )

# =============================================================================
# CREATE PROJECT
# =============================================================================

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> ProjectResponse:
    """
    Create a new project.
    
    Creates a new project for the authenticated user with the provided configuration.
    """
    try:
        service = ProjectService(db)
        
        # Convert Pydantic model to dict
        project_dict = project_data.model_dump(exclude_unset=True)
        
        # Create project
        project = await service.create_project(project_dict, current_user.id)
        
        logger.info(f"Created project '{project.name}' for user {current_user.id}")
        
        # Create response manually to avoid relationship access issues
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            default_assistant_id=project.default_assistant_id,
            default_assistant_name=None,  # Will be loaded if needed
            has_default_assistant=bool(project.default_assistant_id),
            color=project.color,
            icon=project.icon,
            user_id=project.user_id,
            is_active=project.is_active,
            is_archived=project.is_archived,
            is_favorited=project.is_favorited,
            conversation_count=0,  # New project has no conversations
            created_at=project.created_at.isoformat() if project.created_at else "",
            updated_at=project.updated_at.isoformat() if project.updated_at else "",
            last_accessed_at=project.last_accessed_at.isoformat() if project.last_accessed_at else None
        )
        
    except ValueError as e:
        logger.warning(f"Validation error creating project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project"
        )

# =============================================================================
# READ PROJECTS
# =============================================================================

@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    include_archived: bool = Query(False, description="Include archived projects"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of projects to return"),
    offset: int = Query(0, ge=0, description="Number of projects to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> ProjectListResponse:
    """
    Get list of user's projects.
    
    Returns a paginated list of projects owned by the authenticated user.
    """
    try:
        service = ProjectService(db)
        
        # Get projects
        projects = await service.get_user_projects(
            user_id=current_user.id,
            include_archived=include_archived,
            limit=limit + 1,  # Get one extra to check if there are more
            offset=offset
        )
        
        # Check if there are more projects
        has_more = len(projects) > limit
        if has_more:
            projects = projects[:limit]  # Remove the extra project
        
        # Convert to summaries
        project_summaries = []
        for project in projects:
            summary = await create_project_summary_async(project, db)
            project_summaries.append(summary)
        
        return ProjectListResponse(
            projects=project_summaries,
            total=len(project_summaries),
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"Error listing projects: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve projects"
        )

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> ProjectResponse:
    """
    Get a specific project by ID.
    
    Returns detailed information about a project owned by the authenticated user.
    """
    try:
        service = ProjectService(db)
        
        project = await service.get_project_by_id(project_id, current_user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Create response manually to avoid relationship access issues
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            default_assistant_id=project.default_assistant_id,
            default_assistant_name=None,  # Will be loaded if needed
            has_default_assistant=bool(project.default_assistant_id),
            color=project.color,
            icon=project.icon,
            user_id=project.user_id,
            is_active=project.is_active,
            is_archived=project.is_archived,
            is_favorited=project.is_favorited,
            conversation_count=await project.get_conversation_count_async(db),
            created_at=project.created_at.isoformat() if project.created_at else "",
            updated_at=project.updated_at.isoformat() if project.updated_at else "",
            last_accessed_at=project.last_accessed_at.isoformat() if project.last_accessed_at else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project"
        )

# =============================================================================
# UPDATE PROJECT
# =============================================================================

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> ProjectResponse:
    """
    Update a project.
    
    Updates an existing project with the provided data.
    """
    try:
        service = ProjectService(db)
        
        # Convert Pydantic model to dict, excluding unset fields
        update_dict = project_data.model_dump(exclude_unset=True)
        
        if not update_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields provided for update"
            )
        
        project = await service.update_project(project_id, update_dict, current_user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        logger.info(f"Updated project {project_id} for user {current_user.id}")
        
        # Load assistant name if there's a default assistant
        default_assistant_name = None
        if project.default_assistant_id:
            try:
                from sqlalchemy import select
                from ...models.assistant import Assistant
                assistant_query = select(Assistant.name).where(Assistant.id == project.default_assistant_id)
                assistant_result = await db.execute(assistant_query)
                default_assistant_name = assistant_result.scalar_one_or_none()
            except Exception as e:
                logger.warning(f"Failed to load assistant name for ID {project.default_assistant_id}: {str(e)}")
        
        # Create response manually to avoid relationship access issues
        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            default_assistant_id=project.default_assistant_id,
            default_assistant_name=default_assistant_name,
            has_default_assistant=bool(project.default_assistant_id),
            color=project.color,
            icon=project.icon,
            user_id=project.user_id,
            is_active=project.is_active,
            is_archived=project.is_archived,
            is_favorited=project.is_favorited,
            conversation_count=await project.get_conversation_count_async(db),
            created_at=project.created_at.isoformat() if project.created_at else "",
            updated_at=project.updated_at.isoformat() if project.updated_at else "",
            last_accessed_at=project.last_accessed_at.isoformat() if project.last_accessed_at else None
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error updating project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project"
        )

# =============================================================================
# DELETE PROJECT
# =============================================================================

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Delete a project.
    
    Soft deletes a project by deactivating it. The project data is preserved.
    """
    try:
        service = ProjectService(db)
        
        success = await service.delete_project(project_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        logger.info(f"Deleted project {project_id} for user {current_user.id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project"
        )

# =============================================================================
# PROJECT STATUS OPERATIONS
# =============================================================================

@router.post("/{project_id}/archive", status_code=status.HTTP_200_OK)
async def archive_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Archive a project.
    
    Archives a project, hiding it from the main view but preserving data.
    """
    try:
        service = ProjectService(db)
        
        success = await service.archive_project(project_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        logger.info(f"Archived project {project_id} for user {current_user.id}")
        return {"message": "Project archived successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to archive project"
        )

@router.post("/{project_id}/unarchive", status_code=status.HTTP_200_OK)
async def unarchive_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Unarchive a project.
    
    Restores an archived project to the main view.
    """
    try:
        service = ProjectService(db)
        
        success = await service.unarchive_project(project_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archived project not found"
            )
        
        logger.info(f"Unarchived project {project_id} for user {current_user.id}")
        return {"message": "Project unarchived successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unarchiving project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unarchive project"
        )

@router.post("/{project_id}/favorite", status_code=status.HTTP_200_OK)
async def toggle_project_favorite(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Toggle project favorite status.
    
    Toggles whether a project is marked as a favorite.
    """
    try:
        service = ProjectService(db)
        
        success = await service.toggle_project_favorite(project_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        logger.info(f"Toggled favorite for project {project_id}")
        return {"message": "Project favorite status toggled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling project favorite: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle project favorite"
        )

# =============================================================================
# PROJECT SEARCH
# =============================================================================

@router.get("/search/", response_model=ProjectListResponse)
async def search_projects(
    q: str = Query(..., min_length=1, description="Search query"),
    archived: Optional[bool] = Query(None, description="Filter by archived status"),
    favorited: Optional[bool] = Query(None, description="Filter by favorite status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> ProjectListResponse:
    """
    Search projects.
    
    Searches projects by name or description with optional filters.
    """
    try:
        service = ProjectService(db)
        
        # Build filters
        filters = {}
        if archived is not None:
            filters['archived'] = archived
        if favorited is not None:
            filters['favorited'] = favorited
        
        # Search projects
        projects = await service.search_projects(
            user_id=current_user.id,
            query=q,
            filters=filters
        )
        
        # Convert to summaries
        project_summaries = []
        for project in projects:
            summary = await create_project_summary_async(project, db)
            project_summaries.append(summary)
        
        return ProjectListResponse(
            projects=project_summaries,
            total=len(project_summaries),
            has_more=False  # Search results are limited
        )
        
    except Exception as e:
        logger.error(f"Error searching projects: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search projects"
        )