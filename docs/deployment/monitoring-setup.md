# Monitoring Setup Guide

This guide covers setting up monitoring and observability for LiveWorldTV across all deployment tiers.

## Table of Contents
1. [Tier 1: Basic Monitoring (Free)](#tier-1-basic-monitoring)
2. [Tier 2: Production Monitoring](#tier-2-production-monitoring)
3. [Tier 3: Enterprise Monitoring](#tier-3-enterprise-monitoring)
4. [Alerts Configuration](#alerts-configuration)
5. [Dashboards](#dashboards)

---

## Tier 1: Basic Monitoring (Free)

### BetterStack Uptime Monitoring

**Cost**: Free (10 monitors)
**Setup Time**: 10 minutes

#### 1. Create BetterStack Account
```bash
# Sign up at https://betterstack.com
# No credit card required for free tier
```

#### 2. Add Uptime Monitors

**Frontend Monitor**:
- URL: `https://your-app.vercel.app`
- Check interval: 3 minutes
- Timeout: 30 seconds
- Expected status code: 200
- Alert on: 2 consecutive failures

**Backend Health Check**:
- URL: `https://your-api.railway.app/health`
- Check interval: 1 minute
- Timeout: 10 seconds
- Expected status code: 200
- Alert on: 2 consecutive failures

**API Channels Endpoint**:
- URL: `https://your-api.railway.app/v1/channels?country=US`
- Check interval: 5 minutes
- Timeout: 15 seconds
- Expected status code: 200
- Alert on: 3 consecutive failures

#### 3. Configure Alerts

**Email Notifications**:
- Add your email in BetterStack dashboard
- Enable notifications for:
  - Monitor goes down
  - Monitor comes back up
  - SSL certificate expiring (30 days)

**Optional: Slack Integration**:
```bash
# 1. Go to BetterStack > Integrations > Slack
# 2. Click "Connect to Slack"
# 3. Authorize the app
# 4. Select channel (e.g., #alerts)
```

#### 4. SSL Certificate Monitoring

BetterStack automatically monitors SSL certificates:
- Alerts 30 days before expiration
- Vercel and Railway auto-renew certificates
- No action needed unless you see repeated alerts

### Vercel Analytics (Automatic)

**Cost**: Free on all plans
**Features**:
- Real User Monitoring (RUM)
- Web Vitals (LCP, FID, CLS)
- Page views and visitor stats

**Access**:
1. Go to Vercel Dashboard
2. Select your project
3. Click "Analytics" tab

**Key Metrics to Watch**:
- **LCP (Largest Contentful Paint)**: Should be <2.5s
- **FID (First Input Delay)**: Should be <100ms
- **CLS (Cumulative Layout Shift)**: Should be <0.1
- **Page Load Time**: Should be <3s

### Railway Metrics (Automatic)

**Cost**: Free on all plans
**Features**:
- CPU usage
- Memory usage
- Network traffic
- Deployment history

**Access**:
1. Go to Railway Dashboard
2. Select your project
3. Click "Metrics" tab

**Key Metrics to Watch**:
- **CPU Usage**: Should stay <70% on average
- **Memory Usage**: Should stay <80% of limit
- **Network In/Out**: Track for anomalies
- **Response Time**: Should be <500ms

---

## Tier 2: Production Monitoring

### Everything from Tier 1, Plus:

### 1. Better Stack Logs (Logtail)

**Cost**: Free up to 1GB/month
**Setup Time**: 15 minutes

#### Setup Backend Logging

**Install Package**:
```bash
cd apps/api
npm install @logtail/node @logtail/pino
```

**Configure Logger** (`apps/api/src/logger.ts`):
```typescript
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/pino';
import pino from 'pino';

const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);

export const logger = pino({
  transport: {
    target: '@logtail/pino',
    options: { logtail },
  },
  level: process.env.LOG_LEVEL || 'info',
});

// Usage:
// logger.info({ channelId: '123' }, 'Channel loaded');
// logger.error({ err }, 'Error loading channel');
// logger.warn({ userId: 'abc' }, 'Rate limit approaching');
```

**Set Environment Variable**:
```bash
# Get token from https://logs.betterstack.com
railway variables set LOGTAIL_SOURCE_TOKEN=your_token_here
```

#### Setup Frontend Error Tracking

**Create Error Boundary** (`apps/web/src/components/ErrorBoundary.tsx`):
```typescript
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log to BetterStack or Sentry
    console.error('Error caught by boundary:', error, errorInfo);

    // Optional: Send to logging service
    if (process.env.NEXT_PUBLIC_LOGTAIL_TOKEN) {
      fetch('https://in.logs.betterstack.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_LOGTAIL_TOKEN}`,
        },
        body: JSON.stringify({
          dt: new Date().toISOString(),
          level: 'error',
          message: error.toString(),
          error: errorInfo,
        }),
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong. Please refresh the page.</h1>;
    }

    return this.props.children;
  }
}
```

### 2. Custom Health Checks

**Enhanced Health Check** (`apps/api/src/health/health.controller.ts`):
```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
    ]);

    const allHealthy = checks.every(c => c.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase() {
    try {
      const start = Date.now();
      await this.db.query('SELECT 1');
      const duration = Date.now() - start;

      return {
        name: 'database',
        status: duration < 100 ? 'healthy' : 'degraded',
        responseTime: `${duration}ms`,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkRedis() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const duration = Date.now() - start;

      return {
        name: 'redis',
        status: duration < 50 ? 'healthy' : 'degraded',
        responseTime: `${duration}ms`,
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private checkMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const percentage = (heapUsedMB / heapTotalMB) * 100;

    return {
      name: 'memory',
      status: percentage < 80 ? 'healthy' : 'degraded',
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      percentage: `${percentage.toFixed(1)}%`,
    };
  }
}
```

### 3. Performance Monitoring

**API Response Time Tracking**:
```typescript
// apps/api/src/middleware/metrics.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const route = req.route?.path || req.path;

      // Log slow requests
      if (duration > 1000) {
        logger.warn({
          type: 'slow_request',
          method: req.method,
          route,
          duration,
          statusCode: res.statusCode,
        });
      }

      // Track metrics (can send to external service)
      if (process.env.ENABLE_METRICS === 'true') {
        // Send to metrics service
      }
    });

    next();
  }
}
```

---

## Tier 3: Enterprise Monitoring

### Everything from Tier 1 & 2, Plus:

### 1. Datadog APM

**Cost**: $15-31/host/month
**Features**:
- Application Performance Monitoring
- Distributed tracing
- Custom metrics
- Log aggregation
- Real User Monitoring

#### Setup Datadog Agent

**Install Package**:
```bash
cd apps/api
npm install dd-trace --save
```

**Initialize Tracer** (`apps/api/src/tracer.ts`):
```typescript
import tracer from 'dd-trace';

tracer.init({
  service: 'liveworldtv-api',
  env: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
  appsec: true,
});

export default tracer;
```

**Import in main.ts** (MUST be first import):
```typescript
import './tracer';  // Must be first!
import { NestFactory } from '@nestjs/core';
// ... rest of imports
```

**Set Environment Variables**:
```bash
railway variables set DD_API_KEY=your_datadog_api_key
railway variables set DD_SERVICE=liveworldtv-api
railway variables set DD_ENV=production
railway variables set DD_VERSION=1.0.0
```

#### Create Custom Metrics

```typescript
import tracer from 'dd-trace';

const metrics = tracer.dogstatsd;

// Counter: Total channels loaded
metrics.increment('channels.loaded', 1, ['country:US', 'topic:NEWS']);

// Gauge: Active users
metrics.gauge('users.active', 1250);

// Histogram: Channel load time
metrics.histogram('channel.load.duration', 150, ['status:success']);

// Set: Unique users
metrics.set('users.unique', 'user-123');
```

### 2. New Relic APM

**Alternative to Datadog**
**Cost**: $49-99/month

**Setup**:
```bash
npm install newrelic
```

**Configure** (`newrelic.js`):
```javascript
'use strict';

exports.config = {
  app_name: ['LiveWorldTV API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
  },
  distributed_tracing: {
    enabled: true,
  },
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 0.5,
  },
};
```

### 3. Sentry for Error Tracking

**Cost**: $26/month (Team plan)

**Backend Setup**:
```bash
cd apps/api
npm install @sentry/node @sentry/tracing
```

```typescript
// apps/api/src/sentry.ts
import * as Sentry from '@sentry/node';
import '@sentry/tracing';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});

export default Sentry;
```

**Frontend Setup**:
```bash
cd apps/web
npm install @sentry/nextjs
```

```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

---

## Alerts Configuration

### Critical Alerts (PagerDuty/On-Call)

**Setup For**:
- API down for 2+ minutes
- Database connection lost
- Error rate > 5%
- Response time p95 > 2s

**Notification**:
- SMS
- Phone call
- PagerDuty escalation

### Warning Alerts (Email/Slack)

**Setup For**:
- Response time p95 > 1s
- Error rate > 1%
- Memory usage > 80%
- CPU usage > 80%
- Slow queries > 500ms

**Notification**:
- Email
- Slack channel

### Info Alerts (Dashboard Only)

**Setup For**:
- Deployment completed
- New channels discovered
- Daily usage reports

---

## Dashboards

### Tier 1: Built-in Dashboards

- **Vercel**: vercel.com/dashboard → Analytics
- **Railway**: railway.app/dashboard → Metrics
- **BetterStack**: betterstack.com/uptime

### Tier 2: Custom Dashboards

**BetterStack Dashboard**:
```javascript
// Create custom dashboard with:
// 1. Uptime percentage (last 30 days)
// 2. Average response time
// 3. Error count
// 4. Top 10 slowest endpoints
// 5. Geographic distribution of errors
```

### Tier 3: Comprehensive Dashboards

**Datadog Dashboard Widgets**:
1. **Overview**
   - Total requests/second
   - Error rate
   - P50/P95/P99 latency
   - Active users

2. **API Health**
   - Requests by endpoint
   - Error rate by endpoint
   - Response time by endpoint
   - Database query time

3. **Infrastructure**
   - CPU usage
   - Memory usage
   - Network I/O
   - Disk I/O

4. **Business Metrics**
   - Channels viewed
   - Auto-play activation rate
   - Extension installs
   - User retention

---

## Monitoring Checklist

### Daily
- [ ] Check error rate (should be <1%)
- [ ] Review slow query log
- [ ] Check API response times
- [ ] Verify all monitors are green

### Weekly
- [ ] Review uptime reports
- [ ] Analyze traffic patterns
- [ ] Check for memory leaks
- [ ] Review user feedback

### Monthly
- [ ] Update monitoring thresholds
- [ ] Review and optimize slow endpoints
- [ ] Capacity planning
- [ ] Cost optimization

---

## Troubleshooting

### High Error Rate

**Check**:
1. BetterStack logs for error details
2. Database connection status
3. Redis connection status
4. External API status (YouTube)

**Fix**:
1. Restart API service if needed
2. Scale up resources if high load
3. Check for recent deployments
4. Review recent code changes

### Slow Response Times

**Check**:
1. Database query performance
2. Redis cache hit rate
3. CPU/Memory usage
4. Network latency

**Fix**:
1. Add database indexes
2. Optimize slow queries
3. Increase cache TTL
4. Scale up resources

### Memory Leaks

**Check**:
1. Memory usage trend over time
2. Heap snapshots (Chrome DevTools)
3. Event listener leaks
4. Database connection leaks

**Fix**:
1. Review recent code changes
2. Check for unclosed connections
3. Implement connection pooling
4. Add memory usage alerts

---

## Next Steps

1. **Implement monitoring** for your tier
2. **Set up alerts** based on your SLA
3. **Create dashboards** for your team
4. **Document runbooks** for common issues
5. **Train team** on monitoring tools

## Resources

- [BetterStack Docs](https://betterstack.com/docs)
- [Datadog APM Guide](https://docs.datadoghq.com/tracing/)
- [Sentry Setup](https://docs.sentry.io/platforms/node/)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Railway Metrics](https://docs.railway.app/reference/metrics)
