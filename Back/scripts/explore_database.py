#!/usr/bin/env python3
"""
Database Explorer Script

This script shows you what's in your AI Dock database.
Perfect for learning how your data is structured!
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
from sqlalchemy import select, text, func
from sqlalchemy.orm import selectinload
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def show_database_info():
    """Show comprehensive database information."""
    
    print("🗄️  AI DOCK DATABASE EXPLORER")
    print("=" * 50)
    
    async with AsyncSession(engine) as session:
        
        # =============================================================================
        # BASIC DATABASE INFO
        # =============================================================================
        
        print("\\n📊 DATABASE OVERVIEW:")
        print("-" * 30)
        
        # Count records in each table
        user_count = await session.scalar(select(func.count(User.id)))
        role_count = await session.scalar(select(func.count(Role.id)))
        dept_count = await session.scalar(select(func.count(Department.id)))
        
        print(f"👥 Users: {user_count}")
        print(f"🏷️  Roles: {role_count}")
        print(f"🏢 Departments: {dept_count}")
        
        # =============================================================================
        # SHOW ALL ROLES
        # =============================================================================
        
        print("\\n🏷️  ROLES TABLE:")
        print("-" * 30)
        
        roles = await session.execute(select(Role))
        for role in roles.scalars():
            print(f"ID: {role.id}")
            print(f"   Name: {role.name}")
            print(f"   Display: {role.display_name}")
            print(f"   Level: {role.level}")
            print(f"   System Role: {role.is_system_role}")
            print(f"   Permissions: {len(role.permissions or {})} permissions")
            print()
        
        # =============================================================================
        # SHOW ALL DEPARTMENTS
        # =============================================================================
        
        print("🏢 DEPARTMENTS TABLE:")
        print("-" * 30)
        
        departments = await session.execute(select(Department))
        for dept in departments.scalars():
            print(f"ID: {dept.id}")
            print(f"   Name: {dept.name}")
            print(f"   Code: {dept.code}")
            print(f"   Budget: ${dept.monthly_budget:,}" if dept.monthly_budget else "   Budget: Not set")
            print(f"   Manager: {dept.manager_email}")
            print()
        
        # =============================================================================
        # SHOW ALL USERS
        # =============================================================================
        
        print("👥 USERS TABLE:")
        print("-" * 30)
        
        # Get users with their roles and departments
        users = await session.execute(
            select(User).options(
                # Load related data using proper SQLAlchemy 2.0 syntax
                selectinload(User.role),
                selectinload(User.department)
            )
        )
        
        for user in users.scalars():
            print(f"ID: {user.id}")
            print(f"   Email: {user.email}")
            print(f"   Username: {user.username}")
            print(f"   Full Name: {user.full_name}")
            print(f"   Role: {user.role.display_name if user.role else 'No Role'}")
            print(f"   Department: {user.department.name if user.department else 'No Department'}")
            print(f"   Active: {user.is_active}")
            print(f"   Admin: {user.is_admin}")
            print(f"   Verified: {user.is_verified}")
            print(f"   Created: {user.created_at}")
            print(f"   Last Login: {user.last_login_at or 'Never'}")
            print()
        
        # =============================================================================
        # SHOW DATABASE TABLES
        # =============================================================================
        
        print("📋 DATABASE TABLES:")
        print("-" * 30)
        
        # Get table names using raw SQL
        tables_result = await session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table';")
        )
        
        for (table_name,) in tables_result:
            if not table_name.startswith('sqlite_'):  # Skip system tables
                print(f"📄 {table_name}")
        
        print()

async def show_table_structure():
    """Show the structure of our main tables."""
    
    print("🏗️  TABLE STRUCTURES:")
    print("=" * 50)
    
    async with AsyncSession(engine) as session:
        
        # Show Users table structure
        print("\\n👥 USERS TABLE COLUMNS:")
        print("-" * 30)
        
        user_schema = await session.execute(
            text("PRAGMA table_info(users);")
        )
        
        for row in user_schema:
            col_id, name, col_type, not_null, default, pk = row
            nullable = "NOT NULL" if not_null else "NULLABLE"
            primary = " (PRIMARY KEY)" if pk else ""
            print(f"  {name}: {col_type} - {nullable}{primary}")
        
        # Show Roles table structure
        print("\\n🏷️  ROLES TABLE COLUMNS:")
        print("-" * 30)
        
        role_schema = await session.execute(
            text("PRAGMA table_info(roles);")
        )
        
        for row in role_schema:
            col_id, name, col_type, not_null, default, pk = row
            nullable = "NOT NULL" if not_null else "NULLABLE"
            primary = " (PRIMARY KEY)" if pk else ""
            print(f"  {name}: {col_type} - {nullable}{primary}")

async def main():
    """Main function."""
    
    try:
        await show_database_info()
        await show_table_structure()
        
        print("\\n✅ Database exploration complete!")
        print("\\n💡 Tips:")
        print("   • Use DB Browser for SQLite for visual exploration")
        print("   • Run this script anytime to see current data")
        print("   • Database file: ai_dock_dev.db")
        
    except Exception as e:
        print(f"❌ Error exploring database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Run the exploration
    asyncio.run(main())
