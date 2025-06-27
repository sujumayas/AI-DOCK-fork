"""
File API Router - Main entry point for all file operations.

This module combines all file-related API endpoints from modular components:
- Upload operations (upload, validation)
- Retrieval operations (download, metadata)
- Listing operations (list, search)
- Deletion operations (delete, bulk delete)
- Statistics operations (stats, limits, health)
- Utility operations (preview)

🎓 LEARNING: Modular API Organization
===================================
Large API modules can be broken down into focused sub-modules:
1. Each module handles one specific area of functionality
2. Main router combines all sub-routers
3. Dependencies are shared across modules
4. Easier to maintain and test individual components

This follows the single responsibility principle and makes
the codebase more maintainable and easier to understand.
"""

from fastapi import APIRouter

# Import all sub-routers
from . import upload
from . import retrieval
from . import listing
from . import deletion
from . import statistics
from . import utilities

# Create the main router
router = APIRouter(prefix="/files", tags=["Files"])

# Include all sub-routers
router.include_router(upload.router, tags=["File Upload"])
router.include_router(retrieval.router, tags=["File Retrieval"])
router.include_router(listing.router, tags=["File Listing"])
router.include_router(deletion.router, tags=["File Deletion"])
router.include_router(statistics.router, tags=["File Statistics"])
router.include_router(utilities.router, tags=["File Utilities"])

# Export the main router for inclusion in the main app
__all__ = ["router"]
