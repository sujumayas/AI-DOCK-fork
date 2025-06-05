# AI Dock Backend - Main FastAPI Application
# This is the "entry point" of our backend - like main() in a program

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

# Import our database and configuration
from .core.config import settings, validate_config
from .core.database import startup_database, shutdown_database, check_database_connection

# Import our API routers
from .api.auth import router as auth_router
from .api.admin.users import router as admin_users_router

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

# CORS Middleware - allows our React frontend to talk to this backend
# Without this, browsers block requests between different ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:8080", 
        "http://localhost:3000"
    ],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],        # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],        # Allow all headers
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
        "debug_mode": settings.debug
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

# Root endpoint - what users see when they visit the API directly
@app.get("/")
def read_root():
    """
    Welcome message for the AI Dock API.
    """
    return {
        "message": f"Welcome to {settings.app_name}! 🤖",
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
                "bulk_operations": "/admin/users/bulk"
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
