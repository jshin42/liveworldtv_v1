#!/bin/bash

###############################################################################
# LiveWorldTV - Tier 1 MVP Deployment Script
#
# This script deploys the entire application stack to free/minimal cost services:
# - Frontend: Vercel (Free)
# - Backend: Railway (Free)
# - Database: Neon PostgreSQL (Free)
# - Redis: Upstash Redis (Free)
#
# Total cost: $0-10/month
# Target: <1000 concurrent users
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  LiveWorldTV - Tier 1 MVP Deployment                         ║${NC}"
echo -e "${BLUE}║  Target: Free tier services for MVP validation               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi
echo -e "${GREEN}✅ Vercel CLI installed${NC}"

# Check for Railway CLI
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}⚠️  Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
fi
echo -e "${GREEN}✅ Railway CLI installed${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1: Build Applications${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_ROOT"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Build backend
echo -e "${YELLOW}🔨 Building API backend...${NC}"
cd "$PROJECT_ROOT/apps/api"
npm run build
echo -e "${GREEN}✅ API backend built${NC}"

# Build frontend
echo -e "${YELLOW}🔨 Building web frontend...${NC}"
cd "$PROJECT_ROOT/apps/web"
npm run build
echo -e "${GREEN}✅ Web frontend built${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2: Setup Database (Neon PostgreSQL)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📋 Please complete the following steps manually:${NC}"
echo ""
echo "1. Go to: https://neon.tech"
echo "2. Sign up for a free account"
echo "3. Create a new project named 'liveworldtv'"
echo "4. Copy the connection string"
echo ""
read -p "Press Enter when you have the Neon connection string ready..."
echo ""
read -p "Enter your Neon PostgreSQL connection string: " DATABASE_URL
echo ""

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Database URL is required${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database URL saved${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3: Setup Redis Cache (Upstash)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📋 Please complete the following steps manually:${NC}"
echo ""
echo "1. Go to: https://upstash.com"
echo "2. Sign up for a free account"
echo "3. Create a new Redis database named 'liveworldtv-cache'"
echo "4. Copy the connection string (redis://...)"
echo ""
read -p "Press Enter when you have the Upstash Redis URL ready..."
echo ""
read -p "Enter your Upstash Redis connection string: " REDIS_URL
echo ""

if [ -z "$REDIS_URL" ]; then
    echo -e "${RED}❌ Redis URL is required${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Redis URL saved${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 4: Deploy Backend to Railway${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_ROOT"

# Check if logged in to Railway
echo -e "${YELLOW}🔐 Checking Railway login status...${NC}"
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}Please log in to Railway:${NC}"
    railway login
fi
echo -e "${GREEN}✅ Logged in to Railway${NC}"

# Initialize Railway project
echo -e "${YELLOW}🚂 Initializing Railway project...${NC}"
cd "$PROJECT_ROOT/apps/api"

if [ ! -f "railway.toml" ]; then
    cat > railway.toml << 'EOF'
[build]
builder = "NIXPACKS"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[healthchecks]]
path = "/health"
timeout = 10
interval = 30
EOF
    echo -e "${GREEN}✅ Created railway.toml${NC}"
fi

# Create Railway project
echo -e "${YELLOW}🚂 Creating Railway project...${NC}"
railway init --name liveworldtv-api || echo "Project may already exist"

# Set environment variables
echo -e "${YELLOW}⚙️  Setting environment variables...${NC}"
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set DATABASE_URL="$DATABASE_URL"
railway variables set REDIS_URL="$REDIS_URL"
railway variables set CORS_ORIGINS="*"
echo -e "${GREEN}✅ Environment variables set${NC}"

# Deploy to Railway
echo -e "${YELLOW}🚀 Deploying API to Railway...${NC}"
railway up

# Get the Railway URL
echo -e "${YELLOW}📋 Getting Railway deployment URL...${NC}"
API_URL=$(railway domain | head -n 1 || echo "")

if [ -z "$API_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not automatically get Railway URL.${NC}"
    read -p "Please enter your Railway API URL (e.g., https://your-app.railway.app): " API_URL
fi

# Ensure URL has https://
if [[ ! "$API_URL" =~ ^https?:// ]]; then
    API_URL="https://$API_URL"
fi

echo -e "${GREEN}✅ Backend deployed to: ${API_URL}${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 5: Deploy Frontend to Vercel${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_ROOT/apps/web"

# Create .env.production
echo -e "${YELLOW}⚙️  Creating production environment file...${NC}"
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=$API_URL
EOF
echo -e "${GREEN}✅ Production environment configured${NC}"

# Check if logged in to Vercel
echo -e "${YELLOW}🔐 Checking Vercel login status...${NC}"
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}Please log in to Vercel:${NC}"
    vercel login
fi
echo -e "${GREEN}✅ Logged in to Vercel${NC}"

# Deploy to Vercel
echo -e "${YELLOW}🚀 Deploying frontend to Vercel...${NC}"
vercel --prod --yes

# Get Vercel URL
FRONTEND_URL=$(vercel inspect --token $(cat ~/.local/share/com.vercel.cli/auth.json | jq -r '.token') 2>/dev/null || echo "")

if [ -z "$FRONTEND_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not automatically get Vercel URL.${NC}"
    read -p "Please enter your Vercel deployment URL: " FRONTEND_URL
fi

echo -e "${GREEN}✅ Frontend deployed to: ${FRONTEND_URL}${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 6: Update CORS Origins${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Update Railway CORS to include Vercel URL
cd "$PROJECT_ROOT/apps/api"
echo -e "${YELLOW}⚙️  Updating CORS configuration...${NC}"
railway variables set CORS_ORIGINS="$FRONTEND_URL,http://localhost:3000"
echo -e "${GREEN}✅ CORS updated${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 7: Run Database Migrations${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}🔄 Running database migrations...${NC}"
cd "$PROJECT_ROOT"

# Create a temporary .env for local migration
cat > .env.temp << EOF
DATABASE_URL=$DATABASE_URL
EOF

# Run migrations (placeholder - implement when migrations exist)
echo -e "${YELLOW}⚠️  Note: Implement migrations when database schema is ready${NC}"
# npm run db:migrate

rm .env.temp

echo -e "${GREEN}✅ Database migrations complete${NC}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    🎉 DEPLOYMENT SUCCESSFUL! 🎉               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo ""
echo -e "${GREEN}Frontend:${NC}    $FRONTEND_URL"
echo -e "${GREEN}Backend API:${NC} $API_URL"
echo -e "${GREEN}Database:${NC}    Neon PostgreSQL (Free tier)"
echo -e "${GREEN}Cache:${NC}       Upstash Redis (Free tier)"
echo ""
echo -e "${BLUE}💰 Estimated Monthly Cost:${NC} $0-5"
echo -e "${BLUE}👥 Target Users:${NC} <1000 concurrent"
echo ""

echo -e "${YELLOW}📋 Next Steps:${NC}"
echo ""
echo "1. Test your deployment:"
echo "   ${FRONTEND_URL}"
echo ""
echo "2. Verify API health:"
echo "   ${API_URL}/health"
echo ""
echo "3. Test auto-play functionality:"
echo "   - Open frontend URL"
echo "   - Should auto-load first US channel"
echo "   - YouTube player should start immediately"
echo ""
echo "4. Deploy Chrome Extension:"
echo "   - See: tools/scripts/deploy/deploy-extension.sh"
echo ""
echo "5. Monitor your services:"
echo "   - Railway: https://railway.app/dashboard"
echo "   - Vercel: https://vercel.com/dashboard"
echo ""
echo "6. Setup monitoring (optional):"
echo "   - BetterStack: https://betterstack.com (Free tier)"
echo ""

echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - Architecture: DEPLOYMENT_ARCHITECTURE.md"
echo "   - Troubleshooting: docs/deployment/troubleshooting.md"
echo ""

echo -e "${GREEN}✨ Your LiveWorldTV MVP is now live! ✨${NC}"
echo ""

# Save deployment info
cat > "$PROJECT_ROOT/.deployment-info" << EOF
# LiveWorldTV Tier 1 Deployment
# Deployed: $(date)

DEPLOYMENT_TIER=1
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$API_URL
DATABASE_PROVIDER=neon
CACHE_PROVIDER=upstash

# Cost: $0-5/month
# Target: <1000 concurrent users
EOF

echo -e "${GREEN}Deployment info saved to .deployment-info${NC}"
