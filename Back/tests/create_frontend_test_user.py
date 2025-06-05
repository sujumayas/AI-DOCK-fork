#!/usr/bin/env python3
"""
Quick script to create a test user for testing our frontend login.
Run this from the Back directory: python create_frontend_test_user.py
"""

import asyncio
import sys
from pathlib import Path

# Add the app directory to Python path so we can import our modules
sys.path.append(str(Path(__file__).parent / "app"))

from app.core.database import get_database_session
from app.core.security import hash_password
from app.models.user import User
from sqlalchemy import select


async def create_test_user():
    """Create a test user for frontend authentication testing."""
    
    # Test user credentials (use these in the frontend!)
    test_email = "test@aidock.com"
    test_password = "testpassword123"
    test_username = "testuser"
    
    async for session in get_database_session():
        try:
            # Check if test user already exists
            result = await session.execute(select(User).where(User.email == test_email))
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"✅ Test user already exists: {test_email}")
                print(f"🔑 Use password: {test_password}")
                print(f"👤 User ID: {existing_user.id}")
                print(f"🔐 Admin: {existing_user.is_admin}")
                
                # Check if password field is correct
                if hasattr(existing_user, 'password_hash') and existing_user.password_hash:
                    print(f"✅ Password hash field exists and is set")
                else:
                    print(f"❌ Password hash field missing or empty!")
                    
                return
            
            # Create new test user with correct field names
            hashed_password = hash_password(test_password)
            test_user = User(
                email=test_email,
                username=test_username,         # Required field
                full_name="Test User",          # Correct field name
                password_hash=hashed_password,  # Correct field name!
                is_active=True,
                is_verified=True,              # Set as verified
                is_admin=False
            )
            
            session.add(test_user)
            await session.commit()
            await session.refresh(test_user)
            
            print(f"🎉 Test user created successfully!")
            print(f"📧 Email: {test_email}")
            print(f"👤 Username: {test_username}")
            print(f"🔑 Password: {test_password}")
            print(f"🆔 User ID: {test_user.id}")
            print(f"🔐 Admin: {test_user.is_admin}")
            print(f"✅ Password hash: {test_user.password_hash[:20]}...")
            
        except Exception as e:
            print(f"❌ Error creating test user: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()
            break


if __name__ == "__main__":
    print("🔧 Creating test user for frontend authentication...")
    asyncio.run(create_test_user())
