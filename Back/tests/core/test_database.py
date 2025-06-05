# Database Test Script
# This script tests our database connection and User model

import asyncio
import sys
import os

# Add the project root to Python path so we can import our modules
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.config import settings, validate_config
from app.core.database import (
    startup_database, 
    check_database_connection,
    get_database_session,
    create_database_tables
)
from app.models.user import User, create_sample_user

async def test_database_setup():
    """
    Test our database configuration and User model.
    This verifies everything is working correctly.
    """
    print("🧪 Testing AI Dock Database Setup")
    print("=" * 50)
    
    # Test 1: Configuration
    print("\n1. Testing Configuration...")
    try:
        validate_config()
        print(f"   ✅ Configuration valid")
        print(f"   📍 Database URL: {settings.database_url}")
        print(f"   🔧 Environment: {settings.environment}")
    except Exception as e:
        print(f"   ❌ Configuration error: {e}")
        return False
    
    # Test 2: Database Connection
    print("\n2. Testing Database Connection...")
    try:
        connection_ok = await check_database_connection()
        if connection_ok:
            print("   ✅ Database connection successful")
        else:
            print("   ❌ Database connection failed")
            return False
    except Exception as e:
        print(f"   ❌ Database connection error: {e}")
        return False
    
    # Test 3: Table Creation
    print("\n3. Creating Database Tables...")
    try:
        await create_database_tables()
        print("   ✅ Database tables created successfully")
    except Exception as e:
        print(f"   ❌ Table creation error: {e}")
        return False
    
    # Test 4: User Model Creation
    print("\n4. Testing User Model...")
    try:
        # Create a sample user object (not saved to database yet)
        test_user = create_sample_user()
        print(f"   ✅ User object created: {test_user}")
        print(f"   📧 Email: {test_user.email}")
        print(f"   👤 Username: {test_user.username}")
        print(f"   🏷️  Display Name: {test_user.display_name}")
        print(f"   👑 Is Admin: {test_user.is_admin}")
        print(f"   ✅ Can Access Admin: {test_user.can_access_admin_panel()}")
    except Exception as e:
        print(f"   ❌ User model error: {e}")
        return False
    
    # Test 5: Database Session
    print("\n5. Testing Database Session...")
    try:
        async for session in get_database_session():
            # Test that we can get a database session
            print("   ✅ Database session created successfully")
            break
    except Exception as e:
        print(f"   ❌ Database session error: {e}")
        return False
    
    # Test 6: User Model Validation
    print("\n6. Testing User Model Validation...")
    try:
        test_user = User(
            email="test@company.com",
            username="test_user",
            full_name="Test User"
        )
        
        print(f"   ✅ Email validation: {test_user.validate_email_format()}")
        print(f"   ✅ Username validation: {test_user.validate_username_format()}")
        print(f"   ✅ Is new user: {test_user.is_new_user}")
        print(f"   ✅ Account age: {test_user.account_age_days} days")
    except Exception as e:
        print(f"   ❌ Validation error: {e}")
        return False
    
    print("\n🎉 All tests passed! Database setup is working correctly.")
    print("\n📋 Summary:")
    print(f"   • Configuration: Valid")
    print(f"   • Database: Connected ({settings.database_url})")
    print(f"   • Tables: Created successfully")
    print(f"   • User Model: Working correctly")
    print(f"   • Sessions: Working correctly")
    
    return True

async def show_database_info():
    """Display information about our database setup."""
    print("\n📊 Database Information:")
    print("=" * 30)
    print(f"Database URL: {settings.database_url}")
    print(f"Async URL: {settings.async_database_url}")
    print(f"Environment: {settings.environment}")
    print(f"Debug Mode: {settings.debug}")
    
    # Show User model information
    print(f"\n📋 User Model Info:")
    print(f"Table Name: {User.__tablename__}")
    print(f"Columns: {list(User.__table__.columns.keys())}")

if __name__ == "__main__":
    async def main():
        """Run all database tests."""
        await show_database_info()
        success = await test_database_setup()
        
        if success:
            print("\n🚀 Ready to start building the authentication system!")
        else:
            print("\n❌ Please fix the errors above before continuing.")
    
    # Run the async main function
    asyncio.run(main())
