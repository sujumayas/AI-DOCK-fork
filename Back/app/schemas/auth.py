"""
Authentication schemas for AI Dock application.

These Pydantic models define the structure and validation rules for:
- Login requests and responses
- User registration data
- Token data structures
- Password reset flows

Why Pydantic schemas?
- Automatic data validation (ensures email is actually an email)
- Type safety (prevents runtime errors)
- Automatic API documentation (FastAPI uses these for docs)
- Clear contracts between frontend and backend
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime


# =============================================================================
# LOGIN & AUTHENTICATION SCHEMAS
# =============================================================================

class LoginRequest(BaseModel):
    """
    Schema for user login requests.
    
    This defines what data the frontend must send when a user tries to log in.
    """
    email: EmailStr = Field(
        ..., 
        description="User's email address",
        example="user@company.com"
    )
    password: str = Field(
        ..., 
        min_length=8, 
        max_length=100,
        description="User's password (min 8 characters)",
        example="SecurePassword123!"
    )
    
    class Config:
        # Allow JSON schema generation for API docs
        schema_extra = {
            "example": {
                "email": "john.doe@company.com",
                "password": "MySecurePassword123!"
            }
        }


class LoginResponse(BaseModel):
    """
    Schema for successful login responses.
    
    This defines what data we send back when login is successful.
    """
    access_token: str = Field(
        ...,
        description="JWT access token for API authentication"
    )
    refresh_token: str = Field(
        ...,
        description="JWT refresh token for getting new access tokens"
    )
    token_type: str = Field(
        default="bearer",
        description="Type of token (always 'bearer' for JWT)"
    )
    expires_in: int = Field(
        ...,
        description="Access token expiration time in seconds"
    )
    user: 'UserInfo' = Field(
        ...,
        description="Basic user information"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "token_type": "bearer",
                "expires_in": 1800,
                "user": {
                    "id": 123,
                    "email": "john.doe@company.com",
                    "full_name": "John Doe",
                    "role": "user",
                    "department": "Engineering"
                }
            }
        }


# =============================================================================
# USER INFORMATION SCHEMAS
# =============================================================================

class UserInfo(BaseModel):
    """
    Basic user information included in authentication responses.
    
    This is a subset of user data that's safe to send to the frontend.
    Never include sensitive data like password hashes here!
    """
    id: int = Field(..., description="User's unique ID")
    email: EmailStr = Field(..., description="User's email address")
    full_name: str = Field(..., description="User's full name")
    role: str = Field(..., description="User's role (admin, user, etc.)")
    department: Optional[str] = Field(None, description="User's department")
    is_active: bool = Field(default=True, description="Whether user account is active")
    is_admin: bool = Field(default=False, description="Whether user has admin privileges")
    created_at: datetime = Field(..., description="Account creation timestamp")
    
    class Config:
        # Use enum values for JSON serialization
        use_enum_values = True
        # Allow datetime serialization
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# =============================================================================
# TOKEN REFRESH SCHEMAS
# =============================================================================

class RefreshTokenRequest(BaseModel):
    """
    Schema for refresh token requests.
    
    When an access token expires, frontend sends refresh token to get a new one.
    """
    refresh_token: str = Field(
        ...,
        description="Valid refresh token"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
            }
        }


class RefreshTokenResponse(BaseModel):
    """
    Schema for refresh token responses.
    
    Returns a new access token when refresh is successful.
    """
    access_token: str = Field(
        ...,
        description="New JWT access token"
    )
    token_type: str = Field(
        default="bearer",
        description="Type of token"
    )
    expires_in: int = Field(
        ...,
        description="New access token expiration time in seconds"
    )


# =============================================================================
# USER REGISTRATION SCHEMAS (for future use)
# =============================================================================

class UserRegistrationRequest(BaseModel):
    """
    Schema for user registration requests.
    
    This will be used when we implement user registration (probably admin-only).
    """
    email: EmailStr = Field(..., description="User's email address")
    full_name: str = Field(
        ..., 
        min_length=2, 
        max_length=100,
        description="User's full name"
    )
    password: str = Field(
        ..., 
        min_length=8, 
        max_length=100,
        description="User's password"
    )
    role: str = Field(
        default="user",
        description="User's role"
    )
    department: Optional[str] = Field(
        None,
        description="User's department"
    )
    
    @validator('password')
    def validate_password(cls, v):
        """
        Validate password strength.
        
        In production, you might want more complex rules:
        - Must contain uppercase and lowercase
        - Must contain numbers
        - Must contain special characters
        """
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v
    
    @validator('full_name')
    def validate_name(cls, v):
        """Validate full name format."""
        if not v.strip():
            raise ValueError('Full name cannot be empty')
        return v.strip()


# =============================================================================
# ERROR RESPONSE SCHEMAS
# =============================================================================

class AuthErrorResponse(BaseModel):
    """
    Schema for authentication error responses.
    
    Standardized error format for all auth-related failures.
    """
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[dict] = Field(None, description="Additional error details")
    
    class Config:
        schema_extra = {
            "example": {
                "error": "invalid_credentials",
                "message": "Invalid email or password",
                "details": None
            }
        }


# =============================================================================
# TOKEN PAYLOAD SCHEMAS (for internal use)
# =============================================================================

class TokenPayload(BaseModel):
    """
    Schema for JWT token payload data.
    
    This defines what data we store inside JWT tokens.
    Used internally for type safety when working with token data.
    """
    user_id: int = Field(..., description="User's ID")
    email: str = Field(..., description="User's email")
    role: str = Field(..., description="User's role")
    exp: int = Field(..., description="Token expiration timestamp")
    token_type: Optional[str] = Field(None, description="Token type (for refresh tokens)")


# =============================================================================
# LOGOUT SCHEMA
# =============================================================================

class LogoutResponse(BaseModel):
    """
    Schema for logout responses.
    """
    message: str = Field(
        default="Successfully logged out",
        description="Logout confirmation message"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "message": "Successfully logged out"
            }
        }


# Forward reference resolution for UserInfo in LoginResponse
LoginResponse.model_rebuild()
