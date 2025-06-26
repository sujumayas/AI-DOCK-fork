"""
Health Check Endpoints

Health monitoring endpoints extracted from the main chat.py file.
Provides service status and available endpoints information.
"""

from fastapi import APIRouter
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# =============================================================================
# HEALTH CHECK ENDPOINT
# =============================================================================

@router.get("/health")
async def chat_health_check():
    """Health check for chat services."""
    return {
        "status": "healthy",
        "message": "Chat service is running",
        "available_endpoints": {
            "send_message": "/chat/send",
            "get_configurations": "/chat/configurations",
            "test_configuration": "/chat/test-configuration",
            "estimate_cost": "/chat/estimate-cost",
            "get_models": "/chat/models/{config_id}",
            "get_dynamic_models": "/chat/models/{config_id}/dynamic",
            "get_all_models": "/chat/all-models"
        },
        "new_features": {
            "dynamic_models": "Real-time model fetching from OpenAI and other providers",
            "model_caching": "1-hour intelligent caching to reduce API calls",
            "graceful_fallback": "Falls back to configuration models if provider API fails",
            "modular_architecture": "Refactored into modular components for better maintainability"
        },
        "architecture": {
            "status": "modular",
            "services": [
                "file_service - File attachment processing",
                "assistant_service - Assistant integration",
                "model_service - Model management and filtering"
            ],
            "schemas": [
                "chat_api.requests - Request validation schemas",
                "chat_api.responses - Response formatting schemas", 
                "chat_api.models - Model-specific schemas"
            ],
            "endpoints": [
                "main - Core chat functionality",
                "configurations - LLM configuration management",
                "models - Model discovery and management",
                "health - Service monitoring"
            ]
        }
    }
