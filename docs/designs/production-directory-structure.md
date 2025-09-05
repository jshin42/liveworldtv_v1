# Production Directory Structure Design

## Expert Analysis: Monorepo Architecture Required

Based on our system design (Web App + Backend API + Extension + Shared AI), we need a **production-grade monorepo** structure.

### **Recommended Structure (Industry Standard)**

```
liveworldtv/
├── README.md                           # Project overview, quickstart
├── package.json                        # Workspace root, shared scripts
├── .gitignore                          # Comprehensive ignore patterns
├── .env.example                        # Environment template
├── CLAUDE.md                           # Claude Code guidance (current)
├── LICENSE                             # Apache 2.0 (AI model compatibility)
│
├── docs/                               # Documentation hub
│   ├── designs/                        # ✅ System design (current)
│   │   ├── liveworldtv-proposal.md     # Phase 1 proposal  
│   │   ├── liveworldtv-system.md       # Phase 2 system design
│   │   └── webgpu-deployment-strategy.md
│   ├── architecture/                   # ADRs, technical decisions
│   ├── api/                           # OpenAPI specs, contract docs
│   ├── runbooks/                      # Operational procedures  
│   └── research/                      # ✅ Move prototype analysis here
│
├── apps/                              # Application boundaries
│   ├── web/                           # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/                   # App Router (pages, layouts)
│   │   │   ├── components/            # UI components
│   │   │   │   ├── ui/                # Base components (Button, Input)
│   │   │   │   ├── player/            # Video player components
│   │   │   │   ├── discovery/         # Country/topic selection
│   │   │   │   └── dubbing/           # Dubbing controls
│   │   │   ├── hooks/                 # React hooks  
│   │   │   ├── lib/                   # Frontend utilities
│   │   │   ├── store/                 # State management (Zustand)
│   │   │   └── types/                 # Frontend-specific types
│   │   ├── __tests__/                 # Frontend tests
│   │   │   ├── components/            # Component tests
│   │   │   ├── hooks/                 # Hook tests
│   │   │   └── e2e/                   # End-to-end tests
│   │   ├── public/                    # Static assets
│   │   ├── next.config.js             # Next.js configuration
│   │   ├── tailwind.config.js         # Tailwind configuration
│   │   └── package.json               # Frontend dependencies
│   │
│   ├── api/                           # NestJS backend service
│   │   ├── src/
│   │   │   ├── modules/               # Feature modules
│   │   │   │   ├── catalog/           # Channel management
│   │   │   │   │   ├── catalog.controller.ts
│   │   │   │   │   ├── catalog.service.ts
│   │   │   │   │   ├── catalog.module.ts
│   │   │   │   │   └── dto/           # Data transfer objects
│   │   │   │   ├── ranking/           # ML recommendation engine
│   │   │   │   ├── scraping/          # Content ingestion
│   │   │   │   ├── analytics/         # Event tracking
│   │   │   │   └── health/            # Health checks
│   │   │   ├── common/                # Shared backend code
│   │   │   │   ├── guards/            # Authentication guards
│   │   │   │   ├── interceptors/      # Logging, validation
│   │   │   │   ├── pipes/             # Data validation
│   │   │   │   └── decorators/        # Custom decorators
│   │   │   ├── database/              # Database layer
│   │   │   │   ├── entities/          # TypeORM entities
│   │   │   │   ├── migrations/        # Database migrations
│   │   │   │   └── seeds/             # Seed data
│   │   │   ├── config/                # Configuration management
│   │   │   └── main.ts                # Application entry point
│   │   ├── test/                      # Backend tests
│   │   │   ├── unit/                  # Unit tests
│   │   │   ├── integration/           # Integration tests
│   │   │   ├── e2e/                   # API end-to-end tests
│   │   │   └── fixtures/              # Test data
│   │   ├── nest-cli.json              # NestJS configuration
│   │   └── package.json               # Backend dependencies
│   │
│   └── extension/                     # Browser extension
│       ├── src/
│       │   ├── background/            # Service worker scripts
│       │   │   ├── model-manager.ts   # AI model orchestration
│       │   │   ├── audio-processor.ts # Audio capture + processing
│       │   │   └── telemetry.ts       # Privacy-safe analytics
│       │   ├── content/               # Content scripts
│       │   │   ├── youtube-injector.ts # YouTube page integration
│       │   │   └── ui-overlay.ts      # Dubbing controls overlay
│       │   ├── popup/                 # Extension popup UI
│       │   │   ├── popup.html         
│       │   │   ├── popup.tsx          # React popup component
│       │   │   └── popup.css          
│       │   ├── workers/               # Web Workers
│       │   │   ├── asr-worker.ts      # Distil-Whisper processing
│       │   │   ├── mt-worker.ts       # NLLB-200 translation
│       │   │   └── tts-worker.ts      # Kokoro-82M synthesis
│       │   ├── models/                # AI model management
│       │   │   ├── model-loader.ts    # WebGPU/WASM model loading
│       │   │   ├── model-cache.ts     # IndexedDB model storage
│       │   │   └── fallback-manager.ts # Graceful degradation
│       │   └── types/                 # Extension-specific types
│       ├── __tests__/                 # Extension tests
│       ├── manifest.json              # Extension manifest
│       ├── webpack.config.js          # Build configuration
│       └── package.json               # Extension build dependencies
│
├── packages/                          # Shared packages (npm workspaces)
│   ├── shared-types/                  # ✅ Cross-app TypeScript types
│   │   ├── src/
│   │   │   ├── api.ts                 # API request/response types
│   │   │   ├── database.ts            # Database entity types  
│   │   │   ├── analytics.ts           # Event tracking types
│   │   │   └── index.ts               # Main exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── utils/                         # Shared utilities
│   │   ├── src/
│   │   │   ├── validation.ts          # Schema validation
│   │   │   ├── crypto.ts              # Hashing, signing utilities
│   │   │   └── date.ts                # Date/time utilities
│   │   └── package.json
│   ├── ai-models/                     # AI model abstractions
│   │   ├── src/
│   │   │   ├── base-model.ts          # Abstract model interface
│   │   │   ├── asr/                   # ASR model implementations
│   │   │   ├── mt/                    # Translation model implementations
│   │   │   └── tts/                   # TTS model implementations
│   │   └── package.json
│   └── telemetry/                     # Observability primitives
│       ├── src/
│       │   ├── metrics.ts             # OpenTelemetry metrics
│       │   ├── tracing.ts             # Distributed tracing
│       │   └── logging.ts             # Structured logging
│       └── package.json
│
├── tools/                             # Development & deployment automation
│   ├── scripts/                       # Automation scripts
│   │   ├── setup-dev.sh               # Local development setup
│   │   ├── build-all.sh               # Multi-app build
│   │   ├── deploy.sh                  # Deployment automation
│   │   └── model-download.sh          # AI model pre-downloading
│   ├── migrations/                    # Database migrations (standalone)
│   │   ├── 001_initial_schema.sql     
│   │   ├── 002_ranking_tables.sql
│   │   └── migrate.js                 # Migration runner
│   ├── docker/                        # Container configurations
│   │   ├── Dockerfile.api             # Backend container
│   │   ├── Dockerfile.web             # Frontend container  
│   │   ├── docker-compose.yml         # Local development
│   │   └── docker-compose.prod.yml    # Production stack
│   └── k8s/                          # Kubernetes manifests (production)
│       ├── namespace.yaml
│       ├── api-deployment.yaml
│       ├── web-deployment.yaml
│       └── ingress.yaml
│
├── tests/                             # Cross-application testing
│   ├── e2e/                          # Full user journey tests
│   │   ├── dubbing-flow.spec.ts      # Complete dubbing activation
│   │   ├── discovery-flow.spec.ts    # Country/topic browsing
│   │   └── extension-integration.spec.ts # Extension + web integration
│   ├── integration/                   # Cross-service tests
│   │   ├── api-catalog.spec.ts       # Catalog service integration
│   │   └── ranking-pipeline.spec.ts   # Ranking algorithm tests
│   ├── performance/                   # Load and performance tests
│   │   ├── api-load.spec.ts          
│   │   └── extension-memory.spec.ts   
│   ├── fixtures/                      # Shared test data
│   │   ├── channels.json              # Test channel data
│   │   ├── users.json                 # Test user profiles
│   │   └── audio-samples/             # Test audio files
│   └── utils/                         # Testing utilities
│       ├── test-db.ts                 # Database test helpers
│       ├── mock-youtube.ts            # YouTube API mocks
│       └── extension-harness.ts       # Extension testing utilities
│
├── .github/                           # GitHub automation
│   ├── workflows/                     # CI/CD pipelines
│   │   ├── ci.yml                     # Lint, test, build
│   │   ├── deploy-staging.yml         # Staging deployment
│   │   ├── deploy-production.yml      # Production deployment
│   │   └── model-update.yml           # AI model release pipeline
│   ├── ISSUE_TEMPLATE/               # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md      # PR template
│
└── config/                           # Configuration files
    ├── eslint.config.js              # Shared linting rules
    ├── prettier.config.js            # Code formatting  
    ├── jest.config.js                # Root Jest configuration
    ├── tsconfig.base.json            # Base TypeScript config
    └── .env.example                  # Environment template
```

## Critical Production Standards Violated

### 🔴 **Immediate Blockers** 
1. **No dependency management**: Missing `package.json` workspace setup
2. **No build system**: Missing TypeScript, bundling, deployment configs  
3. **No testing infrastructure**: Missing Jest, testing utilities, fixture management
4. **No CI/CD**: Missing automation for quality gates and deployment

### 🟡 **Organizational Issues**
1. **Prototype files scattered**: Should reorganize into `docs/research/`
2. **No operational tooling**: Missing scripts, migrations, Docker setup
3. **No shared code structure**: No packages for cross-app utilities

## Recommendation: Restructure Before Phase 3

**Current state**: Good design docs, **poor development foundation**  
**Blocking factor**: Cannot write subsystem specs (Phase 3) without knowing code organization  
**Required action**: Restructure repository for production development

**Approach options**:
1. **Reorganize current**: Move files to production structure, add infrastructure
2. **Fresh start**: Create new repo with production structure, migrate design docs
3. **Hybrid**: Keep current for design archive, create production workspace

## Solution Verification Conclusion

**Design quality**: ✅ **Excellent** (comprehensive, well-researched)  
**Implementation readiness**: ❌ **Poor** (directory structure inadequate)  
**Production viability**: ⚠️ **Conditional** (needs proper development foundation)

**Honest assessment**: We have world-class design trapped in amateur project organization.

**Critical decision needed**: Restructure repository now, or continue with inadequate foundation and pay technical debt later?