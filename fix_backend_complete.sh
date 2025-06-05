#!/bin/bash

# 🔧 AI Dock Complete Fix Script
# This script fixes the Pydantic issue and resets the database

echo "🔧 AI Dock Backend Fix & Reset"
echo "================================"

# Navigate to backend directory
cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back

echo "📂 Current directory: $(pwd)"

# Step 1: Reset database (clears old schema)
echo ""
echo "🗄️  Step 1: Resetting database..."
python3 reset_database.py

# Step 2: Setup test data (creates users, roles, departments)
echo ""
echo "👥 Step 2: Creating test data..."
python3 setup_test_data.py

# Step 3: Test backend startup
echo ""
echo "🚀 Step 3: Testing backend startup..."
echo "Starting server for 5 seconds to test..."

# Start server in background
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

# Wait for startup
sleep 5

# Test health endpoint
echo "📊 Testing health endpoint..."
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend is responding!"
else
    echo "❌ Backend not responding"
fi

# Kill test server
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "🎉 Fix Complete!"
echo "================"
echo ""
echo "✅ Next steps:"
echo "1. Start backend: ./quick_start.sh"
echo "2. Start frontend: cd ../Front && npm run dev" 
echo "3. Login with: admin@aidock.dev / admin123!"
echo ""
echo "🔍 If login still fails, run the debug tools:"
echo "   python3 ../debug_backend.py"
echo "   open ../frontend_debug.html"
