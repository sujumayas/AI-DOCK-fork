"""
Assistant system health check and info endpoints.

This module provides system status and feature information.

🎓 LEARNING: Health Check Design
===============================
Health checks serve multiple purposes:
- Monitor system availability
- Verify feature functionality
- Provide API documentation
- Enable service discovery

Best practices:
- No authentication required
- Fast response times
- Meaningful status codes
- Feature capability listing
"""

from fastapi import APIRouter

# Create a basic router without authentication for health checks
router = APIRouter()

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
# API INFORMATION
# =============================================================================

@router.get("/info")
async def assistant_api_info():
    """
    Get detailed API information for the assistant system.
    
    Provides comprehensive documentation about available operations,
    required parameters, and expected responses.
    """
    return {
        "api_version": "1.0",
        "description": "AI Dock Custom Assistants API",
        "authentication": "JWT Bearer token required for all endpoints except health checks",
        "rate_limiting": "Subject to user and department quotas",
        "operations": {
            "crud": {
                "description": "Create, Read, Update, Delete assistants",
                "endpoints": [
                    "POST /assistants/",
                    "GET /assistants/",
                    "GET /assistants/{id}",
                    "PUT /assistants/{id}",
                    "DELETE /assistants/{id}"
                ]
            },
            "conversations": {
                "description": "Manage assistant-conversation relationships",
                "endpoints": [
                    "GET /assistants/{id}/conversations",
                    "POST /assistants/{id}/conversations"
                ]
            },
            "search": {
                "description": "Search and filter assistants",
                "endpoints": [
                    "GET /assistants/search?q={query}"
                ]
            },
            "analytics": {
                "description": "View usage statistics and insights",
                "endpoints": [
                    "GET /assistants/stats/overview"
                ]
            },
            "bulk": {
                "description": "Perform operations on multiple assistants",
                "endpoints": [
                    "POST /assistants/bulk"
                ]
            }
        },
        "models": {
            "assistant": {
                "fields": [
                    "id", "name", "description", "system_prompt",
                    "temperature", "model_preferences", "is_active",
                    "created_at", "updated_at"
                ]
            },
            "conversation": {
                "fields": [
                    "id", "title", "assistant_id", "message_count",
                    "last_message_at", "created_at"
                ]
            }
        },
        "limits": {
            "max_assistants_per_user": "Determined by department quota",
            "max_name_length": 100,
            "max_description_length": 500,
            "max_system_prompt_length": 4000,
            "pagination_max_limit": 100
        }
    }
