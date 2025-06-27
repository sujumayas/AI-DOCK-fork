"""
Assistant API module initialization.

This module aggregates all assistant-related endpoints from submodules
and provides a unified router that maintains the same interface as the
original monolithic assistants.py file.

🎓 LEARNING: Module Aggregation Pattern
======================================
When refactoring a large module into smaller ones:
1. Keep the same external interface (router)
2. Import and combine sub-routers
3. Maintain the same prefix structure
4. Ensure all endpoints remain accessible
5. Document the module organization

This allows dependent code to work without changes while
benefiting from better internal organization.
"""

from fastapi import APIRouter, Depends

# Import our security dependency for the main router
from ...core.security import get_current_user

# Import all sub-routers
from .crud import router as crud_router
from .conversations import router as conversations_router
from .statistics import router as statistics_router
from .search import router as search_router
from .bulk_operations import router as bulk_operations_router
from .health import router as health_router

# =============================================================================
# MAIN ROUTER SETUP
# =============================================================================

# Create the main router that will be imported by other modules
# This maintains the same interface as the original assistants.py
router = APIRouter(
    prefix="/assistants",                # All routes will start with /assistants
    tags=["Assistants"],                 # Groups endpoints in API docs
    dependencies=[Depends(get_current_user)],  # Default auth for most endpoints
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Insufficient permissions"},
        404: {"description": "Assistant not found"},
        422: {"description": "Validation Error"}
    }
)

# =============================================================================
# AGGREGATE SUB-ROUTERS
# =============================================================================

# Include CRUD operations (create, read, update, delete)
# These form the core of assistant management
router.include_router(crud_router, prefix="")

# Include conversation management endpoints
# These handle the relationship between assistants and chat conversations
router.include_router(conversations_router, prefix="")

# Include statistics endpoints
# These provide analytics and usage insights
router.include_router(statistics_router, prefix="")

# Include search endpoints
# These enable fast assistant discovery
router.include_router(search_router, prefix="")

# Include bulk operations
# These allow managing multiple assistants at once
router.include_router(bulk_operations_router, prefix="")

# Include health check endpoints
# Note: These don't require authentication, so we include them separately
# with their own route registration to bypass the default auth requirement
health_router_public = APIRouter(
    prefix="/assistants",
    tags=["Assistants"]
)
health_router_public.include_router(health_router, prefix="")

# =============================================================================
# MODULE EXPORTS
# =============================================================================

# Export the main router for use in the application
# This maintains backward compatibility with code that imports:
# from app.api.assistants import router
__all__ = ["router", "health_router_public"]

# =============================================================================
# DOCUMENTATION
# =============================================================================

"""
Module Organization:
===================

1. **base.py**: Shared dependencies and utilities
   - Common imports and configurations
   - Shared error handlers
   - Utility functions

2. **crud.py**: Basic CRUD operations
   - POST /assistants/ - Create assistant
   - GET /assistants/ - List assistants
   - GET /assistants/{id} - Get specific assistant
   - PUT /assistants/{id} - Update assistant
   - DELETE /assistants/{id} - Delete assistant

3. **conversations.py**: Assistant-conversation management
   - GET /assistants/{id}/conversations - List conversations
   - POST /assistants/{id}/conversations - Create conversation

4. **statistics.py**: Analytics and insights
   - GET /assistants/stats/overview - Get usage statistics

5. **search.py**: Search and discovery
   - GET /assistants/search - Search assistants

6. **bulk_operations.py**: Multi-assistant operations
   - POST /assistants/bulk - Perform bulk actions

7. **health.py**: System health and info
   - GET /assistants/health - Health check
   - GET /assistants/info - API information

Benefits of This Structure:
==========================
- **Maintainability**: Each file has a single, clear purpose
- **Testability**: Smaller files are easier to test
- **Scalability**: Easy to add new endpoints in appropriate modules
- **Clarity**: Developers can quickly find relevant code
- **Reusability**: Shared utilities in base.py reduce duplication
"""

# =============================================================================
# DEBUGGING SUPPORT
# =============================================================================

if __name__ == "__main__":
    print("🤖 Assistant API Module Information:")
    print(f"   Main router prefix: {router.prefix}")
    print(f"   Total sub-modules: 6")
    print(f"   Authentication: Required (except health endpoints)")
    print("\n📁 Module Structure:")
    print("   - crud.py: Basic CRUD operations")
    print("   - conversations.py: Conversation management")
    print("   - statistics.py: Analytics endpoints")
    print("   - search.py: Search functionality")
    print("   - bulk_operations.py: Bulk operations")
    print("   - health.py: Health checks")
    print("\n✅ Module successfully refactored into atomic components!")
