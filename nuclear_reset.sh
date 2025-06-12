#!/bin/bash
# Nuclear Git Reset - Start with Clean History
# This completely removes all git history and starts fresh

echo "🚨 NUCLEAR OPTION: Creating completely fresh git repository"
echo "⚠️  This will destroy ALL git history!"

cd /Users/blas/Desktop/INRE/INRE-DOCK-2

# Create final backup
cp -r .git .git-backup-$(date +%Y%m%d-%H%M%S)

# Remove all git history
rm -rf .git

# Start fresh
git init
git branch -m main

# Add .gitignore first
git add .gitignore
git commit -m "🎯 Initial commit: Add .gitignore"

# Add backend code (excluding sensitive files)
git add Back/app/ Back/requirements.txt Back/README.md Back/.env.example Back/quick_start.sh
git commit -m "🚀 Add backend API and services"

# Add frontend code
git add Front/src/ Front/package*.json Front/index.html Front/vite.config.ts Front/tailwind.config.js Front/tsconfig*.json Front/postcss.config.js
git commit -m "🎨 Add frontend React application"

# Add documentation
git add Helpers/
git commit -m "📚 Add project documentation"

echo "✅ Fresh repository created with clean history!"
echo "🔍 Verify no secrets: git log --oneline --all -p | grep -i sk-"
echo "📤 Force push: git push --force-with-lease origin main"
