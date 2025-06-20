# Backend Refactoring Example: FastAPI Routes

This example shows how to refactor a large FastAPI route file into smaller, organized modules.

## Before: users.py (500+ lines)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import bcrypt
import jwt
from pydantic import BaseModel, EmailStr

# Everything mixed in one file
router = APIRouter()

# Pydantic models mixed with routes
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    department: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    department: str
    created_at: datetime
    is_active: bool

class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

# Database models mixed in
class UserDB:
    def __init__(self, db: Session):
        self.db = db
    
    def get_by_email(self, email: str):
        return self.db.query(User).filter(User.email == email).first()
    
    def get_by_id(self, user_id: int):
        return self.db.query(User).filter(User.id == user_id).first()
    
    def create(self, user_data: dict):
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def update(self, user_id: int, user_data: dict):
        user = self.get_by_id(user_id)
        for key, value in user_data.items():
            setattr(user, key, value)
        self.db.commit()
        return user

# Utility functions mixed in
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(user_id: int) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

# Business logic mixed with routes
def validate_user_quota(user, requested_tokens: int) -> bool:
    current_usage = calculate_monthly_usage(user.id)
    return current_usage + requested_tokens <= user.token_quota

def calculate_monthly_usage(user_id: int) -> int:
    # Complex calculation logic here
    pass

# Routes with all logic embedded
@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    user_db = UserDB(db)
    if user_db.get_by_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = hash_password(user.password)
    
    # Create user
    user_data = user.dict()
    user_data['password'] = hashed_password
    del user_data['password']  # Don't include in response
    
    new_user = user_db.create(user_data)
    
    # Send welcome email
    send_welcome_email(new_user.email, new_user.name)
    
    # Log creation
    logger.info(f"New user created: {new_user.email}")
    
    return new_user

@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Check permissions
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )
    
    user_db = UserDB(db)
    user = user_db.get_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

# More routes...
```

## After: Refactored Structure

### Directory Structure:
```
app/
├── api/
│   └── routes/
│       └── users/
│           ├── __init__.py
│           ├── routes.py          # API endpoints only (80 lines)
│           ├── schemas.py         # Pydantic models
│           ├── services.py        # Business logic
│           └── dependencies.py    # Route dependencies
├── models/
│   └── user.py                   # SQLAlchemy models
├── repositories/
│   └── user_repository.py        # Database operations
├── core/
│   ├── security.py               # Auth utilities
│   └── config.py                 # Configuration
└── utils/
    └── email.py                  # Email utilities
```

### 1. schemas.py - Pydantic Models
```python
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str
    department: str

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class UserWithStats(UserResponse):
    total_tokens_used: int
    monthly_tokens_used: int
    tokens_remaining: int
```

### 2. repositories/user_repository.py - Database Operations
```python
from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.user import User

class UserRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email address"""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        """Get all users with pagination"""
        return self.db.query(User).offset(skip).limit(limit).all()
    
    def create(self, user_data: dict) -> User:
        """Create new user"""
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def update(self, user_id: int, user_data: dict) -> Optional[User]:
        """Update existing user"""
        user = self.get_by_id(user_id)
        if not user:
            return None
            
        for key, value in user_data.items():
            if value is not None:
                setattr(user, key, value)
                
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def delete(self, user_id: int) -> bool:
        """Delete user"""
        user = self.get_by_id(user_id)
        if not user:
            return False
            
        self.db.delete(user)
        self.db.commit()
        return True
```

### 3. services.py - Business Logic
```python
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories.user_repository import UserRepository
from app.core.security import hash_password, verify_password
from app.schemas.users import UserCreate, UserUpdate, UserResponse
from app.utils.email import send_welcome_email
from app.core.logging import logger

class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
    
    def create_user(self, user_data: UserCreate) -> UserResponse:
        """Create new user with validation and side effects"""
        # Check if user exists
        existing_user = self.user_repo.get_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Prepare user data
        user_dict = user_data.dict()
        user_dict['password'] = hash_password(user_data.password)
        
        # Create user
        new_user = self.user_repo.create(user_dict)
        
        # Side effects
        try:
            send_welcome_email(new_user.email, new_user.name)
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")
        
        logger.info(f"New user created: {new_user.email}")
        
        return UserResponse.from_orm(new_user)
    
    def get_user_by_id(self, user_id: int, requesting_user_id: int, is_admin: bool) -> UserResponse:
        """Get user with permission check"""
        # Check permissions
        if user_id != requesting_user_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this user"
            )
        
        # Get user
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse.from_orm(user)
    
    def update_user(self, user_id: int, user_data: UserUpdate, requesting_user_id: int, is_admin: bool) -> UserResponse:
        """Update user with permission check"""
        # Check permissions
        if user_id != requesting_user_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this user"
            )
        
        # Update user
        updated_user = self.user_repo.update(user_id, user_data.dict(exclude_unset=True))
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse.from_orm(updated_user)
    
    def validate_user_quota(self, user_id: int, requested_tokens: int) -> bool:
        """Check if user has enough tokens"""
        current_usage = self.calculate_monthly_usage(user_id)
        user = self.user_repo.get_by_id(user_id)
        return current_usage + requested_tokens <= user.token_quota
    
    def calculate_monthly_usage(self, user_id: int) -> int:
        """Calculate user's monthly token usage"""
        # Implementation here
        pass
```

### 4. routes.py - Clean API Endpoints (Now Only 80 Lines!)
```python
from fastapi import APIRouter, Depends, status
from typing import List

from app.schemas.users import UserCreate, UserUpdate, UserResponse
from app.services.users import UserService
from app.api.dependencies import get_db, get_current_user
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    service: UserService = Depends(lambda db=Depends(get_db): UserService(db))
):
    """Create a new user"""
    return service.create_user(user_data)

@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(lambda db=Depends(get_db): UserService(db))
):
    """Get user by ID"""
    return service.get_user_by_id(
        user_id=user_id,
        requesting_user_id=current_user.id,
        is_admin=current_user.role == "admin"
    )

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(lambda db=Depends(get_db): UserService(db))
):
    """Update user information"""
    return service.update_user(
        user_id=user_id,
        user_data=user_data,
        requesting_user_id=current_user.id,
        is_admin=current_user.role == "admin"
    )

@router.get("/", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(lambda db=Depends(get_db): UserService(db))
):
    """List all users (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return service.list_users(skip=skip, limit=limit)
```

### 5. core/security.py - Security Utilities
```python
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import settings

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(
        password.encode('utf-8'), 
        bcrypt.gensalt()
    ).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS)
    
    payload = {
        'user_id': user_id,
        'exp': expire,
        'iat': datetime.utcnow()
    }
    
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None
```

## Benefits of Backend Refactoring

1. **Clear Separation**: Routes, business logic, and data access are separated
2. **Testability**: Can mock repositories and test services independently
3. **Reusability**: Services can be used in multiple routes or background tasks
4. **Maintainability**: Easy to find and modify specific functionality
5. **Scalability**: Can easily add new endpoints without bloating files
6. **Type Safety**: Clear interfaces between layers
7. **Error Handling**: Centralized in services
8. **Security**: Authentication/authorization logic is centralized

## Key Patterns Applied

- **Repository Pattern**: Database operations isolated from business logic
- **Service Layer**: Business logic separated from HTTP concerns
- **Dependency Injection**: Easy to test and mock dependencies
- **Single Responsibility**: Each module has one clear purpose
- **DRY**: Shared utilities and configurations
- **Clean Architecture**: Clear boundaries between layers
