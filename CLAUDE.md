# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Dock is a secure internal LLM gateway for enterprises with a FastAPI backend and React frontend. The system provides user authentication, role-based access control, LLM integration with multiple providers, usage tracking, and quota management.

## Development Commands

### Backend (FastAPI)
```bash
# Navigate to backend directory
cd Back

# Create and activate virtual environment
python -m venv ai_dock_env
source ai_dock_env/bin/activate  # On Windows: ai_dock_env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Alternative: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Alternative: ./quick_start.sh

# Test the API
curl http://localhost:8000/health
```

### Frontend (React + Vite)
```bash
# Navigate to frontend directory
cd Front

# Install dependencies
npm install

# Run development server
npm run dev  # Starts on port 8080

# Build for production
npm run build

# Lint code
npm run lint
```

## Architecture

### Backend Architecture
- **FastAPI** with async/await patterns throughout
- **SQLAlchemy 2.0** with async database operations
- **Pydantic** for data validation and settings management
- **JWT** authentication with role-based access control
- **LiteLLM** integration for multiple LLM providers (OpenAI, Anthropic, etc.)
- **Streaming responses** via Server-Sent Events for real-time chat

### Database Models
Key models include:
- **User** - Authentication and user management
- **Department** - Organizational structure
- **Role** - Permission-based access control
- **LLMConfig** - LLM provider configurations
- **Quota** - Usage limits and tracking
- **Conversation** - Chat history and context
- **Assistant** - Custom AI assistants
- **Project** - Conversation organization
- **UsageLog** - Usage analytics and billing

### API Structure
- `/auth/*` - Authentication endpoints
- `/admin/*` - Admin management (users, quotas, LLM configs)
- `/manager/*` - Manager-level operations
- `/chat/*` - Chat and streaming endpoints
- `/files/*` - File upload and processing
- `/assistants/*` - Custom assistant management
- `/api/projects/*` - Project and conversation management

### Frontend Architecture
- **React** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Axios** for API communication
- **React Router** for navigation

### Key Frontend Components
- **AuthContext** - Global authentication state
- **ChatInterface** - Main chat functionality with streaming
- **AdminSettings** - Admin dashboard
- **AssistantManagement** - Custom assistant creation
- **ProjectManager** - Conversation organization
- **FileUpload** - Secure file handling

## Configuration

### Environment Variables
Backend uses `.env` file with:
- `DATABASE_URL` - Database connection string
- `SECRET_KEY` - JWT signing key (must be secure in production)
- `OPENAI_API_KEY` - OpenAI API access
- `ANTHROPIC_API_KEY` - Anthropic Claude API access
- `FRONTEND_URL` - Frontend URL for CORS

### Key Configuration Files
- `Back/app/core/config.py` - Central configuration management
- `Back/app/core/database.py` - Database setup and connection
- `Front/vite.config.ts` - Frontend build configuration

## Development Workflow

### Starting the Application
1. Start backend: `cd Back && ./quick_start.sh`
2. Start frontend: `cd Front && npm run dev`
3. Visit http://localhost:8080 for the application
4. API docs available at http://localhost:8000/docs

### Key Development Patterns
- **Async/await** throughout backend for performance
- **Dependency injection** in FastAPI for testability
- **Pydantic schemas** for request/response validation
- **SQLAlchemy async sessions** for database operations
- **JWT middleware** for authentication
- **Error handling** with custom exception classes
- **Streaming responses** for real-time chat

### Testing
- Backend: API documentation provides interactive testing at `/docs`
- Health checks available at `/health` and `/chat/health`
- CORS testing endpoint at `/cors/test`

## Security Features
- JWT token-based authentication
- Role-based access control (Admin, Manager, User)
- CORS configuration for frontend integration
- Security headers middleware
- File upload validation and security
- API key management for LLM providers

## LLM Integration
- **LiteLLM** for unified provider interface
- **Dynamic model fetching** from providers
- **Cost calculation** and quota enforcement
- **Usage tracking** and analytics
- **Streaming responses** for real-time chat
- **Custom assistants** with system prompts

## File Processing
- **Multi-format support** (PDF, DOCX, TXT)
- **Content extraction** and preview
- **Secure upload** with validation
- **File analytics** and management
- **Integration with chat** for document analysis

## Railway Deployment

### Deployment Files
- `railway.json` - Railway deployment configuration
- `Procfile` - Process definition for Railway
- `nixpacks.toml` - Nixpacks build configuration
- `start.sh` - Startup script
- `RAILWAY_DEPLOY.md` - Complete deployment guide

### Quick Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy from Back directory
cd Back
railway login
railway init
railway up
```

### Required Environment Variables for Railway
```
DATABASE_URL=postgresql://... (auto-provided by Railway PostgreSQL)
SECRET_KEY=your-secure-secret-key
ENVIRONMENT=production
DEBUG=false
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
FRONTEND_URL=https://your-frontend-domain.com
```

### Configuration Updates for Railway
- `app/core/config.py` updated to use `PORT` environment variable
- Environment variables properly configured for production
- Health check endpoint at `/health` for Railway monitoring
```

## Development Recommendations

- Always use `python3` for any local python call that is not inside a virtual env.