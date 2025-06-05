#!/usr/bin/env python3
"""
Super simple test to just verify our models can be imported and tables created.
"""

import asyncio
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def simple_test():
    """Simple test that just imports and creates tables."""
    print("🔧 Simple AI Dock Model Test...")
    
    try:
        # Import database components
        print("Importing database components...")
        from app.core.database import Base, engine
        
        # Import models
        print("Importing models...")
        from app.models.user import User
        from app.models.role import Role
        from app.models.department import Department
        
        print("Creating tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        print("✅ Success! All tests passed!")
        print("📊 Tables created:")
        for table_name in Base.metadata.tables.keys():
            print(f"   - {table_name}")
        
        print(f"📍 Database location: ./ai_dock_dev.db")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(simple_test())
