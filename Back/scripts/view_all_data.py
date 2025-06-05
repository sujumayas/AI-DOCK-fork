#!/usr/bin/env python3
"""
Database Data Viewer

This script shows all your data in a nice, readable format.
Run this anytime to see what's in your database!
"""

import sys
import asyncio
from pathlib import Path

# Add the parent directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import engine
from app.models.user import User
from app.models.role import Role
from app.models.department import Department
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def show_all_data():
    """Show all data in the database in a formatted way."""
    
    print("🗄️  AI DOCK DATABASE CONTENTS")
    print("=" * 60)
    
    async with AsyncSession(engine) as session:
        
        # =============================================================================
        # SHOW ALL DEPARTMENTS
        # =============================================================================
        
        print("\\n🏢 DEPARTMENTS:")
        print("-" * 40)
        
        departments = await session.execute(select(Department))
        dept_list = list(departments.scalars())
        
        if not dept_list:
            print("   📭 No departments found")
        else:
            for dept in dept_list:
                print(f"🏢 {dept.name} ({dept.code})")
                print(f"   💰 Budget: ${dept.monthly_budget:,.2f}" if dept.monthly_budget else "   💰 Budget: Not set")
                print(f"   👔 Manager: {dept.manager_email}")
                print(f"   📍 Location: {dept.location}")
                print(f"   📝 Description: {dept.description}")
                print()
        
        # =============================================================================
        # SHOW ALL ROLES
        # =============================================================================
        
        print("🏷️  ROLES:")
        print("-" * 40)
        
        roles = await session.execute(select(Role))
        role_list = list(roles.scalars())
        
        if not role_list:
            print("   📭 No roles found")
        else:
            for role in role_list:
                print(f"🏷️  {role.display_name} (level {role.level})")
                print(f"   🔗 System Name: {role.name}")
                print(f"   ⚙️  System Role: {role.is_system_role}")
                print(f"   🔐 Permissions: {len(role.permissions or {})} permissions")
                if role.permissions:
                    for perm, enabled in role.permissions.items():
                        if enabled:
                            print(f"      ✅ {perm}")
                print()
        
        # =============================================================================
        # SHOW ALL USERS
        # =============================================================================
        
        print("👥 USERS:")
        print("-" * 40)
        
        # Get users with their related data loaded
        users = await session.execute(
            select(User).options(
                selectinload(User.role),
                selectinload(User.department)
            )
        )
        user_list = list(users.scalars())
        
        if not user_list:
            print("   📭 No users found")
        else:
            for user in user_list:
                print(f"👤 {user.full_name} (@{user.username})")
                print(f"   📧 Email: {user.email}")
                print(f"   🏷️  Role: {user.role.display_name if user.role else 'No Role'}")
                print(f"   🏢 Department: {user.department.name if user.department else 'No Department'}")
                print(f"   🔓 Status: {'Active' if user.is_active else 'Inactive'}")
                print(f"   ✅ Verified: {user.is_verified}")
                print(f"   ⚡ Admin: {user.is_admin}")
                print(f"   📅 Created: {user.created_at}")
                print(f"   🕐 Last Login: {user.last_login_at or 'Never'}")
                print()
        
        # =============================================================================
        # SUMMARY STATISTICS
        # =============================================================================
        
        print("📊 SUMMARY:")
        print("-" * 40)
        print(f"🏢 Departments: {len(dept_list)}")
        print(f"🏷️  Roles: {len(role_list)}")
        print(f"👥 Users: {len(user_list)}")
        
        active_users = sum(1 for user in user_list if user.is_active)
        admin_users = sum(1 for user in user_list if user.is_admin)
        
        print(f"🟢 Active Users: {active_users}")
        print(f"⚡ Admin Users: {admin_users}")
        
        print("\\n💡 TIP: Use DB Browser for SQLite for visual exploration!")
        print("   Download: https://sqlitebrowser.org/")
        print(f"   File: {Path(__file__).parent.parent}/ai_dock_dev.db")

if __name__ == "__main__":
    asyncio.run(show_all_data())
