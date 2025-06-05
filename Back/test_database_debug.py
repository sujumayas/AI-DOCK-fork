#!/usr/bin/env python3
"""
Quick database test script to debug the admin user search issue.
"""

import sys
import os
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.database import get_sync_session, create_database_tables_sync
from app.models.user import User
from app.models.role import Role, create_default_roles
from app.models.department import Department, create_default_departments
from app.core.security import get_password_hash

def test_database():
    """Test database connection and basic operations."""
    print("🔍 Testing AI Dock Database...")
    
    # Get a database session
    session = get_sync_session()
    
    try:
        # Test basic connection
        print("✅ Database connection successful")
        
        # Check if tables exist by trying to query them
        print("\n📊 Checking database tables...")
        
        # Check roles
        role_count = session.query(Role).count()
        print(f"   Roles: {role_count}")
        
        # Check departments
        dept_count = session.query(Department).count()
        print(f"   Departments: {dept_count}")
        
        # Check users
        user_count = session.query(User).count()
        print(f"   Users: {user_count}")
        
        # If no data, create test data
        if role_count == 0:
            print("\n🔧 Creating default roles...")
            default_roles = create_default_roles()
            for role in default_roles:
                session.add(role)
            session.commit()
            print(f"   Created {len(default_roles)} roles")
        
        if dept_count == 0:
            print("\n🔧 Creating default departments...")
            default_depts = create_default_departments()
            for dept in default_depts:
                session.add(dept)
            session.commit()
            print(f"   Created {len(default_depts)} departments")
        
        if user_count == 0:
            print("\n🔧 Creating test admin user...")
            
            # Get admin role and engineering department
            admin_role = session.query(Role).filter(Role.name == 'admin').first()
            eng_dept = session.query(Department).filter(Department.code == 'ENG').first()
            
            if admin_role and eng_dept:
                admin_user = User(
                    email="admin@aidock.local",
                    username="admin",
                    full_name="AI Dock Administrator",
                    password_hash=get_password_hash("admin123"),
                    role_id=admin_role.id,
                    department_id=eng_dept.id,
                    is_admin=True,
                    is_active=True,
                    is_verified=True,
                    job_title="System Administrator"
                )
                session.add(admin_user)
                session.commit()
                print("   Created admin user")
            else:
                print("   ❌ Could not create admin user - missing role or department")
        
        # Test the search functionality
        print("\n🔍 Testing user search functionality...")
        
        # Get all users
        all_users = session.query(User).all()
        print(f"   Found {len(all_users)} users")
        
        for user in all_users:
            print(f"     - {user.username} ({user.email}) - Role: {user.role.name if user.role else 'None'}")
        
        # Test search with filters like the admin API does
        print("\n🔍 Testing search with filters (like admin API)...")
        from app.schemas.admin import UserSearchFilters
        from app.services.admin_service import AdminService
        
        admin_service = AdminService(session)
        
        # Test the exact search that's failing
        filters = UserSearchFilters(
            page=1,
            page_size=20,
            sort_by="created_at",
            sort_order="desc",
            is_active=False  # This is what the frontend is searching for
        )
        
        result = admin_service.search_users(filters)
        print(f"   Search result: {result.total_count} users found")
        print(f"   Users: {[u.username for u in result.users]}")
        
        print("\n✅ Database test completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Database test failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        session.close()

if __name__ == "__main__":
    # Create tables first
    create_database_tables_sync()
    
    # Run the test
    test_database()
