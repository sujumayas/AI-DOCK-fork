# Railway Deployment Guide for AI Dock Backend

This guide walks you through deploying the AI Dock backend to Railway.

## Prerequisites

1. **Railway Account**: Create an account at [railway.app](https://railway.app)
2. **Railway CLI** (optional): Install with `npm install -g @railway/cli`
3. **Git Repository**: Your code should be in a Git repository

## Deployment Steps

### 1. Connect to Railway

#### Option A: Using Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Select the `Back` folder as the root directory

#### Option B: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project in the Back directory
cd Back
railway init

# Deploy
railway up
```

### 2. Configure Environment Variables

In your Railway project dashboard, go to **Variables** tab and add:

#### Required Variables:
```
DATABASE_URL=postgresql://username:password@host:port/database
SECRET_KEY=your-super-secret-key-here
ENVIRONMENT=production
DEBUG=false
```

#### Optional LLM Provider Variables:
```
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
FRONTEND_URL=https://your-frontend-domain.com
```

### 3. Add Database (PostgreSQL)

1. In Railway dashboard, click "New Service"
2. Select "PostgreSQL"
3. Railway will automatically set `DATABASE_URL` environment variable

### 4. Domain Configuration

1. In Railway dashboard, go to **Settings** → **Domains**
2. Generate a domain or add your custom domain
3. Update `FRONTEND_URL` in environment variables if needed

## Configuration Files

The following files have been created for Railway deployment:

### `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pip install -r requirements.txt"
  },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### `Procfile`
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### `nixpacks.toml`
```toml
[phases.setup]
nixPkgs = ['python311', 'gcc', 'pkg-config']

[phases.install]
cmds = ['pip install -r requirements.txt']

[start]
cmd = 'uvicorn app.main:app --host 0.0.0.0 --port $PORT'
```

## Important Notes

1. **Environment Variables**: Railway will provide `PORT` and `DATABASE_URL` automatically
2. **Static Files**: Railway handles static file serving automatically
3. **Health Checks**: The `/health` endpoint is configured for Railway health checks
4. **Logs**: Access logs through Railway dashboard under "Logs" tab

## Troubleshooting

### Common Issues:

1. **Build Failures**: Check logs in Railway dashboard
2. **Environment Variables**: Ensure all required variables are set
3. **Database Connection**: Verify `DATABASE_URL` is correct
4. **Port Issues**: Railway sets `PORT` automatically, don't hardcode it

### Useful Commands:
```bash
# View logs
railway logs

# Check environment variables
railway variables

# Connect to database
railway connect postgresql

# Open deployed app
railway open
```

## Monitoring

After deployment, monitor your application:

1. **Health Check**: Visit `https://your-domain.railway.app/health`
2. **API Docs**: Visit `https://your-domain.railway.app/docs`
3. **Logs**: Check Railway dashboard for application logs
4. **Metrics**: Monitor CPU, memory, and request metrics in Railway dashboard

## Security Checklist

- [ ] `SECRET_KEY` is securely generated and set
- [ ] `DEBUG` is set to `false` in production
- [ ] Database credentials are secure
- [ ] LLM API keys are properly configured
- [ ] CORS settings allow your frontend domain
- [ ] Environment is set to `production`

## Next Steps

1. Configure your frontend to use the Railway backend URL
2. Set up custom domain (optional)
3. Configure monitoring and alerts
4. Set up CI/CD pipeline for automatic deployments