"""
Tests for authentication schemas.

This file tests Pydantic schemas used for authentication requests and responses.
"""

import pytest
from pydantic import ValidationError
import sys
import os

# Add the project root to the path
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.schemas.auth import LoginRequest, LoginResponse, UserInfo


@pytest.mark.unit
def test_login_request_valid(sample_login_credentials):
    """Test LoginRequest schema with valid data."""
    login_request = LoginRequest(**sample_login_credentials)
    
    assert login_request.email == sample_login_credentials["email"]
    assert login_request.password == sample_login_credentials["password"]


@pytest.mark.unit
def test_login_request_invalid_email():
    """Test LoginRequest schema rejects invalid email."""
    with pytest.raises(ValidationError):
        LoginRequest(
            email="not-an-email",
            password="ValidPassword123!"
        )


@pytest.mark.unit
def test_login_request_short_password():
    """Test LoginRequest schema rejects short password."""
    with pytest.raises(ValidationError):
        LoginRequest(
            email="test@company.com",
            password="123"  # Too short
        )


@pytest.mark.unit
def test_user_info_schema(sample_user_data):
    """Test UserInfo schema creation."""
    user_info = UserInfo(**sample_user_data)
    
    assert user_info.email == sample_user_data["email"]
    assert user_info.full_name == sample_user_data["full_name"]
    assert user_info.role == sample_user_data["role"]
    assert user_info.is_active == sample_user_data["is_active"]


# TODO: Add more schema tests as we develop features:
# - test_login_response_schema()
# - test_refresh_token_schema()
# - test_user_registration_schema()
# - test_password_reset_schema()
