#!/usr/bin/env python3
"""
Debug script to check database state for statistics
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import engine, SessionLocal
from app.models.user import User
from app.models.role import Role
from app.models.department import Department
from sqlalchemy import text, func

def check_database_state():
    """Check the database state to debug statistics endpoint"""
    db = SessionLocal()
    
    try:
        print("🔍 Checking database state for statistics endpoint...\n")
        
        # Check basic counts
        print("📊 Basic counts:")
        print(f"Total users: {db.query(User).count()}")
        print(f"Total roles: {db.query(Role).count()}")
        print(f"Total departments: {db.query(Department).count()}")
        
        # Check user states
        print("\n👤 User states:")
        print(f"Active users: {db.query(User).filter(User.is_active == True).count()}")
        print(f"Admin users: {db.query(User).filter(User.is_admin == True).count()}")
        print(f"Verified users: {db.query(User).filter(User.is_verified == True).count()}")
        
        # Check if joins work
        print("\n🔗 Testing joins:")
        
        # Users with roles
        users_with_roles = db.query(User).join(Role).count()
        print(f"Users with valid roles: {users_with_roles}")
        
        # List all roles
        print("\n📋 All roles:")
        roles = db.query(Role).all()
        for role in roles:
            user_count = db.query(User).filter(User.role_id == role.id).count()
            print(f"  - {role.name} (ID: {role.id}): {user_count} users")
        
        # List all departments
        print("\n🏢 All departments:")
        departments = db.query(Department).all()
        if departments:
            for dept in departments:
                user_count = db.query(User).filter(User.department_id == dept.id).count()
                print(f"  - {dept.name} (ID: {dept.id}): {user_count} users")
        else:
            print("  No departments found!")
        
        # Test the problematic query
        print("\n🧪 Testing statistics queries:")
        
        try:
            # Test role grouping
            role_stats = db.query(
                Role.name, func.count(User.id)
            ).join(User).group_by(Role.name).all()
            print("✅ Role grouping query works")
            for role_name, count in role_stats:
                print(f"  - {role_name}: {count}")
        except Exception as e:
            print(f"❌ Role grouping query failed: {e}")
        
        try:
            # Test department grouping
            dept_stats = db.query(
                Department.name, func.count(User.id)
            ).join(User).group_by(Department.name).all()
            print("\n✅ Department grouping query works")
            for dept_name, count in dept_stats:
                print(f"  - {dept_name}: {count}")
        except Exception as e:
            print(f"❌ Department grouping query failed: {e}")
        
        # Check for users without departments
        print("\n⚠️  Users without departments:")
        users_no_dept = db.query(User).filter(User.department_id == None).count()
        print(f"Users with no department: {users_no_dept}")
        
    except Exception as e:
        print(f"\n❌ Database check failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_database_state()
