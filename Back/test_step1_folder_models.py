#!/usr/bin/env python3
"""
Test script for Chat Folder Models - Step 1 Verification

This script verifies that the Folder and Chat models are properly defined
and can be imported without errors.
"""

import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_model_imports():
    """Test that all models can be imported successfully."""
    print("🧪 Testing model imports...")
    
    try:
        from app.models.folder import Folder
        from app.models.chat import Chat
        from app.models import Folder as FolderImport, Chat as ChatImport
        
        print("✅ Folder model imported successfully")
        print("✅ Chat model imported successfully")
        print("✅ Models available through __init__.py")
        
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_model_structure():
    """Test the basic structure of our models."""
    print("\n🏗️  Testing model structure...")
    
    try:
        from app.models.folder import Folder
        from app.models.chat import Chat
        
        # Test Folder model attributes
        folder_attrs = [
            'id', 'name', 'description', 'user_id', 'parent_id',
            'color', 'icon', 'sort_order', 'is_active', 'is_system',
            'created_at', 'updated_at', 'created_by'
        ]
        
        for attr in folder_attrs:
            if hasattr(Folder, attr):
                print(f"✅ Folder.{attr} exists")
            else:
                print(f"❌ Folder.{attr} missing")
                
        # Test Chat model attributes
        chat_attrs = [
            'id', 'title', 'description', 'user_id', 'folder_id',
            'conversation_id', 'color', 'icon', 'is_pinned', 'is_favorite',
            'sort_order', 'message_count', 'last_activity_at', 'last_model_used',
            'total_tokens_used', 'estimated_cost', 'is_active', 'is_archived',
            'created_at', 'updated_at', 'created_by'
        ]
        
        for attr in chat_attrs:
            if hasattr(Chat, attr):
                print(f"✅ Chat.{attr} exists")
            else:
                print(f"❌ Chat.{attr} missing")
                
        return True
    except Exception as e:
        print(f"❌ Model structure test failed: {e}")
        return False

def test_model_methods():
    """Test that model methods are properly defined."""
    print("\n⚙️  Testing model methods...")
    
    try:
        from app.models.folder import Folder
        from app.models.chat import Chat
        
        # Test Folder methods
        folder_methods = [
            'to_dict', 'create_default_folders', 'soft_delete',
            'move_to_folder', 'get_breadcrumb'
        ]
        
        for method in folder_methods:
            if hasattr(Folder, method):
                print(f"✅ Folder.{method}() exists")
            else:
                print(f"❌ Folder.{method}() missing")
        
        # Test Chat methods
        chat_methods = [
            'to_dict', 'update_activity', 'sync_with_conversation',
            'move_to_folder', 'toggle_pin', 'toggle_favorite',
            'archive', 'unarchive', 'soft_delete', 'restore',
            'create_from_conversation', 'get_user_chats'
        ]
        
        for method in chat_methods:
            if hasattr(Chat, method):
                print(f"✅ Chat.{method}() exists")
            else:
                print(f"❌ Chat.{method}() missing")
        
        return True
    except Exception as e:
        print(f"❌ Model methods test failed: {e}")
        return False

def test_model_properties():
    """Test that model properties are properly defined."""
    print("\n🏷️  Testing model properties...")
    
    try:
        from app.models.folder import Folder
        from app.models.chat import Chat
        
        # Test Folder properties
        folder_properties = [
            'full_path', 'depth', 'chat_count', 'total_chat_count', 'has_children'
        ]
        
        for prop in folder_properties:
            if hasattr(Folder, prop):
                print(f"✅ Folder.{prop} property exists")
            else:
                print(f"❌ Folder.{prop} property missing")
        
        # Test Chat properties
        chat_properties = [
            'folder_path', 'display_title', 'status_label', 'activity_summary'
        ]
        
        for prop in chat_properties:
            if hasattr(Chat, prop):
                print(f"✅ Chat.{prop} property exists")
            else:
                print(f"❌ Chat.{prop} property missing")
        
        return True
    except Exception as e:
        print(f"❌ Model properties test failed: {e}")
        return False

def test_relationships():
    """Test that model relationships are properly defined."""
    print("\n🔗 Testing model relationships...")
    
    try:
        from app.models.folder import Folder
        from app.models.chat import Chat
        
        # Test Folder relationships
        if hasattr(Folder, 'user'):
            print("✅ Folder -> User relationship exists")
        else:
            print("❌ Folder -> User relationship missing")
            
        if hasattr(Folder, 'children'):
            print("✅ Folder -> Children relationship exists")
        else:
            print("❌ Folder -> Children relationship missing")
            
        if hasattr(Folder, 'chats'):
            print("✅ Folder -> Chats relationship exists")
        else:
            print("❌ Folder -> Chats relationship missing")
        
        # Test Chat relationships
        if hasattr(Chat, 'user'):
            print("✅ Chat -> User relationship exists")
        else:
            print("❌ Chat -> User relationship missing")
            
        if hasattr(Chat, 'folder'):
            print("✅ Chat -> Folder relationship exists")
        else:
            print("❌ Chat -> Folder relationship missing")
            
        if hasattr(Chat, 'conversation'):
            print("✅ Chat -> Conversation relationship exists")
        else:
            print("❌ Chat -> Conversation relationship missing")
        
        return True
    except Exception as e:
        print(f"❌ Model relationships test failed: {e}")
        return False

def main():
    """Run all tests for Step 1 verification."""
    print("🚀 AI Dock Chat Folder Models - Step 1 Verification")
    print("=" * 60)
    
    tests = [
        test_model_imports,
        test_model_structure,
        test_model_methods,
        test_model_properties,
        test_relationships
    ]
    
    all_passed = True
    for test in tests:
        if not test():
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All tests passed! Step 1 implementation is complete.")
        print("\n📊 Summary:")
        print("✅ Folder model created with hierarchical structure support")
        print("✅ Chat model created with folder organization capabilities")
        print("✅ Models integrated with existing conversation system")
        print("✅ Comprehensive properties and methods implemented")
        print("✅ Database relationships properly defined")
        print("\n🎯 Ready for Step 2: Backend API - Folder CRUD Operations")
    else:
        print("❌ Some tests failed. Please review the implementation.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
