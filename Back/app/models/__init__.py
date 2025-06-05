# AI Dock Database Models Package
# This package contains all our database table definitions

"""
Database Models for AI Dock Application

This package contains SQLAlchemy model classes that define our database schema:

- user.py: User accounts, authentication, and profile information
- role.py: User roles (admin, user, analyst, etc.) 
- department.py: Organizational departments for quota management
- llm_config.py: LLM provider configurations (OpenAI, Claude, etc.)
- usage_log.py: Tracking of all LLM interactions and usage
- quota.py: Department-based usage limits and enforcement

Each model file defines:
1. The database table structure (columns, types, constraints)
2. Relationships between tables (foreign keys, joins)
3. Model methods for common operations
4. Validation rules for data integrity

Usage Pattern:
```python
from app.models.user import User
from app.models.department import Department

# Create a new user
new_user = User(
    email="john@company.com",
    username="john_doe", 
    department_id=dept.id
)
```

SQLAlchemy automatically converts these Python classes into database tables
and provides an Object-Relational Mapping (ORM) layer for database operations.
"""

# Import all models here so SQLAlchemy knows about them
# This ensures all tables are created when create_all() is called

# User management models
from .user import User
from .role import Role, RoleType, PermissionConstants
from .department import Department

# Additional models will be imported as we create them:  
from .llm_config import LLMConfiguration, LLMProvider
from .usage_log import UsageLog
# from .quota import DepartmentQuota

# Import Base from database for schema operations
from ..core.database import Base

# Export all models for easy importing
__all__ = [
    "Base",  # Add Base for schema operations
    "User",
    "Role",
    "RoleType", 
    "PermissionConstants",
    "Department", 
    "LLMConfiguration",
    "LLMProvider",
    "UsageLog",
    # "DepartmentQuota",
]

# Model registry information (useful for debugging)
def get_all_models():
    """
    Return a list of all model classes.
    Useful for debugging and database management scripts.
    """
    return [
        User,
        Role,
        Department,
        LLMConfiguration,
        UsageLog,
        # Add other models as we create them
    ]

def get_model_names():
    """Return a list of all model class names."""
    return [model.__name__ for model in get_all_models()]

def get_table_names():
    """Return a list of all database table names."""
    return [model.__tablename__ for model in get_all_models()]

# Print model information when package is imported (for debugging)
if __name__ == "__main__":
    print("🗃️  AI Dock Database Models:")
    for model in get_all_models():
        print(f"   - {model.__name__} -> {model.__tablename__}")
