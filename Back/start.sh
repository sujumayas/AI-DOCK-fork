#!/bin/bash

# Railway Startup Script for AI Dock Backend
# This script handles the startup process for Railway deployment

echo "🚀 Starting AI Dock Backend on Railway..."
echo "Environment: $ENVIRONMENT"
echo "Port: $PORT"
echo "Database: $DATABASE_URL"

# Start the FastAPI application
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT