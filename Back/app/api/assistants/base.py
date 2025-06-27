"""
Base module for assistant API endpoints.

This module contains shared dependencies, router setup, and common imports
used across all assistant endpoint modules.

🎓 LEARNING: Modular API Design
==============================
By extracting common dependencies to a base module, we:
- Avoid duplicate imports across files
- Maintain consistency in router configuration
- Centralize logging setup
- Share common error handling patterns
"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
import logging

# Import our database dependency
from ...core.database import get_async_db
from ...core.security import get_current_user

# Import our models
from ...models.user import User
from ...models.assistant import Assistant
from ...models.chat_conversation import ChatConversation

# Import our schemas (data models for requests/responses)
from ...schemas.assistant import (
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
from ...services.assistant_service import assistant_service

# Setup logging for assistant endpoints
logger = logging.getLogger(__name__)

# =============================================================================
# SHARED ROUTER CONFIGURATION
# =============================================================================

def create_assistant_router() -> APIRouter:
    """
    Create a router with common configuration for assistant endpoints.
    
    This function creates a router with:
    - Authentication requirement
    - Common response models
    - Consistent prefix and tags
    
    Returns:
        Configured APIRouter instance
    """
    return APIRouter(
        dependencies=[Depends(get_current_user)],  # All endpoints require authentication
        responses={
            401: {"description": "Unauthorized"},
            403: {"description": "Forbidden - Insufficient permissions"},
            404: {"description": "Assistant not found"},
            422: {"description": "Validation Error"}
        }
    )

# =============================================================================
# SHARED ERROR HANDLERS
# =============================================================================

def handle_assistant_not_found(assistant_id: int, user_email: str) -> None:
    """
    Standard handler for assistant not found errors.
    
    Args:
        assistant_id: The ID of the assistant that wasn't found
        user_email: Email of the user attempting access
        
    Raises:
        HTTPException: 404 Not Found
    """
    logger.warning(f"Assistant {assistant_id} not found or not owned by {user_email}")
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "error": "not_found",
            "message": f"Assistant {assistant_id} not found"
        }
    )

def handle_validation_error(error: Exception, user_email: str, operation: str) -> None:
    """
    Standard handler for validation errors.
    
    Args:
        error: The validation error
        user_email: Email of the user
        operation: The operation being performed
        
    Raises:
        HTTPException: 400 Bad Request
    """
    logger.warning(f"{operation} failed for {user_email}: {str(error)}")
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "error": "validation_error",
            "message": str(error)
        }
    )

def handle_internal_error(error: Exception, user_email: str, operation: str) -> None:
    """
    Standard handler for unexpected internal errors.
    
    Args:
        error: The internal error
        user_email: Email of the user
        operation: The operation being performed
        
    Raises:
        HTTPException: 500 Internal Server Error
    """
    logger.error(f"Error {operation} for {user_email}: {str(error)}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "error": "internal_error",
            "message": f"Error {operation}"
        }
    )

# =============================================================================
# SHARED UTILITIES
# =============================================================================

def compute_assistant_summary(assistant: Assistant) -> AssistantSummary:
    """
    Convert an Assistant model to AssistantSummary schema.
    
    This centralizes the logic for creating assistant summaries
    to ensure consistency across endpoints.
    
    Args:
        assistant: The Assistant model instance
        
    Returns:
        AssistantSummary schema instance
    """
    # Compute values safely to avoid lazy loading
    system_prompt_preview = assistant.system_prompt[:147] + "..." if len(assistant.system_prompt) > 150 else assistant.system_prompt
    
    # Use pre-computed conversation count from service layer
    conversation_count = getattr(assistant, '_conversation_count', 0)
    
    # Compute is_new safely
    is_new = False
    if assistant.created_at:
        from datetime import datetime, timedelta
        day_ago = datetime.utcnow() - timedelta(hours=24)
        is_new = assistant.created_at > day_ago
    
    return AssistantSummary(
        id=assistant.id,
        name=assistant.name,
        description=assistant.description,
        system_prompt_preview=system_prompt_preview,
        is_active=assistant.is_active,
        conversation_count=conversation_count,
        created_at=assistant.created_at,
        is_new=is_new
    )
