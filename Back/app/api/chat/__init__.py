"""
Chat API Module

Modular chat API endpoints extracted from the monolithic chat.py file.
This module provides a clean separation of concerns for better maintainability.
"""

from .main import router as main_router
from .configurations import router as config_router
from .models import router as models_router
from .health import router as health_router

# Export the main router that combines all sub-routers
from fastapi import APIRouter

# Create the main chat router
router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

# Include all sub-routers
router.include_router(main_router, tags=["Chat Messages"])
router.include_router(config_router, tags=["Configurations"])
router.include_router(models_router, tags=["Models"])
router.include_router(health_router, tags=["Health"])

__all__ = ["router"]
