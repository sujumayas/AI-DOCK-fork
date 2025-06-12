# 🚀 AI Dock - Pre-Push Security Checklist

Run this checklist BEFORE every `git push` to avoid committing secrets!

## ✅ Security Checks

### 1. Check for sensitive files
```bash
# Navigate to project root
cd /Users/blas/Desktop/INRE/INRE-DOCK-2

# Check if .env is staged (should show nothing)
git status | grep "\.env"

# Verify no API keys in staged files
git diff --cached | grep -i "sk-"
git diff --cached | grep -i "api[_-]key"
```

### 2. Verify .gitignore is working
```bash
# These should NOT appear (should be empty output)
git ls-files | grep "\.env$"
git ls-files | grep "api_key"
git ls-files | grep "secret"
```

### 3. Check environment file contents
```bash
# Quickly scan for real keys (should only show placeholders)
grep -r "sk-[a-zA-Z0-9]" Back/.env
```

## ✅ Code Quality Checks

### 4. Frontend checks
```bash
# Navigate to frontend
cd Front

# Check for console.logs with sensitive data
grep -r "console.log.*api" src/
grep -r "console.log.*key" src/
grep -r "console.log.*token" src/

# Ensure build works
npm run build
```

### 5. Backend checks
```bash
# Navigate to backend
cd ../Back

# Check for hardcoded secrets in Python files
grep -r "sk-[a-zA-Z0-9]" *.py
grep -r "api.*key.*=" *.py

# Run tests
python -m pytest tests/ -v
```

## ✅ Git Best Practices

### 6. Clean commit message
```bash
# Good commit message format:
# feat: add user quota management component
# fix: resolve authentication token refresh bug
# docs: update API documentation for departments
```

### 7. Final check before push
```bash
# Review what you're about to commit
git status
git diff --cached

# Check remote status
git remote -v
git log --oneline -3
```

## 🚨 If You Find Secrets

**STOP IMMEDIATELY** and run:
```bash
# Remove from staging
git reset HEAD file-with-secret

# Clean the file
# Then re-add only safe files
git add safe-file.py
```

## ✅ Safe Push Commands

```bash
# Safe push (recommended)
git push origin main

# If you need to force push (only after secret cleanup)
git push --force-with-lease origin main
```

---

**Remember**: It's better to double-check than to expose API keys! 🔒
