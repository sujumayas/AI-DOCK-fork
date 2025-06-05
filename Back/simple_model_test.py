#!/usr/bin/env python3
"""
Simple test to verify our models are working.
"""

import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
from app.models import User, Role, Department

def simple_test():
    """Simple test that just creates the tables."""
    print("🔧 Testing AI Dock Models...")
    
    try:
        # Create all tables
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully!")
        
        # List all tables
        print("\n📋 Database tables created:")
        for table_name in Base.metadata.tables.keys():
            print(f"   - {table_name}")
        
        # Check if we can import models
        print(f"\n📦 Model imports working:")
        print(f"   - User model: {User.__name__}")
        print(f"   - Role model: {Role.__name__}")
        print(f"   - Department model: {Department.__name__}")
        
        print(f"\n🎉 Basic model test passed!")
        print(f"📍 Database location: ./ai_dock_dev.db")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    simple_test()
