#!/usr/bin/env python3
"""
Quick script to start the AI Dock backend server for testing.

This script starts the FastAPI server with the correct settings for development and testing.

Usage:
    python start_server.py
"""

import subprocess
import sys
import os
from pathlib import Path

def start_backend_server():
    """Start the FastAPI backend server."""
    print("🚀 Starting AI Dock Backend Server...")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not Path("app/main.py").exists():
        print("❌ Error: app/main.py not found")
        print("   Please run this script from the /Back directory")
        sys.exit(1)
    
    # Check if virtual environment exists
    venv_path = Path("ai_dock_env")
    if not venv_path.exists():
        print("❌ Error: Virtual environment not found")
        print("   Expected: ai_dock_env/")
        print("   Please create the virtual environment first")
        sys.exit(1)
    
    # Prepare environment
    env = os.environ.copy()
    
    # Add virtual environment to PATH
    if sys.platform == "win32":
        env["PATH"] = str(venv_path / "Scripts") + os.pathsep + env["PATH"]
        python_executable = venv_path / "Scripts" / "python.exe"
    else:
        env["PATH"] = str(venv_path / "bin") + os.pathsep + env["PATH"]
        python_executable = venv_path / "bin" / "python"
    
    # Server command
    cmd = [
        str(python_executable),
        "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload",
        "--log-level", "info"
    ]
    
    print("🔧 Server Configuration:")
    print(f"   Host: 0.0.0.0:8000")
    print(f"   Reload: Enabled")
    print(f"   Python: {python_executable}")
    print(f"   Working Directory: {Path.cwd()}")
    print("")
    print("📋 Useful URLs:")
    print("   API Health: http://localhost:8000/health")
    print("   API Docs: http://localhost:8000/docs")
    print("   Admin API: http://localhost:8000/admin/users/search")
    print("")
    print("⚠️  Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        # Start the server
        subprocess.run(cmd, env=env)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        print("   Please ensure all dependencies are installed")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    start_backend_server()
