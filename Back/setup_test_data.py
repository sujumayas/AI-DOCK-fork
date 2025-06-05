#!/usr/bin/env python3
"""
AI Dock - Test Data Setup Script (Updated for .dev emails)

This script creates test users, roles, and departments for testing our Admin API.
Run this script to populate your database with realistic test data.

Usage:
    python setup_test_data.py
"""

import asyncio
import sys
from pathlib import Path

# Add the app directory to the Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

from app.core.database import get_database_session, startup_database
from app.models.user import User
from app.models.role import Role, PermissionConstants
from app.models.department import Department
from app.core.security import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

async def create_test_data():
    """
    Create comprehensive test data for the Admin API.
    
    Creates:
    - Admin and User roles with proper permissions
    - Multiple departments (Engineering, Marketing, HR, Sales)
    - Test admin user (for API access)
    - Multiple test users with different roles and departments
    """
    print("🔧 Setting up test data for AI Dock Admin API...")
    
    # Initialize database
    await startup_database()
    
    # Get database session using async context manager
    async for db in get_database_session():
        await process_test_data(db)
        break  # Only process once

async def process_test_data(db: AsyncSession):
    try:
        # =============================================================================
        # 1. CREATE ROLES WITH PERMISSIONS
        # =============================================================================
        print("\n👤 Creating roles...")
        
        # Create Admin Role (all permissions)
        from sqlalchemy import select
        result = await db.execute(select(Role).filter(Role.name == "admin"))
        admin_role = result.scalar_one_or_none()
        if not admin_role:
            admin_role = Role(
                name="admin",
                display_name="System Administrator",
                description="Full system access with all administrative privileges",
                level=5,  # Highest level
                is_system_role=True,
                created_by="system",
                permissions={
                    PermissionConstants.CAN_VIEW_ADMIN_PANEL: True,
                    PermissionConstants.CAN_CREATE_USERS: True,
                    PermissionConstants.CAN_VIEW_USERS: True,
                    PermissionConstants.CAN_EDIT_USERS: True,
                    PermissionConstants.CAN_DELETE_USERS: True,
                    PermissionConstants.CAN_MANAGE_ROLES: True,
                    PermissionConstants.CAN_VIEW_DEPARTMENTS: True,
                    PermissionConstants.CAN_CREATE_DEPARTMENTS: True,
                    PermissionConstants.CAN_EDIT_DEPARTMENTS: True,
                    PermissionConstants.CAN_DELETE_DEPARTMENTS: True,
                    PermissionConstants.CAN_MANAGE_SYSTEM_SETTINGS: True,
                    PermissionConstants.CAN_CONFIGURE_AI_PROVIDERS: True,
                    PermissionConstants.CAN_VIEW_ALL_USAGE: True,
                    PermissionConstants.CAN_MANAGE_QUOTAS: True
                }
            )
            db.add(admin_role)
            await db.flush()  # Get the ID
            print("  ✅ Created: Admin Role")
        else:
            print("  ⚡ Admin role already exists")
        
        # Create Standard User Role (basic permissions)
        result = await db.execute(select(Role).filter(Role.name == "user"))
        user_role = result.scalar_one_or_none()
        if not user_role:
            user_role = Role(
                name="user",
                display_name="Standard User",
                description="Regular user with basic LLM access",
                level=2,  # Basic user level
                is_system_role=True,
                created_by="system",
                permissions={
                    PermissionConstants.CAN_USE_AI_CHAT: True,
                    PermissionConstants.CAN_ACCESS_AI_HISTORY: True
                }
            )
            db.add(user_role)
            await db.flush()  # Get the ID
            print("  ✅ Created: User Role")
        else:
            print("  ⚡ User role already exists")
        
        # Create Manager Role (department management)
        result = await db.execute(select(Role).filter(Role.name == "manager"))
        manager_role = result.scalar_one_or_none()
        if not manager_role:
            manager_role = Role(
                name="manager",
                display_name="Department Manager",
                description="Department manager with team oversight",
                level=4,  # Manager level
                is_system_role=True,
                created_by="system",
                permissions={
                    PermissionConstants.CAN_USE_AI_CHAT: True,
                    PermissionConstants.CAN_ACCESS_AI_HISTORY: True,
                    PermissionConstants.CAN_VIEW_USAGE_STATS: True,
                    PermissionConstants.CAN_MANAGE_DEPARTMENT_USERS: True
                }
            )
            db.add(manager_role)
            await db.flush()  # Get the ID
            print("  ✅ Created: Manager Role")
        else:
            print("  ⚡ Manager role already exists")
        
        await db.commit()
        
        # =============================================================================
        # 2. CREATE DEPARTMENTS
        # =============================================================================
        print("\n🏢 Creating departments...")
        
        departments_data = [
            {
                "name": "Engineering",
                "code": "ENG",
                "description": "Software development and technical operations",
                "monthly_budget": Decimal('10000.00'),
                "parent_id": None
            },
            {
                "name": "Frontend Development",
                "code": "FRONTEND",
                "description": "User interface and web development",
                "monthly_budget": Decimal('3000.00'),
                "parent_department": "Engineering"
            },
            {
                "name": "Backend Development",
                "code": "BACKEND",
                "description": "API and server-side development",
                "monthly_budget": Decimal('4000.00'),
                "parent_department": "Engineering"
            },
            {
                "name": "Marketing",
                "code": "MKT",
                "description": "Brand management and customer outreach",
                "monthly_budget": Decimal('5000.00'),
                "parent_id": None
            },
            {
                "name": "Content Creation",
                "code": "CONTENT",
                "description": "Content writing and creative marketing",
                "monthly_budget": Decimal('2500.00'),
                "parent_department": "Marketing"
            },
            {
                "name": "Human Resources",
                "code": "HR",
                "description": "People operations and talent management",
                "monthly_budget": Decimal('2000.00'),
                "parent_id": None
            },
            {
                "name": "Sales",
                "code": "SALES",
                "description": "Customer acquisition and business development",
                "monthly_budget": Decimal('3500.00'),
                "parent_id": None
            }
        ]
        
        created_departments = {}
        
        for dept_data in departments_data:
            result = await db.execute(select(Department).filter(Department.name == dept_data["name"]))
            existing_dept = result.scalar_one_or_none()
            if not existing_dept:
                # Handle parent department reference
                parent_id = dept_data.get("parent_id")
                if "parent_department" in dept_data:
                    parent_dept = created_departments.get(dept_data["parent_department"])
                    if parent_dept:
                        parent_id = parent_dept.id
                
                department = Department(
                    name=dept_data["name"],
                    code=dept_data["code"],
                    description=dept_data["description"],
                    monthly_budget=dept_data["monthly_budget"],
                    parent_id=parent_id,
                    created_by="system"
                )
                db.add(department)
                await db.flush()  # Get the ID without committing
                created_departments[dept_data["name"]] = department
                print(f"  ✅ Created: {dept_data['name']}")
            else:
                created_departments[dept_data["name"]] = existing_dept
                print(f"  ⚡ {dept_data['name']} already exists")
        
        await db.commit()
        
        # =============================================================================
        # 3. CREATE TEST USERS
        # =============================================================================
        print("\n👥 Creating test users...")
        
        # Refresh role objects after commit
        result = await db.execute(select(Role).filter(Role.name == "admin"))
        admin_role = result.scalar_one_or_none()
        result = await db.execute(select(Role).filter(Role.name == "user"))
        user_role = result.scalar_one_or_none()
        result = await db.execute(select(Role).filter(Role.name == "manager"))
        manager_role = result.scalar_one_or_none()
        
        # Test users data with .dev emails
        test_users_data = [
            {
                "username": "admin",
                "email": "admin@aidock.dev",
                "full_name": "System Administrator",
                "password": "admin123!",
                "role": admin_role,
                "department": created_departments["Engineering"],
                "job_title": "System Administrator",
                "phone": "+1-555-0001",
                "is_verified": True,
                "is_active": True
            },
            {
                "username": "john.doe",
                "email": "john.doe@aidock.dev",
                "full_name": "John Doe",
                "password": "user123",
                "role": manager_role,
                "department": created_departments["Engineering"],
                "job_title": "Engineering Manager",
                "phone": "+1-555-0002",
                "is_verified": True,
                "is_active": True
            },
            {
                "username": "jane.smith",
                "email": "jane.smith@aidock.dev",
                "full_name": "Jane Smith",
                "password": "user123",
                "role": user_role,
                "department": created_departments["Frontend Development"],
                "job_title": "Frontend Developer",
                "phone": "+1-555-0003",
                "is_verified": True,
                "is_active": True
            },
            {
                "username": "bob.wilson",
                "email": "bob.wilson@aidock.dev",
                "full_name": "Bob Wilson",
                "password": "user123",
                "role": user_role,
                "department": created_departments["Backend Development"],
                "job_title": "Senior Backend Developer",
                "phone": "+1-555-0004",
                "is_verified": True,
                "is_active": True
            },
            {
                "username": "alice.brown",
                "email": "alice.brown@aidock.dev",
                "full_name": "Alice Brown",
                "password": "user123",
                "role": manager_role,
                "department": created_departments["Marketing"],
                "job_title": "Marketing Director",
                "phone": "+1-555-0005",
                "is_verified": True,
                "is_active": True
            },
            {
                "username": "charlie.davis",
                "email": "charlie.davis@aidock.dev",
                "full_name": "Charlie Davis",
                "password": "user123",
                "role": user_role,
                "department": created_departments["Content Creation"],
                "job_title": "Content Writer",
                "phone": "+1-555-0006",
                "is_verified": True,
                "is_active": True
            },
            {
                "username": "diana.taylor",
                "email": "diana.taylor@aidock.dev",
                "full_name": "Diana Taylor",
                "password": "user123",
                "role": user_role,
                "department": created_departments["Human Resources"],
                "job_title": "HR Specialist",
                "phone": "+1-555-0007",
                "is_verified": True,
                "is_active": True
            },
            {
                "username": "inactive.user",
                "email": "inactive.user@aidock.dev",
                "full_name": "Inactive User",
                "password": "user123",
                "role": user_role,
                "department": created_departments["Sales"],
                "job_title": "Former Sales Rep",
                "phone": "+1-555-0008",
                "is_verified": False,
                "is_active": False  # Inactive for testing
            }
        ]
        
        users_created = 0
        for user_data in test_users_data:
            print(f"\n🔍 Processing user: {user_data['username']}")
            
            # Check if user already exists
            result = await db.execute(select(User).filter(User.username == user_data["username"]))
            existing_user = result.scalar_one_or_none()
            
            if not existing_user:
                print(f"  📝 Creating new user...")
                print(f"     Username: {user_data['username']}")
                print(f"     Email: {user_data['email']}")
                print(f"     Role: {user_data['role'].name}")
                print(f"     Department: {user_data['department'].name}")
                
                # Create password hash
                password_hash = get_password_hash(user_data["password"])
                print(f"  🔐 Password hashed successfully")
                
                user = User(
                    username=user_data["username"],
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    password_hash=password_hash,
                    role_id=user_data["role"].id,
                    department_id=user_data["department"].id,
                    job_title=user_data["job_title"],
                    phone=user_data["phone"],
                    is_verified=user_data["is_verified"],
                    is_active=user_data["is_active"],
                    is_admin=(user_data["role"].name == "admin")  # Set is_admin based on role
                )
                
                db.add(user)
                await db.flush()  # Get the user ID
                users_created += 1
                print(f"  ✅ Created: {user_data['full_name']} ({user_data['username']}) - ID: {user.id}")
            else:
                print(f"  ⚡ {user_data['full_name']} already exists - ID: {existing_user.id}")
        
        # Final commit for all users
        print(f"\n💾 Committing {users_created} new users to database...")
        await db.commit()
        print("✅ All users committed successfully!")
        
        # =============================================================================
        # 4. VERIFY DATA AND DISPLAY SUMMARY
        # =============================================================================
        print("\n🔍 Verifying created data...")
        
        from sqlalchemy import func
        
        result = await db.execute(select(func.count(User.id)))
        total_users = result.scalar()
        result = await db.execute(select(func.count(Role.id)))
        total_roles = result.scalar()
        result = await db.execute(select(func.count(Department.id)))
        total_departments = result.scalar()
        
        print("\n" + "="*60)
        print("🎉 TEST DATA SETUP COMPLETED!")
        print("="*60)
        
        print("\n📊 SUMMARY:")
        print(f"  👥 Users in database: {total_users}")
        print(f"  👤 Roles in database: {total_roles}")
        print(f"  🏢 Departments in database: {total_departments}")
        
        print("\n🔑 ADMIN LOGIN CREDENTIALS:")
        print("  Email: admin@aidock.dev")
        print("  Password: admin123!")
        
        print("\n🧪 READY FOR TESTING:")
        print("  1. Start the backend: python start_server.py")
        print("  2. Start the frontend: npm run dev (in Front directory)")
        print("  3. Visit: http://localhost:8080")
        print("  4. Login with admin credentials above")
        
        # List all users to verify they exist
        print("\n📋 AVAILABLE TEST USERS:")
        from sqlalchemy.orm import selectinload
        result = await db.execute(select(User).options(selectinload(User.role), selectinload(User.department)))
        users = result.scalars().all()
        
        if users:
            for user in users:
                status = "🟢 Active" if user.is_active else "🔴 Inactive"
                verified = "✅ Verified" if user.is_verified else "❌ Unverified"
                print(f"  {user.username} ({user.role.display_name}) - {status} {verified}")
                print(f"    Email: {user.email}")
                print(f"    Department: {user.department.name}")
                print("")
        else:
            print("  ⚠️  No users found in database!")
        
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error creating test data: {e}")
        import traceback
        traceback.print_exc()
        await db.rollback()
        raise

if __name__ == "__main__":
    # Run the async function
    asyncio.run(create_test_data())
