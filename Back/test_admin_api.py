#!/usr/bin/env python3
"""
AI Dock Admin API Testing Script

This script tests all the Admin User Management API endpoints to verify they work correctly.
Run this after setting up test data with setup_test_data.py.

Usage:
    python test_admin_api.py
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

class AdminAPITester:
    """Test harness for the Admin User Management API."""
    
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.headers = {}
        self.test_results = []
    
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results."""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    def authenticate(self) -> bool:
        """Login and get JWT token."""
        print("\n🔐 STEP 1: AUTHENTICATION")
        print("-" * 40)
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                data={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                self.headers = {"Authorization": f"Bearer {self.token}"}
                self.log_test("Admin Login", True, f"Token: {self.token[:20]}...")
                return True
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_health_check(self) -> bool:
        """Test API health endpoint."""
        print("\n🏥 STEP 2: HEALTH CHECK")
        print("-" * 40)
        
        try:
            response = requests.get(f"{self.base_url}/health")
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.log_test("Health Check", True, f"Status: {data.get('status')}, DB: {data.get('database')}")
            else:
                self.log_test("Health Check", False, f"Status: {response.status_code}")
            
            return success
            
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_user_statistics(self) -> bool:
        """Test user statistics endpoint."""
        print("\n📊 STEP 3: USER STATISTICS")
        print("-" * 40)
        
        try:
            response = requests.get(
                f"{self.base_url}/admin/users/statistics",
                headers=self.headers
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                total = data.get("total_users", 0)
                active = data.get("active_users", 0)
                self.log_test("Get User Statistics", True, f"Total: {total}, Active: {active}")
                
                # Display detailed stats
                print(f"    📈 Total Users: {data.get('total_users', 0)}")
                print(f"    🟢 Active Users: {data.get('active_users', 0)}")
                print(f"    🔴 Inactive Users: {data.get('inactive_users', 0)}")
                print(f"    ✅ Verified Users: {data.get('verified_users', 0)}")
                print(f"    👑 Admin Users: {data.get('admin_users', 0)}")
                
                if "users_by_role" in data:
                    print("    📊 Users by Role:")
                    for role_stat in data["users_by_role"]:
                        print(f"      - {role_stat['role_name']}: {role_stat['count']}")
                
            else:
                self.log_test("Get User Statistics", False, f"Status: {response.status_code}")
            
            return success
            
        except Exception as e:
            self.log_test("Get User Statistics", False, f"Exception: {str(e)}")
            return False
    
    def test_search_users(self) -> Dict[str, Any]:
        """Test user search endpoint."""
        print("\n🔍 STEP 4: SEARCH USERS")
        print("-" * 40)
        
        all_users = {}
        
        try:
            # Test 1: Get all users
            response = requests.get(
                f"{self.base_url}/admin/users/search",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                total = data.get("total_count", 0)
                
                for user in users:
                    all_users[user["id"]] = user
                
                self.log_test("Search All Users", True, f"Found {len(users)} users (total: {total})")
                
                # Display user list
                print("    👥 Found Users:")
                for user in users[:5]:  # Show first 5
                    status = "🟢" if user["is_active"] else "🔴"
                    role = user.get("role", {}).get("display_name", "Unknown")
                    dept = user.get("department", {}).get("display_name", "No Department")
                    print(f"      {status} {user['username']} ({role}) - {dept}")
                
                if len(users) > 5:
                    print(f"      ... and {len(users) - 5} more")
                
            else:
                self.log_test("Search All Users", False, f"Status: {response.status_code}")
            
            # Test 2: Search with query
            response = requests.get(
                f"{self.base_url}/admin/users/search?search_query=john&page_size=5",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                self.log_test("Search with Query", True, f"Found {len(users)} users matching 'john'")
            else:
                self.log_test("Search with Query", False, f"Status: {response.status_code}")
            
            # Test 3: Filter by role
            response = requests.get(
                f"{self.base_url}/admin/users/search?role_name=user&page_size=10",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                self.log_test("Filter by Role", True, f"Found {len(users)} users with 'user' role")
            else:
                self.log_test("Filter by Role", False, f"Status: {response.status_code}")
            
            # Test 4: Filter by active status
            response = requests.get(
                f"{self.base_url}/admin/users/search?is_active=false",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                self.log_test("Filter Inactive Users", True, f"Found {len(users)} inactive users")
            else:
                self.log_test("Filter Inactive Users", False, f"Status: {response.status_code}")
            
        except Exception as e:
            self.log_test("Search Users", False, f"Exception: {str(e)}")
        
        return all_users
    
    def test_get_user_by_id(self, user_id: int) -> bool:
        """Test get user by ID endpoint."""
        try:
            response = requests.get(
                f"{self.base_url}/admin/users/{user_id}",
                headers=self.headers
            )
            
            success = response.status_code == 200
            
            if success:
                user = response.json()
                self.log_test(f"Get User by ID ({user_id})", True, f"User: {user['username']}")
            else:
                self.log_test(f"Get User by ID ({user_id})", False, f"Status: {response.status_code}")
            
            return success
            
        except Exception as e:
            self.log_test(f"Get User by ID ({user_id})", False, f"Exception: {str(e)}")
            return False
    
    def test_create_user(self) -> Optional[int]:
        """Test user creation endpoint."""
        print("\n➕ STEP 5: CREATE USER")
        print("-" * 40)
        
        try:
            new_user_data = {
                "username": f"testuser_{int(time.time())}",
                "email": f"testuser_{int(time.time())}@aidock.local",
                "full_name": "Test User Created by API",
                "password": "testpass123",
                "role_id": 2,  # Assuming user role ID is 2
                "department_id": 1,  # Assuming engineering department ID is 1
                "job_title": "API Test User",
                "phone": "+1-555-9999",
                "bio": "Created during API testing"
            }
            
            response = requests.post(
                f"{self.base_url}/admin/users/",
                headers=self.headers,
                json=new_user_data
            )
            
            if response.status_code == 201:
                user = response.json()
                user_id = user["id"]
                self.log_test("Create User", True, f"Created user: {user['username']} (ID: {user_id})")
                return user_id
            else:
                self.log_test("Create User", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create User", False, f"Exception: {str(e)}")
            return None
    
    def test_update_user(self, user_id: int) -> bool:
        """Test user update endpoint."""
        print("\n✏️ STEP 6: UPDATE USER")
        print("-" * 40)
        
        try:
            update_data = {
                "full_name": "Updated Test User Name",
                "job_title": "Updated Job Title",
                "bio": "Updated during API testing"
            }
            
            response = requests.put(
                f"{self.base_url}/admin/users/{user_id}",
                headers=self.headers,
                json=update_data
            )
            
            success = response.status_code == 200
            
            if success:
                user = response.json()
                self.log_test("Update User", True, f"Updated: {user['full_name']}")
            else:
                self.log_test("Update User", False, f"Status: {response.status_code}")
            
            return success
            
        except Exception as e:
            self.log_test("Update User", False, f"Exception: {str(e)}")
            return False
    
    def test_user_activation(self, user_id: int) -> bool:
        """Test user activation/deactivation endpoints."""
        print("\n🔄 STEP 7: USER ACTIVATION")
        print("-" * 40)
        
        success_count = 0
        
        try:
            # Test deactivation
            response = requests.post(
                f"{self.base_url}/admin/users/{user_id}/deactivate",
                headers=self.headers
            )
            
            if response.status_code == 200:
                user = response.json()
                is_active = user.get("is_active", True)
                if not is_active:
                    self.log_test("Deactivate User", True, "User successfully deactivated")
                    success_count += 1
                else:
                    self.log_test("Deactivate User", False, "User is still active")
            else:
                self.log_test("Deactivate User", False, f"Status: {response.status_code}")
            
            # Test activation
            response = requests.post(
                f"{self.base_url}/admin/users/{user_id}/activate",
                headers=self.headers
            )
            
            if response.status_code == 200:
                user = response.json()
                is_active = user.get("is_active", False)
                if is_active:
                    self.log_test("Activate User", True, "User successfully activated")
                    success_count += 1
                else:
                    self.log_test("Activate User", False, "User is still inactive")
            else:
                self.log_test("Activate User", False, f"Status: {response.status_code}")
            
            return success_count == 2
            
        except Exception as e:
            self.log_test("User Activation Tests", False, f"Exception: {str(e)}")
            return False
    
    def test_bulk_operations(self, user_ids: list) -> bool:
        """Test bulk operations endpoint."""
        print("\n📦 STEP 8: BULK OPERATIONS")
        print("-" * 40)
        
        if len(user_ids) < 2:
            self.log_test("Bulk Operations", False, "Need at least 2 users for bulk testing")
            return False
        
        try:
            # Test bulk activation
            bulk_data = {
                "user_ids": user_ids[:3],  # Test with first 3 users
                "action": "activate"
            }
            
            response = requests.post(
                f"{self.base_url}/admin/users/bulk",
                headers=self.headers,
                json=bulk_data
            )
            
            if response.status_code == 200:
                result = response.json()
                successful = result.get("successful_count", 0)
                total = result.get("total_requested", 0)
                self.log_test("Bulk Activate", True, f"Successful: {successful}/{total}")
                return True
            else:
                self.log_test("Bulk Activate", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Bulk Operations", False, f"Exception: {str(e)}")
            return False
    
    def test_delete_user(self, user_id: int) -> bool:
        """Test user deletion endpoint."""
        print("\n🗑️ STEP 9: DELETE USER")
        print("-" * 40)
        
        try:
            response = requests.delete(
                f"{self.base_url}/admin/users/{user_id}",
                headers=self.headers
            )
            
            success = response.status_code == 200
            
            if success:
                result = response.json()
                self.log_test("Delete User", True, f"User {user_id} deleted successfully")
            else:
                self.log_test("Delete User", False, f"Status: {response.status_code}")
            
            return success
            
        except Exception as e:
            self.log_test("Delete User", False, f"Exception: {str(e)}")
            return False
    
    def test_get_user_by_username(self) -> bool:
        """Test get user by username endpoint."""
        try:
            response = requests.get(
                f"{self.base_url}/admin/users/username/admin",
                headers=self.headers
            )
            
            success = response.status_code == 200
            
            if success:
                user = response.json()
                self.log_test("Get User by Username", True, f"Found: {user['full_name']}")
            else:
                self.log_test("Get User by Username", False, f"Status: {response.status_code}")
            
            return success
            
        except Exception as e:
            self.log_test("Get User by Username", False, f"Exception: {str(e)}")
            return False
    
    def test_get_user_by_email(self) -> bool:
        """Test get user by email endpoint."""
        try:
            response = requests.get(
                f"{self.base_url}/admin/users/email/admin@aidock.local",
                headers=self.headers
            )
            
            success = response.status_code == 200
            
            if success:
                user = response.json()
                self.log_test("Get User by Email", True, f"Found: {user['full_name']}")
            else:
                self.log_test("Get User by Email", False, f"Status: {response.status_code}")
            
            return success
            
        except Exception as e:
            self.log_test("Get User by Email", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run the complete test suite."""
        print("🧪 AI DOCK ADMIN API TEST SUITE")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("\n❌ Authentication failed. Cannot continue with tests.")
            return
        
        # Step 2: Health check
        self.test_health_check()
        
        # Step 3: Statistics
        self.test_user_statistics()
        
        # Step 4: Search users
        all_users = self.test_search_users()
        
        if all_users:
            # Step 5: Get user by ID (test with first user)
            first_user_id = list(all_users.keys())[0]
            self.test_get_user_by_id(first_user_id)
            
            print("\n🔍 STEP 4.5: ADDITIONAL LOOKUP TESTS")
            print("-" * 40)
            
            # Test username and email lookup
            self.test_get_user_by_username()
            self.test_get_user_by_email()
        
        # Step 6: Create a new user
        new_user_id = self.test_create_user()
        
        if new_user_id:
            # Step 7: Update the user
            self.test_update_user(new_user_id)
            
            # Step 8: Test activation/deactivation
            self.test_user_activation(new_user_id)
            
            # Step 9: Test bulk operations
            if all_users:
                user_ids = list(all_users.keys())
                self.test_bulk_operations(user_ids)
            
            # Step 10: Delete the test user
            self.test_delete_user(new_user_id)
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary."""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"\n✅ Passed: {passed}")
        print(f"❌ Failed: {total - passed}")
        print(f"📊 Total: {total}")
        print(f"🎯 Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n" + "=" * 60)
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Your Admin API is working perfectly!")
        elif passed > total * 0.8:
            print("✅ Most tests passed! Check the failed tests above.")
        else:
            print("⚠️  Several tests failed. Check your API implementation.")
        
        print("=" * 60)

def main():
    """Main function to run the test suite."""
    print("🚀 Starting AI Dock Admin API Testing...")
    print(f"📍 Testing against: {BASE_URL}")
    print(f"👤 Admin user: {ADMIN_USERNAME}")
    print()
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print("❌ Server is not responding correctly. Please start the backend server.")
            print("   Run: uvicorn app.main:app --reload")
            return
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to the server. Please ensure the backend is running.")
        print("   Run: uvicorn app.main:app --reload")
        return
    
    # Run tests
    tester = AdminAPITester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()
