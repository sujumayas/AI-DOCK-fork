#!/usr/bin/env python3
"""
Create Admin User Script

This script creates an admin user for the AI Dock application.
Perfect for setting up your first admin account!

Usage:
    python scripts/create_admin_user.py
"""

import sys
import asyncio
from pathlib import Path

# Add the parent directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import engine, create_database_tables
from app.models.user import User
from app.models.role import Role
from app.models.department import Department
from app.core.security import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_default_roles():
    """Create default system roles if they don't exist."""
    
    async with AsyncSession(engine) as session:
        
        print("🏷️  Creating default roles...")
        
        # Check if roles already exist
        existing_roles = await session.execute(select(Role))
        role_names = {role.name for role in existing_roles.scalars()}
        
        default_roles = [
            {
                "name": "admin",
                "display_name": "Administrator",
                "level": 100,
                "is_system_role": True,
                "permissions": {
                    "can_manage_users": True,
                    "can_manage_departments": True,
                    "can_manage_roles": True,
                    "can_view_all_usage": True,
                    "can_manage_quotas": True,
                    "can_configure_llms": True,
                    "can_access_admin_panel": True,
                    "can_use_llms": True
                }
            },
            {
                "name": "user",
                "display_name": "Standard User", 
                "level": 10,
                "is_system_role": True,
                "permissions": {
                    "can_use_llms": True,
                    "can_view_own_usage": True
                }
            }
        ]
        
        created_roles = {}
        
        for role_data in default_roles:
            if role_data["name"] not in role_names:
                role = Role(**role_data)
                session.add(role)
                created_roles[role_data["name"]] = role
                print(f"   ✅ Created role: {role_data['display_name']}")
            else:
                # Get existing role
                existing_role = await session.execute(
                    select(Role).where(Role.name == role_data["name"])
                )
                created_roles[role_data["name"]] = existing_role.scalar_one()
                print(f"   ℹ️  Role already exists: {role_data['display_name']}")
        
        await session.commit()
        return created_roles

async def create_default_department():
    """Create a default department if none exists."""
    
    async with AsyncSession(engine) as session:
        
        print("🏢 Creating default department...")
        
        # Check if any departments exist
        existing_dept = await session.execute(select(Department))
        departments = list(existing_dept.scalars())
        
        if not departments:
            department = Department(
                name="Technology",
                code="TECH",
                description="Technology and IT Department",
                monthly_budget=10000.00,
                cost_center="TECH-001",
                manager_email="admin@aidock.local",
                location="Main Office"
            )
            session.add(department)
            await session.commit()
            print("   ✅ Created default department: Technology")
            return department
        else:
            print(f"   ℹ️  Department already exists: {departments[0].name}")
            return departments[0]

async def create_admin_user():
    """Create an admin user."""
    
    async with AsyncSession(engine) as session:
        
        print("👑 Creating admin user...")
        
        # Check if admin user already exists (check both email AND username)
        admin_email_check = await session.execute(
            select(User).where(User.email == "admin@aidock.local")
        )
        existing_admin_by_email = admin_email_check.scalar_one_or_none()
        
        admin_username_check = await session.execute(
            select(User).where(User.username == "admin")
        )
        existing_admin_by_username = admin_username_check.scalar_one_or_none()
        
        # If admin exists by email, use that one
        if existing_admin_by_email:
            print("   ℹ️  Admin user already exists (by email)!")
            print(f"   📧 Email: {existing_admin_by_email.email}")
            print(f"   👤 Username: {existing_admin_by_email.username}")
            print(f"   🔓 Status: {'Active' if existing_admin_by_email.is_active else 'Inactive'}")
            return existing_admin_by_email
            
        # If admin exists by username, show info and create with different username
        if existing_admin_by_username:
            print("   ⚠️  Username 'admin' already exists!")
            print(f"   👤 Existing user: {existing_admin_by_username.username} ({existing_admin_by_username.email})")
            print("   🔄 Creating admin user with username 'sysadmin' instead...")
            admin_username = "sysadmin"
        else:
            admin_username = "admin"
        
        # Get the admin role
        admin_role = await session.execute(
            select(Role).where(Role.name == "admin")
        )
        admin_role = admin_role.scalar_one()
        
        # Get the default department
        default_dept = await session.execute(select(Department))
        default_dept = default_dept.scalars().first()
        
        # Create admin user
        admin_user = User(
            email="admin@aidock.local",
            username=admin_username,  # Use the determined username
            full_name="System Administrator",
            password_hash=get_password_hash("admin123"),  # Correct field name!
            is_admin=True,
            is_active=True,
            is_verified=True,
            role_id=admin_role.id,
            department_id=default_dept.id if default_dept else None
        )
        
        session.add(admin_user)
        await session.commit()
        
        print("   ✅ Admin user created successfully!")
        print("   📧 Email: admin@aidock.local")
        print(f"   👤 Username: {admin_username}")
        print("   🔑 Password: admin123")
        print("   ⚠️  IMPORTANT: Change this password after first login!")
        
        return admin_user

async def show_summary():
    """Show a summary of what was created."""
    
    async with AsyncSession(engine) as session:
        
        print("\\n📊 SETUP SUMMARY:")
        print("=" * 50)
        
        # Count everything
        user_count = await session.scalar(select(func.count(User.id)))
        role_count = await session.scalar(select(func.count(Role.id)))
        dept_count = await session.scalar(select(func.count(Department.id)))
        
        print(f"👥 Total Users: {user_count}")
        print(f"🏷️  Total Roles: {role_count}")
        print(f"🏢 Total Departments: {dept_count}")
        
        # Show admin user details
        admin_user = await session.execute(
            select(User).where(User.email == "admin@aidock.local")
        )
        admin = admin_user.scalar_one_or_none()
        
        if admin:
            print("\\n👑 ADMIN USER DETAILS:")
            print("-" * 30)
            print(f"📧 Email: {admin.email}")
            print(f"👤 Username: {admin.username}")
            print(f"👨‍💼 Full Name: {admin.full_name}")
            print(f"🔓 Active: {admin.is_active}")
            print(f"✅ Verified: {admin.is_verified}")
            print(f"⚡ Admin: {admin.is_admin}")

async def main():
    """Main function to set up admin user."""
    
    print("🚀 AI DOCK ADMIN SETUP")
    print("=" * 50)
    
    try:
        # Initialize database first
        print("🗄️  Initializing database...")
        await create_database_tables()
        print("   ✅ Database initialized!")
        
        # Create default roles
        roles = await create_default_roles()
        
        # Create default department
        await create_default_department()
        
        # Create admin user
        admin_user = await create_admin_user()
        
        # Show summary
        await show_summary()
        
        print("\\n🎉 Admin setup complete!")
        print("\\n🔑 LOGIN CREDENTIALS:")
        print("   Email: admin@aidock.local")
        print("   Username: Check the summary above for the actual username used")
        print("   Password: admin123")
        print("\\n⚠️  SECURITY NOTE:")
        print("   Please change the admin password after first login!")
        print("\\n🌐 NEXT STEPS:")
        print("   1. Start the backend server: uvicorn app.main:app --reload")
        print("   2. Test login at: http://localhost:8000/docs")
        print("   3. Use the /auth/login endpoint with above credentials")
        
    except Exception as e:
        print(f"❌ Error setting up admin user: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Run the admin setup
    asyncio.run(main())
