"""
Authentication API Endpoints for AI Dock application.

This module handles HTTP requests for authentication operations.
It's the "interface" between the frontend and our authentication business logic.

🎓 LEARNING: API Endpoint Design
==============================
Good API endpoints should:
- Have clear, RESTful URLs (/auth/login, /auth/logout)
- Use appropriate HTTP methods (POST for login/logout)
- Return consistent response formats
- Use proper HTTP status codes
- Handle errors gracefully
- Include helpful documentation
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any

# Import our schemas (data models for requests/responses)
from app.schemas.auth import (
    LoginRequest, 
    LoginResponse, 
    LogoutResponse,
    AuthErrorResponse
)

# Import our authentication service (business logic)
from app.services.auth_service import (
    authenticate_user,
    logout_user,
    get_current_user_from_token,
    AuthenticationError
)

# =============================================================================
# ROUTER SETUP
# =============================================================================

# Create a router - this groups related endpoints together
# Think of it like a "sub-application" for authentication
router = APIRouter(
    prefix="/auth",                    # All routes will start with /auth
    tags=["Authentication"],           # Groups endpoints in API docs
    responses={
        401: {"description": "Unauthorized"},
        422: {"description": "Validation Error"}
    }
)

# Security scheme for protected endpoints
# This tells FastAPI to expect "Authorization: Bearer <token>" headers
security = HTTPBearer()


# =============================================================================
# LOGIN ENDPOINT
# =============================================================================

@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest) -> LoginResponse:
    """
    User login endpoint.
    
    🎓 LEARNING: HTTP POST for Login
    ===============================
    Why POST and not GET?
    - POST sends data in request body (more secure)
    - GET sends data in URL (visible in logs, browser history)
    - Login credentials should never be in URLs!
    
    Request Flow:
    1. Frontend sends POST to /auth/login with email/password
    2. FastAPI validates the request data (LoginRequest schema)
    3. We call our authentication service to do the work
    4. Return tokens and user info (LoginResponse schema)
    
    Args:
        login_data: Email and password from the request body
        
    Returns:
        LoginResponse with access token, refresh token, and user info
        
    Raises:
        HTTPException: 401 for invalid credentials, 422 for validation errors
    """
    try:
        # Call our authentication service to do the actual work
        # The service handles all the complex logic (database, passwords, tokens)
        result = await authenticate_user(login_data)
        
        # If we get here, authentication was successful!
        return result
    
    except AuthenticationError as e:
        # Our custom authentication error (wrong password, inactive account, etc.)
        # Convert to HTTP 401 Unauthorized
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": e.error_code,
                "message": e.message
            }
        )
    
    except Exception as e:
        # Unexpected error - don't expose internal details to frontend
        print(f"Unexpected error in login endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "An unexpected error occurred. Please try again."
            }
        )


# =============================================================================
# LOGOUT ENDPOINT
# =============================================================================

@router.post("/logout", response_model=LogoutResponse)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)) -> LogoutResponse:
    """
    User logout endpoint.
    
    🎓 LEARNING: Protected Endpoints
    ===============================
    This endpoint requires authentication - users must send a valid token.
    
    The `Depends(security)` part tells FastAPI:
    1. Extract the "Authorization: Bearer <token>" header
    2. Validate the format (Bearer <token>)
    3. Pass the token to our function
    
    If no token or invalid format → automatic 401 error
    
    Request Flow:
    1. Frontend sends POST to /auth/logout with Authorization header
    2. FastAPI extracts and validates token format
    3. We validate the token and get user info
    4. Call logout service
    5. Return success message
    
    Args:
        credentials: Authorization header with Bearer token
        
    Returns:
        LogoutResponse with success message
        
    Raises:
        HTTPException: 401 for invalid/expired tokens
    """
    try:
        # Extract the token from "Bearer <token>"
        token = credentials.credentials
        
        # Get user from token (this validates the token)
        current_user = await get_current_user_from_token(token)
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "invalid_token",
                    "message": "Invalid or expired token"
                }
            )
        
        # Call logout service
        result = await logout_user(current_user.id)
        
        # Return success response
        return LogoutResponse(message=result["message"])
    
    except HTTPException:
        # Re-raise HTTP exceptions (like 401) as-is
        raise
    
    except Exception as e:
        # Unexpected error
        print(f"Unexpected error in logout endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "An unexpected error occurred. Please try again."
            }
        )


# =============================================================================
# CURRENT USER ENDPOINT (BONUS)
# =============================================================================

@router.get("/me")
async def get_current_user_info(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Get current user information.
    
    🎓 LEARNING: User Info Endpoint
    ==============================
    This endpoint lets the frontend get information about the currently
    logged-in user. Useful for:
    - Displaying user name in header
    - Checking user permissions
    - Refreshing user data
    
    This is a common pattern in web applications.
    
    Args:
        credentials: Authorization header with Bearer token
        
    Returns:
        Current user information
        
    Raises:
        HTTPException: 401 for invalid/expired tokens
    """
    try:
        # Extract token and get user
        token = credentials.credentials
        current_user = await get_current_user_from_token(token)
        
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "invalid_token",
                    "message": "Invalid or expired token"
                }
            )
        
        # Return user info (safe data only)
        from app.services.auth_service import create_user_info
        return create_user_info(current_user)
    
    except HTTPException:
        raise
    
    except Exception as e:
        print(f"Unexpected error in get_current_user_info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "internal_error",
                "message": "Unable to retrieve user information"
            }
        )


# =============================================================================
# HEALTH CHECK FOR AUTH SYSTEM
# =============================================================================

@router.get("/health")
async def auth_health_check():
    """
    Authentication system health check.
    
    Simple endpoint to verify the auth system is working.
    Doesn't require authentication - just checks if endpoints are accessible.
    """
    return {
        "status": "healthy",
        "message": "Authentication system is operational",
        "endpoints": {
            "login": "/auth/login",
            "logout": "/auth/logout",
            "user_info": "/auth/me"
        }
    }


# =============================================================================
# ERROR HANDLERS (ADVANCED)
# =============================================================================

# You could add custom error handlers here for more specific error responses
# For now, we handle errors within each endpoint function


# =============================================================================
# FUTURE ENDPOINTS (TODO)
# =============================================================================

# TODO: Add these endpoints as the application grows:

# @router.post("/refresh")
# async def refresh_access_token(refresh_data: RefreshTokenRequest):
#     """Get new access token using refresh token."""
#     pass

# @router.post("/forgot-password")
# async def request_password_reset(email: EmailStr):
#     """Request password reset email."""
#     pass

# @router.post("/reset-password")
# async def reset_password(reset_data: PasswordResetRequest):
#     """Reset password using reset token."""
#     pass

# @router.post("/change-password")
# async def change_password(password_data: ChangePasswordRequest, current_user = Depends(get_current_user)):
#     """Change password for authenticated user."""
#     pass


# =============================================================================
# UTILITY FUNCTIONS FOR DEPENDENCY INJECTION
# =============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency function to get current user from token.
    
    🎓 LEARNING: FastAPI Dependencies
    ================================
    This function can be used as a dependency in other endpoints:
    
    @router.get("/protected")
    async def protected_endpoint(current_user = Depends(get_current_user)):
        # current_user is automatically populated from the token
        return {"message": f"Hello {current_user.username}!"}
    
    FastAPI will automatically:
    1. Extract the Authorization header
    2. Validate the token
    3. Get the user from database
    4. Pass user object to the endpoint function
    
    If any step fails → automatic 401 error
    """
    token = credentials.credentials
    user = await get_current_user_from_token(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "invalid_token",
                "message": "Could not validate credentials"
            }
        )
    
    return user


async def get_current_admin_user(current_user = Depends(get_current_user)):
    """
    Dependency function to get current user and verify admin access.
    
    Use this for admin-only endpoints:
    
    @router.get("/admin/users")
    async def list_users(admin_user = Depends(get_current_admin_user)):
        # Only admins can reach this endpoint
        return {"users": [...]}
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "insufficient_permissions",
                "message": "Admin access required"
            }
        )
    
    return current_user
