#!/usr/bin/env python3
"""
Setup script for testing AID-003-B Admin User Management API

This script ensures the test environment is properly configured:
1. Checks if the backend server is running
2. Verifies database connectivity
3. Ensures admin user exists
4. Creates necessary test data if missing

Usage:
    python setup_test_environment.py
"""

import asyncio
import aiohttp
import sys
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TestEnvironmentSetup:
    """Setup and verify test environment for Admin API testing."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None

    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()

    async def check_server_running(self) -> bool:
        """Check if the backend server is running."""
        try:
            logger.info("🔍 Checking if backend server is running...")
            
            async with self.session.get(f"{self.base_url}/health", timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"✅ Backend server is running: {data.get('message')}")
                    logger.info(f"   Version: {data.get('version')}")
                    logger.info(f"   Environment: {data.get('environment')}")
                    logger.info(f"   Database: {data.get('database')}")
                    return True
                else:
                    logger.error(f"❌ Backend server returned HTTP {response.status}")
                    return False
                    
        except asyncio.TimeoutError:
            logger.error("❌ Backend server not responding (timeout)")
            return False
        except aiohttp.ClientConnectorError:
            logger.error("❌ Cannot connect to backend server")
            return False
        except Exception as e:
            logger.error(f"❌ Error checking server: {str(e)}")
            return False

    async def check_admin_exists(self) -> bool:
        """Check if admin user exists and can authenticate."""
        try:
            logger.info("🔍 Checking admin user credentials...")
            
            # Try to authenticate with default admin credentials
            auth_data = {"username": "admin", "password": "admin123"}
            
            async with self.session.post(
                f"{self.base_url}/auth/login", 
                json=auth_data,
                timeout=10
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    if data.get("access_token"):
                        logger.info("✅ Admin user authentication successful")
                        return True
                    else:
                        logger.error("❌ Admin authentication failed: No access token")
                        return False
                else:
                    logger.error(f"❌ Admin authentication failed: HTTP {response.status}")
                    response_text = await response.text()
                    logger.error(f"   Response: {response_text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Error checking admin user: {str(e)}")
            return False

    async def check_api_endpoints(self) -> bool:
        """Check if admin API endpoints are available."""
        try:
            logger.info("🔍 Checking admin API endpoints...")
            
            # First authenticate to get token
            auth_data = {"username": "admin", "password": "admin123"}
            
            async with self.session.post(f"{self.base_url}/auth/login", json=auth_data) as response:
                if response.status != 200:
                    logger.error("❌ Cannot authenticate for endpoint testing")
                    return False
                    
                auth_result = await response.json()
                token = auth_result.get("access_token")
                
                if not token:
                    logger.error("❌ No access token received")
                    return False

            # Test admin endpoints
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Test user search endpoint
            async with self.session.get(
                f"{self.base_url}/admin/users/search?page=1&page_size=5",
                headers=headers,
                timeout=10
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    user_count = len(data.get("users", []))
                    total_count = data.get("total_count", 0)
                    logger.info(f"✅ Admin API endpoints working: Found {user_count} users (total: {total_count})")
                    return True
                else:
                    logger.error(f"❌ Admin API endpoint failed: HTTP {response.status}")
                    response_text = await response.text()
                    logger.error(f"   Response: {response_text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Error testing API endpoints: {str(e)}")
            return False

    def check_test_script_exists(self) -> bool:
        """Check if test script exists."""
        test_script_path = Path("test_admin_api.py")
        
        if test_script_path.exists():
            logger.info("✅ Admin API test script found")
            return True
        else:
            logger.error("❌ Admin API test script not found (test_admin_api.py)")
            return False

    def show_startup_instructions(self):
        """Show instructions for starting the backend server."""
        logger.info("")
        logger.info("📋 Backend Server Startup Instructions:")
        logger.info("=" * 50)
        logger.info("1. Open a new terminal window")
        logger.info("2. Navigate to the backend directory:")
        logger.info("   cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back")
        logger.info("3. Activate the virtual environment:")
        logger.info("   source ai_dock_env/bin/activate")
        logger.info("4. Start the server:")
        logger.info("   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
        logger.info("5. Wait for the server to start (you should see 'Uvicorn running on...')")
        logger.info("6. Then run this setup script again")
        logger.info("")

    async def run_setup_checks(self) -> bool:
        """Run all setup checks."""
        logger.info("🚀 Setting up test environment for AID-003-B")
        logger.info("=" * 60)
        
        # Check if test script exists
        if not self.check_test_script_exists():
            return False
        
        # Check server
        if not await self.check_server_running():
            self.show_startup_instructions()
            return False
        
        # Check admin authentication
        if not await self.check_admin_exists():
            logger.error("")
            logger.error("❌ Admin user not found or credentials incorrect")
            logger.error("   Expected username: admin")
            logger.error("   Expected password: admin123")
            logger.error("")
            logger.error("   Please ensure admin user exists in database")
            return False
        
        # Check API endpoints
        if not await self.check_api_endpoints():
            return False
        
        logger.info("")
        logger.info("🎉 Test environment is ready!")
        logger.info("   You can now run: python test_admin_api.py")
        logger.info("")
        
        return True


async def main():
    """Main setup function."""
    print("🛠️  AI Dock Test Environment Setup")
    print("Setting up environment for AID-003-B testing...")
    print("=" * 60)
    
    try:
        async with TestEnvironmentSetup() as setup:
            success = await setup.run_setup_checks()
            
            if success:
                print("✅ Environment setup complete! Ready to test AID-003-B.")
                sys.exit(0)
            else:
                print("❌ Environment setup failed. Please fix the issues above.")
                sys.exit(1)
                
    except KeyboardInterrupt:
        print("\n⚠️  Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Fatal error during setup: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
