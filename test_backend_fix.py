#!/usr/bin/env python3
"""
🔧 Backend Startup Test Script
Test if the backend can start after fixing the Pydantic conflict
"""

import subprocess
import sys
import os
import time

def test_backend_startup():
    """Test if backend can start without Pydantic errors"""
    print("🔧 Testing AI Dock Backend Startup")
    print("=" * 50)
    
    # Change to backend directory
    backend_dir = "/Users/blas/Desktop/INRE/INRE-DOCK-2/Back"
    os.chdir(backend_dir)
    
    print(f"📂 Working directory: {os.getcwd()}")
    
    # Try to import the main app to check for syntax/import errors
    print("\n🔍 Testing imports...")
    try:
        # Add backend directory to Python path
        sys.path.insert(0, backend_dir)
        
        # Try importing the main app
        from app.main import app
        print("✅ Successfully imported FastAPI app")
        
        # Try importing the problematic schema
        from app.schemas.llm_config import LLMConfigurationCreate
        print("✅ Successfully imported LLM configuration schema")
        
        # Try creating a test instance
        test_config = LLMConfigurationCreate(
            name="Test Config",
            provider="openai",
            api_endpoint="https://api.openai.com/v1",
            api_key="sk-test123456789",
            default_model="gpt-4",
            model_parameters={"temperature": 0.7}  # This should work now
        )
        print("✅ Successfully created test configuration instance")
        
        print("\n🎉 All imports successful! Pydantic conflict resolved!")
        return True
        
    except Exception as e:
        print(f"\n❌ Import/Validation Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_server_startup():
    """Test actual server startup"""
    print("\n🚀 Testing server startup...")
    
    try:
        # Try to start the server for a few seconds
        process = subprocess.Popen(
            ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait a bit for startup
        time.sleep(3)
        
        # Check if process is still running
        if process.poll() is None:
            print("✅ Server started successfully!")
            
            # Kill the test server
            process.terminate()
            process.wait(timeout=5)
            
            return True
        else:
            # Process died, get error output
            stdout, stderr = process.communicate()
            print(f"❌ Server failed to start:")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Server startup test failed: {e}")
        return False

if __name__ == "__main__":
    print("🔧 AI Dock Backend Fix Verification")
    print("=" * 50)
    
    # Test imports first
    imports_ok = test_backend_startup()
    
    if imports_ok:
        # Test server startup
        server_ok = test_server_startup()
        
        if server_ok:
            print("\n" + "=" * 50)
            print("🎉 SUCCESS! Backend is ready to run!")
            print("=" * 50)
            print("\n✅ Next steps:")
            print("1. Start backend: cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back && ./quick_start.sh")
            print("2. Start frontend: cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Front && npm run dev")
            print("3. Login with: admin@aidock.dev / admin123!")
        else:
            print("\n❌ Server startup failed. Check error messages above.")
    else:
        print("\n❌ Import errors still exist. Check error messages above.")
