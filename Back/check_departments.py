#!/usr/bin/env python3
"""
Quick check for departments table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.core.config import settings

# Create engine
engine = create_engine(settings.DATABASE_URL)

# Check tables
with engine.connect() as conn:
    # Check what tables exist
    result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
    tables = [row[0] for row in result]
    
    print("📋 Tables in database:")
    for table in tables:
        print(f"  - {table}")
    
    if 'departments' in tables:
        print("\n✅ Departments table exists")
        
        # Check if it has any data
        result = conn.execute(text("SELECT COUNT(*) FROM departments"))
        count = result.scalar()
        print(f"   Number of departments: {count}")
        
        if count > 0:
            result = conn.execute(text("SELECT id, name FROM departments"))
            print("   Departments:")
            for row in result:
                print(f"     - ID: {row[0]}, Name: {row[1]}")
    else:
        print("\n❌ Departments table does NOT exist!")
        print("   This is likely the cause of the 422 error")
        
        # Let's create the departments table
        print("\n🔧 Creating departments table...")
        try:
            from app.core.database import Base, engine
            from app.models.department import Department
            
            # Create all tables
            Base.metadata.create_all(bind=engine)
            print("✅ Tables created successfully!")
        except Exception as e:
            print(f"❌ Failed to create tables: {e}")
