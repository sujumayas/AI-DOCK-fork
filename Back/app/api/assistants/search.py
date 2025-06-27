"""
Assistant search and quick access endpoints.

This module handles search functionality for finding assistants quickly.

🎓 LEARNING: Search API Design
=============================
Search endpoints should prioritize:
- Speed for real-time autocomplete
- Relevance in results ranking
- Efficiency in database queries
- User experience optimization

Common patterns:
- Fuzzy matching for typos
- Prefix matching for autocomplete
- Weighted scoring (name > description)
- Result limiting for performance
"""

from fastapi import Query
from typing import List

# Import shared dependencies from base module
from .base import (
    APIRouter, HTTPException, Depends, AsyncSession,
    get_async_db, get_current_user, User,
    AssistantSummary, assistant_service,
    logger, create_assistant_router, compute_assistant_summary,
    handle_internal_error
)

# Create router for search operations
router = create_assistant_router()

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
        
        # Convert to summary format using shared utility
        summaries = [compute_assistant_summary(assistant) for assistant in assistants]
        
        logger.debug(f"Search '{q}' returned {len(summaries)} results for {current_user.email}")
        return summaries
        
    except Exception as e:
        handle_internal_error(e, current_user.email, "searching assistants")
