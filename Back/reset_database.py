#!/usr/bin/env python3
"""
AI Dock - Database Reset Script

This script drops all existing tables and recreates them with the current model definitions.
Use this when you've updated model schemas and need to reset the database.

⚠️ WARNING: This will delete all existing data!

Usage:
    python reset_database.py
"""

import asyncio
import sys
from pathlib import Path

# Add the app directory to the Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

from app.core.database import drop_database_tables, create_database_tables, startup_database

async def reset_database():
    """
    Reset the database by dropping all tables and recreating them.
    
    This ensures the database schema matches our current model definitions.
    """
    print("🗑️  Resetting AI Dock Database...")
    print("=" * 50)
    
    try:
        # Initialize database connection
        print("🔗 Connecting to database...")
        await startup_database()
        
        # Drop all existing tables
        print("🗑️  Dropping all existing tables...")
        await drop_database_tables()
        
        # Create tables with current schema
        print("🏗️  Creating tables with updated schema...")
        await create_database_tables()
        
        print("\n" + "=" * 50)
        print("✅ DATABASE RESET COMPLETED!")
        print("=" * 50)
        print("\n📋 NEXT STEPS:")
        print("1. Run: python setup_test_data.py")
        print("2. Start server: python start_server.py")
        print("3. Test admin login: admin@aidock.dev / admin123!")
        print("\n" + "=" * 50)
        
    except Exception as e:
        print(f"\n❌ Error resetting database: {e}")
        raise

if __name__ == "__main__":
    # Run the async function
    asyncio.run(reset_database())
