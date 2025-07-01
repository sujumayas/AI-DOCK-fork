"""
Project Statistics API endpoints.

This module handles project analytics, statistics, and reporting.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
import logging

from ...core.database import get_async_db
from ...core.security import get_current_user
from ...models.user import User
from ...services.project_service import ProjectService

# Setup logging
logger = logging.getLogger(__name__)

# Create router for project statistics
router = APIRouter(prefix="/projects", tags=["projects", "statistics"])

# =============================================================================
# RESPONSE MODELS
# =============================================================================

from pydantic import BaseModel

class ProjectStatsResponse(BaseModel):
    """Response model for project statistics."""
    id: int
    name: str
    conversation_count: int
    total_messages: int
    avg_messages_per_conversation: float
    conversations_last_week: int
    days_since_created: int
    has_system_prompt: bool
    has_custom_preferences: bool
    created_at: str
    updated_at: str
    last_accessed_at: str
    last_activity: str
    is_favorited: bool
    is_archived: bool

class UserProjectSummaryResponse(BaseModel):
    """Response model for user project summary."""
    user_id: int
    total_projects: int
    active_projects: int
    archived_projects: int
    favorited_projects: int
    total_conversations: int
    recently_active_projects: int
    avg_conversations_per_project: float

# =============================================================================
# PROJECT STATISTICS ENDPOINTS
# =============================================================================

@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
async def get_project_statistics(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> ProjectStatsResponse:
    """
    Get detailed statistics for a project.
    
    Returns comprehensive analytics and metrics for the specified project.
    """
    try:
        service = ProjectService(db)
        
        stats = await service.get_project_stats(project_id, current_user.id)
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Convert datetime objects to ISO strings for JSON serialization
        for key in ['created_at', 'updated_at', 'last_accessed_at', 'last_activity']:
            if key in stats and stats[key]:
                if hasattr(stats[key], 'isoformat'):
                    stats[key] = stats[key].isoformat()
                else:
                    stats[key] = str(stats[key])
        
        return ProjectStatsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project statistics"
        )

@router.get("/summary", response_model=UserProjectSummaryResponse)
async def get_user_project_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> UserProjectSummaryResponse:
    """
    Get summary statistics for all user projects.
    
    Returns an overview of the user's project usage and activity.
    """
    try:
        service = ProjectService(db)
        
        summary = await service.get_user_project_summary(current_user.id)
        if not summary:
            # Return empty summary if no projects exist
            summary = {
                'user_id': current_user.id,
                'total_projects': 0,
                'active_projects': 0,
                'archived_projects': 0,
                'favorited_projects': 0,
                'total_conversations': 0,
                'recently_active_projects': 0,
                'avg_conversations_per_project': 0.0
            }
        
        return UserProjectSummaryResponse(**summary)
        
    except Exception as e:
        logger.error(f"Error getting user project summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project summary"
        )