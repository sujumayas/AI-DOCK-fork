"""
Assistant API Endpoints for AI Dock Custom Assistants feature.

This module handles HTTP requests for assistant operations.
It's the "interface" between the frontend and our assistant business logic.

🎓 LEARNING: API Endpoint Design for Custom Assistants
=====================================================
These endpoints enable users to:
- Create personalized AI assistants with custom prompts
- Manage their assistant collection (CRUD operations)
- Use assistants in chat conversations
- Track assistant usage and statistics

Good API endpoints should:
- Have clear, RESTful URLs (/assistants/, /assistants/{id})
- Use appropriate HTTP methods (GET, POST, PUT, DELETE)
- Return consistent response formats
- Use proper HTTP status codes
- Handle errors gracefully with helpful messages
- Include comprehensive documentation
- Validate ownership and permissions
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any, Union
import logging

# Import our database dependency
from ..core.database import get_async_db
from ..core.security import get_current_user

# Import our models
from ..models.user import User
from ..models.assistant import Assistant
from ..models.chat_conversation import ChatConversation

# Import our schemas (data models for requests/responses)
from ..schemas.assistant import (
    AssistantCreate,
    AssistantUpdate, 
    AssistantResponse,
    AssistantSummary,
    AssistantListRequest,
    AssistantListResponse,
    AssistantConversationCreate,
    AssistantConversationResponse,
    AssistantOperationResponse,
    AssistantStatsResponse,
    AssistantErrorResponse,
    AssistantBulkAction,
    AssistantBulkResponse,
    create_assistant_response_from_model
)

# Import our service layer (business logic)
from ..services.assistant_service import assistant_service

# =============================================================================
# ROUTER SETUP
# =============================================================================

# Create a router - this groups related endpoints together
# Think of it like a "sub-application" for assistant management
router = APIRouter(
    prefix="/assistants",                # All routes will start with /assistants
    tags=["Assistants"],                 # Groups endpoints in API docs
    dependencies=[Depends(get_current_user)],  # All endpoints require authentication
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Insufficient permissions"},
        404: {"description": "Assistant not found"},
        422: {"description": "Validation Error"}
    }
)

# Setup logging for assistant endpoints
logger = logging.getLogger(__name__)

# =============================================================================
# ASSISTANT CRUD ENDPOINTS
# =============================================================================

@router.post("/", response_model=AssistantResponse, status_code=status.HTTP_201_CREATED)
async def create_assistant(
    assistant_data: AssistantCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantResponse:
    """
    Create a new custom AI assistant.
    
    🎓 LEARNING: Assistant Creation Flow
    ==================================
    When a user creates an assistant:
    1. Frontend sends POST to /assistants/ with assistant data
    2. FastAPI validates the request data (AssistantCreate schema)
    3. We call our assistant service to handle business logic
    4. Service validates ownership, checks limits, creates database record
    5. Return the created assistant with generated ID and metadata
    
    This endpoint enables users to create personalized AI personas like:
    - "Data Analyst Pro" with data-focused prompts and analytical temperament
    - "Creative Writer" with imaginative prompts and creative temperature settings
    - "Code Reviewer" with technical prompts and precise, low-temperature responses
    
    Args:
        assistant_data: Assistant creation data (name, description, system_prompt, preferences)
        current_user: Authenticated user from token (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantResponse with the created assistant details
        
    Raises:
        HTTPException: 400 for validation errors, 429 for quota limits
    """
    try:
        logger.info(f"User {current_user.email} creating assistant '{assistant_data.name}'")
        
        # Call our service to handle the creation
        assistant = await assistant_service.create_assistant(
            db=db,
            user_id=current_user.id,
            assistant_data=assistant_data
        )
        
        # Convert model to response schema
        response = create_assistant_response_from_model(assistant)
        
        logger.info(f"Successfully created assistant {assistant.id} for user {current_user.email}")
        return response
        
    except ValueError as e:
        # Business logic errors (quotas, validation, duplicates)
        logger.warning(f"Assistant creation failed for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "validation_error",
                "message": str(e)
            }
        )
    
    except Exception as e:
        # Unexpected errors - don't expose internal details
        logger.error(f"Unexpected error creating assistant for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "An unexpected error occurred while creating the assistant"
            }
        )


@router.get("/", response_model=AssistantListResponse)
async def list_assistants(
    limit: int = Query(20, ge=1, le=100, description="Maximum assistants to return"),
    offset: int = Query(0, ge=0, description="Number of assistants to skip"),
    search: Optional[str] = Query(None, max_length=100, description="Search query for name or description"),
    status_filter: Optional[str] = Query(None, description="Filter by status (active, inactive)"),
    sort_by: str = Query("updated_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order (asc or desc)"),
    include_inactive: bool = Query(False, description="Include inactive assistants"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantListResponse:
    """
    Get a list of assistants for the current user with filtering and pagination.
    
    🎓 LEARNING: List Endpoints with Advanced Features
    ================================================
    Production list endpoints need sophisticated features:
    - **Pagination**: Don't load all data at once (limit/offset)
    - **Search**: Find assistants by name or description
    - **Filtering**: Show only active/inactive assistants
    - **Sorting**: Order by name, date, usage frequency
    - **Performance**: Fast responses even with many assistants
    
    This endpoint powers the assistant management interface where users can:
    - Browse their assistant collection
    - Search for specific assistants
    - Sort by most recently used or created
    - Filter by status for maintenance
    
    Args:
        limit: Maximum assistants to return (1-100)
        offset: Number to skip for pagination
        search: Text search in names/descriptions
        status_filter: Filter by active/inactive status
        sort_by: Field to sort by (name, created_at, updated_at)
        sort_order: Sort direction (asc/desc)
        include_inactive: Whether to include inactive assistants
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantListResponse with assistants and pagination info
    """
    try:
        logger.debug(f"User {current_user.email} listing assistants (limit={limit}, search='{search}')")
        
        # Create request object for service
        list_request = AssistantListRequest(
            limit=limit,
            offset=offset,
            search=search,
            status_filter=status_filter,
            sort_by=sort_by,
            sort_order=sort_order,
            include_inactive=include_inactive
        )
        
        # Get assistants from service
        assistants, total_count = await assistant_service.get_user_assistants(
            db=db,
            user_id=current_user.id,
            request=list_request
        )
        
        # Convert to summary format
        assistant_summaries = []
        for assistant in assistants:
            summary = AssistantSummary(
                id=assistant.id,
                name=assistant.name,
                description=assistant.description,
                system_prompt_preview=assistant.system_prompt_preview,
                is_active=assistant.is_active,
                conversation_count=assistant.conversation_count,
                created_at=assistant.created_at,
                is_new=assistant.is_new
            )
            assistant_summaries.append(summary)
        
        # Build response with pagination info
        response = AssistantListResponse(
            assistants=assistant_summaries,
            total_count=total_count,
            limit=limit,
            offset=offset,
            has_more=(offset + len(assistants)) < total_count,
            filters_applied={
                "search": search,
                "status_filter": status_filter,
                "include_inactive": include_inactive,
                "sort_by": sort_by,
                "sort_order": sort_order
            }
        )
        
        logger.debug(f"Returned {len(assistants)} assistants for {current_user.email}")
        return response
        
    except Exception as e:
        logger.error(f"Error listing assistants for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error retrieving assistants"
            }
        )


@router.get("/{assistant_id}", response_model=AssistantResponse)
async def get_assistant(
    assistant_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantResponse:
    """
    Get a specific assistant by ID with ownership validation.
    
    🎓 LEARNING: Resource Retrieval with Security
    ============================================
    When retrieving specific resources:
    1. Validate that the resource exists
    2. Check user ownership/permissions
    3. Return rich data for detailed views
    4. Handle missing resources gracefully
    
    This endpoint enables:
    - Assistant detail pages in the frontend
    - Editing assistant information
    - Viewing assistant statistics and usage
    
    Args:
        assistant_id: ID of the assistant to retrieve
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantResponse with complete assistant details
        
    Raises:
        HTTPException: 404 if not found or not owned by user
    """
    try:
        logger.debug(f"User {current_user.email} requesting assistant {assistant_id}")
        
        # Get assistant with ownership validation
        assistant = await assistant_service.get_assistant(
            db=db,
            assistant_id=assistant_id,
            user_id=current_user.id
        )
        
        if not assistant:
            logger.warning(f"Assistant {assistant_id} not found or not owned by {current_user.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "not_found",
                    "message": f"Assistant {assistant_id} not found"
                }
            )
        
        # Convert to response schema
        response = create_assistant_response_from_model(assistant)
        
        logger.debug(f"Retrieved assistant {assistant_id} for {current_user.email}")
        return response
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    
    except Exception as e:
        logger.error(f"Error getting assistant {assistant_id} for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error retrieving assistant"
            }
        )


@router.put("/{assistant_id}", response_model=AssistantResponse)
async def update_assistant(
    assistant_id: int,
    update_data: AssistantUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantResponse:
    """
    Update an existing assistant with ownership validation.
    
    🎓 LEARNING: Update Operations
    =============================
    Update endpoints should:
    - Allow partial updates (only modify provided fields)
    - Validate ownership before allowing changes
    - Preserve existing data for non-provided fields
    - Return the updated resource
    - Handle conflicts (e.g., name already exists)
    
    This enables users to:
    - Refine assistant prompts based on experience
    - Adjust model preferences for better results
    - Update names and descriptions for clarity
    - Activate/deactivate assistants
    
    Args:
        assistant_id: ID of the assistant to update
        update_data: Fields to update (only non-None fields are modified)
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantResponse with updated assistant data
        
    Raises:
        HTTPException: 404 if not found, 400 for validation errors
    """
    try:
        logger.info(f"User {current_user.email} updating assistant {assistant_id}")
        
        # Update through service
        updated_assistant = await assistant_service.update_assistant(
            db=db,
            assistant_id=assistant_id,
            user_id=current_user.id,
            update_data=update_data
        )
        
        if not updated_assistant:
            logger.warning(f"Assistant {assistant_id} not found for update by {current_user.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "not_found",
                    "message": f"Assistant {assistant_id} not found"
                }
            )
        
        # Convert to response schema
        response = create_assistant_response_from_model(updated_assistant)
        
        logger.info(f"Successfully updated assistant {assistant_id} for {current_user.email}")
        return response
        
    except ValueError as e:
        # Business logic errors (name conflicts, validation)
        logger.warning(f"Assistant update failed for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "validation_error",
                "message": str(e)
            }
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error updating assistant {assistant_id} for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error updating assistant"
            }
        )


@router.delete("/{assistant_id}", response_model=AssistantOperationResponse)
async def delete_assistant(
    assistant_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantOperationResponse:
    """
    Delete an assistant and all associated conversations.
    
    🎓 LEARNING: Delete Operations and Cascade Effects
    ================================================
    Deletion is complex because assistants can have:
    - Associated conversations
    - Chat history
    - Usage statistics
    - User preferences
    
    Consider:
    - **Cascade deletes**: What else should be deleted?
    - **Soft deletes**: Mark as deleted instead of removing?
    - **Backup/export**: Allow users to export before deletion?
    - **Confirmation**: Require explicit confirmation for safety?
    
    This implementation does hard deletes with cascade.
    
    Args:
        assistant_id: ID of the assistant to delete
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantOperationResponse with deletion confirmation
        
    Raises:
        HTTPException: 404 if not found or not owned
    """
    try:
        logger.info(f"User {current_user.email} deleting assistant {assistant_id}")
        
        # Delete through service
        deleted = await assistant_service.delete_assistant(
            db=db,
            assistant_id=assistant_id,
            user_id=current_user.id
        )
        
        if not deleted:
            logger.warning(f"Assistant {assistant_id} not found for deletion by {current_user.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "not_found",
                    "message": f"Assistant {assistant_id} not found"
                }
            )
        
        response = AssistantOperationResponse(
            success=True,
            message="Assistant deleted successfully",
            assistant_id=assistant_id,
            assistant=None  # No data to return for deleted resource
        )
        
        logger.info(f"Successfully deleted assistant {assistant_id} for {current_user.email}")
        return response
        
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Error deleting assistant {assistant_id} for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error deleting assistant"
            }
        )

# =============================================================================
# ASSISTANT CONVERSATION ENDPOINTS
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "not_found",
                    "message": f"Assistant {assistant_id} not found"
                }
            )
        
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
        logger.error(f"Error listing conversations for assistant {assistant_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error retrieving assistant conversations"
            }
        )


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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "not_found",
                    "message": f"Assistant {assistant_id} not found"
                }
            )
        
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
        logger.error(f"Error creating conversation with assistant {assistant_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error creating assistant conversation"
            }
        )

# =============================================================================
# ASSISTANT STATISTICS AND ANALYTICS
# =============================================================================

@router.get("/stats/overview", response_model=AssistantStatsResponse)
async def get_assistant_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantStatsResponse:
    """
    Get comprehensive statistics about user's assistants.
    
    🎓 LEARNING: Analytics Endpoints
    ==============================
    Analytics help users understand:
    - Which assistants are most valuable
    - Usage patterns and trends
    - Opportunities for optimization
    - System health and performance
    
    This data can power:
    - Dashboard widgets
    - Usage reports
    - Recommendation systems
    - Performance optimization
    
    Args:
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantStatsResponse with comprehensive statistics
    """
    try:
        logger.debug(f"Generating assistant statistics for {current_user.email}")
        
        # Get stats from service
        stats = await assistant_service.get_assistant_stats(
            db=db,
            user_id=current_user.id
        )
        
        # Convert to response schema
        response = AssistantStatsResponse(
            total_assistants=stats["total_assistants"],
            active_assistants=stats["active_assistants"],
            total_conversations=stats["total_conversations"],
            most_used_assistant=stats["most_used_assistant"],
            recent_activity=stats["recent_activity"]
        )
        
        logger.debug(f"Generated stats for {current_user.email}: {stats['total_assistants']} assistants")
        return response
        
    except Exception as e:
        logger.error(f"Error generating assistant stats for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error generating assistant statistics"
            }
        )

# =============================================================================
# SEARCH AND QUICK ACCESS ENDPOINTS
# =============================================================================

@router.get("/search", response_model=List[AssistantSummary])
async def search_assistants(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> List[AssistantSummary]:
    """
    Search assistants for autocomplete and quick access.
    
    🎓 LEARNING: Search User Experience
    =================================
    Search endpoints should prioritize:
    - **Speed**: Fast responses for autocomplete
    - **Relevance**: Match names before descriptions
    - **Usability**: Return actionable results
    - **Performance**: Limit result sets
    
    This enables:
    - Assistant picker in chat interface
    - Quick assistant switching
    - Find specific assistants in large collections
    
    Args:
        q: Search query text
        limit: Maximum results to return
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        List of AssistantSummary objects matching the search
    """
    try:
        logger.debug(f"User {current_user.email} searching assistants: '{q}'")
        
        # Search through service
        assistants = await assistant_service.search_assistants(
            db=db,
            user_id=current_user.id,
            search_query=q,
            limit=limit
        )
        
        # Convert to summary format
        summaries = []
        for assistant in assistants:
            summary = AssistantSummary(
                id=assistant.id,
                name=assistant.name,
                description=assistant.description,
                system_prompt_preview=assistant.system_prompt_preview,
                is_active=assistant.is_active,
                conversation_count=assistant.conversation_count,
                created_at=assistant.created_at,
                is_new=assistant.is_new
            )
            summaries.append(summary)
        
        logger.debug(f"Search '{q}' returned {len(summaries)} results for {current_user.email}")
        return summaries
        
    except Exception as e:
        logger.error(f"Error searching assistants for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error searching assistants"
            }
        )

# =============================================================================
# BULK OPERATIONS ENDPOINTS (FUTURE ENHANCEMENT)
# =============================================================================

@router.post("/bulk", response_model=AssistantBulkResponse)
async def bulk_assistant_operations(
    bulk_action: AssistantBulkAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
) -> AssistantBulkResponse:
    """
    Perform bulk operations on multiple assistants.
    
    🎓 LEARNING: Bulk Operations
    ===========================
    Bulk operations improve user experience for:
    - Managing large assistant collections
    - Cleanup operations (delete unused assistants)
    - Status changes (activate/deactivate multiple)
    - Maintenance tasks
    
    Consider:
    - Transaction safety (all-or-nothing)
    - Progress reporting for long operations
    - Error handling (partial failures)
    - User confirmation for destructive actions
    
    Args:
        bulk_action: Operation to perform and target assistant IDs
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)
        
    Returns:
        AssistantBulkResponse with operation results
    """
    try:
        logger.info(f"User {current_user.email} performing bulk {bulk_action.action} on {len(bulk_action.assistant_ids)} assistants")
        
        successful_count = 0
        failed_count = 0
        failed_assistants = []
        
        # Process each assistant
        for assistant_id in bulk_action.assistant_ids:
            try:
                if bulk_action.action == "activate":
                    update_data = AssistantUpdate(is_active=True)
                    await assistant_service.update_assistant(
                        db=db,
                        assistant_id=assistant_id,
                        user_id=current_user.id,
                        update_data=update_data
                    )
                    
                elif bulk_action.action == "deactivate":
                    update_data = AssistantUpdate(is_active=False)
                    await assistant_service.update_assistant(
                        db=db,
                        assistant_id=assistant_id,
                        user_id=current_user.id,
                        update_data=update_data
                    )
                    
                elif bulk_action.action == "delete":
                    await assistant_service.delete_assistant(
                        db=db,
                        assistant_id=assistant_id,
                        user_id=current_user.id
                    )
                
                successful_count += 1
                
            except Exception as e:
                failed_count += 1
                failed_assistants.append({
                    "assistant_id": assistant_id,
                    "error": str(e)
                })
                logger.warning(f"Bulk operation failed for assistant {assistant_id}: {str(e)}")
        
        # Build response
        response = AssistantBulkResponse(
            success=failed_count == 0,
            message=f"Bulk {bulk_action.action} completed: {successful_count} successful, {failed_count} failed",
            total_requested=len(bulk_action.assistant_ids),
            successful_count=successful_count,
            failed_count=failed_count,
            failed_assistants=failed_assistants if failed_assistants else None
        )
        
        logger.info(f"Bulk operation completed for {current_user.email}: {successful_count}/{len(bulk_action.assistant_ids)} successful")
        return response
        
    except Exception as e:
        logger.error(f"Error in bulk assistant operation for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Error performing bulk operation"
            }
        )

# =============================================================================
# HEALTH CHECK AND SYSTEM INFO
# =============================================================================

@router.get("/health")
async def assistant_health_check():
    """
    Health check for assistant system.
    
    Simple endpoint to verify the assistant system is working.
    Doesn't require authentication - just checks if endpoints are accessible.
    """
    return {
        "status": "healthy",
        "message": "Assistant system is operational",
        "features": {
            "create_assistants": "Users can create custom AI assistants",
            "manage_assistants": "Full CRUD operations on assistants",
            "conversation_integration": "Assistants can be used in chat conversations",
            "search_and_filter": "Advanced search and filtering capabilities",
            "statistics": "Usage analytics and insights",
            "bulk_operations": "Bulk management operations"
        },
        "endpoints": {
            "create": "POST /assistants/",
            "list": "GET /assistants/",
            "get": "GET /assistants/{id}",
            "update": "PUT /assistants/{id}",
            "delete": "DELETE /assistants/{id}",
            "conversations": "GET /assistants/{id}/conversations",
            "create_conversation": "POST /assistants/{id}/conversations",
            "search": "GET /assistants/search",
            "statistics": "GET /assistants/stats/overview",
            "bulk_operations": "POST /assistants/bulk"
        }
    }


# =============================================================================
# ERROR HANDLERS (ADVANCED)
# =============================================================================

# Custom error handlers could be added here for more specific error responses
# For now, we handle errors within each endpoint function

# Example of how to add a custom error handler:
# @router.exception_handler(ValueError)
# async def validation_exception_handler(request: Request, exc: ValueError):
#     return JSONResponse(
#         status_code=400,
#         content={"error": "validation_error", "message": str(exc)}
#     )

# =============================================================================
# DEBUGGING AND TESTING HELPERS
# =============================================================================

if __name__ == "__main__":
    print("🤖 Assistant API Information:")
    print(f"   Router prefix: {router.prefix}")
    print(f"   Number of endpoints: {len(router.routes)}")
    print(f"   Authentication required: Yes (all endpoints)")
    print(f"   Features: CRUD, search, statistics, bulk operations")
    print("🎯 Ready for integration into main FastAPI application!")
