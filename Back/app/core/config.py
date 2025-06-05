# AI Dock Core Configuration
# This file manages all environment variables and app settings
# Think of this as the "control panel" for our entire application

from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    """
    Application configuration class using Pydantic Settings.
    
    Why Pydantic Settings?
    - Automatic type validation (ensures DATABASE_URL is a string, etc.)
    - Environment variable parsing with defaults
    - Documentation through type hints
    - Easy testing with different configs
    """
    
    # =============================================================================
    # DATABASE CONFIGURATION
    # =============================================================================
    
    # Main database connection string
    # Format: postgresql://username:password@host:port/database_name
    # Or for development: sqlite:///./database_name.db
    database_url: str = "sqlite:///./ai_dock_dev.db"
    
    # For async database operations (SQLAlchemy 2.0+ style)
    # We'll use this for our actual database connections
    @property
    def async_database_url(self) -> str:
        """
        Convert regular database URL to async version.
        SQLite: sqlite+aiosqlite:///./file.db
        PostgreSQL: postgresql+asyncpg://user:pass@host/db
        """
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://")
        elif self.database_url.startswith("sqlite:///"):
            return self.database_url.replace("sqlite:///", "sqlite+aiosqlite:///")
        return self.database_url
    
    # =============================================================================
    # SECURITY CONFIGURATION
    # =============================================================================
    
    # Secret key for JWT tokens - THIS MUST BE SECURE IN PRODUCTION!
    # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    secret_key: str = "dev-secret-key-change-in-production"
    
    # JWT algorithm and expiration times
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 10080  # 7 days
    
    # =============================================================================
    # APPLICATION CONFIGURATION
    # =============================================================================
    
    # App metadata
    app_name: str = "AI Dock API"
    app_version: str = "0.1.0"
    
    # Environment (development, staging, production)
    environment: str = "development"
    
    # Debug mode - enables detailed error messages
    debug: bool = True
    
    # API server configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Frontend URL for CORS (Cross-Origin Resource Sharing)
    frontend_url: str = "http://localhost:8080"
    
    # =============================================================================
    # LLM PROVIDER CONFIGURATION
    # =============================================================================
    
    # OpenAI API settings
    openai_api_key: Optional[str] = None
    openai_org_id: Optional[str] = None
    
    # Anthropic Claude API settings  
    anthropic_api_key: Optional[str] = None
    
    # Default rate limiting
    default_rate_limit_per_minute: int = 60
    default_daily_quota_tokens: int = 100000
    
    # =============================================================================
    # PYDANTIC SETTINGS CONFIGURATION
    # =============================================================================
    
    class Config:
        """
        Pydantic configuration for environment variable loading.
        """
        # Look for variables in .env file
        env_file = ".env"
        
        # Case sensitive environment variables
        case_sensitive = False
        
        # Ignore extra fields in .env that aren't defined here
        extra = "ignore"

# =============================================================================
# SINGLETON PATTERN FOR SETTINGS
# =============================================================================

# Create a single instance of settings that the whole app uses
# This is called the "Singleton Pattern" - one global configuration object
settings = Settings()

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_settings() -> Settings:
    """
    Dependency function to get settings in FastAPI endpoints.
    
    This allows for easy testing - we can inject different settings
    in tests without changing the global settings object.
    """
    return settings

def is_production() -> bool:
    """Check if we're running in production environment."""
    return settings.environment.lower() == "production"

def is_development() -> bool:
    """Check if we're running in development environment."""
    return settings.environment.lower() == "development"

# =============================================================================
# CONFIGURATION VALIDATION
# =============================================================================

def validate_config() -> None:
    """
    Validate critical configuration settings on startup.
    This catches configuration errors early before they cause problems.
    """
    errors = []
    
    # Check that we have a database URL
    if not settings.database_url:
        errors.append("DATABASE_URL is required")
    
    # In production, ensure we have a secure secret key
    if is_production():
        if settings.secret_key == "dev-secret-key-change-in-production":
            errors.append("SECRET_KEY must be changed in production")
        
        if len(settings.secret_key) < 32:
            errors.append("SECRET_KEY must be at least 32 characters in production")
    
    # Validate that we have at least one LLM API key
    if not any([settings.openai_api_key, settings.anthropic_api_key]):
        print("⚠️  Warning: No LLM API keys configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env")
    
    if errors:
        error_msg = "Configuration errors:\n" + "\n".join(f"- {error}" for error in errors)
        raise ValueError(error_msg)

# Print configuration summary when module is imported (for debugging)
if __name__ == "__main__":
    print(f"🔧 AI Dock Configuration Summary:")
    print(f"   Environment: {settings.environment}")
    print(f"   Database: {settings.database_url}")
    print(f"   Debug Mode: {settings.debug}")
    print(f"   API Port: {settings.api_port}")
    print(f"   Frontend URL: {settings.frontend_url}")
