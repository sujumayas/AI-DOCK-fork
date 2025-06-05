#!/usr/bin/env python3
"""
Test script for Role and Department models with relationships.

This script demonstrates:
1. Creating roles and departments
2. Setting up foreign key relationships  
3. Testing the relationship connections
4. Showing how to navigate between related objects

Run this script to verify our models work correctly!
"""

import sys
import os
from decimal import Decimal

# Add the parent directory to the Python path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now we can import our app modules
from app.core.database import engine, SessionLocal, Base
from app.models.user import User, create_sample_user
from app.models.role import Role, RoleType, PermissionConstants, create_default_roles
from app.models.department import Department, create_default_departments, create_engineering_sub_departments
from app.core.security import get_password_hash

def create_tables():
    """Create all database tables."""
    print("🗃️  Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")

def test_role_creation():
    """Test creating and working with roles."""
    print("\n🎭 Testing Role Creation...")
    
    session = SessionLocal()
    try:
        # Create default roles
        roles = create_default_roles()
        
        # Add roles to database
        for role in roles:
            session.add(role)
        
        session.commit()
        
        # Test role retrieval
        admin_role = session.query(Role).filter(Role.name == RoleType.ADMIN.value).first()
        user_role = session.query(Role).filter(Role.name == RoleType.USER.value).first()
        
        print(f"✅ Created roles:")
        print(f"   - Admin Role: {admin_role}")
        print(f"   - User Role: {user_role}")
        
        # Test permission checking
        print(f"\n🔐 Testing permissions:")
        print(f"   - Admin can manage users: {admin_role.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
        print(f"   - User can manage users: {user_role.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
        print(f"   - Admin can use AI chat: {admin_role.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
        print(f"   - User can use AI chat: {user_role.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
        
        # Test role hierarchy
        print(f"\n📊 Testing role hierarchy:")
        print(f"   - Admin level: {admin_role.level}")
        print(f"   - User level: {user_role.level}")
        print(f"   - Admin can manage User role: {admin_role.can_manage_role(user_role)}")
        print(f"   - User can manage Admin role: {user_role.can_manage_role(admin_role)}")
        
        return admin_role.id, user_role.id
        
    except Exception as e:
        print(f"❌ Error testing roles: {e}")
        session.rollback()
        return None, None
    finally:
        session.close()

def test_department_creation():
    """Test creating and working with departments."""
    print("\n🏢 Testing Department Creation...")
    
    session = SessionLocal()
    try:
        # Create default departments
        departments = create_default_departments()
        
        # Add departments to database
        for dept in departments:
            session.add(dept)
        
        session.commit()
        
        # Get the engineering department for sub-departments
        engineering = session.query(Department).filter(Department.code == "ENG").first()
        
        # Create engineering sub-departments
        if engineering:
            sub_depts = create_engineering_sub_departments(engineering)
            for sub_dept in sub_depts:
                session.add(sub_dept)
            session.commit()
        
        # Test department retrieval
        all_depts = session.query(Department).all()
        print(f"✅ Created {len(all_depts)} departments:")
        
        for dept in all_depts:
            hierarchy_path = dept.get_full_path()
            print(f"   - {dept.name} ({dept.code}) - {hierarchy_path}")
            if dept.monthly_budget:
                print(f"     Budget: ${dept.monthly_budget}/month")
        
        # Test department hierarchy
        print(f"\n🌳 Testing department hierarchy:")
        if engineering:
            children = engineering.get_all_children()
            print(f"   - Engineering has {len(children)} sub-departments:")
            for child in children:
                print(f"     - {child.name} ({child.code})")
        
        # Test budget functionality
        print(f"\n💰 Testing budget functionality:")
        if engineering:
            budget_status = engineering.get_budget_status()
            print(f"   - Engineering budget status: {budget_status}")
            can_afford = engineering.can_afford_usage(Decimal('100.50'))
            print(f"   - Can afford $100.50 usage: {can_afford}")
        
        return engineering.id if engineering else None
        
    except Exception as e:
        print(f"❌ Error testing departments: {e}")
        session.rollback()
        return None
    finally:
        session.close()

def test_user_relationships(admin_role_id, user_role_id, engineering_dept_id):
    """Test creating users with role and department relationships."""
    print("\n👥 Testing User Relationships...")
    
    if not admin_role_id or not user_role_id:
        print("❌ No roles available for testing user relationships")
        return
    
    session = SessionLocal()
    try:
        # Create admin user
        admin_user = User(
            email="admin@aidock.local",
            username="admin",
            full_name="System Administrator",
            password_hash=get_password_hash("admin123"),
            role_id=admin_role_id,
            department_id=engineering_dept_id,  # Optional
            is_admin=True,
            is_active=True,
            is_verified=True,
            job_title="System Administrator"
        )
        
        # Create regular user
        regular_user = User(
            email="john.doe@aidock.local", 
            username="john_doe",
            full_name="John Doe",
            password_hash=get_password_hash("user123"),
            role_id=user_role_id,
            department_id=engineering_dept_id,  # Optional
            is_active=True,
            job_title="Software Engineer"
        )
        
        # Add users to database
        session.add(admin_user)
        session.add(regular_user)
        session.commit()
        
        # Test relationship access
        print(f"✅ Created users with relationships:")
        print(f"   - Admin User: {admin_user.full_name}")
        print(f"     Role: {admin_user.get_role_name()}")
        print(f"     Department: {admin_user.get_department_name()}")
        print(f"     Can access admin panel: {admin_user.can_access_admin_panel()}")
        
        print(f"   - Regular User: {regular_user.full_name}")
        print(f"     Role: {regular_user.get_role_name()}")
        print(f"     Department: {regular_user.get_department_name()}")
        print(f"     Can access admin panel: {regular_user.can_access_admin_panel()}")
        
        # Test permission checking through relationships
        print(f"\n🔐 Testing user permissions through roles:")
        print(f"   - Admin can manage users: {admin_user.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
        print(f"   - Admin can use AI chat: {admin_user.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
        print(f"   - Regular user can manage users: {regular_user.has_permission(PermissionConstants.CAN_MANAGE_USER_ROLES)}")
        print(f"   - Regular user can use AI chat: {regular_user.has_permission(PermissionConstants.CAN_USE_AI_CHAT)}")
        
        # Test user management hierarchy
        print(f"\n👔 Testing user management hierarchy:")
        print(f"   - Admin can manage regular user: {admin_user.can_manage_user(regular_user)}")
        print(f"   - Regular user can manage admin: {regular_user.can_manage_user(admin_user)}")
        
        # Test department membership
        print(f"\n🏢 Testing department membership:")
        if engineering_dept_id:
            print(f"   - Admin is in Engineering: {admin_user.is_in_department('Engineering')}")
            print(f"   - Regular user is in Engineering: {regular_user.is_in_department('Engineering')}")
        
        print(f"✅ All relationship tests passed!")
        
    except Exception as e:
        print(f"❌ Error testing user relationships: {e}")
        session.rollback()
    finally:
        session.close()

def test_reverse_relationships():
    """Test accessing relationships in reverse (role.users, department.users)."""
    print("\n🔄 Testing Reverse Relationships...")
    
    session = SessionLocal()
    try:
        # Get roles and check their users
        admin_role = session.query(Role).filter(Role.name == RoleType.ADMIN.value).first()
        user_role = session.query(Role).filter(Role.name == RoleType.USER.value).first()
        
        if admin_role:
            admin_users = admin_role.users  # This uses the backref we created
            print(f"   - Admin role has {len(admin_users)} users:")
            for user in admin_users:
                print(f"     - {user.full_name} ({user.email})")
        
        if user_role:
            regular_users = user_role.users
            print(f"   - User role has {len(regular_users)} users:")
            for user in regular_users:
                print(f"     - {user.full_name} ({user.email})")
        
        # Get departments and check their users
        engineering = session.query(Department).filter(Department.code == "ENG").first()
        if engineering:
            dept_users = engineering.users  # This uses the backref we created
            print(f"   - Engineering department has {len(dept_users)} users:")
            for user in dept_users:
                print(f"     - {user.full_name} ({user.email}) - {user.get_role_name()}")
        
        print(f"✅ Reverse relationship tests passed!")
        
    except Exception as e:
        print(f"❌ Error testing reverse relationships: {e}")
    finally:
        session.close()

def print_database_summary():
    """Print a summary of what's in our database."""
    print("\n📊 Database Summary:")
    
    session = SessionLocal()
    try:
        # Count records
        role_count = session.query(Role).count()
        dept_count = session.query(Department).count()
        user_count = session.query(User).count()
        
        print(f"   - Roles: {role_count}")
        print(f"   - Departments: {dept_count}")
        print(f"   - Users: {user_count}")
        
        # Show structure
        print(f"\n🏗️  Database Structure:")
        print(f"   - users table: connects to roles and departments via foreign keys")
        print(f"   - roles table: defines permissions and hierarchy")
        print(f"   - departments table: supports hierarchy with parent/child relationships")
        
        print(f"\n🔗 Key Relationships:")
        print(f"   - User → Role (many-to-one): user.role_id → roles.id")
        print(f"   - User → Department (many-to-one): user.department_id → departments.id")
        print(f"   - Department → Department (self-reference): department.parent_id → departments.id")
        
    except Exception as e:
        print(f"❌ Error getting database summary: {e}")
    finally:
        session.close()

def main():
    """Main test function."""
    print("🚀 Testing AI Dock Role & Department Models")
    print("=" * 50)
    
    # Create database tables
    create_tables()
    
    # Test role creation
    admin_role_id, user_role_id = test_role_creation()
    
    # Test department creation  
    engineering_dept_id = test_department_creation()
    
    # Test user relationships
    test_user_relationships(admin_role_id, user_role_id, engineering_dept_id)
    
    # Test reverse relationships
    test_reverse_relationships()
    
    # Print summary
    print_database_summary()
    
    print("\n🎉 All tests completed!")
    print("\n💡 What you learned:")
    print("   - Foreign keys connect tables together")
    print("   - Relationships let you navigate between connected data")
    print("   - Backrefs create automatic reverse relationships")
    print("   - Role-based permissions provide flexible access control")
    print("   - Department hierarchy supports organizational structure")
    
    print("\n🎯 Next steps:")
    print("   - Try accessing your database at: ./ai_dock_dev.db")
    print("   - Run your FastAPI server: uvicorn app.main:app --reload")
    print("   - Ready to build admin management features!")

if __name__ == "__main__":
    main()
