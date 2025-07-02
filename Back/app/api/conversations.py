# AI Dock Conversation API Endpoints
# REST API for conversation save/load functionality

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from ..core.database import get_async_db
from ..core.security import get_current_user
from ..models.user import User
from ..services.conversation_service import conversation_service
from ..schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationSummary,
    ConversationDetail,
    ConversationSaveFromMessages,
    ConversationListResponse,
    ConversationStatsResponse,
    ConversationOperationResponse,
    ConversationListRequest,
    ConversationSearchRequest
)

router = APIRouter(prefix="/conversations", tags=["Conversations"])

@router.post("/", response_model=ConversationDetail)
async def create_conversation(
    conversation_data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Create a new empty conversation"""
    try:
        conversation = await conversation_service.create_conversation(
            db=db,
            user_id=current_user.id,
            title=conversation_data.title,
            llm_config_id=conversation_data.llm_config_id,
            model_used=conversation_data.model_used,
            project_id=conversation_data.project_id,
            assistant_id=conversation_data.assistant_id
        )
        
        return await conversation_service.get_conversation(
            db=db,
            conversation_id=conversation.id,
            user_id=current_user.id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create conversation: {str(e)}"
        )

@router.post("/save-from-messages", response_model=ConversationDetail)
async def save_conversation_from_messages(
    conversation_data: ConversationSaveFromMessages,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Save a complete conversation from a list of messages"""
    try:
        # Convert Pydantic models to dicts for service layer
        messages = [msg.dict() for msg in conversation_data.messages]
        
        conversation = await conversation_service.save_conversation_from_messages(
            db=db,
            user_id=current_user.id,
            messages=messages,
            llm_config_id=conversation_data.llm_config_id,
            model_used=conversation_data.model_used,
            title=conversation_data.title,
            project_id=conversation_data.project_id,
            assistant_id=conversation_data.assistant_id
        )
        
        return await conversation_service.get_conversation(
            db=db,
            conversation_id=conversation.id,
            user_id=current_user.id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save conversation: {str(e)}"
        )

@router.get("/", response_model=ConversationListResponse)
async def list_conversations(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get user's conversations with pagination"""
    try:
        conversations = await conversation_service.get_user_conversations(
            db=db,
            user_id=current_user.id,
            limit=limit,
            offset=offset
        )
        
        # Get total count for pagination
        stats = await conversation_service.get_conversation_stats(
            db=db,
            user_id=current_user.id
        )
        
        return ConversationListResponse(
            conversations=conversations,
            total_count=stats["total_conversations"],
            limit=limit,
            offset=offset,
            has_more=len(conversations) == limit
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch conversations: {str(e)}"
        )

@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get a specific conversation with all messages"""
    conversation = await conversation_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return conversation

@router.put("/{conversation_id}", response_model=ConversationDetail)
async def update_conversation(
    conversation_id: int,
    conversation_data: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Update conversation (currently only title)"""
    if conversation_data.title:
        conversation = await conversation_service.update_conversation_title(
            db=db,
            conversation_id=conversation_id,
            user_id=current_user.id,
            new_title=conversation_data.title
        )
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        return await conversation_service.get_conversation(
            db=db,
            conversation_id=conversation_id,
            user_id=current_user.id
        )
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No valid fields to update"
    )

@router.delete("/{conversation_id}", response_model=ConversationOperationResponse)
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Delete a conversation and all its messages"""
    success = await conversation_service.delete_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    return ConversationOperationResponse(
        success=True,
        message="Conversation deleted successfully",
        conversation_id=conversation_id
    )

@router.post("/search", response_model=List[ConversationSummary])
async def search_conversations(
    search_data: ConversationSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Search conversations by title"""
    try:
        conversations = await conversation_service.search_conversations(
            db=db,
            user_id=current_user.id,
            query=search_data.query,
            limit=search_data.limit
        )
        
        return conversations
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

@router.get("/stats/summary", response_model=ConversationStatsResponse)
async def get_conversation_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get user's conversation statistics"""
    try:
        stats = await conversation_service.get_conversation_stats(
            db=db,
            user_id=current_user.id
        )
        
        return ConversationStatsResponse(**stats)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get stats: {str(e)}"
        )

@router.post("/{conversation_id}/messages", response_model=ConversationOperationResponse)
async def add_message_to_conversation(
    conversation_id: int,
    role: str,
    content: str,
    model_used: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Add a single message to existing conversation"""
    try:
        # Verify conversation exists and belongs to user
        conversation = await conversation_service.get_conversation(
            db=db,
            conversation_id=conversation_id,
            user_id=current_user.id
        )
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        message = await conversation_service.save_message_to_conversation(
            db=db,
            conversation_id=conversation_id,
            role=role,
            content=content,
            model_used=model_used
        )
        
        return ConversationOperationResponse(
            success=True,
            message="Message added successfully",
            conversation_id=conversation_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add message: {str(e)}"
        )
