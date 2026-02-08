#!/bin/bash
# Railway Setup Script for MYDON
# Run: ./scripts/railway-setup.sh

set -e

APP_URL="https://mydon-production.up.railway.app"

echo "🚂 MYDON Railway Setup"
echo "======================"

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

echo "🔧 Setting environment variables..."

# Set all required variables (skip empty values)
railway variables \
  --set "NODE_ENV=production" \
  --set "VITE_APP_URL=$APP_URL" \
  --set "OAUTH_SERVER_URL=$APP_URL/api/oauth" \
  --set "JWT_SECRET=$JWT_SECRET" \
  --set "OWNER_OPEN_ID=dev-admin" \
  --set "VITE_APP_ID=mydon-roadmap" \
  --set "LOG_LEVEL=info"

echo ""
echo "✅ Variables set!"
echo ""
echo "⚠️  Add in Railway Dashboard:"
echo "   1. DATABASE_URL - Add MySQL plugin (+ New → MySQL)"
echo "   2. GROQ_API_KEY - Free: https://console.groq.com/keys"
echo ""
echo "🚀 To deploy: railway up"
echo ""
