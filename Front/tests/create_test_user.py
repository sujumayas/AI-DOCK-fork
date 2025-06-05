#!/usr/bin/env python3
"""
Create a test user for authentication testing.

This script creates a test user in the database so we can test our login endpoints.
Run this once before testing the authentication API.

🎓 LEARNING: Database Seeding
============================
In real applications, you often need "seed data" - initial users, settings, etc.
This script is a simple example of database seeding for development.
"""

import asyncio
import sys
import os
from datetime import datetime, UTC

# Add the project root to the path so we can import our app modules
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.database import AsyncSessionLocal, startup_database
from app.models.user import User
from app.core.security import hash_password


async def create_test_user():
    """
    Create a test user in the database.
    
    This user will be used to test our authentication endpoints:
    - Email: test@aidock.com
    - Password: TestPassword123!
    - Role: Regular user (not admin)
    """
    
    print("🔐 Creating Test User for AI Dock Authentication")
    print("=" * 50)
    
    # Initialize database connection
    try:
        await startup_database()
        print("✅ Database connection established")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False
    
    # Test user data
    test_email = "test@aidock.com"
    test_password = "TestPassword123!"
    test_username = "testuser"
    test_full_name = "Test User"
    
    print(f"\n👤 Creating user:")
    print(f"   Email: {test_email}")
    print(f"   Username: {test_username}")
    print(f"   Password: {test_password}")
    print(f"   Full Name: {test_full_name}")
    
    try:
        async with AsyncSessionLocal() as db:
            # Check if user already exists
            from sqlalchemy import select
            result = await db.execute(
                select(User).where(User.email == test_email)
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"\n⚠️  User with email {test_email} already exists!")
                print("   Updating password for existing user...")
                
                # Update existing user's password
                existing_user.password_hash = hash_password(test_password)
                existing_user.updated_at = datetime.now(UTC)
                await db.commit()
                
                print("✅ Existing user password updated successfully!")
                return True
            
            # Create new user
            hashed_password = hash_password(test_password)
            
            new_user = User(
                username=test_username,
                email=test_email,
                full_name=test_full_name,
                password_hash=hashed_password,
                is_active=True,
                is_admin=False,
                is_verified=True,  # Skip email verification for testing
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC)
            )
            
            # Add to database
            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)
            
            print(f"\n✅ Test user created successfully!")
            print(f"   User ID: {new_user.id}")
            print(f"   Created at: {new_user.created_at}")
            
    except Exception as e:
        print(f"\n❌ Error creating test user: {e}")
        return False
    
    print("\n🎯 Test User Ready!")
    print("=" * 50)
    print("You can now test the login endpoint with:")
    print(f"  Email: {test_email}")
    print(f"  Password: {test_password}")
    print("\nTry this curl command:")
    print(f"""
curl -X POST http://localhost:8000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{{"email": "{test_email}", "password": "{test_password}"}}'
""")
    
    return True


async def create_admin_user():
    """
    Create an admin test user as well.
    """
    
    print("\n👑 Creating Admin User...")
    
    admin_email = "admin@aidock.com"
    admin_password = "AdminPassword123!"
    admin_username = "admin"
    admin_full_name = "Admin User"
    
    try:
        async with AsyncSessionLocal() as db:
            # Check if admin already exists
            from sqlalchemy import select
            result = await db.execute(
                select(User).where(User.email == admin_email)
            )
            existing_admin = result.scalar_one_or_none()
            
            if existing_admin:
                print(f"⚠️  Admin user already exists, updating password...")
                existing_admin.password_hash = hash_password(admin_password)
                existing_admin.updated_at = datetime.now(UTC)
                await db.commit()
                print("✅ Admin password updated!")
                return True
            
            # Create admin user
            hashed_password = hash_password(admin_password)
            
            admin_user = User(
                username=admin_username,
                email=admin_email,
                full_name=admin_full_name,
                password_hash=hashed_password,
                is_active=True,
                is_admin=True,  # This makes them an admin
                is_verified=True,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC)
            )
            
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            
            print(f"✅ Admin user created successfully!")
            print(f"   Admin ID: {admin_user.id}")
            print(f"   Email: {admin_email}")
            print(f"   Password: {admin_password}")
            
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False
    
    return True


async def main():
    """Main function to create test users."""
    print("🏗️  Setting up test users for AI Dock authentication testing...\n")
    
    # Create regular test user
    user_success = await create_test_user()
    
    # Create admin test user
    admin_success = await create_admin_user()
    
    if user_success and admin_success:
        print("\n🎉 All test users created successfully!")
        print("\n📝 Available test accounts:")
        print("   Regular User: test@aidock.com / TestPassword123!")
        print("   Admin User:   admin@aidock.com / AdminPassword123!")
        print("\n🚀 Ready to test authentication endpoints!")
    else:
        print("\n❌ Some users failed to create. Check the errors above.")


if __name__ == "__main__":
    asyncio.run(main())
