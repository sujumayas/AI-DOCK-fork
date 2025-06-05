#!/usr/bin/env python3
"""
AI Dock - Database Inspection Script

This script shows what's currently in the database.
Use this to verify your test data was created properly.

Usage:
    python inspect_database.py
"""

import asyncio
import sys
from pathlib import Path

# Add the app directory to the Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

from app.core.database import get_database_session, startup_database
from app.models.user import User
from app.models.role import Role
from app.models.department import Department
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

async def inspect_database():
    """
    Inspect the current state of the database.
    Shows all users, roles, and departments.
    """
    print("🔍 Inspecting AI Dock Database...")
    print("=" * 60)
    
    try:
        # Initialize database
        await startup_database()
        
        # Get database session
        async for db in get_database_session():
            # =============================================================================
            # COUNT TOTALS
            # =============================================================================
            print("\n📊 DATABASE TOTALS:")
            
            result = await db.execute(select(func.count(User.id)))
            total_users = result.scalar()
            result = await db.execute(select(func.count(Role.id)))
            total_roles = result.scalar()
            result = await db.execute(select(func.count(Department.id)))
            total_departments = result.scalar()
            
            print(f"  👥 Total Users: {total_users}")
            print(f"  👤 Total Roles: {total_roles}")
            print(f"  🏢 Total Departments: {total_departments}")
            
            # =============================================================================
            # LIST ALL ROLES
            # =============================================================================
            print("\n👤 ROLES:")
            result = await db.execute(select(Role).order_by(Role.level.desc()))
            roles = result.scalars().all()
            
            if roles:
                for role in roles:
                    print(f"  {role.name} - {role.display_name} (Level {role.level})")
                    print(f"    Permissions: {len(role.permissions or {})} permissions")
            else:
                print("  ⚠️  No roles found!")
            
            # =============================================================================
            # LIST ALL DEPARTMENTS
            # =============================================================================
            print("\n🏢 DEPARTMENTS:")
            result = await db.execute(select(Department).order_by(Department.name))
            departments = result.scalars().all()
            
            if departments:
                for dept in departments:
                    parent_info = f" (under {dept.parent.name})" if dept.parent_id else " (top-level)"
                    print(f"  {dept.code} - {dept.name}{parent_info}")
                    print(f"    Budget: ${dept.monthly_budget}/month")
            else:
                print("  ⚠️  No departments found!")
            
            # =============================================================================
            # LIST ALL USERS
            # =============================================================================
            print("\n👥 USERS:")
            result = await db.execute(
                select(User)
                .options(selectinload(User.role), selectinload(User.department))
                .order_by(User.username)
            )
            users = result.scalars().all()
            
            if users:
                for user in users:
                    status = "🟢 Active" if user.is_active else "🔴 Inactive"
                    verified = "✅ Verified" if user.is_verified else "❌ Unverified"
                    
                    print(f"  {user.username} - {user.full_name}")
                    print(f"    Email: {user.email}")
                    print(f"    Role: {user.role.display_name}")
                    print(f"    Department: {user.department.name}")
                    print(f"    Status: {status} {verified}")
                    print(f"    ID: {user.id}")
                    print("")
            else:
                print("  ⚠️  No users found!")
            
            # =============================================================================
            # CHECK ADMIN USER SPECIFICALLY
            # =============================================================================
            print("\n🔑 ADMIN USER CHECK:")
            result = await db.execute(
                select(User)
                .options(selectinload(User.role))
                .filter(User.email == "admin@aidock.dev")
            )
            admin_user = result.scalar_one_or_none()
            
            if admin_user:
                print(f"✅ Admin user found!")
                print(f"   Username: {admin_user.username}")
                print(f"   Email: {admin_user.email}")
                print(f"   Role: {admin_user.role.display_name}")
                print(f"   Active: {admin_user.is_active}")
                print(f"   Password Hash Length: {len(admin_user.password_hash)} chars")
            else:
                print("❌ Admin user NOT found!")
                print("   Expected email: admin@aidock.dev")
            
            break  # Only process once
            
    except Exception as e:
        print(f"\n❌ Error inspecting database: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("🔍 Database inspection complete!")

if __name__ == "__main__":
    asyncio.run(inspect_database())
