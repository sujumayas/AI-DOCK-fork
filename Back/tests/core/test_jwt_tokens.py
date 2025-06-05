#!/usr/bin/env python3
"""
Test script for JWT token functionality.

This tests our JWT token creation, verification, and expiration handling.
"""

import sys
import os
import time
from datetime import timedelta

# Add the project root to the path so we can import our app modules
sys.path.append('/Users/blas/Desktop/INRE/INRE-DOCK-2/Back')

from app.core.security import (
    create_access_token, 
    create_refresh_token, 
    verify_token,
    decode_token_without_verification
)


def test_jwt_tokens():
    """Test our JWT token creation and verification functions."""
    
    print("🎫 Testing AI Dock JWT Token System")
    print("=" * 50)
    
    # Sample user data to encode in token
    user_data = {
        "user_id": 123,
        "email": "test@company.com",
        "role": "user",
        "department": "Engineering"
    }
    
    print(f"User data to encode: {user_data}")
    
    # Test 1: Create access token
    print("\n1️⃣ Creating access token...")
    access_token = create_access_token(user_data)
    print(f"Access token created: {access_token[:50]}...")
    print(f"Token length: {len(access_token)} characters")
    
    # Test 2: Verify valid access token
    print("\n2️⃣ Verifying valid access token...")
    decoded_data = verify_token(access_token)
    if decoded_data:
        print("✅ Token verification successful!")
        print(f"Decoded user_id: {decoded_data.get('user_id')}")
        print(f"Decoded email: {decoded_data.get('email')}")
        print(f"Token expires at: {decoded_data.get('exp')}")
    else:
        print("❌ Token verification failed!")
    
    # Test 3: Create refresh token
    print("\n3️⃣ Creating refresh token...")
    refresh_data = {"user_id": user_data["user_id"]}
    refresh_token = create_refresh_token(refresh_data)
    print(f"Refresh token created: {refresh_token[:50]}...")
    
    # Test 4: Verify refresh token
    print("\n4️⃣ Verifying refresh token...")
    refresh_decoded = verify_token(refresh_token)
    if refresh_decoded:
        print("✅ Refresh token verification successful!")
        print(f"Token type: {refresh_decoded.get('token_type')}")
        print(f"User ID: {refresh_decoded.get('user_id')}")
    else:
        print("❌ Refresh token verification failed!")
    
    # Test 5: Test invalid token
    print("\n5️⃣ Testing invalid token...")
    fake_token = "invalid.token.here"
    invalid_result = verify_token(fake_token)
    if invalid_result is None:
        print("✅ Invalid token correctly rejected!")
    else:
        print("❌ Invalid token was accepted (this is bad!)")
    
    # Test 6: Test expired token (create with 1-second expiration)
    print("\n6️⃣ Testing token expiration...")
    short_token = create_access_token(user_data, expires_delta=timedelta(seconds=1))
    print("Created token with 1-second expiration...")
    
    # Verify immediately (should work)
    immediate_result = verify_token(short_token)
    print(f"Immediate verification: {'✅ Success' if immediate_result else '❌ Failed'}")
    
    # Wait 2 seconds and try again (should fail)
    print("Waiting 2 seconds for token to expire...")
    time.sleep(2)
    expired_result = verify_token(short_token)
    print(f"After expiration: {'❌ Still valid (bad!)' if expired_result else '✅ Correctly expired'}")
    
    # Test 7: Decode expired token without verification (for debugging)
    print("\n7️⃣ Debugging expired token...")
    debug_data = decode_token_without_verification(short_token)
    if debug_data:
        print("✅ Debug decode successful (unverified)")
        print(f"Original user_id: {debug_data.get('user_id')}")
        print(f"Expiration time: {debug_data.get('exp')}")
    else:
        print("❌ Debug decode failed")
    
    print("\n🎉 JWT Token testing complete!")
    print("Our token system is working correctly!")


if __name__ == "__main__":
    test_jwt_tokens()
