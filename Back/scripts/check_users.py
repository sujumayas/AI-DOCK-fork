#!/usr/bin/env python3
"""
Quick Database User Check

This script shows what users currently exist in the database.
"""

import sys
import asyncio
from pathlib import Path

# Add the parent directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import engine
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def show_existing_users():
    """Show all existing users in the database."""
    
    async with AsyncSession(engine) as session:
        
        print("🔍 EXISTING USERS IN DATABASE:")
        print("=" * 50)
        
        # Get all users
        users_result = await session.execute(select(User))
        users = list(users_result.scalars())
        
        if not users:
            print("   📭 No users found in database")
            return
        
        for i, user in enumerate(users, 1):
            print(f"👤 User #{i}:")
            print(f"   📧 Email: {user.email}")
            print(f"   👤 Username: {user.username}")
            print(f"   👨‍💼 Full Name: {user.full_name}")
            print(f"   🔓 Active: {user.is_active}")
            print(f"   ⚡ Admin: {user.is_admin}")
            print(f"   📅 Created: {user.created_at}")
            print()

if __name__ == "__main__":
    asyncio.run(show_existing_users())
