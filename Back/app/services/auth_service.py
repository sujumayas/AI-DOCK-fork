"""
Authentication Service for AI Dock application.

This module contains all the BUSINESS LOGIC for authentication operations.
Think of this as the "brain" that knows HOW to authenticate users.

🎓 LEARNING: Service Layer Pattern
===============================
Why separate business logic from API endpoints?

API Endpoints (auth.py):
- Handle HTTP requests/responses
- Validate input data
- Return proper HTTP status codes
- Focus on "communication"

Services (this file):
- Handle business logic
- Database operations
- Complex calculations
- Focus on "what needs to happen"

This separation makes code:
- Easier to test (test business logic separately)
- More reusable (same logic can be used by API, CLI, background jobs)
- Cleaner and more maintainable
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Import our models, schemas, and utilities
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, UserInfo, TokenPayload
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.core.database import AsyncSessionLocal


# =============================================================================
# AUTHENTICATION BUSINESS LOGIC
# =============================================================================

class AuthenticationError(Exception):
    """
    Custom exception for authentication failures.
    
    Using custom exceptions makes error handling cleaner and more specific.
    Instead of generic "Exception", we can catch "AuthenticationError".
    """
    def __init__(self, message: str, error_code: str = "auth_failed"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


async def authenticate_user(login_data: LoginRequest) -> LoginResponse:
    """
    Main authentication function - handles the complete login process.
    
    This is the "entry point" for user authentication. It orchestrates
    all the steps needed to log someone in safely.
    
    Steps:
    1. Find user by email
    2. Verify password
    3. Check account status
    4. Create JWT tokens
    5. Update login timestamp
    6. Return success response
    
    Args:
        login_data: LoginRequest object with email and password
        
    Returns:
        LoginResponse with tokens and user info
        
    Raises:
        AuthenticationError: If authentication fails for any reason
    """
    
    # Step 1: Get a database session
    # This is how we connect to the database to query data
    async with AsyncSessionLocal() as db:
        
        # Step 2: Find the user by email
        user = await find_user_by_email(db, login_data.email)
        if not user:
            # Security: Don't reveal whether email exists or not
            # Always say "invalid credentials" to prevent email enumeration
            raise AuthenticationError(
                "Invalid email or password",
                "invalid_credentials"
            )
        
        # Step 3: Verify the password
        if not verify_password(login_data.password, user.password_hash):
            raise AuthenticationError(
                "Invalid email or password",
                "invalid_credentials"
            )
        
        # Step 4: Check if account is active
        if not user.is_active:
            raise AuthenticationError(
                "Account is deactivated. Please contact your administrator.",
                "account_inactive"
            )
        
        # Step 5: Create JWT tokens
        # Access token: short-lived, used for API requests
        # Refresh token: longer-lived, used to get new access tokens
        token_data = create_user_tokens(user)
        
        # Step 6: Update last login timestamp
        # This helps with analytics and security monitoring
        await update_last_login(db, user)
        
        # Step 7: Create user info for response (without sensitive data)
        user_info = create_user_info(user)
        
        # Step 8: Build and return successful login response
        return LoginResponse(
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            token_type="bearer",
            expires_in=token_data["expires_in"],
            user=user_info
        )


async def logout_user(user_id: int) -> Dict[str, str]:
    """
    Handle user logout.
    
    🎓 LEARNING: JWT Logout Challenges
    ================================
    JWT tokens are "stateless" - the server doesn't track them.
    This means we can't "delete" a token from the server side.
    
    For basic logout, we just return success and let the frontend
    delete the tokens from storage.
    
    For production apps, you might:
    - Keep a "blacklist" of revoked tokens
    - Use shorter token expiration times
    - Implement proper session management
    
    Args:
        user_id: ID of the user logging out
        
    Returns:
        Dict with logout success message
    """
    
    # In a more complex system, you might:
    # 1. Log the logout event for security monitoring
    # 2. Invalidate refresh tokens in a blacklist
    # 3. Clear any server-side session data
    
    # For now, we just return a success message
    # The frontend will delete the tokens from localStorage
    return {
        "message": "Successfully logged out",
        "logged_out_at": datetime.utcnow().isoformat()
    }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def find_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """
    Find a user by their email address.
    
    🎓 LEARNING: Database Queries with SQLAlchemy
    ============================================
    SQLAlchemy lets us write database queries using Python objects
    instead of raw SQL. This is safer and more maintainable.
    
    Raw SQL: SELECT * FROM users WHERE email = 'user@example.com'
    SQLAlchemy: db.query(User).filter(User.email == email).first()
    
    Args:
        db: Database session
        email: Email address to search for
        
    Returns:
        User object if found, None if not found
    """
    try:
        # Use SQLAlchemy to query the database
        # .filter() adds a WHERE clause
        # .first() returns the first match (or None if no matches)
        result = await db.execute(
            select(User).where(User.email == email.lower())
        )
        user = result.scalar_one_or_none()
        return user
    
    except Exception as e:
        # Log the error for debugging (in production, use proper logging)
        print(f"Database error in find_user_by_email: {e}")
        return None


def create_user_tokens(user: User) -> Dict[str, Any]:
    """
    Create access and refresh tokens for a user.
    
    🎓 LEARNING: JWT Token Strategy
    ==============================
    We create TWO tokens:
    
    Access Token (30 minutes):
    - Used for API requests
    - Contains user info (id, email, role)
    - Short-lived for security
    
    Refresh Token (7 days):
    - Used to get new access tokens
    - Contains minimal info (just user_id)
    - Longer-lived for convenience
    
    Args:
        user: User object to create tokens for
        
    Returns:
        Dict with access_token, refresh_token, and expires_in
    """
    
    # Prepare data to store in the access token
    access_token_data = {
        "user_id": user.id,
        "email": user.email,
        "role": "admin" if user.is_admin else "user",
        "username": user.username
    }
    
    # Prepare data for refresh token (minimal info for security)
    refresh_token_data = {
        "user_id": user.id,
        "token_type": "refresh"
    }
    
    # Create the tokens using our security utilities
    access_token = create_access_token(access_token_data)
    refresh_token = create_refresh_token(refresh_token_data)
    
    # Calculate expiration time in seconds (for frontend)
    expires_in = 30 * 60  # 30 minutes in seconds
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in
    }


async def update_last_login(db: AsyncSession, user: User) -> None:
    """
    Update the user's last login timestamp.
    
    This is useful for:
    - Analytics (when do users log in?)
    - Security (detect unusual login patterns)
    - User experience (show "Welcome back!" messages)
    
    Args:
        db: Database session
        user: User object to update
    """
    try:
        # Update the last_login_at field
        user.last_login_at = datetime.utcnow()
        
        # Commit the change to the database
        await db.commit()
        
    except Exception as e:
        # If update fails, rollback and log error
        await db.rollback()
        print(f"Error updating last login for user {user.id}: {e}")


def create_user_info(user: User) -> UserInfo:
    """
    Create a UserInfo object for API responses.
    
    🎓 LEARNING: Data Transfer Objects (DTOs)
    ========================================
    We don't send the raw User model to the frontend because:
    - It contains sensitive data (password_hash)
    - It has database-specific fields (SQLAlchemy metadata)
    - We want to control exactly what data is exposed
    
    UserInfo is a "clean" version with only safe, necessary data.
    
    Args:
        user: User model from database
        
    Returns:
        UserInfo object safe for API responses
    """
    return UserInfo(
        id=user.id,
        email=user.email,
        full_name=user.full_name or user.username,
        role="admin" if user.is_admin else "user",
        department=user.job_title,  # Using job_title as department for now
        is_active=user.is_active,
        is_admin=user.is_admin,  # Include the is_admin field
        created_at=user.created_at
    )


# =============================================================================
# TOKEN VALIDATION UTILITIES
# =============================================================================

async def get_current_user_from_token(token: str) -> Optional[User]:
    """
    Get the current user from a JWT token.
    
    This function will be used by protected endpoints to identify
    which user is making a request.
    
    🎓 LEARNING: Authentication vs Authorization
    ==========================================
    Authentication: "Who are you?" (login, verify identity)
    Authorization: "What can you do?" (check permissions)
    
    This function handles authentication - it tells us WHO is making
    the request based on their token.
    
    Args:
        token: JWT access token from Authorization header
        
    Returns:
        User object if token is valid, None if invalid
    """
    from app.core.security import verify_token
    
    try:
        # Step 1: Verify and decode the token
        token_data = verify_token(token)
        if not token_data:
            return None
        
        # Step 2: Extract user ID from token
        user_id = token_data.get("user_id")
        if not user_id:
            return None
        
        # Step 3: Find user in database
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            # Step 4: Verify user is still active
            if user and not user.is_active:
                return None
            
            return user
    
    except Exception as e:
        print(f"Error validating token: {e}")
        return None


def validate_refresh_token(refresh_token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a refresh token and extract user data.
    
    Used when the frontend sends a refresh token to get a new access token.
    
    Args:
        refresh_token: JWT refresh token
        
    Returns:
        Dict with user data if valid, None if invalid
    """
    from app.core.security import verify_token
    
    try:
        token_data = verify_token(refresh_token)
        if not token_data:
            return None
        
        # Verify this is actually a refresh token
        if token_data.get("token_type") != "refresh":
            return None
        
        return token_data
    
    except Exception as e:
        print(f"Error validating refresh token: {e}")
        return None


# =============================================================================
# VALIDATION AND UTILITY FUNCTIONS
# =============================================================================

def is_valid_email(email: str) -> bool:
    """
    Validate email format.
    
    Basic email validation - in production you'd use a more robust validator.
    """
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def is_strong_password(password: str) -> bool:
    """
    Check if password meets strength requirements.
    
    Current requirements:
    - At least 8 characters
    - Contains uppercase and lowercase letters
    - Contains at least one number
    
    You could expand this with more complex rules.
    """
    if len(password) < 8:
        return False
    
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    
    return has_upper and has_lower and has_digit
