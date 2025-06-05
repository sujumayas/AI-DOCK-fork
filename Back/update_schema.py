#!/usr/bin/env python3
"""
🗄️ Database Schema Update Script
This script updates the database schema to match current model definitions
Run this to fix schema mismatches before adding LLM configurations
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_db, engine
from app.models import Base
from app.models.llm_config import LLMConfiguration, LLMProvider
from app.models.user import User
from app.models.role import Role
from app.models.department import Department

async def update_database_schema():
    """Update database schema to match current models"""
    
    print("🔄 Updating database schema...")
    print("⚠️  This will recreate LLM configuration tables!")
    
    # Ask for confirmation
    response = input("Continue? (y/N): ").lower().strip()
    if response != 'y':
        print("❌ Operation cancelled")
        return
    
    try:
        async with engine.begin() as conn:
            print("🗑️  Dropping existing LLM configuration table...")
            # Drop only the problematic table
            await conn.run_sync(lambda sync_conn: sync_conn.execute(
                "DROP TABLE IF EXISTS llm_configurations"
            ))
            
            print("🏗️  Creating updated table schema...")
            # Create only the LLM configuration table with new schema
            await conn.run_sync(lambda sync_conn: 
                LLMConfiguration.__table__.create(sync_conn, checkfirst=True)
            )
            
        print("✅ Database schema updated successfully!")
        print("🚀 You can now run the OpenAI setup script again")
        
    except Exception as e:
        print(f"❌ Error updating schema: {e}")
        print("🔍 Make sure your backend server is not running during schema updates")

if __name__ == "__main__":
    print("🗄️ AI Dock - Database Schema Update")
    print("=" * 40)
    asyncio.run(update_database_schema())
