# Phase 3: Subsystem Specifications

## Context & Dependencies

**Phase 1**: ✅ Proposal approved with validated feasibility
**Phase 2**: ✅ System design complete with evidence-based architecture
**Phase 3**: Detailed subsystem specifications for implementation

## Subsystem Overview

Based on Phase 2 system design, we have **6 core subsystems**:

1. **Web Application** (Next.js frontend)
2. **API Gateway** (NestJS backend services)
3. **Browser Extension** (Chrome Manifest V3 + local AI)
4. **Content Ingestion** (7pm scraper + YouTube API)
5. **Data Layer** (PostgreSQL + Redis)
6. **Deployment Infrastructure** (Docker + CI/CD)

---

## 1. Web Application Subsystem

### Component Architecture
```
apps/web/src/
├── app/                    # Next.js 15 app router
│   ├── (routes)/
│   │   ├── page.tsx       # Home: autoplay + discovery
│   │   ├── [country]/
│   │   │   └── page.tsx   # Country-specific channels
│   │   └── watch/
│   │       └── [id]/page.tsx # Individual channel player
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Tailwind CSS
├── components/
│   ├── ui/                # Reusable UI primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── select.tsx
│   ├── player/            # Video player components
│   │   ├── youtube-player.tsx
│   │   ├── controls.tsx
│   │   └── captions.tsx
│   └── discovery/         # Content discovery
│       ├── country-selector.tsx
│       ├── topic-rails.tsx
│       └── channel-grid.tsx
├── lib/
│   ├── api.ts            # API client (React Query)
│   ├── store.ts          # Zustand state management
│   └── types.ts          # Frontend-specific types
└── hooks/
    ├── use-player.ts     # YouTube player integration
    ├── use-extension.ts  # Extension communication
    └── use-analytics.ts  # Event tracking
```

### State Management (Zustand)
```typescript
interface AppState {
  // Discovery state
  selectedCountry: string | null
  selectedTopic: TopicType | null
  channels: Channel[]
  
  // Player state
  currentChannel: Channel | null
  isPlaying: boolean
  dubbingEnabled: boolean
  extensionAvailable: boolean
  
  // Actions
  setCountry: (country: string) => void
  setTopic: (topic: TopicType) => void
  playChannel: (channel: Channel) => void
  toggleDubbing: () => void
}
```

### API Integration Patterns
```typescript
// React Query integration
const { data: channels, isLoading } = useQuery({
  queryKey: ['channels', country, topic],
  queryFn: () => api.channels.list({ country, topic }),
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false
})
```

---

## 2. API Gateway Subsystem

### NestJS Module Structure
```
apps/api/src/
├── main.ts               # Bootstrap application
├── app.module.ts         # Root module
├── modules/
│   ├── catalog/          # Channel management
│   │   ├── catalog.module.ts
│   │   ├── catalog.controller.ts
│   │   ├── catalog.service.ts
│   │   ├── entities/
│   │   │   ├── channel.entity.ts
│   │   │   └── live-stream.entity.ts
│   │   └── dto/
│   │       ├── channel-list.dto.ts
│   │       └── channel-filter.dto.ts
│   ├── ranking/          # ML recommendations
│   │   ├── ranking.module.ts
│   │   ├── ranking.controller.ts
│   │   ├── ranking.service.ts
│   │   └── algorithms/
│   │       ├── thompson-sampling.ts
│   │       └── diversity-constraint.ts
│   ├── analytics/        # Event tracking
│   │   ├── analytics.module.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   └── events/
│   │       └── play-event.dto.ts
│   └── admin/           # Management interface
│       ├── admin.module.ts
│       ├── admin.controller.ts
│       └── admin.service.ts
├── common/
│   ├── decorators/      # Custom decorators
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth guards
│   ├── interceptors/    # Request/response interceptors
│   └── pipes/           # Validation pipes
└── config/
    ├── database.config.ts
    ├── redis.config.ts
    └── app.config.ts
```

### Service Layer Patterns
```typescript
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @Inject('REDIS') private redis: Redis
  ) {}

  async getChannelsByCountryTopic(
    country: string,
    topic: TopicType,
    pagination: PaginationDto
  ): Promise<PaginatedResponse<Channel>> {
    // Cache key pattern
    const cacheKey = `channels:${country}:${topic}:${pagination.page}`
    
    // Check cache first
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)
    
    // Query with optimized indexes
    const [channels, total] = await this.channelRepo.findAndCount({
      where: { country, topic, active: true },
      order: { lastSeen: 'DESC' },
      skip: pagination.offset,
      take: pagination.limit
    })
    
    const result = { channels, pagination: { total, ...pagination } }
    
    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(result))
    
    return result
  }
}
```

### API Response Standards
```typescript
// Standardized API response wrapper
interface ApiResponse<T> {
  data: T
  meta: {
    timestamp: string
    version: string
    requestId: string
  }
  pagination?: {
    page: number
    limit: number
    total: number
    hasNext: boolean
  }
}

// Error response format
interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
  meta: {
    timestamp: string
    requestId: string
  }
}
```

---

## 3. Browser Extension Subsystem

### Manifest V3 Architecture
```json
{
  "manifest_version": 3,
  "name": "LiveWorldTV Dubbing",
  "version": "0.1.0",
  "permissions": [
    "tabCapture",
    "storage",
    "offscreen"
  ],
  "host_permissions": [
    "https://*.liveworldtv.com/*",
    "https://www.youtube.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["https://*.liveworldtv.com/*"],
    "js": ["content.js"],
    "run_at": "document_start"
  }],
  "web_accessible_resources": [{
    "resources": ["models/*.onnx", "workers/*.js"],
    "matches": ["https://*.liveworldtv.com/*"]
  }],
  "action": {
    "default_popup": "popup.html"
  }
}
```

### Extension Directory Structure
```
apps/extension/src/
├── background/           # Service worker (Manifest V3)
│   ├── background.ts    # Main service worker
│   ├── model-manager.ts # AI model downloading/caching
│   └── tab-manager.ts   # Tab capture coordination
├── content/             # Content scripts
│   ├── content.ts       # Main content script
│   ├── player-integration.ts # YouTube player hooks
│   └── ui-overlay.ts    # Dubbing controls overlay
├── offscreen/           # Offscreen document (audio processing)
│   ├── offscreen.html
│   ├── offscreen.ts
│   └── audio-processor.ts
├── workers/             # Web Workers
│   ├── asr-worker.ts    # Speech recognition
│   ├── mt-worker.ts     # Machine translation
│   └── tts-worker.ts    # Text-to-speech
├── popup/              # Extension popup
│   ├── popup.html
│   ├── popup.ts
│   └── popup.css
└── models/             # AI model files (downloaded)
    ├── distil-whisper.onnx
    ├── nllb-200.onnx
    └── kokoro-82m.onnx
```

### AI Pipeline Architecture
```typescript
// Main AI pipeline coordinator
class DubbingPipeline {
  private asr: ASRWorker
  private mt: MTWorker  
  private tts: TTSWorker
  private audioMixer: AudioMixer
  
  constructor() {
    this.asr = new ASRWorker()
    this.mt = new MTWorker()
    this.tts = new TTSWorker()
    this.audioMixer = new AudioMixer()
  }
  
  async startDubbing(tabId: number): Promise<MediaStream> {
    // 1. Capture tab audio
    const audioStream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    })
    
    // 2. Setup processing pipeline
    const processedStream = await this.processPipeline(audioStream)
    
    return processedStream
  }
  
  private async processPipeline(audioStream: MediaStream): Promise<MediaStream> {
    const audioChunks = this.chunkAudio(audioStream, 1000) // 1s chunks
    
    return new ReadableStream({
      start: async () => {
        for await (const chunk of audioChunks) {
          // Parallel processing for overlapping chunks
          const text = await this.asr.transcribe(chunk)
          const translated = await this.mt.translate(text)
          const audio = await this.tts.synthesize(translated)
          
          // Mix with original (ducked)
          const mixed = this.audioMixer.mix(chunk, audio, -12) // Duck original -12dB
          
          // Stream to output
          this.controller.enqueue(mixed)
        }
      }
    })
  }
}
```

### Communication Protocols
```typescript
// Background ↔ Content Script messaging
interface ExtensionMessage {
  type: 'ENABLE_DUBBING' | 'DISABLE_DUBBING' | 'MODEL_STATUS' | 'QUALITY_FEEDBACK'
  data: any
  tabId: number
  timestamp: number
}

// Content Script ↔ Web App messaging
interface WebAppMessage {
  type: 'EXTENSION_READY' | 'DUBBING_STATUS' | 'LATENCY_UPDATE'
  data: {
    extensionAvailable: boolean
    dubbingEnabled: boolean
    currentLatency?: number
    modelLoadingProgress?: number
  }
}
```

---

## 4. Content Ingestion Subsystem

### Scraper Architecture
```
tools/scrapers/src/
├── 7pm/
│   ├── scraper.ts       # Main 7pm.com scraper
│   ├── parser.ts        # HTML parsing logic
│   └── rate-limiter.ts  # Respectful scraping
├── youtube/
│   ├── api-client.ts    # YouTube Data API v3
│   ├── search.ts        # Fallback channel discovery
│   └── metadata.ts      # Channel metadata enrichment
├── common/
│   ├── base-scraper.ts  # Abstract scraper class
│   ├── retry-policy.ts  # Error handling
│   └── content-validator.ts # Data quality checks
└── scheduler/
    ├── cron-manager.ts  # Scheduling engine
    └── job-definitions.ts # Scraping job specs
```

### Scraping Specifications
```typescript
interface ScrapingJob {
  source: 'SEVEN_PM' | 'YOUTUBE_API'
  frequency: CronExpression
  targets: {
    countries: CountryCode[]
    topics: TopicType[]
  }
  quality: {
    minChannelsPerTopic: number
    maxStalenessDays: number
    requiredMetadata: string[]
  }
  limits: {
    requestsPerMinute: number
    concurrentRequests: number
    retryAttempts: number
  }
}

// 7pm.com scraping job
const sevenPmJob: ScrapingJob = {
  source: 'SEVEN_PM',
  frequency: '0 */6 * * *', // Every 6 hours
  targets: {
    countries: ['US', 'UK', 'DE', 'FR', 'JP', 'BR', 'AU', 'CA'],
    topics: ['NEWS', 'SPORTS', 'MUSIC_DJS']
  },
  quality: {
    minChannelsPerTopic: 10,
    maxStalenessDays: 1,
    requiredMetadata: ['title', 'country', 'embedUrl']
  },
  limits: {
    requestsPerMinute: 10,
    concurrentRequests: 2,
    retryAttempts: 3
  }
}
```

### Content Validation Rules
```typescript
class ContentValidator {
  validateChannel(channel: RawChannelData): ValidationResult {
    const errors: string[] = []
    
    // Required fields
    if (!channel.title?.trim()) errors.push('title required')
    if (!channel.country?.match(/^[A-Z]{2}$/)) errors.push('invalid country code')
    if (!channel.embedUrl?.startsWith('https://www.youtube.com/embed/')) {
      errors.push('invalid YouTube embed URL')
    }
    
    // Content quality checks
    if (channel.title.length > 100) errors.push('title too long')
    if (channel.description?.includes('test')) errors.push('test content detected')
    
    // Duplicate detection
    const fingerprint = this.generateFingerprint(channel)
    if (this.isDuplicate(fingerprint)) errors.push('duplicate content')
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: this.generateWarnings(channel)
    }
  }
  
  private generateFingerprint(channel: RawChannelData): string {
    return crypto
      .createHash('sha256')
      .update(`${channel.title}${channel.country}${channel.embedUrl}`)
      .digest('hex')
      .substring(0, 16)
  }
}
```

---

## 5. Data Layer Specifications

### Database Schema Implementation
```sql
-- Core schema with performance optimizations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Enums
CREATE TYPE channel_topic AS ENUM ('NEWS', 'SPORTS', 'MUSIC_DJS');
CREATE TYPE channel_source AS ENUM ('YOUTUBE_EMBED', 'LICENSED');
CREATE TYPE stream_status AS ENUM ('LIVE', 'OFF', 'UNKNOWN');
CREATE TYPE event_type AS ENUM (
  'play_start', 'dub_enabled', 'dub_disabled', 'seek', 'stop',
  'extension_installed', 'model_loaded', 'quality_feedback'
);

-- Main tables with constraints and indexes
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country CHAR(2) NOT NULL,
  topic channel_topic NOT NULL,
  source_type channel_source NOT NULL DEFAULT 'YOUTUBE_EMBED',
  source_url TEXT NOT NULL,
  youtube_channel_id VARCHAR(50), -- For API correlation
  owner VARCHAR(255),
  description TEXT,
  thumbnail_url TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  content_fingerprint CHAR(16), -- For duplicate detection
  
  -- Constraints
  CONSTRAINT channels_country_check CHECK (country ~ '^[A-Z]{2}$'),
  CONSTRAINT channels_url_check CHECK (source_url ~ '^https://'),
  
  -- Indexes for performance
  UNIQUE (content_fingerprint),
  INDEX idx_channels_country_topic (country, topic, last_seen DESC),
  INDEX idx_channels_active_last_seen (active, last_seen DESC) WHERE active = true,
  INDEX idx_channels_source_url USING hash (source_url),
  INDEX idx_channels_youtube_id USING hash (youtube_channel_id)
);

-- Live stream status with automatic cleanup
CREATE TABLE live_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  status stream_status NOT NULL DEFAULT 'UNKNOWN',
  started_at TIMESTAMPTZ,
  delay_seconds INTEGER DEFAULT 30,
  dvr_window_sec INTEGER DEFAULT 10800, -- 3 hours (YouTube max)
  viewer_count INTEGER DEFAULT 0,
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (channel_id),
  INDEX idx_live_streams_status (status, last_checked),
  INDEX idx_live_streams_cleanup (last_checked) WHERE status = 'OFF'
);

-- Ranking with materialized view pattern
CREATE TABLE ranking_stats (
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  activation_ctr DECIMAL(5,4) DEFAULT 0.0,
  ttfmp_ms INTEGER, -- Time to first meaningful phrase
  mos_proxy DECIMAL(3,2), -- Mean opinion score proxy
  speech_ratio DECIMAL(3,2), -- % content that's speech
  wer_proxy DECIMAL(3,2), -- Word error rate proxy
  watch_time_sec INTEGER DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (channel_id),
  INDEX idx_ranking_stats_updated (last_updated DESC),
  INDEX idx_ranking_stats_quality (mos_proxy DESC, activation_ctr DESC)
);

-- Session tracking (GDPR compliant)
CREATE TABLE user_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  preferences JSONB DEFAULT '{"country": null, "topic": null}',
  recent_autoplays UUID[] DEFAULT '{}',
  extension_version VARCHAR(20),
  user_agent_hash CHAR(32), -- Hash for analytics, not tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  
  INDEX idx_user_sessions_expires (expires_at)
);

-- Analytics events (partitioned by month)
CREATE TABLE play_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES user_sessions(session_id) ON DELETE SET NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  event_type event_type NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  
  INDEX idx_play_events_timestamp (event_timestamp DESC),
  INDEX idx_play_events_channel_type (channel_id, event_type, event_timestamp)
) PARTITION BY RANGE (event_timestamp);

-- Monthly partitions (auto-created)
CREATE TABLE play_events_2025_09 PARTITION OF play_events
FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
```

### Redis Caching Patterns
```typescript
interface CachePatterns {
  channels: {
    key: `channels:${country}:${topic}:page:${number}`
    ttl: 300 // 5 minutes
    pattern: 'channels:*'
  }
  
  ranking: {
    key: `ranking:home:${country}`
    ttl: 3600 // 1 hour
    pattern: 'ranking:*'
  }
  
  sessions: {
    key: `session:${sessionId}`
    ttl: 604800 // 7 days
    pattern: 'session:*'
  }
  
  live_status: {
    key: `live:${channelId}`
    ttl: 60 // 1 minute
    pattern: 'live:*'
  }
}
```

---

## 6. Testing Specifications

### Test Categories & Coverage
```typescript
// Unit test specifications
interface UnitTestSpecs {
  coverage: {
    minimum: 80
    target: 90
    excludes: ['*.config.js', '*.d.ts', 'test/**']
  }
  
  categories: {
    services: ['CatalogService', 'RankingService', 'AnalyticsService']
    algorithms: ['ThompsonSampling', 'DiversityConstraint']
    validators: ['ContentValidator', 'ChannelValidator']
    utilities: ['ApiClient', 'CacheManager', 'ModelLoader']
  }
}

// Integration test specifications
interface IntegrationTestSpecs {
  api_contracts: {
    'GET /v1/channels': [
      'returns valid channel list',
      'respects pagination limits',
      'filters by country/topic',
      'handles invalid parameters'
    ]
  }
  
  database: {
    'channel_ingestion': [
      'deduplicates content',
      'updates last_seen timestamp',
      'maintains referential integrity'
    ]
  }
  
  extension: {
    'ai_pipeline': [
      'loads models successfully',
      'processes audio chunks',
      'outputs dubbed audio',
      'handles model loading failures'
    ]
  }
}

// E2E test scenarios
interface E2ETestSpecs {
  user_journeys: {
    'new_user_discovery': [
      'lands on homepage',
      'sees autoplay with captions',
      'clicks enable dubbing',
      'installs extension',
      'receives dubbed audio'
    ]
    
    'extension_user_flow': [
      'extension pre-installed',
      'enables dubbing immediately',
      'switches between channels',
      'quality remains consistent'
    ]
  }
  
  fallback_scenarios: {
    'webgpu_unavailable': [
      'detects WebGPU support',
      'falls back to WebAssembly',
      'maintains functionality',
      'shows latency warning'
    ]
  }
}
```

### Quality Gates
```yaml
# .github/workflows/quality-gates.yml
quality_gates:
  unit_tests:
    coverage_threshold: 80
    max_duration: "5 minutes"
    
  integration_tests:
    database_required: true
    max_duration: "15 minutes"
    
  e2e_tests:
    browser_matrix: ["chrome", "firefox", "safari"]
    max_duration: "30 minutes"
    
  performance_tests:
    load_scenarios:
      - concurrent_users: 100
      - api_requests_per_second: 50
      - model_download_simulation: true
    
  security_scans:
    dependency_check: true
    secret_scanning: true
    extension_permissions_audit: true
```

---

## Implementation Sequence

### Sprint 1: Foundation (2 weeks)
1. Database schema implementation
2. Basic API structure (catalog service)
3. Extension manifest and basic content script
4. CI/CD pipeline setup

### Sprint 2: Core Features (2 weeks)  
1. Channel ingestion pipeline
2. Discovery API endpoints
3. YouTube player integration
4. Basic extension popup

### Sprint 3: AI Pipeline (3 weeks)
1. Model downloading and caching
2. ASR worker implementation
3. Translation worker implementation
4. TTS worker implementation
5. Audio mixing and output

### Sprint 4: Integration (2 weeks)
1. End-to-end dubbing pipeline
2. Fallback mechanisms
3. Quality monitoring
4. Performance optimization

### Sprint 5: Polish (1 week)
1. Error handling
2. Loading states
3. Analytics implementation
4. Documentation

**Total MVP Timeline: 10 weeks**

---

## Success Criteria

### Technical Acceptance Criteria
- [ ] All API endpoints return valid responses within 500ms p95
- [ ] Extension loads AI models within 30s p90
- [ ] Dubbing latency <3s p95 (WebAssembly), <1s stretch goal (WebGPU)
- [ ] Zero server-side content restreaming
- [ ] 100% local AI processing (no external API calls)

### Business Acceptance Criteria
- [ ] Catalog contains ≥50 channels across 8 countries
- [ ] Discovery interface loads within 2s
- [ ] Extension installation rate ≥15% of activated users
- [ ] Time-shift buffering works within YouTube constraints
- [ ] Captions-only fallback provides full functionality

This subsystem specification provides the detailed implementation roadmap while respecting the validated constraints from Phase 1-2 verification.