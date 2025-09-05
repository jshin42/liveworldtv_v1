# Deployment & Operational Specifications

## Overview

This specification defines production deployment architecture, operational procedures, and monitoring systems for LiveWorldTV. The system uses containerized deployment with comprehensive observability and automated failover.

## Deployment Architecture

### Production Infrastructure

```mermaid
graph TB
    subgraph "CDN Layer"
        CF[Cloudflare CDN<br/>AI Models + Static Assets]
    end
    
    subgraph "Application Layer"
        LB[Load Balancer<br/>nginx]
        WEB1[Web App 1<br/>Next.js]
        WEB2[Web App 2<br/>Next.js]
        API1[API 1<br/>NestJS]
        API2[API 2<br/>NestJS]
    end
    
    subgraph "Data Layer"  
        PG_PRIMARY[(PostgreSQL Primary)]
        PG_READ[(PostgreSQL Read Replica)]
        REDIS[(Redis Cluster)]
    end
    
    subgraph "Background Services"
        SCRAPER[Content Scraper]
        SCHEDULER[Task Scheduler]
    end
    
    CF --> LB
    LB --> WEB1
    LB --> WEB2  
    WEB1 --> API1
    WEB2 --> API2
    API1 --> PG_PRIMARY
    API2 --> PG_READ
    API1 --> REDIS
    API2 --> REDIS
    SCRAPER --> PG_PRIMARY
```

### Container Orchestration (Docker Compose)

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - web
      - api
    networks:
      - liveworldtv
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.prod
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://api.liveworldtv.com
      NEXT_PUBLIC_CDN_URL: https://cdn.liveworldtv.com
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    networks:
      - liveworldtv
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile.prod
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_API_KEY: ${ADMIN_API_KEY}
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '1'
    depends_on:
      - postgres
      - redis
    networks:
      - liveworldtv
    restart: unless-stopped

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: liveworldtv_prod
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docs/database/implementation-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    ports:
      - "5432:5432"
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2'
    networks:
      - liveworldtv
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - liveworldtv
    restart: unless-stopped

  scraper:
    build:
      context: .
      dockerfile: tools/scrapers/Dockerfile
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      SCRAPER_SCHEDULE: "0 */6 * * *" # Every 6 hours
    depends_on:
      - postgres
      - redis
    networks:
      - liveworldtv
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  liveworldtv:
    driver: bridge
```

---

## Environment Configuration

### Production Environment Variables

```bash
# .env.production (managed via secret manager)
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@postgres.internal:5432/liveworldtv_prod
DATABASE_POOL_SIZE=20
DATABASE_CONNECTION_TIMEOUT=5000

# Redis
REDIS_URL=redis://redis.internal:6379
REDIS_MAX_CONNECTIONS=50

# API Security
JWT_SECRET=${VAULT_JWT_SECRET}
ADMIN_API_KEY=${VAULT_ADMIN_KEY}
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CDN & Assets
CDN_BASE_URL=https://cdn.liveworldtv.com
MODEL_CDN_URL=https://models.liveworldtv.com
STATIC_ASSETS_URL=https://static.liveworldtv.com

# External Services
YOUTUBE_API_KEY=${VAULT_YOUTUBE_KEY}
YOUTUBE_QUOTA_LIMIT=10000

# Monitoring
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.liveworldtv.com
OTEL_SERVICE_NAME=liveworldtv-api
OTEL_SERVICE_VERSION=${BUILD_VERSION}

# Feature Flags
FF_ENABLE_WEBGPU=true
FF_ENABLE_RANKING_V2=true
FF_ENABLE_7PM_SCRAPING=true
FF_DUBBING_QUALITY_THRESHOLD=0.7

# Operational
LOG_LEVEL=info
HEALTH_CHECK_TIMEOUT=5000
GRACEFUL_SHUTDOWN_TIMEOUT=30000
```

### Development Environment

```bash
# .env.development
NODE_ENV=development

DATABASE_URL=postgresql://liveworldtv:liveworldtv@localhost:5432/liveworldtv
REDIS_URL=redis://localhost:6379

NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CDN_URL=http://localhost:3002

# Development feature flags
FF_ENABLE_WEBGPU=false  # Disable for dev reliability
FF_ENABLE_MODEL_MOCKING=true
FF_ENABLE_DETAILED_LOGGING=true

LOG_LEVEL=debug
```

---

## Monitoring & Observability

### OpenTelemetry Configuration

```typescript
// apps/api/src/telemetry/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'

export function initializeObservability(): NodeSDK {
  const sdk = new NodeSDK({
    serviceName: 'liveworldtv-api',
    serviceVersion: process.env.BUILD_VERSION || '0.1.0',
    
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-express': {
          requestHook: (span, info) => {
            span.setAttributes({
              'http.route': info.route?.path,
              'user.country': info.req.query?.country,
              'user.session_id': info.req.headers['x-session-id']
            })
          }
        }
      })
    ],
    
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/metrics'
      }),
      exportIntervalMillis: 30000 // 30 seconds
    })
  })
  
  return sdk
}

// Custom metrics for business logic
export class LiveWorldTVMetrics {
  private dubbingLatencyHistogram: Histogram
  private channelDiscoveryCounter: Counter
  private modelLoadingHistogram: Histogram
  private qualityScoreGauge: Gauge
  
  constructor(private meter: Meter) {
    this.dubbingLatencyHistogram = meter.createHistogram('dubbing_latency_ms', {
      description: 'End-to-end dubbing latency',
      unit: 'ms'
    })
    
    this.channelDiscoveryCounter = meter.createCounter('channel_discovery_total', {
      description: 'Channel discovery events'
    })
    
    this.modelLoadingHistogram = meter.createHistogram('model_loading_duration_ms', {
      description: 'AI model loading time',
      unit: 'ms'
    })
    
    this.qualityScoreGauge = meter.createGauge('dubbing_quality_score', {
      description: 'Average dubbing quality score (1-5)'
    })
  }
  
  recordDubbingLatency(latencyMs: number, country: string, topic: string): void {
    this.dubbingLatencyHistogram.record(latencyMs, {
      country,
      topic,
      threshold_met: latencyMs < 1000 ? 'true' : 'false'
    })
  }
  
  recordModelLoading(modelName: string, durationMs: number, success: boolean): void {
    this.modelLoadingHistogram.record(durationMs, {
      model: modelName,
      success: success.toString(),
      runtime: process.env.FF_ENABLE_WEBGPU === 'true' ? 'webgpu' : 'wasm'
    })
  }
}
```

### Alert Policies

```yaml
# monitoring/alerts.yml
alerts:
  critical:
    - name: API Error Rate High
      condition: rate(api_errors_total[5m]) > 0.05
      threshold: "5% error rate over 5 minutes"
      notification: pagerduty
      
    - name: Database Connection Pool Exhausted
      condition: db_connections_active / db_connections_max > 0.9
      threshold: "90% connection pool usage"
      notification: pagerduty
      
    - name: Extension Crash Rate High
      condition: rate(extension_crashes_total[10m]) > 0.1
      threshold: "10% extension crash rate over 10 minutes"
      notification: pagerduty
  
  warning:
    - name: Dubbing Latency Degraded
      condition: histogram_quantile(0.95, dubbing_latency_ms[5m]) > 2000
      threshold: "P95 dubbing latency > 2s"
      notification: slack
      
    - name: Model Download Failures
      condition: rate(model_download_failures_total[15m]) > 0.15
      threshold: "15% model download failure rate"
      notification: slack
      
    - name: Content Scraping Failures
      condition: scraping_job_success_rate < 0.9
      threshold: "Scraping success rate < 90%"
      notification: slack

  performance:
    - name: Memory Usage High
      condition: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.85
      threshold: "85% memory usage"
      notification: slack
      
    - name: Disk Usage High
      condition: disk_usage_percent > 80
      threshold: "80% disk usage"
      notification: slack
```

---

## Health Checks & SLOs

### Service Health Endpoints

```typescript
// apps/api/src/modules/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly databaseHealthIndicator: DatabaseHealthIndicator,
    private readonly redisHealthIndicator: RedisHealthIndicator
  ) {}
  
  @Get()
  @HealthCheck()
  async getHealth() {
    return this.healthService.check([
      () => this.databaseHealthIndicator.pingCheck('database'),
      () => this.redisHealthIndicator.pingCheck('redis'),
      () => this.scrapingHealthIndicator.checkLastSuccessfulRun(),
      () => this.modelCdnHealthIndicator.checkAvailability()
    ])
  }
  
  @Get('detailed')
  async getDetailedHealth(): Promise<DetailedHealthResponse> {
    const [dbMetrics, redisMetrics, appMetrics] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getRedisMetrics(), 
      this.getApplicationMetrics()
    ])
    
    return {
      timestamp: new Date().toISOString(),
      status: this.calculateOverallStatus([dbMetrics, redisMetrics, appMetrics]),
      components: {
        database: dbMetrics,
        redis: redisMetrics,
        application: appMetrics
      },
      slo_compliance: await this.calculateSLOCompliance()
    }
  }
  
  private async getDatabaseMetrics(): Promise<ComponentHealth> {
    const stats = await this.databaseService.query(`
      SELECT 
        (SELECT COUNT(*) FROM channels WHERE active = true) as active_channels,
        (SELECT COUNT(*) FROM live_streams WHERE status = 'LIVE') as live_streams,
        (SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()) as active_sessions,
        (SELECT AVG(mean_time) FROM query_performance) as avg_query_time_ms
    `)
    
    return {
      status: stats.avg_query_time_ms < 100 ? 'healthy' : 'degraded',
      metrics: stats,
      last_check: new Date()
    }
  }
}
```

### Service Level Objectives

```typescript
interface SLODefinitions {
  availability: {
    target: 99.9 // 99.9% uptime
    measurement_window: '28d'
    error_budget: '8.6h' // 0.1% of 28 days
  }
  
  latency: {
    api_response_time: {
      target_p50: 200 // 200ms P50
      target_p95: 500 // 500ms P95
      target_p99: 1000 // 1s P99
    }
    
    dubbing_latency: {
      target_p50_webgpu: 1000 // 1s P50 with WebGPU
      target_p95_webgpu: 1500 // 1.5s P95 with WebGPU
      target_p50_wasm: 2500 // 2.5s P50 with WebAssembly
      target_p95_wasm: 3500 // 3.5s P95 with WebAssembly
    }
  }
  
  quality: {
    model_loading_success: 95 // 95% model loading success rate
    content_freshness: 99 // 99% channels updated within 6h
    dubbing_quality_score: 4.0 // Average MOS ≥ 4.0
  }
}
```

---

## Deployment Strategies

### Rolling Deployment

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    strategy:
      matrix:
        service: [web, api]
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Build and push Docker images
        run: |
          docker build -t liveworldtv/${{ matrix.service }}:${{ github.ref_name }} \
                       -f apps/${{ matrix.service }}/Dockerfile.prod .
          docker push liveworldtv/${{ matrix.service }}:${{ github.ref_name }}
        
      - name: Deploy with zero downtime
        run: |
          # Rolling update with health checks
          kubectl set image deployment/${{ matrix.service }} \
            ${{ matrix.service }}=liveworldtv/${{ matrix.service }}:${{ github.ref_name }}
          
          # Wait for rollout completion
          kubectl rollout status deployment/${{ matrix.service }} --timeout=600s
          
          # Verify health checks
          kubectl wait --for=condition=ready pod -l app=${{ matrix.service }} --timeout=300s

  validate-deployment:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Run smoke tests
        run: |
          # Test critical endpoints
          curl -f https://api.liveworldtv.com/health
          curl -f https://liveworldtv.com/api/health
          
          # Test sample channel discovery
          curl -f "https://api.liveworldtv.com/v1/channels?country=US&topic=NEWS&limit=5"
          
      - name: Validate SLO compliance
        run: |
          # Check error rates haven't spiked
          npm run validate:slo
```

### Blue-Green Deployment (for major releases)

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

VERSION=$1
ENVIRONMENT=${2:-production}

echo "🚀 Starting blue-green deployment of version $VERSION"

# 1. Deploy to green environment
echo "📦 Deploying to green environment..."
kubectl apply -f k8s/green/ --namespace=liveworldtv-green

# 2. Wait for green to be healthy
echo "🏥 Waiting for green health checks..."
kubectl wait --for=condition=ready pod -l env=green --timeout=300s

# 3. Run validation tests against green
echo "🧪 Running validation tests..."
./scripts/validate-green-deployment.sh $VERSION

# 4. Switch traffic gradually
echo "🔄 Switching traffic: blue -> green"
kubectl patch service liveworldtv-service -p '{"spec":{"selector":{"env":"green"}}}'

# 5. Monitor for 10 minutes
echo "👀 Monitoring green performance..."
./scripts/monitor-deployment.sh 600 # 10 minutes

# 6. Cleanup blue if successful
echo "🧹 Cleaning up blue environment..."
kubectl delete -f k8s/blue/ --namespace=liveworldtv-blue

echo "✅ Blue-green deployment complete!"
```

---

## Operational Procedures

### Incident Response Runbook

```yaml
# docs/runbooks/incident-response.yml
incidents:
  P0_total_outage:
    detection:
      - "API error rate > 50% for 2+ minutes"
      - "Extension crash rate > 50% for 5+ minutes"  
      - "Database connection failures"
    
    immediate_response:
      - "Page on-call engineer immediately"
      - "Create incident in PagerDuty"
      - "Start customer communication"
    
    mitigation_steps:
      1. "Check load balancer and API service status"
      2. "Verify database connectivity and query performance"
      3. "Roll back last deployment if deployed within 2h"
      4. "Scale API replicas if resource constrained"
      5. "Disable feature flags if specific feature failing"
    
    communication:
      - "Status page update within 10 minutes"
      - "Customer email within 30 minutes if not resolved"
      
  P1_performance_degradation:
    detection:
      - "API P95 latency > 2s for 10+ minutes"
      - "Dubbing latency P95 > 5s for 10+ minutes"
      - "Model download success rate < 80%"
    
    response_time: "2 hours"
    
    investigation_steps:
      1. "Check database query performance and locks"
      2. "Analyze Redis memory usage and eviction rate"  
      3. "Review CDN hit rates for model downloads"
      4. "Check for unusual traffic patterns or abuse"
      5. "Verify external service dependencies (YouTube API)"
      
  P2_feature_degradation:
    detection:
      - "Extension adoption rate drops > 20%"
      - "Content scraping success rate < 90%"
      - "Ranking staleness > 4 hours"
    
    response_time: "Business hours"
    
    investigation_steps:
      1. "Review scraping job logs and error patterns"
      2. "Check for changes in 7pm.com or YouTube structure"
      3. "Analyze user feedback and quality scores"
      4. "Review feature flag configurations"
```

### Backup & Recovery

```bash
#!/bin/bash
# scripts/backup-database.sh

set -e

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="liveworldtv_backup_${BACKUP_DATE}.sql"
S3_BUCKET="liveworldtv-backups"

echo "🗄️ Starting database backup..."

# 1. Create compressed backup
pg_dump $DATABASE_URL | gzip > /tmp/$BACKUP_FILE.gz

# 2. Upload to S3 with encryption
aws s3 cp /tmp/$BACKUP_FILE.gz s3://$S3_BUCKET/daily/ \
  --server-side-encryption AES256 \
  --storage-class STANDARD_IA

# 3. Test backup integrity
echo "🔍 Validating backup..."
gunzip -t /tmp/$BACKUP_FILE.gz

# 4. Cleanup local file
rm /tmp/$BACKUP_FILE.gz

# 5. Log success
echo "✅ Backup complete: s3://$S3_BUCKET/daily/$BACKUP_FILE.gz"

# 6. Cleanup old backups (keep 30 days)
aws s3 ls s3://$S3_BUCKET/daily/ | \
  awk '$1 < "'$(date -d '30 days ago' '+%Y-%m-%d')'" {print $4}' | \
  xargs -I {} aws s3 rm s3://$S3_BUCKET/daily/{}
```

### Disaster Recovery

```yaml
# Disaster recovery procedures
disaster_recovery:
  rto: "4 hours"  # Recovery Time Objective
  rpo: "1 hour"   # Recovery Point Objective
  
  procedures:
    database_failure:
      1. "Promote read replica to primary"
      2. "Update application connection strings"
      3. "Restore from latest S3 backup if needed"
      4. "Verify data integrity with checksums"
      
    application_failure:
      1. "Deploy last known good version"
      2. "Scale horizontally if resource issue"
      3. "Enable maintenance mode if needed"
      4. "Investigate root cause in parallel"
      
    cdn_failure:
      1. "Switch to backup CDN provider"
      2. "Update DNS records (5-minute TTL)"
      3. "Verify model downloads working"
      4. "Monitor extension functionality"
      
    complete_infrastructure_failure:
      1. "Activate DR site in alternate region"
      2. "Restore database from latest backup"
      3. "Update DNS to point to DR site"
      4. "Communicate extended downtime to users"
```

---

## Security & Compliance

### Security Hardening

```yaml
# Security configuration
security:
  api_security:
    rate_limiting:
      global: "100 requests/minute per IP"
      authenticated: "500 requests/minute per session"
      model_downloads: "5 downloads/hour per IP"
    
    input_validation:
      - "Strict parameter validation on all endpoints"
      - "SQL injection prevention (parameterized queries)"
      - "XSS prevention (input sanitization)"
      - "CSRF protection (SameSite cookies)"
    
    data_protection:
      - "Encrypt sensitive data at rest (AES-256)"
      - "Hash PII before storage (SHA-256)"
      - "Secure connection requirements (TLS 1.3+)"
      - "No secrets in logs or error messages"
  
  extension_security:
    permissions:
      - "Minimal permissions (tabCapture, storage only)"
      - "Host restrictions (liveworldtv.com only)"
      - "No external network access"
    
    content_security:
      - "CSP: script-src 'self' 'wasm-unsafe-eval'"
      - "Model integrity verification (SHA-256)"
      - "Signed extension distribution"
  
  infrastructure:
    - "VPC with private subnets"
    - "Security groups with minimal access"
    - "Regular security updates (automated)"
    - "Secrets management (AWS Secrets Manager)"
```

### Compliance Requirements

```typescript
// Privacy and compliance specifications
interface ComplianceRequirements {
  gdpr: {
    data_minimization: 'Collect only necessary data'
    purpose_limitation: 'Use data only for stated purposes'
    storage_limitation: 'Auto-delete after 7 days (sessions) / 90 days (events)'
    user_rights: {
      access: 'API endpoint for data export'
      rectification: 'Session preference updates'
      erasure: 'Immediate session deletion capability'
      portability: 'JSON export format'
    }
  }
  
  accessibility: {
    wcag_2_1: 'Level AA compliance'
    keyboard_navigation: 'Full functionality without mouse'
    screen_reader: 'ARIA labels and semantic HTML'
    captions: 'Always available as fallback'
  }
  
  privacy:
    data_processing: '100% local AI processing'
    no_tracking: 'No cross-site tracking or fingerprinting'
    minimal_storage: 'Session data only, no personal information'
    transparency: 'Clear privacy policy and data handling'
  }
}
```

### Operational Dashboards

```yaml
# Grafana dashboard specifications
dashboards:
  user_experience:
    metrics:
      - "Dubbing activation rate by country/topic"
      - "Average dubbing latency (P50, P95, P99)"
      - "Extension installation conversion rate"
      - "Quality scores by model and browser"
      - "Time to first meaningful phrase"
    
  technical_health:
    metrics:
      - "API request rate and latency"
      - "Database query performance"
      - "Redis hit/miss ratios"
      - "Model download success rates"
      - "Container resource utilization"
    
  business_metrics:
    metrics:
      - "Daily active users"
      - "Channel discovery engagement"
      - "Watch time with/without dubbing"
      - "Geographic usage distribution"
      - "Extension vs captions-only usage"
    
  content_pipeline:
    metrics:
      - "Scraping job success rates"
      - "Channel catalog freshness"
      - "Live stream detection accuracy"
      - "Content quality scores"
      - "Duplicate detection effectiveness"
```

---

## Deployment Checklist

### Pre-Deployment Validation

```bash
#!/bin/bash
# scripts/pre-deployment-check.sh

echo "🔍 Pre-deployment validation..."

# 1. Code quality gates
npm run lint
npm run typecheck
npm run test:all

# 2. Security scanning
npm audit --audit-level moderate
./scripts/security-scan.sh

# 3. Build validation
npm run build
./scripts/validate-build-artifacts.sh

# 4. Database migration validation
npm run db:migrate:dry-run
./scripts/validate-migrations.sh

# 5. Performance benchmarks
npm run test:performance
./scripts/validate-performance.sh

# 6. Extension packaging
npm run ext:build
npm run ext:validate

echo "✅ Pre-deployment validation complete"
```

### Post-Deployment Validation

```bash
#!/bin/bash
# scripts/post-deployment-check.sh

VERSION=$1
ENVIRONMENT=${2:-production}

echo "🚀 Post-deployment validation for $VERSION in $ENVIRONMENT..."

# 1. Health check endpoints
curl -f https://api.liveworldtv.com/health
curl -f https://liveworldtv.com/api/health

# 2. Sample API calls
curl -f "https://api.liveworldtv.com/v1/channels?country=US&topic=NEWS&limit=5"

# 3. Database connectivity
npm run db:health-check

# 4. Redis connectivity  
npm run redis:health-check

# 5. CDN availability
curl -f https://cdn.liveworldtv.com/models/health

# 6. Extension compatibility
npm run ext:smoke-test

# 7. Performance validation
npm run perf:smoke-test

echo "✅ Post-deployment validation complete for $VERSION"
```

This operational specification provides the foundation for reliable production deployment and operations while maintaining the quality and performance targets defined in Phase 1-2.