"""
Tests for User model functionality.

This file will contain tests for the User model when we create more complex
user management features.
"""

import pytest
import sys
import os

# Add the project root to the path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.models.user import User


@pytest.mark.unit
def test_user_model_creation(sample_user_data):
    """Test creating a User model instance."""
    user = User(**sample_user_data)
    
    assert user.email == sample_user_data["email"]
    assert user.username == sample_user_data["username"]
    assert user.full_name == sample_user_data["full_name"]
    assert user.is_active == sample_user_data["is_active"]


@pytest.mark.unit 
def test_user_email_validation():
    """Test User email validation functionality."""
    # This will test email validation when we add that method
    user = User(
        email="test@company.com",
        username="testuser",
        full_name="Test User"
    )
    
    # Test will be implemented when we add validation methods
    assert user.email == "test@company.com"
    # assert user.validate_email_format() == True  # Future feature


# TODO: Add more model tests as we develop features:
# - test_user_password_hashing()
# - test_user_role_validation()
# - test_user_department_assignment()
# - test_user_quota_management()
# - test_user_api_key_generation()
