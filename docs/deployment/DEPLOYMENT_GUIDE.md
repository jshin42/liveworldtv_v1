# LiveWorldTV Deployment Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Local Development](#local-development)
3. [Tier 1: MVP Deployment (Free)](#tier-1-mvp-deployment)
4. [Tier 2: Production Deployment](#tier-2-production-deployment)
5. [Tier 3: Enterprise Scale](#tier-3-enterprise-scale)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- Node.js 18+ installed
- npm 9+ installed
- Git installed
- Docker (optional, for local dev)

### One-Command Deploy (Tier 1 - Free)

```bash
# Clone and deploy
git clone https://github.com/yourusername/liveworldtv_v1.git
cd liveworldtv_v1
./tools/scripts/deploy/deploy-tier1.sh
```

This script will:
- ✅ Install dependencies
- ✅ Build all applications
- ✅ Deploy frontend to Vercel (Free)
- ✅ Deploy backend to Railway (Free)
- ✅ Guide you through database setup
- ✅ Configure environment variables
- ✅ Run migrations
- ✅ Output your live URLs

**Total Time**: 15-30 minutes
**Total Cost**: $0-5/month

---

## Local Development

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Clean restart
docker-compose down -v && docker-compose up -d
```

**Services**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Manual Setup

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Setup Environment
```bash
# Copy example env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Edit with your local database URLs
nano apps/api/.env
```

#### 3. Start Services

**Terminal 1 - Backend**:
```bash
cd apps/api
npm run start:dev
# API will run on http://localhost:3001
```

**Terminal 2 - Frontend**:
```bash
cd apps/web
npm run dev
# Web will run on http://localhost:3000
```

#### 4. Run Tests
```bash
# Backend unit tests
cd apps/api
npm test

# Backend e2e tests
npm run test:e2e

# Frontend tests
cd apps/web
npm test

# All tests with coverage
npm run test:coverage
```

---

## Tier 1: MVP Deployment

**Target**: MVP/POC validation
**Cost**: $0-5/month
**Users**: <1000 concurrent
**Setup Time**: 15-30 minutes

### Architecture
```
Users → Vercel (Frontend) → Railway (API) → Neon (PostgreSQL) + Upstash (Redis)
```

### Step-by-Step

#### 1. Run Automated Script
```bash
./tools/scripts/deploy/deploy-tier1.sh
```

The script will prompt you for:
- Neon PostgreSQL connection string
- Upstash Redis connection string

#### 2. Manual Steps (if script fails)

**A. Deploy Backend to Railway**
```bash
cd apps/api

# Login to Railway
railway login

# Create new project
railway init --name liveworldtv-api

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set DATABASE_URL="your-neon-url"
railway variables set REDIS_URL="your-upstash-url"

# Deploy
railway up

# Get deployment URL
railway domain
```

**B. Deploy Frontend to Vercel**
```bash
cd apps/web

# Login to Vercel
vercel login

# Set environment variable
echo "NEXT_PUBLIC_API_URL=https://your-api.railway.app" > .env.production

# Deploy
vercel --prod
```

#### 3. Verify Deployment
```bash
# Test API health
curl https://your-api.railway.app/health

# Test API endpoint
curl https://your-api.railway.app/v1/channels?country=US

# Test Frontend
open https://your-app.vercel.app
```

### Expected Results
- ✅ Frontend loads in <3s
- ✅ Auto-play starts immediately
- ✅ Channels display correctly
- ✅ API responses in <500ms
- ✅ YouTube player functional

### Limitations
- ⚠️ Backend may sleep after 15min idle (cold starts)
- ⚠️ Limited to 500 hours/month runtime
- ⚠️ Database limited to 0.5GB storage
- ⚠️ No auto-scaling
- ⚠️ No SLA guarantees

---

## Tier 2: Production Deployment

**Target**: Production launch
**Cost**: $35-50/month
**Users**: 1k-10k concurrent
**Setup Time**: 4-6 hours

### Upgrades from Tier 1
- ✅ Always-on backend (no cold starts)
- ✅ 10GB database with backups
- ✅ Monitoring and alerts
- ✅ 1M Redis commands/month
- ✅ Better performance

### Step-by-Step

#### 1. Upgrade Railway
```bash
# In Railway dashboard:
# 1. Go to project settings
# 2. Upgrade to Hobby plan ($5/month)
# 3. Resources: 8GB RAM, 4 vCPU
```

#### 2. Upgrade Neon Database
```bash
# In Neon dashboard:
# 1. Go to project settings
# 2. Upgrade to Scale plan ($19/month)
# 3. Benefits: 10GB, dedicated CPU, connection pooling
```

#### 3. Upgrade Vercel (Optional)
```bash
# In Vercel dashboard:
# 1. Upgrade to Pro plan ($20/month)
# 2. Benefits: 1TB bandwidth, priority support
```

#### 4. Setup Monitoring
```bash
# BetterStack (Free tier)
# 1. Sign up at https://betterstack.com
# 2. Add uptime monitors:
#    - Frontend: https://your-app.vercel.app
#    - Backend: https://your-api.railway.app/health
# 3. Configure alerts (email/Slack)
```

#### 5. Enable Backups
```bash
# Neon (automatic)
# - Point-in-time recovery enabled
# - Daily automated backups

# Railway (manual)
# - Database snapshots via Neon
# - Code in Git repository
```

#### 6. Setup Staging Environment
```bash
# Create staging branch
git checkout -b staging

# Deploy staging API
cd apps/api
railway init --name liveworldtv-api-staging
railway variables set NODE_ENV=staging
railway up

# Deploy staging frontend
cd apps/web
vercel --name liveworldtv-web-staging
```

---

## Tier 3: Enterprise Scale

**Target**: Enterprise/High traffic
**Cost**: $150-300/month
**Users**: 10k-100k concurrent
**Setup Time**: 2-3 days

### Features
- ✅ Auto-scaling (3-10 instances)
- ✅ High availability (99.99% uptime)
- ✅ Multi-region deployment
- ✅ Advanced APM monitoring
- ✅ DDoS protection
- ✅ SOC2 ready

### Architecture
```
CloudFlare CDN
    ↓
Vercel (Multi-region)
    ↓
Load Balancer
    ↓
Railway (3+ instances) ← Auto-scaling
    ↓
Neon (HA + Replicas) + Upstash (Cluster)
    ↓
Datadog APM
```

### Setup Guide
See: [Tier 3 Setup Documentation](./tier3-setup.md)

---

## Post-Deployment

### 1. Smoke Tests

```bash
# Test script (automated)
node test-autoplay.js

# Manual tests
# ✅ Frontend loads
# ✅ Auto-play starts immediately
# ✅ YouTube player functional
# ✅ Channel switching works
# ✅ API responds correctly
```

### 2. Load Testing

```bash
# Install k6
brew install k6  # macOS
# or
apt-get install k6  # Ubuntu

# Run load test
k6 run tools/scripts/load-test.js

# Expected results:
# - 95% requests < 500ms
# - 0% error rate
# - Can handle target concurrent users
```

### 3. Monitoring Setup

#### BetterStack (Tier 1-2)
```bash
# Add monitors:
# 1. Uptime: Frontend + Backend
# 2. SSL Certificate monitoring
# 3. Response time tracking

# Configure alerts:
# - Email notifications
# - Slack webhook (optional)
# - SMS for critical (optional)
```

#### Datadog (Tier 3)
```javascript
// Add to apps/api/src/main.ts
import { datadog } from 'dd-trace';

datadog.init({
  service: 'liveworldtv-api',
  env: process.env.NODE_ENV,
  logInjection: true,
  runtimeMetrics: true,
});
```

### 4. DNS Setup (Optional - Custom Domain)

```bash
# Vercel
# 1. Add custom domain in Vercel dashboard
# 2. Update DNS records:
#    CNAME: www → cname.vercel-dns.com
#    A: @ → 76.76.21.21

# Railway
# 1. Add custom domain in Railway dashboard
# 2. Update DNS records:
#    CNAME: api → your-app.railway.app
```

### 5. CDN Setup (Tier 3)

```bash
# CloudFlare
# 1. Add site to CloudFlare
# 2. Update nameservers
# 3. Enable:
#    - Auto minify (JS, CSS, HTML)
#    - Brotli compression
#    - HTTP/3 (QUIC)
#    - DDoS protection

# Configure caching rules:
# - Cache static assets: 1 year
# - Cache API responses: 5 minutes
# - Bypass cache for auth endpoints
```

---

## Troubleshooting

### Issue: Backend Cold Starts (Tier 1)

**Symptoms**:
- First request takes 5-10s
- Intermittent timeouts

**Solutions**:
```bash
# Option 1: Upgrade to Hobby plan ($5/month)
railway upgrade

# Option 2: Keep-alive ping (free)
# Add to frontend (apps/web/src/app/layout.tsx):
useEffect(() => {
  setInterval(() => {
    fetch(`${API_URL}/health`);
  }, 5 * 60 * 1000); // Every 5 minutes
}, []);
```

### Issue: Database Connection Limit

**Symptoms**:
- "too many connections" errors
- Random connection failures

**Solutions**:
```bash
# Enable connection pooling in Neon
# In DATABASE_URL, add: ?pgbouncer=true

# Example:
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true"

# Or upgrade to Scale plan for more connections
```

### Issue: CORS Errors

**Symptoms**:
- Frontend can't reach API
- "CORS policy" errors in console

**Solutions**:
```bash
# Update CORS_ORIGINS in Railway:
railway variables set CORS_ORIGINS="https://your-frontend.vercel.app,http://localhost:3000"

# Redeploy:
railway up
```

### Issue: Build Failures

**Symptoms**:
- Vercel/Railway deployment fails
- TypeScript errors

**Solutions**:
```bash
# Test build locally first:
npm run build

# Check for TypeScript errors:
npm run typecheck

# Clear cache and rebuild:
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: YouTube Player Not Loading

**Symptoms**:
- Black screen instead of video
- "Video unavailable" message

**Solutions**:
```bash
# Check CORS on YouTube embeds
# Ensure sourceUrl is correct format:
# ✅ https://www.youtube.com/embed/VIDEO_ID
# ❌ https://www.youtube.com/watch?v=VIDEO_ID

# Verify channel is live:
# Open sourceUrl in browser to confirm

# Check for restrictive Content Security Policy:
# Add to vercel.json headers if needed
```

### Getting Help

- **Documentation**: `/docs/`
- **Issue Tracker**: GitHub Issues
- **Community**: Discord / Slack
- **Support**: support@liveworldtv.com

---

## Deployment Checklist

### Pre-Launch
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Seed data loaded

### Post-Launch
- [ ] Frontend accessible
- [ ] API health check passes
- [ ] Auto-play working
- [ ] YouTube embeds loading
- [ ] Monitoring configured
- [ ] Alerts setup
- [ ] SSL certificates valid
- [ ] DNS configured (if custom domain)

### Week 1
- [ ] Load testing completed
- [ ] Performance targets met
- [ ] Error rate < 1%
- [ ] User feedback collected
- [ ] Analytics tracking working

### Week 2+
- [ ] Monitoring dashboards reviewed
- [ ] Backup restoration tested
- [ ] Incident response documented
- [ ] Runbooks created
- [ ] Team training completed

---

## Next Steps

1. **Review Architecture**: See [DEPLOYMENT_ARCHITECTURE.md](../../DEPLOYMENT_ARCHITECTURE.md)
2. **Choose Your Tier**: Based on budget and scale needs
3. **Run Deployment Script**: `./tools/scripts/deploy/deploy-tier1.sh`
4. **Verify Deployment**: Run smoke tests
5. **Setup Monitoring**: Add uptime checks
6. **Document Configuration**: Update team wiki

## Additional Resources

- [Docker Compose Configuration](../../docker-compose.yml)
- [Vercel Configuration](../../apps/web/vercel.json)
- [Railway Configuration](../../apps/api/railway.toml)
- [Environment Variables Template](./environment-variables.md)
- [Performance Tuning Guide](./performance-tuning.md)
- [Security Best Practices](./security.md)
