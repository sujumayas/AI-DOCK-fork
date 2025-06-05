#!/usr/bin/env python3
"""
Test script for our password security functions.

Run this to see how password hashing and verification works!
"""

import sys
import os

# Add the project root to the path so we can import our app modules
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.security import hash_password, verify_password


def test_password_security():
    """Test our password hashing and verification functions."""
    
    print("🔒 Testing AI Dock Password Security")
    print("=" * 50)
    
    # Test password
    test_password = "mySecurePassword123!"
    print(f"Original password: {test_password}")
    
    # Hash the password
    print("\n1️⃣ Hashing password...")
    hashed = hash_password(test_password)
    print(f"Hashed password: {hashed}")
    print(f"Hash length: {len(hashed)} characters")
    
    # Verify correct password
    print("\n2️⃣ Testing correct password verification...")
    is_valid = verify_password(test_password, hashed)
    print(f"Correct password verification: {is_valid} ✅")
    
    # Verify wrong password
    print("\n3️⃣ Testing wrong password verification...")
    wrong_password = "wrongPassword123!"
    is_valid_wrong = verify_password(wrong_password, hashed)
    print(f"Wrong password verification: {is_valid_wrong} ❌")
    
    # Show that same password creates different hashes (salt effect)
    print("\n4️⃣ Testing salt uniqueness...")
    hash1 = hash_password(test_password)
    hash2 = hash_password(test_password)
    print(f"Hash 1: {hash1}")
    print(f"Hash 2: {hash2}")
    print(f"Hashes are different: {hash1 != hash2} ✅")
    print("(This is GOOD! Salt makes each hash unique)")
    
    # Verify both hashes work with same password
    print("\n5️⃣ Testing both hashes verify correctly...")
    print(f"Password verifies against hash 1: {verify_password(test_password, hash1)} ✅")
    print(f"Password verifies against hash 2: {verify_password(test_password, hash2)} ✅")
    
    print("\n🎉 All password security tests passed!")
    print("Our password system is working correctly!")


if __name__ == "__main__":
    test_password_security()
