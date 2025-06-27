"""
Assistant statistics and analytics endpoints.

This module provides insights and analytics about assistant usage.

🎓 LEARNING: Analytics API Design
================================
Analytics endpoints help users understand:
- Usage patterns and trends
- Performance metrics
- Optimization opportunities
- Value derived from features

Key principles:
- Aggregate data efficiently
- Provide actionable insights
- Respect privacy boundaries
- Enable data-driven decisions
"""

# Import shared dependencies from base module
from .base import (
    APIRouter, HTTPException, Depends, AsyncSession,
    get_async_db, get_current_user, User,
    AssistantStatsResponse, assistant_service,
    logger, create_assistant_router, handle_internal_error
)

# Create router for statistics operations
router = create_assistant_router()

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
        handle_internal_error(e, current_user.email, "generating assistant statistics")
