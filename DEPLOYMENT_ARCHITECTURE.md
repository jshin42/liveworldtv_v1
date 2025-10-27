# Deployment Architecture for LiveWorldTV

## Executive Summary

This document outlines three deployment architecture tiers balancing **ease of implementation** vs **cost** vs **scalability**.

### Quick Recommendation
- **MVP/Hobby**: **Tier 1** (Free to $10/month) - Deploy in 1-2 hours
- **Production Launch**: **Tier 2** ($35-50/month) - Professional grade with monitoring
- **Scale (10k+ CCU)**: **Tier 3** ($150-300/month) - Enterprise-ready with auto-scaling

---

## Architecture Tiers

### Tier 1: Minimal Cost Architecture (MVP/Hobby)
**Total Cost**: $0-10/month | **Setup Time**: 1-2 hours | **Target**: <1000 CCU

#### Components

| Component | Service | Plan | Cost | Limits |
|-----------|---------|------|------|--------|
| Frontend | Vercel | Hobby | $0 | 100GB bandwidth/month |
| API Backend | Railway / Render | Free | $0 | 500h/month, sleeps on idle |
| Database | Neon PostgreSQL | Free | $0 | 0.5 GB storage, 1 project |
| Redis Cache | Upstash Redis | Free | $0 | 10k commands/day |
| Extension | Chrome Web Store | One-time | $5 | Unlimited users |
| **TOTAL** | | | **$0-10/month** | |

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Devices                            │
└──────────┬──────────────────────────────────────┬───────────────┘
           │                                      │
           │ HTTPS                                │ Extension
           │                                      │
┌──────────▼──────────────┐           ┌──────────▼──────────────┐
│   Vercel Edge Network   │           │  Chrome Extension       │
│  (Next.js 15 Frontend)  │           │  (Local AI Dubbing)     │
│  - SSR/SSG             │           │  - ONNX Runtime Web     │
│  - Auto CDN            │           │  - 1.36GB models        │
└──────────┬──────────────┘           └─────────────────────────┘
           │
           │ API Calls
           │ (REST + JSON)
           │
┌──────────▼──────────────┐
│   Railway/Render.com    │
│   (NestJS API)          │
│   - Catalog Service     │
│   - Ranking Service     │
│   - Analytics Service   │
└──────┬──────────┬───────┘
       │          │
       │          │
┌──────▼─────┐  ┌▼──────────────┐
│ Neon       │  │ Upstash Redis │
│ PostgreSQL │  │ (Cache)       │
│ (Free)     │  │ (Free)        │
└────────────┘  └───────────────┘
```

#### Pros
✅ **Zero to minimal cost** for MVP validation
✅ **Fast deployment** - Single command deploys
✅ **Auto HTTPS** and CDN included
✅ **No DevOps experience** required
✅ **Perfect for demo/POC**

#### Cons
❌ Backend sleeps after 15min inactivity (cold starts)
❌ Limited database storage (0.5GB)
❌ No auto-scaling capabilities
❌ Basic monitoring only
❌ Shared infrastructure (no SLA)

#### Deployment Commands

```bash
# Frontend (Vercel)
cd apps/web
vercel --prod

# Backend (Railway)
cd apps/api
railway login
railway init
railway up

# Environment Variables
railway variables set DATABASE_URL=<neon-connection-string>
railway variables set REDIS_URL=<upstash-redis-url>
```

#### When to Upgrade
- Backend cold starts affecting UX (>2s response time)
- Exceeding 500 hours/month runtime
- Need for 24/7 uptime guarantee
- Database approaching 0.5GB limit

---

### Tier 2: Balanced Production Architecture
**Total Cost**: $35-50/month | **Setup Time**: 4-6 hours | **Target**: 1k-10k CCU

#### Components

| Component | Service | Plan | Cost | Specs |
|-----------|---------|------|------|-------|
| Frontend | Vercel | Pro | $20/month | 1TB bandwidth, priority support |
| API Backend | Railway | Hobby | $5/month | Always-on, 8GB RAM, 4 vCPU |
| Database | Neon PostgreSQL | Scale | $19/month | 10GB storage, dedicated CPU |
| Redis Cache | Upstash Redis | Pay-as-go | $5-10/month | 1M commands/month |
| Monitoring | BetterStack | Free | $0 | Basic uptime monitoring |
| Extension | Chrome Web Store | One-time | $5 | Unlimited users |
| **TOTAL** | | | **$49-59/month** | |

#### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      Global User Base                          │
└──────┬──────────────────────────────────────────┬──────────────┘
       │                                          │
       │ HTTPS (SSL)                              │ Extension
       │                                          │
┌──────▼─────────────────────┐         ┌─────────▼──────────────┐
│  Vercel Global Edge CDN    │         │  Chrome Extension      │
│  (Next.js 15 SSR/SSG)      │         │  (AI Dubbing Pipeline) │
│  - 70+ PoPs worldwide      │         │  - WebGPU Inference    │
│  - Automatic CDN caching   │         │  - Local Processing    │
│  - DDoS protection         │         │  - Privacy-first       │
└──────┬─────────────────────┘         └────────────────────────┘
       │
       │ REST API
       │ (v1/channels, v1/streams)
       │
┌──────▼─────────────────────┐
│  Railway Container         │
│  (NestJS + TypeScript)     │
│  ┌──────────────────────┐  │
│  │ Catalog Module       │  │
│  │ Ranking Module       │  │
│  │ Analytics Module     │  │
│  │ Health Checks        │  │
│  └──────────────────────┘  │
│  Resources:                │
│  - 8GB RAM                 │
│  - 4 vCPU                  │
│  - Always-on (no sleep)    │
└──────┬──────────┬──────────┘
       │          │
       │          │
┌──────▼─────┐  ┌▼─────────────────┐
│ Neon PG    │  │ Upstash Redis    │
│ (Scale)    │  │ (Pay-as-you-go)  │
│ - 10GB     │  │ - 1M cmd/month   │
│ - Backups  │  │ - Global edge    │
│ - Pooling  │  │ - Persistence    │
└────────────┘  └──────────────────┘
       │
       │
┌──────▼────────────────────┐
│  BetterStack Monitoring   │
│  - Uptime checks          │
│  - Alert notifications    │
│  - Incident response      │
└───────────────────────────┘
```

#### Pros
✅ **Always-on** backend (no cold starts)
✅ **Production-grade** database with backups
✅ **Better performance** with dedicated resources
✅ **Global CDN** for fast page loads
✅ **Basic monitoring** and alerts
✅ **Supports 1k-10k concurrent users**

#### Cons
⚠️ Manual scaling required
⚠️ Single point of failure (no redundancy)
⚠️ Limited database connections (100 max)
⚠️ Basic monitoring (no APM/tracing)

#### Deployment Configuration

**Vercel Configuration** (`vercel.json`):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "apps/web/package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "@api-url-production"
  },
  "regions": ["iad1", "sfo1", "lhr1"],
  "framework": "nextjs"
}
```

**Railway Configuration** (`railway.toml`):
```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm run start:prod"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[healthchecks]]
path = "/health"
timeout = 10
interval = 30

[env]
NODE_ENV = "production"
PORT = "3001"
```

#### Monitoring Setup

```bash
# BetterStack Uptime Monitoring
# Add these endpoints:
- https://liveworldtv.vercel.app (Frontend)
- https://api.liveworldtv.railway.app/health (Backend)

# Alert channels:
- Email notifications
- Slack webhook (optional)

# SLA Target: 99.5% uptime
```

#### When to Upgrade
- Consistently hitting 5k+ concurrent users
- Need for auto-scaling
- Require multi-region deployment
- Need advanced monitoring/APM
- Compliance requirements (SOC2, GDPR)

---

### Tier 3: Enterprise/Scale Architecture
**Total Cost**: $150-300/month | **Setup Time**: 2-3 days | **Target**: 10k-100k CCU

#### Components

| Component | Service | Plan | Cost | Specs |
|-----------|---------|------|------|-------|
| Frontend CDN | Vercel Enterprise | $150/month | Custom SLA, dedicated support |
| API Cluster | Railway Pro (3 instances) | $45/month | Auto-scaling, load balanced |
| Database | Neon Business | $69/month | 50GB, HA, point-in-time recovery |
| Redis Cache | Upstash Pro | $40/month | 10M commands, clustering |
| Monitoring | Datadog / New Relic | $15-50/month | APM, logs, traces, RUM |
| CDN | CloudFlare Pro | $20/month | Advanced DDoS, analytics |
| **TOTAL** | | | **$339-374/month** | |

#### Architecture Diagram

```
                    ┌─────────────────────────┐
                    │   CloudFlare CDN        │
                    │   (DDoS Protection)     │
                    └────────┬────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼─────────┐        ┌─────────▼──────────┐
    │  Vercel Frontend  │        │  Chrome Extension  │
    │  (Next.js SSR)    │        │  (AI Dubbing)      │
    │  - Multi-region   │        │  - Local Models    │
    │  - Edge caching   │        │  - Privacy-first   │
    └─────────┬─────────┘        └────────────────────┘
              │
              │ REST API + WebSocket
              │
    ┌─────────▼──────────────────────────┐
    │   Railway Load Balancer            │
    │   (Automatic failover)             │
    └──┬───────────┬─────────────┬───────┘
       │           │             │
   ┌───▼───┐   ┌──▼────┐    ┌──▼────┐
   │ API 1 │   │ API 2 │    │ API 3 │
   │ 8GB   │   │ 8GB   │    │ 8GB   │
   │ 4vCPU │   │ 4vCPU │    │ 4vCPU │
   └───┬───┘   └──┬────┘    └──┬────┘
       │          │            │
       └──────────┼────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼────────┐   ┌───▼──────────────┐
    │ Neon PG     │   │ Upstash Redis    │
    │ (Business)  │   │ (Pro Cluster)    │
    │ - 50GB      │   │ - Multi-region   │
    │ - HA        │   │ - Persistence    │
    │ - Replicas  │   │ - Clustering     │
    └─────────────┘   └──────────────────┘
         │
         │
    ┌────▼─────────────────────────┐
    │  Datadog / New Relic         │
    │  - APM & Distributed Tracing │
    │  - Log aggregation           │
    │  - Real User Monitoring      │
    │  - Custom dashboards         │
    │  - Alert workflows           │
    └──────────────────────────────┘
```

#### Pros
✅ **Auto-scaling** based on load
✅ **High availability** with redundancy
✅ **Multi-region deployment**
✅ **Advanced monitoring** and APM
✅ **99.99% uptime** SLA
✅ **DDoS protection**
✅ **Supports 10k-100k+ concurrent users**

#### Cons
⚠️ Higher complexity to manage
⚠️ Requires DevOps expertise
⚠️ Higher costs ($300+/month)
⚠️ Longer setup time (2-3 days)

#### Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf
terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.15"
    }
  }
}

resource "vercel_project" "liveworldtv_web" {
  name      = "liveworldtv-web"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = "yourusername/liveworldtv_v1"
  }

  build_command = "cd apps/web && npm run build"
  output_directory = "apps/web/.next"

  environment = [
    {
      key    = "NEXT_PUBLIC_API_URL"
      value  = "https://api.liveworldtv.com"
      target = ["production"]
    }
  ]
}

resource "railway_service" "api" {
  name    = "liveworldtv-api"
  project = railway_project.main.id

  replicas = 3

  health_check = {
    path     = "/health"
    interval = 30
    timeout  = 10
  }

  resources = {
    memory = "8Gi"
    cpu    = "4000m"
  }
}
```

#### Advanced Monitoring

```typescript
// Datadog APM Integration
import { datadog } from 'dd-trace';

datadog.init({
  service: 'liveworldtv-api',
  env: process.env.NODE_ENV,
  logInjection: true,
  runtimeMetrics: true,
});

// Custom metrics
const metrics = {
  channelLoad: new Histogram('channel.load.duration'),
  apiRequests: new Counter('api.requests.total'),
  concurrentUsers: new Gauge('users.concurrent'),
};
```

---

## Migration Path

### Phase 1: MVP Launch (Tier 1)
**Timeline**: Week 1
**Budget**: $0-10/month

```bash
# Quick deploy script
./scripts/deploy-mvp.sh

# What it does:
# 1. Deploy frontend to Vercel (free)
# 2. Deploy API to Railway (free tier)
# 3. Create Neon PostgreSQL database
# 4. Setup Upstash Redis
# 5. Run migrations
# 6. Seed initial channel data
```

**Success Criteria**:
- Frontend loads in <3s
- API response time <500ms
- Support 100-500 concurrent users
- Channel auto-play works
- Extension dubbing functional

### Phase 2: Production Ready (Tier 2)
**Timeline**: Week 2-3
**Budget**: $35-50/month

**Upgrade Path**:
1. Upgrade Railway to Hobby plan ($5/month)
2. Upgrade Neon to Scale plan ($19/month)
3. Add monitoring (BetterStack free tier)
4. Configure automated backups
5. Setup staging environment

**What Changes**:
- ✅ Zero cold starts (always-on backend)
- ✅ Dedicated database resources
- ✅ Automated backups (daily)
- ✅ Uptime monitoring with alerts
- ✅ Support 1k-5k concurrent users

### Phase 3: Scale (Tier 3)
**Timeline**: Month 2-3
**Budget**: $150-300/month

**Upgrade Path**:
1. Migrate to Railway Pro with 3 instances
2. Upgrade to Neon Business (HA + replicas)
3. Add Datadog for APM
4. Implement CloudFlare Pro
5. Setup auto-scaling policies
6. Multi-region deployment

**What Changes**:
- ✅ Auto-scaling (3-10 instances)
- ✅ High availability (99.99% uptime)
- ✅ Advanced monitoring and APM
- ✅ Multi-region latency optimization
- ✅ Support 10k-100k concurrent users

---

## Cost Comparison Matrix

| Metric | Tier 1 (MVP) | Tier 2 (Production) | Tier 3 (Scale) |
|--------|--------------|---------------------|----------------|
| **Monthly Cost** | $0-10 | $35-50 | $150-300 |
| **Setup Time** | 1-2 hours | 4-6 hours | 2-3 days |
| **Concurrent Users** | <1k | 1k-10k | 10k-100k |
| **Uptime SLA** | None | 99.5% | 99.99% |
| **Cold Starts** | Yes (15min idle) | No | No |
| **Auto-scaling** | No | No | Yes |
| **Multi-region** | No | No | Yes |
| **Monitoring** | Basic | Better | Advanced APM |
| **Support** | Community | Email | Priority |
| **DevOps Required** | None | Basic | Advanced |

---

## Recommended Deployment Timeline

### Week 1: Tier 1 MVP Deployment
**Goal**: Get live with minimal cost for user testing

```bash
# Day 1-2: Deploy infrastructure
- Deploy frontend to Vercel
- Deploy API to Railway
- Setup databases (Neon + Upstash)
- Configure environment variables

# Day 3-4: Testing and validation
- Run smoke tests
- Load test with 100 concurrent users
- Verify auto-play functionality
- Test extension dubbing

# Day 5: Launch MVP
- Deploy extension to Chrome Web Store
- Share with initial beta testers
- Monitor usage and collect feedback
```

**Budget**: $5 (Chrome Web Store fee only)

### Week 2-3: Upgrade to Tier 2 (Based on Traction)
**Trigger**:
- >500 daily active users
- Cold starts affecting UX
- Need for 24/7 availability

```bash
# Upgrade checklist
✅ Upgrade Railway to Hobby plan
✅ Upgrade Neon to Scale plan
✅ Add monitoring and alerts
✅ Configure automated backups
✅ Setup staging environment
✅ Document runbooks
```

**Budget**: $49/month

### Month 2+: Consider Tier 3 (Based on Growth)
**Trigger**:
- >5k daily active users
- Need for auto-scaling
- Enterprise customers requiring SLA
- Compliance requirements

---

## Quick Start Deployment

### Prerequisites
```bash
# Install CLIs
npm install -g vercel railway-cli

# Login to services
vercel login
railway login
```

### One-Command Deploy (Tier 1)

```bash
# Deploy everything
./scripts/deploy-all.sh production

# What it does:
# 1. Builds all apps
# 2. Deploys frontend to Vercel
# 3. Deploys backend to Railway
# 4. Runs database migrations
# 5. Seeds initial data
# 6. Outputs deployment URLs
```

### Environment Variables Template

Create `.env.production`:

```bash
# Frontend (Vercel)
NEXT_PUBLIC_API_URL=https://liveworldtv-api.railway.app

# Backend (Railway)
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@hostname:5432/liveworldtv
REDIS_URL=redis://default:pass@hostname:6379
CORS_ORIGINS=https://liveworldtv.vercel.app

# Feature Flags
ENABLE_DUBBING=true
ENABLE_ANALYTICS=true
ENABLE_DISCOVERY=false

# Monitoring
DATADOG_API_KEY=your-key-here (Tier 3 only)
SENTRY_DSN=your-dsn-here (Optional)
```

---

## Security Considerations

### All Tiers
- ✅ HTTPS enforced (automatic with Vercel/Railway)
- ✅ Environment variables stored securely
- ✅ API rate limiting (10 requests/second per IP)
- ✅ Input validation on all endpoints
- ✅ CORS properly configured

### Tier 2+
- ✅ Database connection pooling
- ✅ Redis password authentication
- ✅ Automated security updates
- ✅ Uptime monitoring

### Tier 3
- ✅ DDoS protection (CloudFlare)
- ✅ WAF (Web Application Firewall)
- ✅ Database encryption at rest
- ✅ VPC/private networking
- ✅ SOC2 compliance ready

---

## Performance Targets

### Tier 1 (MVP)
- Page Load: <3s (p95)
- API Response: <500ms (p95)
- TTFMP: <10s (Time to First Meaningful Phrase)
- Uptime: 95%+

### Tier 2 (Production)
- Page Load: <2s (p95)
- API Response: <300ms (p95)
- TTFMP: <8s
- Uptime: 99.5%+

### Tier 3 (Scale)
- Page Load: <1.5s (p95)
- API Response: <200ms (p95)
- TTFMP: <6s
- Uptime: 99.99%+

---

## Decision Framework

**Choose Tier 1 if**:
- You're validating the MVP
- Budget is primary constraint
- <1k expected users
- Can tolerate cold starts
- No SLA requirements

**Choose Tier 2 if**:
- Launching to production
- Need 24/7 availability
- 1k-10k expected users
- Want monitoring and alerts
- Budget: $35-50/month acceptable

**Choose Tier 3 if**:
- Scaling to thousands of users
- Need auto-scaling
- Require high availability (99.99%)
- Enterprise customers
- Budget: $150-300/month acceptable

---

## Next Steps

1. **Review this document** and choose your tier
2. **Run the deployment scripts** (see `/tools/scripts/deploy/`)
3. **Configure monitoring** based on your tier
4. **Load test** your deployment
5. **Document** your specific configuration in `/docs/deployment/`

## Support Resources

- **Tier 1 Setup**: See `/tools/scripts/deploy/deploy-tier1.sh`
- **Tier 2 Setup**: See `/tools/scripts/deploy/deploy-tier2.sh`
- **Tier 3 Setup**: See `/docs/deployment/tier3-setup.md`
- **Troubleshooting**: See `/docs/deployment/troubleshooting.md`
