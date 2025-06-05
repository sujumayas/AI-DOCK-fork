"""
Shared test fixtures and configuration for all tests.

This file contains pytest fixtures that can be used across all test modules.
"""

import pytest
import asyncio
import sys
import os
from datetime import datetime

# Add the project root to the path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.config import settings
from app.core.database import get_database_session


@pytest.fixture
def sample_user_data():
    """Fixture providing sample user data for tests."""
    return {
        "id": 1,
        "email": "test@company.com",
        "username": "testuser",
        "full_name": "Test User",
        "role": "user",
        "department": "Engineering",
        "is_active": True,
        "created_at": datetime.utcnow()
    }


@pytest.fixture
def sample_login_credentials():
    """Fixture providing sample login credentials."""
    return {
        "email": "test@company.com",
        "password": "SecurePassword123!"
    }


@pytest.fixture
async def db_session():
    """Fixture providing a database session for tests."""
    async for session in get_database_session():
        yield session
        # Clean up after test
        await session.rollback()


@pytest.fixture
def jwt_token_data():
    """Fixture providing sample JWT token data."""
    return {
        "user_id": 123,
        "email": "test@company.com", 
        "role": "user",
        "department": "Engineering"
    }


# Test markers
pytest.mark.unit = pytest.mark.unit
pytest.mark.integration = pytest.mark.integration
pytest.mark.slow = pytest.mark.slow
pytest.mark.auth = pytest.mark.auth
pytest.mark.database = pytest.mark.database
pytest.mark.api = pytest.mark.api
