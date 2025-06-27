"""
Assistant bulk operations endpoints.

This module handles operations on multiple assistants at once.

🎓 LEARNING: Bulk Operations Design
==================================
Bulk operations improve efficiency when managing many resources:
- Reduce API calls from client
- Ensure transactional consistency
- Provide progress feedback
- Handle partial failures gracefully

Key considerations:
- Transaction boundaries
- Error accumulation
- Performance optimization
- User feedback
"""

# Import shared dependencies from base module
from .base import (
    APIRouter, HTTPException, Depends, AsyncSession,
    get_async_db, get_current_user, User,
    AssistantBulkAction, AssistantBulkResponse, AssistantUpdate,
    assistant_service, logger, create_assistant_router,
    handle_internal_error
)

# Create router for bulk operations
router = create_assistant_router()

# =============================================================================
# BULK OPERATIONS ENDPOINTS
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
        handle_internal_error(e, current_user.email, "performing bulk operation")
