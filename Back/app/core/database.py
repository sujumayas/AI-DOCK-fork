# AI Dock Database Configuration and Connection Management
# This file sets up SQLAlchemy to talk to our database with BOTH sync and async support

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from typing import AsyncGenerator, Generator
import logging

from .config import settings

# =============================================================================
# LOGGING SETUP
# =============================================================================

# Create a logger specifically for database operations
logger = logging.getLogger(__name__)

# =============================================================================
# SQLALCHEMY BASE CLASSES
# =============================================================================

# Create the base class for all our database models
# Think of this as the "parent class" that all our User, Department, etc. classes inherit from
# The Base class automatically creates its own metadata object that we can access via Base.metadata
Base = declarative_base()

# Ensure metadata is properly initialized
if not hasattr(Base, 'metadata') or Base.metadata is None:
    logger.error("❌ SQLAlchemy Base metadata not properly initialized")
    raise Exception("Database Base class metadata initialization failed")

# =============================================================================
# DATABASE ENGINE CONFIGURATION (ASYNC)
# =============================================================================

# Create the async database engine for async operations
async_engine = create_async_engine(
    settings.async_database_url,
    
    # Echo SQL queries in development (helpful for learning!)
    echo=settings.debug,
    
    # Connection pool settings - these control how many database connections we keep open
    pool_size=10,                    # Keep 10 connections ready
    max_overflow=20,                 # Allow 20 more if needed
    pool_pre_ping=True,             # Test connections before using them
    pool_recycle=3600,              # Refresh connections every hour
    
    # For SQLite only - allows multiple threads to access the database
    connect_args=(
        {"check_same_thread": False} 
        if settings.database_url.startswith("sqlite") 
        else {}
    )
)

# =============================================================================
# DATABASE ENGINE CONFIGURATION (SYNC)
# =============================================================================

# Create the synchronous database engine for sync operations
# This is needed for the AdminService and other sync operations
sync_engine = create_engine(
    settings.database_url,  # Note: using the sync URL, not async
    
    # Echo SQL queries in development
    echo=settings.debug,
    
    # Connection pool settings
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    
    # For SQLite only
    connect_args=(
        {"check_same_thread": False} 
        if settings.database_url.startswith("sqlite") 
        else {}
    )
)

# =============================================================================
# SESSION FACTORIES
# =============================================================================

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,         # Keep objects accessible after commit
    autoflush=True,                 # Automatically sync changes to DB
    autocommit=False                # Require explicit commits (safer!)
)

# Create sync session factory
SyncSessionLocal = sessionmaker(
    sync_engine,
    class_=Session,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False
)

# =============================================================================
# DATABASE SESSION DEPENDENCIES
# =============================================================================

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an async database session.
    
    Use this for async route handlers and services.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Async database session error: {e}")
            raise
        finally:
            await session.close()

def get_sync_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a synchronous database session.
    
    Use this for sync route handlers and services like AdminService.
    """
    session = SyncSessionLocal()
    try:
        yield session
    except Exception as e:
        session.rollback()
        logger.error(f"Sync database session error: {e}")
        raise
    finally:
        session.close()

# Default to sync for backward compatibility with existing code
get_db = get_sync_db

# Export engines for scripts that need direct access
engine = sync_engine  # For backward compatibility

# =============================================================================
# DATABASE INITIALIZATION
# =============================================================================

async def create_database_tables():
    """
    Create all database tables defined by our models.
    
    This function looks at all the model classes that inherit from Base
    and creates the corresponding tables in the database.
    """
    async with async_engine.begin() as conn:
        # Import all models here to ensure they're registered with Base
        # This imports all model files which registers them with SQLAlchemy
        from ..models import (
            user, role, department, llm_config, 
            usage_log, quota, conversation
        )
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables created successfully")

def create_database_tables_sync():
    """
    Synchronous version of table creation.
    """
    # Import all models here to ensure they're registered with Base
    # This imports all model files which registers them with SQLAlchemy
    from ..models import (
        user, role, department, llm_config, 
        usage_log, quota, conversation
    )
    
    # Create all tables using sync engine
    Base.metadata.create_all(sync_engine)
    logger.info("✅ Database tables created successfully (sync)")

async def drop_database_tables():
    """
    Drop all database tables. 
    USE WITH CAUTION - this deletes all data!
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        logger.info("🗑️  Database tables dropped")

def drop_database_tables_sync():
    """
    Synchronous version of table dropping.
    """
    Base.metadata.drop_all(sync_engine)
    logger.info("🗑️  Database tables dropped (sync)")

# =============================================================================
# DATABASE HEALTH CHECK
# =============================================================================

async def check_database_connection() -> bool:
    """
    Test if we can connect to the database (async version).
    Returns True if connection is successful, False otherwise.
    """
    try:
        async with async_engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            return result is not None
    except Exception as e:
        logger.error(f"Async database connection failed: {e}")
        return False

def check_database_connection_sync() -> bool:
    """
    Test if we can connect to the database (sync version).
    Returns True if connection is successful, False otherwise.
    """
    try:
        with sync_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            return result is not None
    except Exception as e:
        logger.error(f"Sync database connection failed: {e}")
        return False

# =============================================================================
# STARTUP AND SHUTDOWN HANDLERS
# =============================================================================

async def startup_database():
    """
    Initialize database on application startup.
    
    This function should be called when the FastAPI app starts up.
    """
    logger.info("🔗 Connecting to database...")
    
    # Test both async and sync connections
    async_healthy = await check_database_connection()
    sync_healthy = check_database_connection_sync()
    
    if async_healthy and sync_healthy:
        logger.info(f"✅ Connected to database: {settings.database_url}")
    else:
        logger.error(f"❌ Failed to connect to database: {settings.database_url}")
        logger.error(f"   Async connection: {'✅' if async_healthy else '❌'}")
        logger.error(f"   Sync connection: {'✅' if sync_healthy else '❌'}")
        raise Exception("Database connection failed")
    
    # Create tables using sync method (more reliable for startup)
    create_database_tables_sync()

async def shutdown_database():
    """
    Clean up database connections on application shutdown.
    """
    logger.info("🔌 Closing database connections...")
    await async_engine.dispose()
    sync_engine.dispose()
    logger.info("✅ Database connections closed")

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_database_url() -> str:
    """Get the current database URL (useful for debugging)."""
    return settings.database_url

def get_async_database_url() -> str:
    """Get the current async database URL (useful for debugging)."""
    return settings.async_database_url

def is_sqlite() -> bool:
    """Check if we're using SQLite database."""
    return settings.database_url.startswith("sqlite")

def is_postgresql() -> bool:
    """Check if we're using PostgreSQL database."""
    return settings.database_url.startswith("postgresql")

# =============================================================================
# TESTING AND DEVELOPMENT HELPERS
# =============================================================================

def get_sync_session() -> Session:
    """
    Get a synchronous database session for testing or scripts.
    
    Remember to close the session when done!
    """
    return SyncSessionLocal()

async def get_async_session() -> AsyncSession:
    """
    Get an asynchronous database session for testing or scripts.
    
    Remember to close the session when done!
    """
    session = AsyncSessionLocal()
    return session

# =============================================================================
# DEBUGGING INFORMATION
# =============================================================================

if __name__ == "__main__":
    print(f"🗄️  Database Configuration:")
    print(f"   Sync URL: {settings.database_url}")
    print(f"   Async URL: {settings.async_database_url}")
    print(f"   Type: {'SQLite' if is_sqlite() else 'PostgreSQL' if is_postgresql() else 'Other'}")
    print(f"   Debug Mode: {settings.debug}")
    print(f"   Available Sessions: Sync ✅ | Async ✅")
