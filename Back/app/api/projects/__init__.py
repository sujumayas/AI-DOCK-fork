# Projects API Module
# Handles project-related HTTP endpoints

from .crud import router as crud_router
from .conversations import router as conversations_router
from .statistics import router as statistics_router

__all__ = ['crud_router', 'conversations_router', 'statistics_router']