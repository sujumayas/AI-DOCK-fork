#!/usr/bin/env python3
"""
Create Default Admin User Script

This script creates a default admin user for testing and development.
Run this script to bootstrap your AI Dock application with an admin account.

🎓 LEARNING: Bootstrap Scripts
=============================
Bootstrap scripts solve the "chicken and egg" problem:
- You need an admin to create users
- But you need a user to become an admin
- Solution: A script that creates the first admin directly in the database

Usage:
    python scripts/create_default_admin.py

Default Admin Credentials:
    Email: admin@aidock.dev
    Password: admin123!
    Username: admin
"""

import sys
import os
import asyncio
from pathlib import Path

# Add the parent directory to Python path so we can import from app/
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import get_database_session, engine
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role
from app.models.department import Department
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default admin user credentials
DEFAULT_ADMIN = {
    "email": "admin@aidock.dev",
    "username": "admin", 
    "full_name": "System Administrator",
    "password": "admin123!",
    "job_title": "System Administrator",
    "bio": "Default admin user created by bootstrap script"
}

# Default role and department
DEFAULT_ROLE = {
    "name": "system_admin",
    "display_name": "System Administrator", 
    "description": "Full system administrator with all permissions",
    "level": 1,
    "permissions": {
        "can_create_users": True,
        "can_view_users": True,
        "can_edit_users": True,
        "can_delete_users": True,
        "can_manage_roles": True,
        "can_manage_departments": True,
        "can_access_admin_panel": True,
        "can_view_system_logs": True,
        "can_manage_settings": True
    },
    "is_system_role": True
}

DEFAULT_DEPARTMENT = {
    "name": "IT Administration",
    "code": "IT-ADMIN",
    "description": "Information Technology Administration Department",
    "monthly_budget": 50000,
    "cost_center": "CC-IT-001",
    "manager_email": "admin@aidock.dev",
    "location": "Head Office"
}


async def check_existing_admin(session: AsyncSession) -> bool:
    """
    Check if there are any existing admin users.
    
    Returns:
        True if admin users exist, False otherwise
    """
    result = await session.execute(
        select(User).where(User.is_admin == True)
    )
    admin_users = result.scalars().all()
    return len(admin_users) > 0


async def create_default_role(session: AsyncSession) -> Role:
    """
    Create the default admin role if it doesn't exist.
    
    Returns:
        The admin role (existing or newly created)
    """
    # Check if role already exists
    result = await session.execute(
        select(Role).where(Role.name == DEFAULT_ROLE["name"])
    )
    existing_role = result.scalar_one_or_none()
    
    if existing_role:
        logger.info(f"✅ Admin role already exists: {existing_role.display_name}")
        return existing_role
    
    # Create new role
    admin_role = Role(
        name=DEFAULT_ROLE["name"],
        display_name=DEFAULT_ROLE["display_name"],
        description=DEFAULT_ROLE["description"],
        level=DEFAULT_ROLE["level"],
        permissions=DEFAULT_ROLE["permissions"],
        is_system_role=DEFAULT_ROLE["is_system_role"],
        is_active=True
    )
    
    session.add(admin_role)
    await session.flush()  # Get the ID
    
    logger.info(f"✅ Created admin role: {admin_role.display_name}")
    return admin_role


async def create_default_department(session: AsyncSession) -> Department:
    """
    Create the default admin department if it doesn't exist.
    
    Returns:
        The admin department (existing or newly created)
    """
    # Check if department already exists
    result = await session.execute(
        select(Department).where(Department.code == DEFAULT_DEPARTMENT["code"])
    )
    existing_dept = result.scalar_one_or_none()
    
    if existing_dept:
        logger.info(f"✅ Admin department already exists: {existing_dept.name}")
        return existing_dept
    
    # Create new department
    admin_dept = Department(
        name=DEFAULT_DEPARTMENT["name"],
        code=DEFAULT_DEPARTMENT["code"],
        description=DEFAULT_DEPARTMENT["description"],
        monthly_budget=DEFAULT_DEPARTMENT["monthly_budget"],
        cost_center=DEFAULT_DEPARTMENT["cost_center"],
        manager_email=DEFAULT_DEPARTMENT["manager_email"],
        location=DEFAULT_DEPARTMENT["location"],
        is_active=True
    )
    
    session.add(admin_dept)
    await session.flush()  # Get the ID
    
    logger.info(f"✅ Created admin department: {admin_dept.name}")
    return admin_dept


async def create_admin_user(session: AsyncSession, role: Role, department: Department) -> User:
    """
    Create the default admin user.
    
    Args:
        session: Database session
        role: Admin role to assign
        department: Admin department to assign
        
    Returns:
        The created admin user
    """
    # Hash the password securely
    password_hash = hash_password(DEFAULT_ADMIN["password"])
    
    # Create admin user
    admin_user = User(
        email=DEFAULT_ADMIN["email"],
        username=DEFAULT_ADMIN["username"],
        full_name=DEFAULT_ADMIN["full_name"],
        password_hash=password_hash,
        job_title=DEFAULT_ADMIN["job_title"],
        bio=DEFAULT_ADMIN["bio"],
        role_id=role.id,
        department_id=department.id,
        is_active=True,
        is_verified=True,
        is_admin=True
    )
    
    session.add(admin_user)
    await session.flush()  # Get the ID
    
    logger.info(f"✅ Created admin user: {admin_user.email}")
    return admin_user


async def main():
    """
    Main function to create default admin user.
    """
    logger.info("🚀 Starting AI Dock Admin User Creation...")
    logger.info("=" * 50)
    
    try:
        # Create async session
        async with AsyncSession(engine) as session:
            # Check if admin users already exist
            if await check_existing_admin(session):
                logger.info("⚠️  Admin users already exist in the database!")
                logger.info("   No new admin user will be created.")
                
                # Show existing admin info
                result = await session.execute(
                    select(User).where(User.is_admin == True)
                )
                admins = result.scalars().all()
                
                logger.info("\\n📋 Existing Admin Users:")
                for admin in admins:
                    logger.info(f"   • {admin.email} ({admin.username})")
                
                return
            
            logger.info("🔧 No admin users found. Creating default admin...")
            
            # Create role and department
            admin_role = await create_default_role(session)
            admin_dept = await create_default_department(session)
            
            # Create admin user
            admin_user = await create_admin_user(session, admin_role, admin_dept)
            
            # Commit all changes
            await session.commit()
            
            logger.info("\\n🎉 SUCCESS! Default admin user created!")
            logger.info("=" * 50)
            logger.info("📋 Admin Credentials:")
            logger.info(f"   Email:    {DEFAULT_ADMIN['email']}")
            logger.info(f"   Username: {DEFAULT_ADMIN['username']}")
            logger.info(f"   Password: {DEFAULT_ADMIN['password']}")
            logger.info("=" * 50)
            logger.info("\\n🧪 Testing Instructions:")
            logger.info("1. Open http://localhost:8000/docs in your browser")
            logger.info("2. Use the /auth/login endpoint with the credentials above")
            logger.info("3. Copy the access_token from the response")
            logger.info("4. Click 'Authorize' in Swagger and enter: Bearer <your_token>")
            logger.info("5. Test the admin endpoints like /admin/users/search")
            logger.info("\\n⚠️  SECURITY WARNING:")
            logger.info("   Change the default password in production!")
            
    except Exception as e:
        logger.error(f"❌ Error creating admin user: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
