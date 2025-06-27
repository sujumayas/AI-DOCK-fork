"""
Assistant conversation management endpoints.

This module handles the relationship between assistants and chat conversations.

🎓 LEARNING: Cross-Domain API Design
===================================
This module bridges two domains: assistants and conversations.
It demonstrates how to:
- Link related resources across domains
- Track usage and relationships
- Enable feature integration
- Maintain data consistency
"""

from fastapi import Query, status
from typing import List

# Import shared dependencies from base module
from .base import (
    APIRouter, HTTPException, Depends, AsyncSession,
    get_async_db, get_current_user, User,
    AssistantConversationCreate, AssistantConversationResponse,
    assistant_service, logger, create_assistant_router,
    handle_assistant_not_found, handle_internal_error
)

# Create router for conversation operations
router = create_assistant_router()

# =============================================================================
# LIST ASSISTANT CONVERSATIONS
# =============================================================================

@router.get("/{assistant_id}/conversations", response_model=List[AssistantConversationResponse])
async def list_assistant_conversations(
    assistant_id: int,
    limit: int = Query(20, ge=1, le=100, description="Maximum conversations to return"),
    offset: int = Query(0, ge=0, description="Number of conversations to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> List[AssistantConversationResponse]:
    """
    Get conversations that use a specific assistant.
    
    🎓 LEARNING: Related Resource Endpoints
    =====================================
    This endpoint shows the relationship between assistants and conversations.
    It enables users to:
    - See how often an assistant is used
    - Access specific conversation history
    - Understand assistant effectiveness
    - Navigate between assistant and chat interfaces
    
    Args:
        assistant_id: ID of the assistant whose conversations to retrieve
        limit: Maximum conversations to return
        offset: Number to skip for pagination
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        List of AssistantConversationResponse objects
        
    Raises:
        HTTPException: 404 if assistant not found or not owned
    """
    try:
        logger.debug(f"User {current_user.email} listing conversations for assistant {assistant_id}")
        
        # First, validate assistant ownership
        assistant = await assistant_service.get_assistant(
            db=db,
            assistant_id=assistant_id,
            user_id=current_user.id
        )
        
        if not assistant:
            handle_assistant_not_found(assistant_id, current_user.email)
        
        # Get assistant with conversations
        assistant_with_conversations = await assistant_service.get_assistant_with_conversations(
            db=db,
            assistant_id=assistant_id,
            user_id=current_user.id,
            include_messages=False,  # Don't load full message history
            limit=limit
        )
        
        # Convert to response format
        conversations = []
        if assistant_with_conversations and assistant_with_conversations.chat_conversations:
            for chat_conv in assistant_with_conversations.chat_conversations[offset:offset+limit]:
                conv_response = AssistantConversationResponse(
                    id=chat_conv.id,
                    title=chat_conv.title,
                    user_id=chat_conv.user_id,
                    assistant_id=chat_conv.assistant_id,
                    assistant_name=assistant.name,
                    assistant_description=assistant.description,
                    message_count=chat_conv.message_count,
                    last_message_at=chat_conv.last_message_at,
                    is_active=chat_conv.is_active,
                    created_at=chat_conv.created_at,
                    updated_at=chat_conv.updated_at
                )
                conversations.append(conv_response)
        
        logger.debug(f"Returned {len(conversations)} conversations for assistant {assistant_id}")
        return conversations
        
    except HTTPException:
        raise
    
    except Exception as e:
        handle_internal_error(e, current_user.email, "retrieving assistant conversations")

# =============================================================================
# CREATE ASSISTANT CONVERSATION
# =============================================================================

@router.post("/{assistant_id}/conversations", 
            response_model=AssistantConversationResponse, 
            status_code=status.HTTP_201_CREATED)
async def create_assistant_conversation(
    assistant_id: int,
    conversation_data: AssistantConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantConversationResponse:
    """
    Create a new conversation using a specific assistant.
    
    🎓 LEARNING: Cross-Domain Operations
    ==================================
    This endpoint bridges assistants and conversations domains.
    It demonstrates how features can work together:
    - User selects an assistant in the UI
    - Starts a new conversation with that assistant
    - Assistant's prompt and preferences are automatically applied
    - Conversation is linked to the assistant for tracking
    
    Args:
        assistant_id: ID of the assistant to use for the conversation
        conversation_data: Conversation creation parameters
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantConversationResponse with created conversation details
        
    Raises:
        HTTPException: 404 if assistant not found or not owned
    """
    try:
        logger.info(f"User {current_user.email} creating conversation with assistant {assistant_id}")
        
        # Create conversation through service
        chat_conversation = await assistant_service.create_assistant_conversation(
            db=db,
            assistant_id=assistant_id,
            user_id=current_user.id,
            conversation_data=conversation_data
        )
        
        if not chat_conversation:
            handle_assistant_not_found(assistant_id, current_user.email)
        
        # Get assistant info for response
        assistant = await assistant_service.get_assistant(
            db=db,
            assistant_id=assistant_id,
            user_id=current_user.id
        )
        
        # Build response
        response = AssistantConversationResponse(
            id=chat_conversation.id,
            title=chat_conversation.title,
            user_id=chat_conversation.user_id,
            assistant_id=chat_conversation.assistant_id,
            assistant_name=assistant.name if assistant else None,
            assistant_description=assistant.description if assistant else None,
            message_count=chat_conversation.message_count,
            last_message_at=chat_conversation.last_message_at,
            is_active=chat_conversation.is_active,
            created_at=chat_conversation.created_at,
            updated_at=chat_conversation.updated_at
        )
        
        logger.info(f"Created conversation {chat_conversation.id} with assistant {assistant_id}")
        return response
        
    except HTTPException:
        raise
    
    except Exception as e:
        handle_internal_error(e, current_user.email, "creating assistant conversation")
