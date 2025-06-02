---

## AI Dock App - Project Overview

### Project Summary

**Name:** AI Dock App  
**Type:** Full-Stack Web Application  
**Purpose:** Secure internal platform for enterprise users to access multiple LLMs through a unified interface  
**Current State:** 🆕 **Fresh Start** - Clean project structure ready for development  

### What We're Building

The AI Dock App is a secure internal web application designed for companies (especially those handling sensitive information like banks) to provide employees access to various Large Language Models (OpenAI, Claude, Mistral, etc.) through a single, controlled interface. The app features role-based access control, departmental usage quotas, comprehensive usage tracking, and is designed for private cloud or intranet deployment.

### Core Features
- **🔐 User Authentication:** Secure login with JWT tokens and role-based access
- **👥 User Management:** Admin interface for managing users, departments, and roles
- **🤖 LLM Integration:** Connect to multiple AI providers (OpenAI, Claude, etc.)
- **💬 Chat Interface:** Clean, unified chat interface for all LLM interactions
- **📊 Usage Tracking:** Comprehensive logging of all interactions and usage
- **⚖️ Quota Management:** Department-based usage limits and enforcement
- **🛡️ Security:** Production-ready security measures for enterprise deployment

---

### Technology Stack

#### Frontend Stack
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite (fast development and building)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Routing:** React Router DOM v6
- **State Management:** React Query + React hooks
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React

#### Backend Stack
- **API Framework:** FastAPI (Python)
- **Database:** PostgreSQL with SQLAlchemy ORM
- **Authentication:** JWT tokens with refresh mechanism
- **Security:** bcrypt password hashing, rate limiting
- **API Documentation:** Automatic OpenAPI/Swagger docs
- **Background Tasks:** Celery + Redis (for cleanup, monitoring)

#### Deployment
- **Containerization:** Docker + Docker Compose
- **Environment:** Designed for private cloud/intranet hosting
- **Database:** PostgreSQL (production) or SQLite (development)
- **Caching:** Redis for sessions and background tasks

---

### Project Structure

```
/Users/blas/Desktop/INRE/INRE-DOCK-2/
├── Front/                          # React frontend (empty - ready for setup)
├── Back/                           # FastAPI backend (empty - ready for setup)
└── Helpers/                        # Project documentation
    ├── project_details.md          # This file
    ├── backlog.md                  # Development backlog
    └── assistant_prompt.md         # Claude assistant configuration
```

#### Planned Frontend Structure
```
Front/
├── src/
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # shadcn/ui base components
│   │   ├── auth/                   # Authentication components
│   │   ├── chat/                   # Chat interface components
│   │   └── admin/                  # Admin management components
│   ├── pages/                      # Page components
│   │   ├── Login.tsx              # Authentication page
│   │   ├── Dashboard.tsx          # Main user dashboard
│   │   ├── ChatInterface.tsx      # LLM chat interface
│   │   └── AdminSettings.tsx      # Admin management interface
│   ├── services/                   # API integration services
│   ├── hooks/                      # Custom React hooks
│   ├── types/                      # TypeScript type definitions
│   └── utils/                      # Utility functions
├── package.json                    # Dependencies and scripts
├── vite.config.ts                  # Vite configuration
└── tailwind.config.js              # Tailwind CSS configuration
```

#### Planned Backend Structure
```
Back/
├── app/
│   ├── api/                        # API route handlers
│   │   ├── auth.py                # Authentication endpoints
│   │   ├── chat.py                # Chat/LLM endpoints
│   │   └── admin/                 # Admin endpoints
│   ├── core/                       # Core configuration
│   │   ├── config.py              # App configuration
│   │   ├── database.py            # Database setup
│   │   └── security.py            # Security utilities
│   ├── models/                     # SQLAlchemy database models
│   │   ├── user.py                # User model
│   │   ├── role.py                # Role model
│   │   ├── department.py          # Department model
│   │   ├── llm_config.py          # LLM configuration model
│   │   └── usage_log.py           # Usage tracking model
│   ├── services/                   # Business logic services
│   │   ├── auth_service.py        # Authentication logic
│   │   ├── llm_service.py         # LLM integration
│   │   └── admin_service.py       # Admin operations
│   ├── schemas/                    # Pydantic data validation
│   └── main.py                     # FastAPI application entry
├── requirements.txt                # Python dependencies
└── .env.example                    # Environment variables template
```

---

### Data Models

#### User Management
- **User:** Core user account with authentication
- **Role:** User roles (admin, user, analyst, etc.)
- **Department:** Organizational departments for quota management

#### LLM Management
- **LLMConfiguration:** Store API keys and settings for different LLM providers
- **UsageLog:** Track every LLM interaction (user, model, tokens, cost, timestamp)
- **DepartmentQuota:** Usage limits and enforcement for each department

#### Key Relationships
- Users belong to Departments and have Roles
- UsageLogs track which User used which LLMConfiguration
- DepartmentQuotas limit usage per Department per LLMConfiguration

---

### Development Workflow

#### Getting Started (After Setup)
```bash
# Backend development
cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Back
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend development  
cd /Users/blas/Desktop/INRE/INRE-DOCK-2/Front
npm install
npm run dev
```

#### Application URLs (After Setup)
- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

---

### Current Implementation Status

**🆕 PROJECT STATUS: Fresh Start**

All directories are clean and ready for development. This is a complete restart with:
- ✅ Clean project structure established
- ✅ Fresh backlog with learning-focused approach
- ✅ Updated assistant prompt for educational development
- ⏳ Ready to begin with frontend setup (AID-001-A)

**📚 Learning Journey Ahead:**
- **Phase 1:** Project setup and basic structure
- **Phase 2:** Authentication system (login, JWT, protected routes)
- **Phase 3:** User management (admin interface, roles, departments)
- **Phase 4:** LLM integration (chat interface, provider configuration)
- **Phase 5:** Usage tracking and quota management
- **Phase 6:** Production readiness (security, deployment, monitoring)

**🎯 Immediate Next Steps:**
1. Set up React frontend with TypeScript and Tailwind CSS
2. Create FastAPI backend with basic health check endpoint
3. Establish database connection and basic models
4. Implement JWT authentication system
5. Build first working feature: user login

---

### Development Philosophy

This project follows a **learning-first approach** where each feature is:
- **Broken into small steps** (30 minutes or less each)
- **Thoroughly explained** (why we're doing it, how it works)
- **Immediately testable** (see results in browser/API)
- **Connected to bigger picture** (how it fits in the overall app)

The goal is not just to build an app, but to **learn fullstack development** through building a real, production-quality application.

---

*Ready to start building! 🚀*