# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**liveworldtv** is a web application that surfaces live YouTube channels from around the world with real-time English dubbing and time-shifted playback capabilities. The app mirrors content from 7pm.com and provides:

1. **Real-time English dubbing** (<1 second latency via local AI)
2. **Time-shift buffering** (30-90s, not full DVR due to YouTube limitations)  
3. **Simplified discovery** (Country + Topic: News, Sports, Music & DJs)
4. **Privacy-first** (100% local processing, no data transmission)

## Architecture Stack (2025 SOTA)

- **Frontend**: Next.js 15+ + React 18 + TypeScript (strict mode)
- **Backend**: NestJS + TypeScript + PostgreSQL + Redis
- **Player**: YouTube IFrame API (primary), hls.js/Shaka (licensed feeds)
- **Extension**: Chrome Manifest V3 with local AI pipeline
- **AI Stack (100% Local)**: Distil-Whisper + NLLB-200-Distilled + Kokoro-82M
- **Deployment**: WebGPU (primary) → WebAssembly (fallback) → Cloud (emergency)

## Project Status & Directory Structure

**Current Phase**: Phase 4 (Implementation) - 15-20% complete with significant gaps  
**Reality Check**: 6-8 weeks to MVP, 4-6 months to full vision  
**Code Status**: Monorepo structure exists, but major implementation gaps require systematic completion

⚠️ **IMPORTANT**: See `IMPLEMENTATION_GAP_ANALYSIS.md` and `REALISTIC_IMPLEMENTATION_ROADMAP.md` for detailed status

### Current Structure (Implementation Phase)
```
liveworldtv_v1/
├── apps/
│   ├── web/                  # ✅ Next.js structure, ❌ components are stubs
│   ├── api/                  # ✅ NestJS modules, ❌ 200+ TypeScript errors  
│   └── extension/            # ✅ Architecture design, ❌ no working code
├── packages/
│   ├── shared-types/         # ⚠️  Basic types exist, missing 50+ exports
│   ├── ai-models/            # ❌ Empty package
│   └── telemetry/            # ❌ Empty package
├── tools/
│   ├── scripts/              # ✅ Automation scripts
│   ├── migrations/           # ✅ Migration tooling
│   └── docker/               # ✅ Container configs
├── tests/                    # ❌ All tests fail compilation
├── docs/                     # ✅ Excellent design documentation
├── IMPLEMENTATION_GAP_ANALYSIS.md     # 📋 Detailed gap analysis
└── REALISTIC_IMPLEMENTATION_ROADMAP.md # 🗺️  6-8 week implementation plan
```

### Implementation Priority Order
1. **Week 1-2**: Fix shared-types, get one API endpoint working with frontend
2. **Week 3-4**: Complete web application without AI features  
3. **Week 5-6**: Basic extension shell and integration
4. **Month 2-3**: Local AI pipeline implementation
5. **Month 4**: Production hardening and optimization

## Development Commands (Future - Phase 5+)

```bash
# Workspace setup (npm workspaces)
npm install

# Development servers
npm run dev                    # All apps concurrently
npm run dev:web               # Frontend only
npm run dev:api               # Backend only

# Building
npm run build                 # All apps
npm run build:extension       # Extension for Chrome Web Store

# Testing  
npm run test                  # All tests
npm run test:unit             # Unit tests only
npm run test:e2e              # End-to-end tests
npm run test:extension        # Extension testing

# Quality gates
npm run lint                  # ESLint across workspace
npm run typecheck             # TypeScript checking
npm run check                 # Full quality validation

# AI Models
npm run models:download       # Download AI models for development
npm run models:validate       # Verify model integrity
npm run models:benchmark      # Performance testing

# Database
npm run db:migrate           # Run migrations
npm run db:seed              # Seed development data
npm run db:reset             # Reset database

# Extension development
npm run ext:build            # Build extension
npm run ext:package          # Package for Chrome Web Store
npm run ext:install          # Install in development Chrome
```

## Revolutionary AI Architecture (2025 SOTA)

**Breakthrough**: 100% local AI pipeline with <1 second dubbing latency

### Local AI Pipeline Components
1. **ASR**: Distil-Whisper (WebGPU, 756MB, 150-200ms)
2. **MT**: NLLB-200-Distilled (WebGPU, 600MB, 50-100ms)  
3. **TTS**: Kokoro-82M (WebGPU, 3.2MB, <300ms)
4. **Total**: ~1.36GB models, <650ms end-to-end latency

### Backend Components  
1. **catalog-service**: Channel metadata + content ingestion
2. **ranking-service**: ML-driven content recommendation
3. **analytics-service**: Privacy-safe user event tracking
4. **admin-service**: Content moderation and management

## Data Model (Core Entities)

```typescript
Channel(id, name, country, topic, sourceType[YOUTUBE_EMBED|LICENSED], sourceUrl, owner)
LiveStream(id, channelId, status[LIVE|OFF], startedAt, delaySeconds, dvrWindowSec)
RankingStats(channelId, activationCtr, ttfmp_ms, mos_proxy, speech_ratio, wer_proxy)
User(id, prefs{country, topic}, recentAutoplays[])
```

## API Surface

- `GET /v1/channels?country=US&topic=NEWS`
- `GET /v1/streams/{id}`
- `GET /v1/ranking/home?country=BR`
- `POST /v1/sessions/play`
- `GET /v1/admin/health`

## Development Guidelines

- **TypeScript strict mode** with ESLint + Prettier
- **No direct getAll() methods** - always paginate
- **Feature flags** for all user-facing functionality
- **TDD approach** - write tests first
- **Conventional commits** with proper scoping
- **No server-side restreaming** of YouTube content
- **Privacy-first** - minimal logging, no YouTube audio capture on server

## Testing Strategy

- **Unit tests**: Ranking algorithms, catalog ingestion, feature gating
- **Contract tests**: API endpoints validation
- **E2E tests**: Cypress/Playwright for autoplay, dubbing, captions
- **Integration tests**: Player startup, DVR seeking, lipsync correction
- **Performance tests**: 10k CCU load testing

## Quality Targets

- TTFMP (Time to First Meaningful Phrase) ≤ 8s p50
- Added dubbing latency ≤ 10s p50, 12s hard cap
- Rebuffer ratio ≤ 0.3% median
- Lipsync error ≤ 250ms
- Playback success ≥ 98.5%

## Git Workflow

- **Trunk-based development** with short-lived feature branches
- **Branch naming**: `{type}/{scope}-{slug}-#{issue}` (e.g., `feat/player-dvr-controls-#123`)
- **Squash & merge** to main after 2 approvals
- **No direct commits** to main branch
- **Feature flags** for gradual rollouts

## Security Requirements

- **No secrets in code** - use environment variables and secret managers
- **Input validation** on all API endpoints  
- **Minimal permissions** for browser extension
- **No server-side YouTube audio capture**
- **Privacy-first telemetry** - aggregated and anonymized

## Documentation Requirements

Each module ships with:
- README with setup instructions
- API documentation with examples
- Architecture Decision Records (ADRs) for major decisions
- Runbooks for operational procedures

## Current Project Phase

**Status**: Phase 3 (Subsystem Specifications) Complete  
**Deliverables**: Detailed implementation specifications for all subsystems  
**Next Steps**: Phase 4 (Implementation) - ready to begin development

### Production Infrastructure Ready

**Repository restructured for development:**
✅ Monorepo workspace setup (apps/, packages/, tools/)  
✅ Tooling infrastructure (build, test, CI/CD configured)
✅ Operational tools (migrations, scripts, Docker ready)

**Phase 4 Ready**: Production-grade structure with comprehensive subsystem specifications

## Revolutionary Insights from Phase 1-2

### Technical Breakthroughs Discovered
1. **<1 second dubbing latency** achievable with local AI (vs 6-10s cloud services)
2. **Zero external dependencies** eliminates service reliability risks
3. **100% privacy** with no data transmission to external services  
4. **Zero marginal costs** after initial model download (vs per-request API fees)

### Critical Constraints Identified
1. **DVR limited to YouTube's buffer windows** (2-3h time-shift, not infinite recording)
2. **Extension adoption barrier** limits dubbing to 15-25% of users (market validated)
3. **Model download size** (660MB) creates onboarding friction
4. **WebGPU dependency** for optimal performance (experimental browser support)

### Product Positioning Shift
- **From**: "Live TV with DVR + dubbing"  
- **To**: "Real-time global news with instant English dubbing"

Refer to `docs/designs/` for complete Phase 1-2 analysis and `.claude/` for development processes.