#!/usr/bin/env python3
"""
🗄️ Database Schema Fix Script
This script updates your database schema to match the current model definitions
Run this to fix missing columns like model_parameters
"""

import asyncio
import sqlite3
from app.core.database import sync_engine, Base
from app.models import LLMConfiguration, LLMProvider, User, Role, Department

def fix_database_schema():
    """Fix database schema by adding missing columns"""
    
    print("🔧 AI Dock - Database Schema Fix")
    print("=" * 40)
    print("🔄 Checking and fixing database schema...")
    
    try:
        # Get the database path (assuming SQLite)
        db_path = str(sync_engine.url).replace('sqlite:///', '')
        print(f"📍 Database: {db_path}")
        
        # Connect directly to SQLite to check/add missing columns
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if model_parameters column exists
        cursor.execute("PRAGMA table_info(llm_configurations)")
        columns = [column[1] for column in cursor.fetchall()]
        
        print(f"📊 Current columns in llm_configurations: {len(columns)}")
        
        missing_columns = []
        expected_columns = {
            'model_parameters': 'JSON',
            'custom_headers': 'JSON', 
            'provider_settings': 'JSON',
            'last_tested_at': 'DATETIME',
            'last_test_result': 'TEXT'
        }
        
        for col_name, col_type in expected_columns.items():
            if col_name not in columns:
                missing_columns.append((col_name, col_type))
        
        if missing_columns:
            print(f"🔍 Found {len(missing_columns)} missing columns:")
            for col_name, col_type in missing_columns:
                print(f"   ➕ Adding {col_name} ({col_type})")
                try:
                    cursor.execute(f"ALTER TABLE llm_configurations ADD COLUMN {col_name} {col_type}")
                    print(f"   ✅ Added {col_name}")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e):
                        print(f"   ℹ️ Column {col_name} already exists")
                    else:
                        raise e
            
            conn.commit()
            print("✅ Database schema updated successfully!")
        else:
            print("✅ Database schema is already up to date!")
        
        # Verify the fix by checking columns again
        cursor.execute("PRAGMA table_info(llm_configurations)")
        new_columns = [column[1] for column in cursor.fetchall()]
        print(f"📊 Final column count: {len(new_columns)}")
        
        # Test a simple query to make sure everything works
        cursor.execute("SELECT COUNT(*) FROM llm_configurations")
        count = cursor.fetchone()[0]
        print(f"📝 LLM configurations in database: {count}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error fixing database schema: {e}")
        print("💡 Make sure your backend server is stopped before running this script")
        return False
    
    print("")
    print("🚀 Schema fix complete! You can now run:")
    print("   python setup_openai_fixed.py")
    print("")
    return True

if __name__ == "__main__":
    fix_database_schema()
