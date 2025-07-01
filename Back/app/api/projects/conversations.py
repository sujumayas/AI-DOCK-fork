"""
Project-Conversation API endpoints.

This module handles linking conversations to projects and managing project conversations.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import logging

from ...core.database import get_async_db
from ...core.security import get_current_user
from ...models.user import User
from ...services.project_service import ProjectService

# Setup logging
logger = logging.getLogger(__name__)

# Create router for project-conversation operations
router = APIRouter(prefix="/projects", tags=["projects", "conversations"])

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

from pydantic import BaseModel, Field

class ConversationLinkRequest(BaseModel):
    """Request model for linking a conversation to a project."""
    conversation_id: int = Field(..., description="ID of the conversation to link")

class ConversationResponse(BaseModel):
    """Response model for conversation data."""
    id: int
    title: str
    user_id: int
    assistant_id: Optional[int]
    assistant_name: Optional[str]
    created_at: str
    updated_at: str
    is_active: bool
    message_count: int
    last_message_at: Optional[str]
    model_used: Optional[str]

class ConversationListResponse(BaseModel):
    """Response model for conversation listings."""
    conversations: List[ConversationResponse]
    total: int
    project_id: int
    project_name: str

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_conversation_response(conversation) -> ConversationResponse:
    """Create a ConversationResponse from a Conversation model."""
    conv_dict = conversation.to_dict()
    return ConversationResponse(**conv_dict)

# =============================================================================
# PROJECT-CONVERSATION MANAGEMENT
# =============================================================================

@router.post("/{project_id}/conversations", status_code=status.HTTP_201_CREATED)
async def add_conversation_to_project(
    project_id: int,
    request: ConversationLinkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Add a conversation to a project.
    
    Links an existing conversation to a project for organization.
    """
    try:
        service = ProjectService(db)
        
        success = await service.add_conversation_to_project(
            project_id=project_id,
            conversation_id=request.conversation_id,
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project or conversation not found, or you don't have permission"
            )
        
        logger.info(f"Added conversation {request.conversation_id} to project {project_id}")
        return {"message": "Conversation added to project successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding conversation to project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add conversation to project"
        )

@router.delete("/{project_id}/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_conversation_from_project(
    project_id: int,
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Remove a conversation from a project.
    
    Unlinks a conversation from a project without deleting the conversation.
    """
    try:
        service = ProjectService(db)
        
        success = await service.remove_conversation_from_project(
            project_id=project_id,
            conversation_id=conversation_id,
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project, conversation not found, or conversation is not in this project"
            )
        
        logger.info(f"Removed conversation {conversation_id} from project {project_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing conversation from project: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove conversation from project"
        )

@router.get("/{project_id}/conversations", response_model=ConversationListResponse)
async def get_project_conversations(
    project_id: int,
    limit: int = Query(20, ge=1, le=100, description="Maximum number of conversations to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> ConversationListResponse:
    """
    Get conversations in a project.
    
    Returns a list of conversations associated with the specified project.
    """
    try:
        service = ProjectService(db)
        
        # Get project to verify ownership and get name
        project = await service.get_project_by_id(project_id, current_user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Get conversations
        conversations = await service.get_project_conversations(
            project_id=project_id,
            user_id=current_user.id,
            limit=limit
        )
        
        # Convert to response models
        conversation_responses = [
            create_conversation_response(conv) for conv in conversations
        ]
        
        return ConversationListResponse(
            conversations=conversation_responses,
            total=len(conversation_responses),
            project_id=project_id,
            project_name=project.name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project conversations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project conversations"
        )