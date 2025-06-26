"""
Chat Assistant Integration Service

Business logic for integrating custom assistants with chat functionality.
Extracted from the main chat.py file for better modularity.
"""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from ...models.user import User
from ...models.assistant import Assistant
from ...models.chat_conversation import ChatConversation
from ...services.assistant_service import assistant_service

logger = logging.getLogger(__name__)

# =============================================================================
# ASSISTANT INTEGRATION PROCESSING FUNCTIONS
# =============================================================================

async def process_assistant_integration(
    assistant_id: Optional[int],
    conversation_id: Optional[int],
    user: User,
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Process assistant integration for chat requests.
    
    🎯 Learning: Assistant-Chat Integration
    ======================================
    This function handles the complex logic of integrating custom assistants
    with chat conversations:
    
    1. **Validation**: Ensure user owns the assistant
    2. **System Prompt**: Extract assistant's system prompt for LLM
    3. **Model Preferences**: Get assistant's preferred LLM settings
    4. **Conversation Management**: Link or create chat conversations
    5. **Error Handling**: Graceful fallback for missing/invalid assistants
    
    Args:
        assistant_id: Optional ID of assistant to use
        conversation_id: Optional ID of existing conversation
        user: Current user (for ownership validation)
        db: Database session
        
    Returns:
        Dictionary containing:
        - assistant: Assistant object or None
        - system_prompt: System prompt to inject or None
        - model_preferences: Dict of LLM preferences
        - chat_conversation: ChatConversation object or None
        - should_create_conversation: Whether to auto-create conversation
        - error: Error message if validation failed
        
    Raises:
        HTTPException: If assistant access is denied
    """
    logger.info(f"🔍 DEBUG: process_assistant_integration called with assistant_id: {assistant_id}, conversation_id: {conversation_id}, user: {user.email}")
    
    result = {
        "assistant": None,
        "system_prompt": None,
        "model_preferences": {},
        "chat_conversation": None,
        "should_create_conversation": False,
        "error": None
    }
    
    # If no assistant specified, return empty result (general chat)
    if not assistant_id:
        logger.info(f"🔍 DEBUG: No assistant_id provided, using general chat")
        return result
    
    try:
        # Get and validate assistant ownership
        assistant = await assistant_service.get_assistant(
            db=db,
            assistant_id=assistant_id,
            user_id=user.id
        )
        
        if not assistant:
            logger.warning(f"❌ DEBUG: Assistant {assistant_id} not found or not owned by user {user.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assistant {assistant_id} not found or access denied"
            )
        
        if not assistant.is_active:
            logger.warning(f"❌ DEBUG: Assistant {assistant_id} is inactive")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Assistant '{assistant.name}' is not active"
            )
        
        logger.info(f"✅ DEBUG: Successfully validated assistant '{assistant.name}' (ID: {assistant_id})")
        
        # Extract assistant configuration
        result["assistant"] = assistant
        result["system_prompt"] = assistant.system_prompt
        result["model_preferences"] = assistant.get_effective_model_preferences()
        
        # Handle conversation integration
        if conversation_id:
            # User specified an existing conversation - validate and load it
            chat_conversation = await get_chat_conversation_with_validation(
                db=db,
                conversation_id=conversation_id,
                user_id=user.id,
                expected_assistant_id=assistant_id
            )
            
            if chat_conversation:
                result["chat_conversation"] = chat_conversation
                logger.info(f"✅ DEBUG: Using existing conversation {conversation_id}")
            else:
                logger.warning(f"⚠️ DEBUG: Conversation {conversation_id} not found or invalid")
                # Fall back to creating new conversation
                result["should_create_conversation"] = True
        else:
            # No conversation specified - we'll auto-create one
            result["should_create_conversation"] = True
            logger.info(f"🔍 DEBUG: Will auto-create conversation for assistant chat")
        
        logger.info(f"🎉 DEBUG: Assistant integration successful - system_prompt length: {len(result['system_prompt']) if result['system_prompt'] else 0}")
        
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        raise
    except Exception as e:
        logger.error(f"❌ DEBUG: Error processing assistant integration: {str(e)}")
        result["error"] = f"Assistant integration failed: {str(e)}"
    
    return result

async def get_chat_conversation_with_validation(
    db: AsyncSession,
    conversation_id: int,
    user_id: int,
    expected_assistant_id: Optional[int] = None
) -> Optional[ChatConversation]:
    """
    Get and validate a chat conversation.
    
    🎯 Learning: Conversation Validation
    ===================================
    When users specify an existing conversation, we need to validate:
    - User owns the conversation
    - Conversation is active
    - Assistant matches (if specified)
    - Conversation exists and is accessible
    
    Args:
        db: Database session
        conversation_id: ID of conversation to validate
        user_id: ID of user (for ownership validation)
        expected_assistant_id: Optional assistant ID that should match
        
    Returns:
        ChatConversation object or None if invalid
    """
    try:
        # Query for the conversation with ownership validation
        chat_conversation = await db.get(ChatConversation, conversation_id)
        
        if not chat_conversation:
            logger.warning(f"Chat conversation {conversation_id} not found")
            return None
        
        # Validate ownership
        if chat_conversation.user_id != user_id:
            logger.warning(f"Chat conversation {conversation_id} not owned by user {user_id}")
            return None
        
        # Validate active status
        if not chat_conversation.is_active:
            logger.warning(f"Chat conversation {conversation_id} is inactive")
            return None
        
        # Validate assistant match if specified
        if expected_assistant_id and chat_conversation.assistant_id != expected_assistant_id:
            logger.warning(
                f"Chat conversation {conversation_id} uses assistant {chat_conversation.assistant_id}, "
                f"but user requested assistant {expected_assistant_id}"
            )
            return None
        
        logger.info(f"✅ Validated chat conversation {conversation_id}")
        return chat_conversation
        
    except Exception as e:
        logger.error(f"Error validating chat conversation {conversation_id}: {str(e)}")
        return None

async def create_chat_conversation_for_assistant(
    db: AsyncSession,
    assistant: Assistant,
    user: User,
    first_message_content: str
) -> Optional[ChatConversation]:
    """
    Auto-create a chat conversation when user starts chatting with an assistant.
    
    🎯 Learning: Auto-Conversation Creation
    ======================================
    When users start chatting with an assistant without specifying a conversation,
    we automatically create one for better organization:
    
    1. Generate meaningful conversation title
    2. Create ChatConversation record
    3. Link to assistant for future reference
    4. Set up proper metadata
    
    Args:
        db: Database session
        assistant: Assistant being used
        user: User creating the conversation
        first_message_content: Content of first message (for title generation)
        
    Returns:
        Created ChatConversation or None if creation failed
    """
    try:
        # Generate a meaningful title based on first message
        conversation_title = generate_conversation_title(
            assistant_name=assistant.name,
            first_message=first_message_content
        )
        
        # Create the chat conversation
        chat_conversation = ChatConversation(
            user_id=user.id,
            assistant_id=assistant.id,
            title=conversation_title,
            description=f"Chat with {assistant.name} assistant",
            is_active=True,
            message_count=0  # Will be updated after message is sent
        )
        
        db.add(chat_conversation)
        await db.flush()  # Get the ID without committing
        
        logger.info(f"✅ Auto-created chat conversation '{conversation_title}' for assistant {assistant.name}")
        return chat_conversation
        
    except Exception as e:
        logger.error(f"Failed to create chat conversation for assistant {assistant.id}: {str(e)}")
        return None

def generate_conversation_title(assistant_name: str, first_message: str, max_length: int = 50) -> str:
    """
    Generate a meaningful conversation title.
    
    🎯 Learning: Title Generation Strategy
    ====================================
    Good conversation titles help users:
    - Quickly identify conversations in lists
    - Understand the context/purpose
    - Find specific conversations later
    
    Strategy:
    1. Use first few words of user message
    2. Include assistant name for context
    3. Keep within reasonable length
    4. Handle edge cases (empty/long messages)
    
    Args:
        assistant_name: Name of the assistant
        first_message: Content of first user message
        max_length: Maximum title length
        
    Returns:
        Generated conversation title
    """
    try:
        # Clean and truncate the first message
        message_preview = first_message.strip()[:30].strip()
        
        # Remove newlines and extra spaces
        message_preview = " ".join(message_preview.split())
        
        # Generate title
        if message_preview:
            if len(message_preview) < 25:
                title = f"{assistant_name}: {message_preview}"
            else:
                title = f"{assistant_name}: {message_preview}..."
        else:
            title = f"Chat with {assistant_name}"
        
        # Ensure title doesn't exceed max length
        if len(title) > max_length:
            title = title[:max_length-3] + "..."
        
        return title
        
    except Exception as e:
        logger.error(f"Error generating conversation title: {str(e)}")
        return f"Chat with {assistant_name}"
