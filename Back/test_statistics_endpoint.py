#!/usr/bin/env python3
"""
Test script to debug the statistics endpoint issue
"""

import requests
import json

# Configuration
API_BASE_URL = "http://localhost:8000"

# Step 1: Login as admin
print("🔐 Logging in as admin...")
login_response = requests.post(
    f"{API_BASE_URL}/auth/login",
    data={
        "username": "admin@aidock.dev",
        "password": "admin123"
    }
)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    print(login_response.text)
    exit(1)

token = login_response.json()["access_token"]
print(f"✅ Got token: {token[:20]}...")

# Step 2: Try to get statistics
print("\n📊 Fetching user statistics...")
headers = {
    "Authorization": f"Bearer {token}"
}

stats_response = requests.get(
    f"{API_BASE_URL}/admin/users/statistics",
    headers=headers
)

print(f"Status code: {stats_response.status_code}")
print(f"Headers: {dict(stats_response.headers)}")

if stats_response.status_code == 200:
    print("✅ Success! Statistics data:")
    print(json.dumps(stats_response.json(), indent=2))
else:
    print(f"❌ Failed with status {stats_response.status_code}")
    print("Response body:")
    print(stats_response.text)
    try:
        error_data = stats_response.json()
        print("\nParsed error:")
        print(json.dumps(error_data, indent=2))
    except:
        print("Could not parse error as JSON")

# Step 3: Let's also check if we can get users list
print("\n👥 Testing user list endpoint...")
users_response = requests.get(
    f"{API_BASE_URL}/admin/users/search",
    headers=headers
)

if users_response.status_code == 200:
    print("✅ User list endpoint works")
    data = users_response.json()
    print(f"Total users: {data.get('total_count', 0)}")
else:
    print(f"❌ User list failed: {users_response.status_code}")
