# AI Dock Backend - Main FastAPI Application
# This is the "entry point" of our backend - like main() in a program

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

# Import our database and configuration
from .core.config import settings, validate_config
from .core.database import startup_database, shutdown_database, check_database_connection

# Import our security middleware
from .middleware.security import SecurityHeadersMiddleware, create_security_test_response

# Import our API routers
from .api.auth import router as auth_router
from .api.admin.users import router as admin_users_router
from .api.admin.llm_configs import router as admin_llm_configs_router
from .api.admin.quotas import router as admin_quotas_router
from .api.chat import router as chat_router
from .api.chat_streaming import router as chat_streaming_router  # 🆕 NEW: Streaming chat

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create our FastAPI application instance
# Think of this as creating a "web server" object
app = FastAPI(
    title=settings.app_name,
    description="Secure internal LLM gateway for enterprises", 
    version=settings.app_version,
    # This creates automatic documentation at /docs
    docs_url="/docs",
    redoc_url="/redoc",
    debug=settings.debug
)

# =============================================================================
# SECURITY MIDDLEWARE - MUST BE FIRST!
# =============================================================================

# Security Headers Middleware - adds protection against common attacks
# This MUST be added before other middleware to ensure security headers
# are applied to all responses, including error responses from other middleware
app.add_middleware(
    SecurityHeadersMiddleware,
    environment=settings.environment  # Production vs development security
)

# CORS Middleware - allows our React frontend to talk to this backend
# Without this, browsers block requests between different ports
# Note: CORS is added AFTER security so security headers are applied to CORS responses
logger.info(f"🌐 Configuring CORS for frontend: {settings.frontend_url}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:8080", 
        "http://localhost:3000",
        "http://127.0.0.1:8080",  # Alternative localhost format
        "http://127.0.0.1:3000"   # Alternative localhost format
    ],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (includes OPTIONS for preflight)
    allow_headers=["*"],  # Allow all headers for maximum compatibility
    expose_headers=["*"],  # Expose all headers to frontend
    max_age=86400,  # Cache preflight response for 24 hours
)

# Health check endpoint - like a "ping" to see if the server is alive
# This is often the first endpoint you create in any API
@app.get("/health")
async def health_check():
    """
    Enhanced health check endpoint.
    Returns API status and database connectivity.
    """
    # Check database connection
    db_healthy = await check_database_connection()
    
    return {
        "status": "healthy" if db_healthy else "degraded",
        "message": "AI Dock API is running! 🚀",
        "version": settings.app_version,
        "environment": settings.environment,
        "database": "connected" if db_healthy else "disconnected",
        "debug_mode": settings.debug,
        "security_enabled": True  # Indicates security middleware is active
    }

# Security test endpoint - verify security headers are working
@app.get("/security/test")
async def security_test():
    """
    Test endpoint to verify security headers are being applied.
    
    This endpoint returns information about security features and
    allows you to inspect the response headers to confirm protection
    is active. Check the browser's developer tools Network tab to
    see the security headers in the response.
    
    Learning: This is a great way to test middleware functionality!
    """
    return create_security_test_response()

# CORS test endpoint - verify CORS configuration is working
@app.get("/cors/test")
@app.post("/cors/test")
@app.options("/cors/test")
async def cors_test():
    """
    Test endpoint to verify CORS configuration is working properly.
    
    This endpoint accepts GET, POST, and OPTIONS requests to test
    that CORS preflight requests are handled correctly.
    
    Learning: CORS issues often happen during preflight (OPTIONS) requests!
    """
    return {
        "message": "CORS is working! 🌍",
        "cors_config": {
            "allowed_origins": [
                settings.frontend_url,
                "http://localhost:8080",
                "http://localhost:3000",
                "http://127.0.0.1:8080",
                "http://127.0.0.1:3000"
            ],
            "methods_allowed": "All methods (*)",
            "headers_allowed": "All headers (*)",
            "credentials_allowed": True
        },
        "test_instructions": "Make a POST request to this endpoint from your frontend to test CORS"
    }

# =============================================================================
# API ROUTERS
# =============================================================================

# Include authentication endpoints
# This adds all /auth/* endpoints to our application
app.include_router(auth_router)

# Include admin user management endpoints
# This adds all /admin/users/* endpoints to our application
app.include_router(
    admin_users_router,
    prefix="/admin",
    tags=["Admin"]
)

# Include admin LLM configuration endpoints
# This adds all /admin/llm-configs/* endpoints to our application
app.include_router(
    admin_llm_configs_router,
    prefix="/admin",
    tags=["Admin LLM"]
)

# Include admin quota management endpoints
# This adds all /admin/quotas/* endpoints to our application
app.include_router(
    admin_quotas_router,
    prefix="/admin",
    tags=["Admin Quotas"]
)

# Include admin department management endpoints
# This adds all /admin/departments/* endpoints to our application
from .api.admin.departments import router as admin_departments_router
app.include_router(
    admin_departments_router,
    tags=["Admin Departments"]
)

# Include admin role management endpoints
# This adds all /admin/roles/* endpoints to our application
from .api.admin.roles import router as admin_roles_router
app.include_router(
    admin_roles_router,
    prefix="/admin",
    tags=["Admin Roles"]
)

# Include admin usage analytics endpoints
# This adds all /admin/usage/* endpoints to our application
from .api.admin.usage_analytics import router as admin_usage_router
app.include_router(
    admin_usage_router,
    prefix="/admin",
    tags=["Usage Analytics"]
)

# Include chat endpoints
# This adds all /chat/* endpoints to our application
app.include_router(chat_router)

# 🚀 Include streaming chat endpoints
# This adds streaming functionality to /chat/* endpoints
app.include_router(chat_streaming_router)

# Include manager endpoints
# This adds all /manager/* endpoints to our application
from .api.manager import router as manager_router
app.include_router(
    manager_router,
    tags=["Manager"]
)

# Include conversation endpoints
# This adds all /conversations/* endpoints to our application
from .api.conversations import router as conversations_router
app.include_router(
    conversations_router,
    tags=["Conversations"]
)

# Include file upload endpoints
# This adds all /files/* endpoints to our application
from .api.files import router as files_router
app.include_router(
    files_router,
    tags=["Files"]
)

# Include assistant endpoints
# This adds all /assistants/* endpoints to our application
from .api.assistants import router as assistants_router, health_router_public as assistants_health_router
app.include_router(
    assistants_router,
    tags=["Assistants"]
)
# Include assistant health endpoints (no auth required)
app.include_router(
    assistants_health_router,
    tags=["Assistants"]
)

# Root endpoint - what users see when they visit the API directly
@app.get("/")
def read_root():
    """
    Welcome message for the AI Dock API.
    """
    return {
        "message": f"Welcome to {settings.app_name}! 🤖",
        "new_features": {
            "streaming_chat": "Real-time streaming responses via Server-Sent Events",
            "dynamic_models": "Live model fetching from OpenAI and other providers",
            "smart_filtering": "Intelligent model filtering to show only relevant models",
            "file_upload": "Secure file upload system for document analysis and AI processing",
            "custom_assistants": "Create personalized AI assistants with custom prompts and preferences"
        },
        "version": settings.app_version,
        "documentation": "/docs",
        "health_check": "/health",
        "environment": settings.environment,
        "available_endpoints": {
            "authentication": {
                "login": "/auth/login",
                "logout": "/auth/logout",
                "current_user": "/auth/me",
                "auth_health": "/auth/health"
            },
            "admin": {
                "user_management": "/admin/users/",
                "search_users": "/admin/users/search",
                "user_statistics": "/admin/users/statistics",
                "bulk_operations": "/admin/users/bulk",
                "llm_configurations": "/admin/llm-configs/",
                "quota_management": {
                    "quotas": "/admin/quotas/",
                    "department_status": "/admin/quotas/department/{id}/status",
                    "reset_quota": "/admin/quotas/{id}/reset",
                    "bulk_reset": "/admin/quotas/bulk/reset",
                    "analytics": "/admin/quotas/analytics/summary"
                },
                "role_management": {
                    "list_roles": "/admin/roles/list",
                    "get_all_roles": "/admin/roles/",
                    "get_role": "/admin/roles/{id}",
                    "all_permissions": "/admin/roles/permissions/all",
                    "permissions_by_category": "/admin/roles/permissions/by-category"
                },
                "usage_analytics": {
                    "summary": "/admin/usage/summary",
                    "user_usage": "/admin/usage/users/{user_id}",
                    "department_usage": "/admin/usage/departments/{department_id}",
                    "recent_logs": "/admin/usage/logs/recent",
                    "top_users": "/admin/usage/top-users",
                    "system_health": "/admin/usage/health"
                }
            },
            "chat": {
                "send_message": "/chat/send",
                "stream_message": "/chat/stream",  # 🆕 NEW: Real-time streaming
                "get_configurations": "/chat/configurations",
                "test_configuration": "/chat/test-configuration",
                "estimate_cost": "/chat/estimate-cost",
                "get_models": "/chat/models/{config_id}",
                "get_dynamic_models": "/chat/models/{config_id}/dynamic",
                "chat_health": "/chat/health",
                "streaming_health": "/chat/stream/health"  # 🆕 NEW: Streaming health check
            },
            "files": {
                "upload": "/files/upload",
                "validate": "/files/validate",
                "list_files": "/files/",
                "search_files": "/files/search",
                "download": "/files/{file_id}/download",
                "metadata": "/files/{file_id}/metadata",
                "preview": "/files/{file_id}/content-preview",
                "delete": "/files/{file_id}",
                "bulk_delete": "/files/bulk-delete",
                "statistics": "/files/statistics",
                "limits": "/files/limits",
                "health": "/files/health"
            },
            "assistants": {
                "create": "/assistants/",
                "list": "/assistants/",
                "get": "/assistants/{id}",
                "update": "/assistants/{id}",
                "delete": "/assistants/{id}",
                "search": "/assistants/search",
                "statistics": "/assistants/stats/overview",
                "conversations": "/assistants/{id}/conversations",
                "create_conversation": "/assistants/{id}/conversations",
                "bulk_operations": "/assistants/bulk",
                "health": "/assistants/health"
            },
            "manager": {
                "user_management": {
                    "list_users": "/manager/users/",
                    "create_user": "/manager/users/",
                    "get_user": "/manager/users/{user_id}",
                    "update_user": "/manager/users/{user_id}",
                    "activate_user": "/manager/users/{user_id}/activate",
                    "deactivate_user": "/manager/users/{user_id}/deactivate",
                    "user_statistics": "/manager/users/statistics"
                },
                "quota_management": {
                    "list_quotas": "/manager/quotas/",
                    "create_quota": "/manager/quotas/",
                    "get_quota": "/manager/quotas/{quota_id}",
                    "update_quota": "/manager/quotas/{quota_id}",
                    "reset_quota": "/manager/quotas/{quota_id}/reset",
                    "dashboard": "/manager/quotas/dashboard",
                    "statistics": "/manager/quotas/statistics"
                }
            }
        }
    }

# =============================================================================
# APPLICATION LIFECYCLE EVENTS
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """
    Initialize the application on startup.
    This runs once when the server starts.
    """
    logger.info(f"🚀 Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"📍 Environment: {settings.environment}")
    
    # Validate configuration
    try:
        validate_config()
        logger.info("✅ Configuration validation passed")
    except Exception as e:
        logger.error(f"❌ Configuration validation failed: {e}")
        raise
    
    # Initialize database
    try:
        await startup_database()
        logger.info("✅ Database initialization completed")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
    
    logger.info("🎉 Application startup completed successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    """
    Clean up resources on application shutdown.
    This runs when the server is stopping.
    """
    logger.info("🔌 Shutting down AI Dock API...")
    
    # Clean up database connections
    await shutdown_database()
    
    logger.info("✅ Application shutdown completed")

# This runs the server when you execute this file directly
# Like if __name__ == "__main__": in regular Python scripts
if __name__ == "__main__":
    # uvicorn is the web server that runs our FastAPI app
    uvicorn.run(
        "app.main:app",         # module:app_variable
        host=settings.api_host,  # Listen on all network interfaces
        port=settings.api_port,  # Port from configuration
        reload=settings.debug    # Auto-restart in development mode
    )
