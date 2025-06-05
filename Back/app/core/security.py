"""
Security utilities for the AI Dock application.

This module handles:
- Password hashing and verification (using bcrypt)
- JWT token creation and validation
- Security constants and configuration
"""

from datetime import datetime, timedelta
from typing import Optional, Union
from passlib.context import CryptContext
import jwt
from jwt.exceptions import InvalidTokenError
from app.core.config import settings
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

# We'll import get_db when needed to avoid circular imports


# =============================================================================
# PASSWORD HASHING SETUP
# =============================================================================

# Create a password context using bcrypt
# This is the modern way to handle password hashing in Python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# =============================================================================
# PASSWORD SECURITY FUNCTIONS
# =============================================================================

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Why bcrypt?
    - It's designed specifically for passwords (unlike SHA-256)
    - It includes a built-in salt (prevents rainbow table attacks)
    - It's slow by design (makes brute force attacks impractical)
    - It automatically handles complexity increases over time
    
    Args:
        password: The plain text password to hash
        
    Returns:
        A bcrypt hash string (includes salt + hash in one string)
        
    Example:
        hashed = hash_password("mypassword123")
        # Returns something like: "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"
    """
    # Use passlib's context - it handles all the bcrypt complexity for us
    # This is cleaner and more secure than using bcrypt directly
    return pwd_context.hash(password)


# Alias for backward compatibility and consistent naming
get_password_hash = hash_password


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    This is how we check if a user's login password is correct.
    We take their input, hash it the same way, and compare to stored hash.
    
    Args:
        password: The plain text password (from user input)
        hashed_password: The stored hash from database
        
    Returns:
        True if password matches, False otherwise
        
    Example:
        is_valid = verify_password("mypassword123", stored_hash)
        if is_valid:
            print("Login successful!")
        else:
            print("Wrong password!")
    """
    try:
        # passlib's verify method handles all the complexity
        # It extracts the salt, rehashes, and compares automatically
        return pwd_context.verify(password, hashed_password)
    
    except Exception as e:
        # If anything goes wrong (corrupt hash, etc.), deny access
        print(f"Password verification error: {e}")
        return False


# =============================================================================
# JWT TOKEN FUNCTIONS
# =============================================================================

# JWT Configuration
ALGORITHM = "HS256"  # HMAC with SHA-256 - secure and fast
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # Short-lived for security
REFRESH_TOKEN_EXPIRE_DAYS = 7     # Longer-lived for convenience


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Access tokens are short-lived (30 minutes) and used for API requests.
    They contain user information and expiration time.
    
    Args:
        data: Dictionary of data to encode in token (usually user_id, email, role)
        expires_delta: Optional custom expiration time
        
    Returns:
        JWT token string
        
    Example:
        token = create_access_token({"user_id": 123, "email": "user@company.com"})
        # Returns: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add expiration to token data
    to_encode.update({"exp": expire})
    
    # Create and return the token
    # settings.secret_key is used to sign the token (like a digital signature)
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Create a JWT refresh token.
    
    Refresh tokens are longer-lived (7 days) and used to get new access tokens
    without requiring the user to log in again.
    
    Args:
        data: Dictionary of data to encode (usually just user_id)
        
    Returns:
        JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "token_type": "refresh"})
    
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """
    Verify and decode a JWT token.
    
    This function checks if a token is valid and returns the data inside it.
    Used to authenticate API requests.
    
    Args:
        token: JWT token string to verify
        
    Returns:
        Dictionary with token data if valid, None if invalid
        
    Example:
        token_data = verify_token("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...")
        if token_data:
            user_id = token_data["user_id"]
            print(f"Valid token for user {user_id}")
        else:
            print("Invalid token!")
    """
    try:
        # Decode and verify the token
        # This checks the signature and expiration automatically
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    
    except jwt.ExpiredSignatureError:
        # Token has expired
        print("Token has expired")
        return None
    
    except jwt.InvalidTokenError:
        # Token is invalid (bad signature, malformed, etc.)
        print("Invalid token")
        return None
    
    except Exception as e:
        # Any other error
        print(f"Token verification error: {e}")
        return None


def decode_token_without_verification(token: str) -> Optional[dict]:
    """
    Decode a JWT token without verifying it.
    
    ONLY use this for debugging or when you need to inspect expired tokens.
    Never use this for authentication!
    
    Args:
        token: JWT token string
        
    Returns:
        Dictionary with token data (unverified!)
    """
    try:
        # Decode without verification - for debugging only!
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload
    except Exception as e:
        print(f"Token decode error: {e}")
        return None


# =============================================================================
# FASTAPI AUTHENTICATION DEPENDENCIES
# =============================================================================

# HTTP Bearer security scheme
# This tells FastAPI to look for "Bearer <token>" in the Authorization header
security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> "User":
    """
    FastAPI dependency to get the current authenticated user.
    
    This function is automatically called on any endpoint that uses:
    `current_user: User = Depends(get_current_user)`
    
    How it works:
    1. FastAPI extracts the Authorization header: "Bearer <jwt_token>"
    2. We validate the token and get the user data
    3. We look up the full user in the database
    4. We return the User object for use in the endpoint
    
    Args:
        credentials: JWT token from Authorization header (injected by FastAPI)
        
    Returns:
        User object from database
        
    Raises:
        HTTPException: 401 if token is invalid/missing or user not found
        
    Example endpoint usage:
    ```python
    @app.get("/protected")
    def protected_route(current_user: User = Depends(get_current_user)):
        return {"message": f"Hello {current_user.username}!"}
    ```
    
    Learning: This is a "dependency injection" pattern. FastAPI automatically
    calls this function before your endpoint and passes the result as a parameter.
    This keeps authentication logic centralized and reusable!
    """
    # Import here to avoid circular imports
    # (User model imports security, so we can't import User at module level)
    from ..models.user import User
    from ..core.database import get_db
    
    # Get database session
    db = next(get_db())
    
    try:
        # Extract the token from the credentials
        token = credentials.credentials
        
        # Verify and decode the token
        token_data = verify_token(token)
        
        if not token_data:
            # Token is invalid, expired, or malformed
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},  # Tells client to use Bearer auth
            )
        
        # Extract user information from token
        user_id = token_data.get("user_id")
        if not user_id:
            # Token doesn't contain user_id
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format: missing user_id",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Look up the user in the database
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            # User doesn't exist in database (maybe deleted after token was issued)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            # User account has been deactivated
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Success! Return the authenticated user
        return user
        
    except HTTPException:
        # Re-raise HTTP exceptions (don't wrap them)
        raise
        
    except Exception as e:
        # Any other error (database connection, etc.)
        print(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> "User":
    """
    FastAPI dependency to get the current authenticated ADMIN user.
    
    This function is like get_current_user but adds an extra check:
    the user must have admin role to access the endpoint.
    
    How it works:
    1. First authenticates the user (same as get_current_user)
    2. Then checks if the user has admin role
    3. Raises 403 Forbidden if user is not an admin
    
    Args:
        credentials: JWT token from Authorization header (injected by FastAPI)
        
    Returns:
        User object from database (guaranteed to be an admin)
        
    Raises:
        HTTPException: 401 if token is invalid/missing or user not found
        HTTPException: 403 if user is not an admin
        
    Example endpoint usage:
    ```python
    @app.get("/admin/users")
    def admin_only_route(current_admin: User = Depends(get_current_admin_user)):
        return {"message": f"Hello admin {current_admin.username}!"}
    ```
    
    Learning: This is the "dependency injection" pattern again, but with
    role-based access control (RBAC). Only admins can access these endpoints!
    """
    # First, get the current user using the standard authentication
    # This handles all the token validation and user lookup
    current_user = get_current_user(credentials)
    
    # Now check if this user has admin privileges
    if not current_user.is_admin:
        # User is authenticated but not an admin
        # Return 403 Forbidden instead of 401 Unauthorized
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    # User is authenticated AND is an admin
    return current_user


def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional["User"]:
    """
    Optional version of get_current_user.
    
    This dependency returns the user if authenticated, or None if not.
    Useful for endpoints that work differently for authenticated vs anonymous users.
    
    Args:
        credentials: Optional JWT token from Authorization header
        
    Returns:
        User object if authenticated, None if not
        
    Example:
    ```python
    @app.get("/optional-auth")
    def optional_route(user: Optional[User] = Depends(get_optional_user)):
        if user:
            return {"message": f"Hello {user.username}!"}
        else:
            return {"message": "Hello anonymous user!"}
    ```
    
    Learning: This pattern is useful for public endpoints that show
    different content for logged-in users.
    """
    
    if not credentials:
        return None
        
    try:
        # Try to get the user using the same logic as get_current_user
        # but return None instead of raising exceptions
        from ..models.user import User
        from ..core.database import get_db
        
        # Get database session
        db = next(get_db())
        
        token = credentials.credentials
        token_data = verify_token(token)
        
        if not token_data:
            return None
            
        user_id = token_data.get("user_id")
        if not user_id:
            return None
            
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user or not user.is_active:
            return None
            
        return user
        
    except Exception:
        # If anything goes wrong, just return None
        return None
