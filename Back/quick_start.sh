#!/bin/bash
# Quick start script for AI Dock backend server
# Check if we're in the right directory
if [ ! -f "app/main.py" ]; then
    echo "❌ Error: Not in the correct directory"
    echo "   Please run this from: /Users/blas/Desktop/INRE/INRE-DOCK-2/Back"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "ai_dock_env" ]; then
    echo "❌ Error: Virtual environment not found"
    echo "   Expected: ai_dock_env/"
    exit 1
fi

# Activate virtual environment
source ai_dock_env/bin/activate

echo "🚀 Starting FastAPI server..."
echo "   URL: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo "   Health: http://localhost:8000/health"
echo ""
echo "⚠️  Press Ctrl+C to stop the server"
echo "=================================="

# Start the server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload