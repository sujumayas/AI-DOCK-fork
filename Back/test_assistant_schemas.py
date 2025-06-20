#!/usr/bin/env python3
"""
Quick test script to validate assistant schemas implementation.
This ensures all imports work and basic validation functions correctly.
"""

import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, '/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

def test_schema_imports():
    """Test that all assistant schemas can be imported."""
    try:
        from app.schemas.assistant import (
            AssistantCreate, 
            AssistantUpdate, 
            AssistantResponse,
            AssistantStatus,
            ModelProvider
        )
        print("✅ Successfully imported all assistant schemas")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_schema_validation():
    """Test basic schema validation."""
    try:
        from app.schemas.assistant import AssistantCreate
        
        # Test valid data
        valid_data = {
            "name": "Test Assistant",
            "description": "A test assistant for validation",
            "system_prompt": "You are a helpful test assistant that provides clear, accurate, and useful responses.",
            "model_preferences": {
                "temperature": 0.7,
                "max_tokens": 2000
            }
        }
        
        assistant = AssistantCreate(**valid_data)
        print("✅ Valid assistant data passes validation")
        
        # Test invalid data (should fail)
        try:
            invalid_assistant = AssistantCreate(
                name="",  # Invalid: empty name
                system_prompt="Hi",  # Invalid: too short
            )
            print("❌ Validation should have failed but didn't")
            return False
        except Exception:
            print("✅ Invalid data correctly rejected")
            
        return True
        
    except Exception as e:
        print(f"❌ Validation test failed: {e}")
        return False

def test_enum_usage():
    """Test that enums work correctly."""
    try:
        from app.schemas.assistant import AssistantStatus, ModelProvider
        
        # Test enum values
        assert AssistantStatus.ACTIVE == "active"
        assert AssistantStatus.INACTIVE == "inactive"
        assert ModelProvider.OPENAI == "openai"
        
        print("✅ Enums work correctly")
        return True
        
    except Exception as e:
        print(f"❌ Enum test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🧪 Testing Assistant Schemas Implementation...")
    print("=" * 50)
    
    tests = [
        ("Schema Imports", test_schema_imports),
        ("Schema Validation", test_schema_validation),
        ("Enum Usage", test_enum_usage),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔬 Running {test_name}...")
        if test_func():
            passed += 1
        else:
            print(f"💥 {test_name} failed!")
    
    print("\n" + "=" * 50)
    print(f"📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Assistant schemas are working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    exit(main())
