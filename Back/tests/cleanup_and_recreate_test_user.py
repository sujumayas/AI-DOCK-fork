#!/usr/bin/env python3
"""
Script to clean up the test user and recreate it with correct field names.
Run this from the Back directory: python cleanup_and_recreate_test_user.py
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


async def cleanup_and_recreate_test_user():
    """Delete existing test user and create a new one with correct fields."""
    
    # Test user credentials
    test_email = "test@aidock.com"
    test_password = "testpassword123"
    test_username = "testuser"
    
    async for session in get_database_session():
        try:
            # Step 1: Delete existing test user if it exists
            result = await session.execute(select(User).where(User.email == test_email))
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"🗑️ Deleting existing test user: {test_email}")
                await session.delete(existing_user)
                await session.commit()
                print(f"✅ Existing user deleted")
            
            # Step 2: Create new test user with correct field names
            print(f"🔧 Creating new test user with correct fields...")
            hashed_password = hash_password(test_password)
            
            test_user = User(
                email=test_email,
                username=test_username,         # Required field
                full_name="Test User",          # Correct field name
                password_hash=hashed_password,  # Correct field name!
                is_active=True,
                is_verified=True,              # Set as verified
                is_admin=False,
                job_title="Test Role"
            )
            
            session.add(test_user)
            await session.commit()
            await session.refresh(test_user)
            
            print(f"🎉 New test user created successfully!")
            print(f"📧 Email: {test_email}")
            print(f"👤 Username: {test_username}")
            print(f"🔑 Password: {test_password}")
            print(f"🆔 User ID: {test_user.id}")
            print(f"🔐 Admin: {test_user.is_admin}")
            print(f"✅ Active: {test_user.is_active}")
            print(f"✅ Verified: {test_user.is_verified}")
            print(f"✅ Password hash field: password_hash")
            
            # Verify the password works
            from app.core.security import verify_password
            password_valid = verify_password(test_password, test_user.password_hash)
            print(f"✅ Password verification test: {'PASS' if password_valid else 'FAIL'}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()
            break


if __name__ == "__main__":
    print("🔧 Cleaning up and recreating test user...")
    asyncio.run(cleanup_and_recreate_test_user())
