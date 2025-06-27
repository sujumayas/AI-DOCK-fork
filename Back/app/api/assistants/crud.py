"""
Assistant CRUD API endpoints.

This module handles basic Create, Read, Update, Delete operations for assistants.

🎓 LEARNING: CRUD Endpoint Organization
======================================
CRUD operations form the foundation of any resource management API.
By separating them into their own module, we:
- Keep related operations together
- Make the code easier to navigate
- Enable focused testing
- Simplify maintenance
"""

from fastapi import Query, status
from typing import Optional

# Import shared dependencies from base module
from .base import (
    APIRouter, HTTPException, Depends, AsyncSession,
    get_async_db, get_current_user, User,
    AssistantCreate, AssistantUpdate, AssistantResponse,
    AssistantListRequest, AssistantListResponse, AssistantOperationResponse,
    create_assistant_response_from_model, assistant_service,
    logger, create_assistant_router, compute_assistant_summary,
    handle_assistant_not_found, handle_validation_error, handle_internal_error
)

# Create router for CRUD operations
router = create_assistant_router()

# =============================================================================
# CREATE ASSISTANT
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
        # For newly created assistants, conversation_count is 0
        response = create_assistant_response_from_model(assistant, conversation_count=0)
        
        logger.info(f"Successfully created assistant {assistant.id} for user {current_user.email}")
        return response
        
    except ValueError as e:
        handle_validation_error(e, current_user.email, "Assistant creation")
    
    except Exception as e:
        handle_internal_error(e, current_user.email, "creating assistant")

# =============================================================================
# LIST ASSISTANTS
# =============================================================================

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
        
        # Convert to summary format using shared utility
        assistant_summaries = [compute_assistant_summary(assistant) for assistant in assistants]
        
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
        handle_internal_error(e, current_user.email, "retrieving assistants")

# =============================================================================
# GET ASSISTANT BY ID
# =============================================================================

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
            handle_assistant_not_found(assistant_id, current_user.email)
        
        # Convert to response schema
        # Use pre-computed conversation count from service layer
        conversation_count = getattr(assistant, '_conversation_count', 0)
        response = create_assistant_response_from_model(assistant, conversation_count=conversation_count)
        
        logger.debug(f"Retrieved assistant {assistant_id} for {current_user.email}")
        return response
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    
    except Exception as e:
        handle_internal_error(e, current_user.email, "retrieving assistant")

# =============================================================================
# UPDATE ASSISTANT
# =============================================================================

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
            handle_assistant_not_found(assistant_id, current_user.email)
        
        # Convert to response schema
        # Use pre-computed conversation count from service layer
        conversation_count = getattr(updated_assistant, '_conversation_count', 0)
        response = create_assistant_response_from_model(updated_assistant, conversation_count=conversation_count)
        
        logger.info(f"Successfully updated assistant {assistant_id} for {current_user.email}")
        return response
        
    except ValueError as e:
        handle_validation_error(e, current_user.email, "Assistant update")
    
    except HTTPException:
        raise
    
    except Exception as e:
        handle_internal_error(e, current_user.email, "updating assistant")

# =============================================================================
# DELETE ASSISTANT
# =============================================================================

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
            handle_assistant_not_found(assistant_id, current_user.email)
        
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
        handle_internal_error(e, current_user.email, "deleting assistant")
