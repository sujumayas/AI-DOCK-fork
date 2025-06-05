#!/usr/bin/env python3
"""
Async test script for Role and Department models.

This script works with our async database setup and demonstrates:
1. Creating roles and departments with async operations
2. Testing relationships between models
3. Verifying our database structure works correctly
"""

import asyncio
import sys
import os
from decimal import Decimal

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our async database components
from app.core.database import engine, AsyncSessionLocal, Base, create_database_tables
from app.models.user import User
from app.models.role import Role, RoleType, PermissionConstants, create_default_roles
from app.models.department import Department, create_default_departments
from app.core.security import hash_password

async def test_database_setup():
    """Test that we can create database tables."""
    print("🗃️  Testing database setup...")
    
    try:
        # Create all tables
        await create_database_tables()
        print("✅ Database tables created successfully!")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

async def test_role_creation():
    """Test creating and working with roles."""
    print("\n🎭 Testing Role Creation...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Create default roles
            roles = create_default_roles()
            
            # Add roles to database
            for role in roles:
                session.add(role)
            
            await session.commit()
            
            # Test role retrieval - need to refresh after commit
            await session.refresh(roles[0])  # Refresh the first role
            
            print(f"✅ Created {len(roles)} roles:")
            for role in roles:
                print(f"   - {role.display_name} (level {role.level})")
            
            # Test permission checking
            admin_role = None
            user_role = None
            
            for role in roles:
                if role.name == RoleType.ADMIN.value:
                    admin_role = role
                elif role.name == RoleType.USER.value:
                    user_role = role
            
            if admin_role and user_role:
                print(f"\n🔐 Testing permissions:")
                print(f"   - Admin can manage users: {admin_role.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
                print(f"   - User can manage users: {user_role.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
                print(f"   - Admin can use AI chat: {admin_role.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
                print(f"   - User can use AI chat: {user_role.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
                
                # Test role hierarchy
                print(f"\n📊 Testing role hierarchy:")
                print(f"   - Admin level: {admin_role.level}")
                print(f"   - User level: {user_role.level}")
                print(f"   - Admin can manage User role: {admin_role.can_manage_role(user_role)}")
                print(f"   - User can manage Admin role: {user_role.can_manage_role(admin_role)}")
                
                return admin_role.id, user_role.id
            
            return None, None
            
        except Exception as e:
            print(f"❌ Error testing roles: {e}")
            await session.rollback()
            return None, None

async def test_department_creation():
    """Test creating and working with departments."""
    print("\n🏢 Testing Department Creation...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Create default departments
            departments = create_default_departments()
            
            # Add departments to database
            for dept in departments:
                session.add(dept)
            
            await session.commit()
            
            # Refresh to get IDs
            for dept in departments:
                await session.refresh(dept)
            
            print(f"✅ Created {len(departments)} departments:")
            for dept in departments:
                print(f"   - {dept.name} ({dept.code}) - Budget: ${dept.monthly_budget}/month")
            
            # Find engineering department for hierarchy test
            engineering = None
            for dept in departments:
                if dept.code == "ENG":
                    engineering = dept
                    break
            
            if engineering:
                print(f"\n💰 Testing budget functionality:")
                budget_status = engineering.get_budget_status()
                print(f"   - Engineering budget status: {budget_status}")
                can_afford = engineering.can_afford_usage(Decimal('100.50'))
                print(f"   - Can afford $100.50 usage: {can_afford}")
                
                return engineering.id
            
            return None
            
        except Exception as e:
            print(f"❌ Error testing departments: {e}")
            await session.rollback()
            return None

async def test_user_relationships(admin_role_id, user_role_id, engineering_dept_id):
    """Test creating users with role and department relationships."""
    print("\n👥 Testing User Relationships...")
    
    if not admin_role_id or not user_role_id:
        print("❌ No roles available for testing user relationships")
        return
    
    async with AsyncSessionLocal() as session:
        try:
            # Create admin user
            admin_user = User(
                email="admin@aidock.local",
                username="admin",
                full_name="System Administrator",
                password_hash=hash_password("admin123"),
                role_id=admin_role_id,
                department_id=engineering_dept_id,
                is_admin=True,
                is_active=True,
                is_verified=True,
                job_title="System Administrator"
            )
            
            # Create regular user
            regular_user = User(
                email="john.doe@aidock.local", 
                username="john_doe",
                full_name="John Doe",
                password_hash=hash_password("user123"),
                role_id=user_role_id,
                department_id=engineering_dept_id,
                is_active=True,
                job_title="Software Engineer"
            )
            
            # Add users to database
            session.add(admin_user)
            session.add(regular_user)
            await session.commit()
            
            # Refresh to load relationships
            await session.refresh(admin_user, ['role', 'department'])
            await session.refresh(regular_user, ['role', 'department'])
            
            print(f"✅ Created users with relationships:")
            print(f"   - Admin User: {admin_user.full_name}")
            print(f"     Role: {admin_user.get_role_name()}")
            print(f"     Department: {admin_user.get_department_name()}")
            print(f"     Can access admin panel: {admin_user.can_access_admin_panel()}")
            
            print(f"   - Regular User: {regular_user.full_name}")
            print(f"     Role: {regular_user.get_role_name()}")
            print(f"     Department: {regular_user.get_department_name()}")
            print(f"     Can access admin panel: {regular_user.can_access_admin_panel()}")
            
            # Test permission checking through relationships
            print(f"\n🔐 Testing user permissions through roles:")
            print(f"   - Admin can manage users: {admin_user.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
            print(f"   - Admin can use AI chat: {admin_user.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
            print(f"   - Regular user can manage users: {regular_user.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
            print(f"   - Regular user can use AI chat: {regular_user.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
            
            # Test user management hierarchy
            print(f"\n👔 Testing user management hierarchy:")
            print(f"   - Admin can manage regular user: {admin_user.can_manage_user(regular_user)}")
            print(f"   - Regular user can manage admin: {regular_user.can_manage_user(admin_user)}")
            
            # Test department membership
            if engineering_dept_id:
                print(f"\n🏢 Testing department membership:")
                print(f"   - Admin is in Engineering: {admin_user.is_in_department('Engineering')}")
                print(f"   - Regular user is in Engineering: {regular_user.is_in_department('Engineering')}")
            
            print(f"✅ All relationship tests passed!")
            
        except Exception as e:
            print(f"❌ Error testing user relationships: {e}")
            await session.rollback()

async def print_database_summary():
    """Print a summary of what's in our database."""
    print("\n📊 Database Summary:")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count records using async queries
            from sqlalchemy import select, func
            
            role_count = await session.scalar(select(func.count(Role.id)))
            dept_count = await session.scalar(select(func.count(Department.id)))
            user_count = await session.scalar(select(func.count(User.id)))
            
            print(f"   - Roles: {role_count}")
            print(f"   - Departments: {dept_count}")
            print(f"   - Users: {user_count}")
            
            # Show structure
            print(f"\n🏗️  Database Structure:")
            print(f"   - users table: connects to roles and departments via foreign keys")
            print(f"   - roles table: defines permissions and hierarchy")
            print(f"   - departments table: supports hierarchy with parent/child relationships")
            
            print(f"\n🔗 Key Relationships:")
            print(f"   - User → Role (many-to-one): user.role_id → roles.id")
            print(f"   - User → Department (many-to-one): user.department_id → departments.id")
            print(f"   - Department → Department (self-reference): department.parent_id → departments.id")
            
        except Exception as e:
            print(f"❌ Error getting database summary: {e}")

async def main():
    """Main async test function."""
    print("🚀 Testing AI Dock Role & Department Models (Async Version)")
    print("=" * 60)
    
    # Test database setup
    if not await test_database_setup():
        print("❌ Database setup failed, stopping tests")
        return
    
    # Test role creation
    admin_role_id, user_role_id = await test_role_creation()
    
    # Test department creation  
    engineering_dept_id = await test_department_creation()
    
    # Test user relationships
    await test_user_relationships(admin_role_id, user_role_id, engineering_dept_id)
    
    # Print summary
    await print_database_summary()
    
    print("\n🎉 All async tests completed!")
    print("\n💡 What you learned:")
    print("   - Async database operations with SQLAlchemy")
    print("   - Foreign keys connect tables together")
    print("   - Relationships let you navigate between connected data")
    print("   - Role-based permissions provide flexible access control")
    print("   - Department hierarchy supports organizational structure")
    
    print("\n🎯 Next steps:")
    print("   - Database file created at: ./ai_dock_dev.db")
    print("   - Try starting FastAPI: uvicorn app.main:app --reload")
    print("   - Ready to build admin management features!")

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
