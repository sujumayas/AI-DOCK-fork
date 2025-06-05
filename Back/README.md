# AI Dock Backend 🚀

A secure FastAPI backend for the AI Dock application - an internal LLM gateway for enterprises.

## 🎯 What This Backend Does

- **🔐 User Authentication**: Secure JWT-based login system
- **🤖 LLM Integration**: Connect to multiple AI providers (OpenAI, Claude, etc.)  
- **👥 User Management**: Role-based access control and department organization
- **📊 Usage Tracking**: Monitor LLM usage and enforce quotas
- **🛡️ Security**: Enterprise-grade security for sensitive data

## 🛠️ Technology Stack

- **FastAPI**: Modern, fast Python web framework
- **SQLAlchemy**: Database ORM for PostgreSQL
- **JWT**: Secure authentication tokens
- **Pydantic**: Data validation and parsing
- **uvicorn**: ASGI web server

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.9+ installed
- PostgreSQL running (or use SQLite for development)

### 2. Setup Virtual Environment

```bash
# Navigate to backend directory
cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back

# Create virtual environment
python -m venv ai_dock_env

# Activate virtual environment
# On macOS/Linux:
source ai_dock_env/bin/activate
# On Windows:
# ai_dock_env\Scripts\activate
```

### 3. Install Dependencies

```bash
# Install all required packages
pip install -r requirements.txt
```

### 4. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your actual values
# At minimum, set:
# - SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
# - DATABASE_URL (or use SQLite for development)
# - LLM API keys when ready to test
```

### 5. Run the Development Server

```bash
# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or alternatively:
python -m app.main
```

### 6. Verify Everything Works

Open your browser and visit:

- **API Homepage**: http://localhost:8000
- **Health Check**: http://localhost:8000/health  
- **API Documentation**: http://localhost:8000/docs 🎉
- **Alternative Docs**: http://localhost:8000/redoc

You should see:
```json
{
  "message": "Welcome to AI Dock API! 🤖",
  "documentation": "/docs",
  "health_check": "/health"
}
```

## 📂 Project Structure

```
Back/
├── app/
│   ├── __init__.py              # Package marker
│   ├── main.py                  # FastAPI application entry point
│   ├── core/                    # Core configuration (coming soon)
│   ├── models/                  # Database models (coming soon)
│   ├── api/                     # API route handlers (coming soon)
│   ├── services/                # Business logic (coming soon)
│   └── schemas/                 # Pydantic schemas (coming soon)
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variables template
└── README.md                    # This file
```

## 🧪 Testing the API

### Using curl

```bash
# Health check
curl http://localhost:8000/health

# Root endpoint
curl http://localhost:8000/
```

### Using the Interactive Docs

1. Go to http://localhost:8000/docs
2. Click "Try it out" on any endpoint
3. Click "Execute" to test

## 🔧 Development Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server with auto-reload
uvicorn app.main:app --reload

# Format code with Black
black app/

# Run tests (when we add them)
pytest
```

## 🌍 Environment Variables

See `.env.example` for all configuration options. Key variables:

- `SECRET_KEY`: JWT token signing key (required)
- `DATABASE_URL`: Database connection string
- `OPENAI_API_KEY`: OpenAI API access
- `ANTHROPIC_API_KEY`: Claude API access
- `ENVIRONMENT`: development/staging/production

## 🚀 Next Steps

1. **Database Setup**: Add SQLAlchemy models and database connection
2. **Authentication**: Implement JWT-based user authentication  
3. **LLM Integration**: Connect to OpenAI, Claude, and other providers
4. **User Management**: Build admin interface for user/department management
5. **Usage Tracking**: Implement quota management and usage analytics

## 📝 API Documentation

Once running, visit http://localhost:8000/docs for complete API documentation with:
- Interactive endpoint testing
- Request/response schemas  
- Authentication examples
- Error code explanations

## 🆘 Troubleshooting

### Common Issues

**Port 8000 already in use:**
```bash
# Use a different port
uvicorn app.main:app --reload --port 8001
```

**Import errors:**
```bash
# Make sure you're in the Back/ directory and virtual environment is activated
cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back
source ai_dock_env/bin/activate
```

**Missing dependencies:**
```bash
# Reinstall requirements
pip install -r requirements.txt
```

---

## 🎓 Learning Resources

This backend is built with educational comments throughout. Key concepts:

- **FastAPI Basics**: Automatic API docs, request/response handling
- **Async Programming**: Modern Python async/await patterns
- **API Design**: RESTful principles, status codes, error handling
- **Security**: JWT tokens, password hashing, CORS
- **Database Integration**: SQLAlchemy ORM patterns

Ready to build something amazing! 🚀
