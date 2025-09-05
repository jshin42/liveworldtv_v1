# Testing Specifications & Quality Gates

## Overview

This specification defines comprehensive testing strategy for LiveWorldTV, including unit tests, integration tests, end-to-end tests, and performance validation. All quality gates must pass before code can be merged or deployed.

## Test Categories & Requirements

### Test Pyramid Distribution

```
        E2E (5%)
      Integration (15%)  
    Unit Tests (80%)
```

**Coverage Requirements**:
- **Unit Tests**: ≥85% line coverage
- **Integration Tests**: ≥90% API contract coverage
- **E2E Tests**: 100% critical user journey coverage

---

## 1. Unit Test Specifications

### Backend Services Testing

```typescript
// apps/api/src/modules/catalog/catalog.service.spec.ts
describe('CatalogService', () => {
  let service: CatalogService
  let mockRepository: jest.Mocked<Repository<Channel>>
  let mockRedis: jest.Mocked<Redis>
  
  beforeEach(() => {
    // Setup mocks with realistic data
    mockRepository = createMockRepository()
    mockRedis = createMockRedis()
    service = new CatalogService(mockRepository, mockRedis)
  })
  
  describe('getChannelsByCountryTopic', () => {
    it('should return cached results when available', async () => {
      const cachedData = createMockChannels(5)
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData))
      
      const result = await service.getChannelsByCountryTopic('US', 'NEWS', { page: 1, limit: 20 })
      
      expect(result).toEqual(cachedData)
      expect(mockRepository.findAndCount).not.toHaveBeenCalled()
    })
    
    it('should query database and cache when cache miss', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRepository.findAndCount.mockResolvedValue([createMockChannels(10), 25])
      
      const result = await service.getChannelsByCountryTopic('US', 'NEWS', { page: 1, limit: 20 })
      
      expect(result.data.channels).toHaveLength(10)
      expect(result.pagination.total).toBe(25)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'channels:US:NEWS:1',
        300,
        JSON.stringify(result)
      )
    })
    
    it('should validate country code format', async () => {
      await expect(
        service.getChannelsByCountryTopic('usa', 'NEWS', { page: 1, limit: 20 })
      ).rejects.toThrow('Invalid country code')
    })
    
    it('should handle database connection errors', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRepository.findAndCount.mockRejectedValue(new Error('Connection failed'))
      
      await expect(
        service.getChannelsByCountryTopic('US', 'NEWS', { page: 1, limit: 20 })
      ).rejects.toThrow('Database connection failed')
    })
  })
  
  describe('ranking algorithm validation', () => {
    it('should apply Thompson sampling correctly', async () => {
      const channels = createMockChannelsWithStats()
      const ranked = await service.rankChannels(channels, 'thompson_sampling')
      
      // Verify Thompson sampling properties
      expect(ranked).toHaveLength(channels.length)
      expect(isValidThompsonSampling(ranked)).toBe(true)
    })
    
    it('should enforce diversity constraints', async () => {
      const channels = createMockChannelsAllSameOwner() // All from same owner
      const ranked = await service.rankChannels(channels, 'thompson_sampling')
      
      // Should not have more than 2 consecutive channels from same owner
      expect(hasValidDiversity(ranked)).toBe(true)
    })
  })
})

// Test data factories
function createMockChannels(count: number): Channel[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(),
    name: `Test Channel ${i}`,
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: `https://www.youtube.com/embed/test${i}`,
    active: true,
    firstSeen: new Date(),
    lastSeen: new Date()
  }))
}
```

### Frontend Component Testing

```typescript
// apps/web/src/components/player/youtube-player.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { YouTubePlayer } from './youtube-player'

describe('YouTubePlayer', () => {
  it('should render player with dubbing controls', () => {
    render(<YouTubePlayer channelId="test123" />)
    
    expect(screen.getByRole('button', { name: /enable dubbing/i })).toBeInTheDocument()
    expect(screen.getByText(/youtube player/i)).toBeInTheDocument()
  })
  
  it('should request extension activation when dubbing enabled', async () => {
    const mockExtensionRequest = jest.fn().mockResolvedValue({ success: true })
    window.chrome = { runtime: { sendMessage: mockExtensionRequest } }
    
    render(<YouTubePlayer channelId="test123" />)
    
    fireEvent.click(screen.getByRole('button', { name: /enable dubbing/i }))
    
    await waitFor(() => {
      expect(mockExtensionRequest).toHaveBeenCalledWith({
        type: 'ENABLE_DUBBING',
        data: { channelId: 'test123' }
      })
    })
  })
  
  it('should show fallback message when extension unavailable', async () => {
    window.chrome = undefined // No extension
    
    render(<YouTubePlayer channelId="test123" />)
    
    fireEvent.click(screen.getByRole('button', { name: /enable dubbing/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/install extension/i)).toBeInTheDocument()
    })
  })
  
  it('should handle YouTube player errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    
    render(<YouTubePlayer channelId="invalid" />)
    
    // Simulate YouTube player error
    const ytPlayer = screen.getByTestId('youtube-iframe')
    fireEvent.error(ytPlayer)
    
    await waitFor(() => {
      expect(screen.getByText(/player error/i)).toBeInTheDocument()
    })
    
    consoleError.mockRestore()
  })
})
```

### Extension Unit Testing

```typescript
// apps/extension/src/background/model-manager.test.ts
describe('ModelManager', () => {
  let manager: ModelManager
  let mockStorage: jest.Mocked<typeof chrome.storage.local>
  
  beforeEach(() => {
    mockStorage = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
    global.chrome = { storage: { local: mockStorage } }
    manager = new ModelManager()
  })
  
  describe('downloadModel', () => {
    it('should download model with progress tracking', async () => {
      const mockFetch = jest.fn().mockImplementation(() => ({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            // Simulate chunked download
            const chunk1 = new Uint8Array(1024)
            const chunk2 = new Uint8Array(1024)
            controller.enqueue(chunk1)
            controller.enqueue(chunk2)
            controller.close()
          }
        })
      }))
      global.fetch = mockFetch
      
      const progressSpy = jest.fn()
      manager.on('progress', progressSpy)
      
      await manager.downloadModel({
        name: 'test-model',
        url: 'https://cdn.test.com/model.onnx',
        size: 2048,
        sha256: 'test-hash'
      })
      
      expect(progressSpy).toHaveBeenCalledWith('test-model', 0.5) // 50% progress
      expect(progressSpy).toHaveBeenCalledWith('test-model', 1.0) // 100% complete
    })
    
    it('should verify model integrity after download', async () => {
      const invalidModel = new Uint8Array(1024)
      setupMockDownload(invalidModel)
      
      await expect(manager.downloadModel(testModelSpec)).rejects.toThrow(
        'Model integrity verification failed'
      )
    })
    
    it('should resume interrupted downloads', async () => {
      const partialModel = new Uint8Array(512)
      mockStorage.get.mockResolvedValue({ 'test-model': partialModel })
      
      const mockFetch = jest.fn().mockImplementation((url, options) => {
        expect(options.headers['Range']).toBe('bytes=512-')
        return createMockResponse(new Uint8Array(512)) // Remaining data
      })
      global.fetch = mockFetch
      
      await manager.downloadModel(testModelSpec)
      
      expect(mockFetch).toHaveBeenCalledWith(
        testModelSpec.url,
        expect.objectContaining({
          headers: expect.objectContaining({ 'Range': 'bytes=512-' })
        })
      )
    })
  })
})
```

---

## 2. Integration Test Specifications

### API Contract Testing

```typescript
// tests/integration/api-contracts.test.ts
describe('API Contracts', () => {
  let app: INestApplication
  let request: supertest.SuperTest<supertest.Test>
  
  beforeAll(async () => {
    app = await createTestingApp()
    request = supertest(app.getHttpServer())
  })
  
  describe('GET /v1/channels', () => {
    it('should return valid channel list schema', async () => {
      const response = await request
        .get('/v1/channels?country=US&topic=NEWS')
        .expect(200)
      
      // Validate response schema
      expect(response.body).toMatchSchema(channelListSchema)
      expect(response.body.data.channels).toBeInstanceOf(Array)
      expect(response.body.data.pagination).toHaveProperty('total')
      expect(response.body.meta).toHaveProperty('timestamp')
    })
    
    it('should respect pagination parameters', async () => {
      const response = await request
        .get('/v1/channels?country=US&topic=NEWS&limit=5&page=1')
        .expect(200)
      
      expect(response.body.data.channels).toHaveLength(5)
      expect(response.body.data.pagination.limit).toBe(5)
      expect(response.body.data.pagination.page).toBe(1)
    })
    
    it('should validate country code format', async () => {
      await request
        .get('/v1/channels?country=usa&topic=NEWS')
        .expect(400)
        .expect(res => {
          expect(res.body.error.code).toBe('INVALID_COUNTRY')
        })
    })
    
    it('should return 500 with database error', async () => {
      // Simulate database failure
      await disconnectDatabase()
      
      await request
        .get('/v1/channels?country=US&topic=NEWS')
        .expect(500)
        .expect(res => {
          expect(res.body.error.code).toBe('INTERNAL_ERROR')
        })
    })
  })
  
  describe('POST /v1/analytics/events', () => {
    it('should accept valid event batch', async () => {
      const eventBatch = {
        events: [
          {
            eventType: 'PLAY_START',
            timestamp: new Date().toISOString(),
            channelId: uuid(),
            metadata: {
              dubbingLatencyMs: 850,
              audioQualityScore: 4.2
            }
          }
        ]
      }
      
      await request
        .post('/v1/analytics/events')
        .send(eventBatch)
        .expect(204)
    })
    
    it('should reject oversized event batches', async () => {
      const eventBatch = {
        events: Array(51).fill(createMockEvent()) // Max is 50
      }
      
      await request
        .post('/v1/analytics/events')
        .send(eventBatch)
        .expect(400)
        .expect(res => {
          expect(res.body.error.code).toBe('BATCH_TOO_LARGE')
        })
    })
  })
})
```

### Database Integration Testing

```typescript
// tests/integration/database.test.ts
describe('Database Integration', () => {
  let dataSource: DataSource
  
  beforeAll(async () => {
    dataSource = await createTestDatabase()
    await runMigrations(dataSource)
  })
  
  afterAll(async () => {
    await dataSource.destroy()
  })
  
  describe('Channel ingestion', () => {
    it('should deduplicate channels by content fingerprint', async () => {
      const channel1 = createTestChannel({ name: 'BBC News', sourceUrl: 'https://youtube.com/embed/bbc1' })
      const channel2 = createTestChannel({ name: 'BBC News', sourceUrl: 'https://youtube.com/embed/bbc1' })
      
      await dataSource.manager.save(Channel, channel1)
      
      // Second insert should fail due to duplicate fingerprint
      await expect(
        dataSource.manager.save(Channel, channel2)
      ).rejects.toThrow(/duplicate key value/)
    })
    
    it('should update last_seen timestamp on duplicate detection', async () => {
      const originalTime = new Date('2025-01-01')
      const channel = await dataSource.manager.save(Channel, 
        createTestChannel({ lastSeen: originalTime })
      )
      
      // Simulate scraper finding same channel again
      await dataSource.manager.query(`
        INSERT INTO channels (name, country, topic, source_url, content_fingerprint, last_seen)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (content_fingerprint) 
        DO UPDATE SET last_seen = NOW()
      `, [channel.name, channel.country, channel.topic, channel.sourceUrl, channel.contentFingerprint])
      
      const updated = await dataSource.manager.findOne(Channel, { where: { id: channel.id } })
      expect(updated!.lastSeen.getTime()).toBeGreaterThan(originalTime.getTime())
    })
  })
  
  describe('Ranking calculations', () => {
    it('should calculate ranking stats correctly', async () => {
      // Setup test data
      const channel = await dataSource.manager.save(Channel, createTestChannel())
      await dataSource.manager.save(PlayEvent, [
        createPlayEvent(channel.id, 'PLAY_START', { watchTimeSeconds: 120 }),
        createPlayEvent(channel.id, 'DUB_ENABLED', { dubbingLatencyMs: 800 }),
        createPlayEvent(channel.id, 'QUALITY_FEEDBACK', { audioQualityScore: 4.5 })
      ])
      
      // Run ranking calculation
      await dataSource.manager.query('SELECT update_ranking_stats()')
      
      // Verify results
      const stats = await dataSource.manager.findOne(RankingStats, { 
        where: { channelId: channel.id } 
      })
      
      expect(stats!.activationCtr).toBeCloseTo(0.5) // 1 activation / 2 plays
      expect(stats!.avgWatchTimeSec).toBe(120)
      expect(stats!.dubbingLatencyP50Ms).toBe(800)
      expect(stats!.mosProxy).toBeCloseTo(4.5)
    })
  })
  
  describe('Data retention policies', () => {
    it('should auto-expire old sessions', async () => {
      const expiredSession = await dataSource.manager.save(UserSession, {
        sessionId: uuid(),
        expiresAt: new Date(Date.now() - 86400000) // 1 day ago
      })
      
      const deletedCount = await dataSource.manager.query('SELECT cleanup_expired_sessions()')
      
      expect(deletedCount[0].cleanup_expired_sessions).toBeGreaterThan(0)
      
      const found = await dataSource.manager.findOne(UserSession, {
        where: { sessionId: expiredSession.sessionId }
      })
      expect(found).toBeNull()
    })
  })
})
```

### Extension Component Testing

```typescript
// apps/extension/src/workers/dubbing-pipeline.test.ts
describe('DubbingPipeline', () => {
  let pipeline: DubbingPipeline
  let mockASR: jest.Mocked<ASRWorker>
  let mockMT: jest.Mocked<MTWorker>
  let mockTTS: jest.Mocked<TTSWorker>
  
  beforeEach(() => {
    mockASR = createMockASRWorker()
    mockMT = createMockMTWorker()
    mockTTS = createMockTTSWorker()
    
    pipeline = new DubbingPipeline({
      targetLatencyMs: 1000,
      maxLatencyMs: 3000,
      bufferSizeMs: 1000,
      maxConcurrentChunks: 3
    })
    
    // Inject mocks
    pipeline.setWorkers(mockASR, mockMT, mockTTS)
  })
  
  describe('processAudioChunk', () => {
    it('should process audio through full pipeline', async () => {
      const testAudio = createTestAudioChunk()
      
      mockASR.transcribe.mockResolvedValue({
        text: 'Bonjour le monde',
        confidence: 0.95,
        latency: 200
      })
      
      mockMT.translate.mockResolvedValue({
        text: 'Hello world',
        confidence: 0.92,
        latency: 150
      })
      
      mockTTS.synthesize.mockResolvedValue({
        audio: createTestAudioOutput(),
        latency: 300,
        fromCache: false
      })
      
      const result = await pipeline.processAudioChunk(testAudio, Date.now())
      
      expect(result.transcription).toBe('Bonjour le monde')
      expect(result.translation).toBe('Hello world')
      expect(result.latency).toBeLessThan(1000) // Under target
      expect(result.qualityScore).toBeGreaterThan(0.8)
    })
    
    it('should skip processing for silent audio', async () => {
      const silentAudio = new Float32Array(16000).fill(0) // 1s silence
      
      const result = await pipeline.processAudioChunk(silentAudio, Date.now())
      
      expect(mockASR.transcribe).not.toHaveBeenCalled()
      expect(result.dubbedAudio).toHaveLength(0)
    })
    
    it('should handle individual component failures', async () => {
      mockASR.transcribe.mockRejectedValue(new Error('ASR failed'))
      
      await expect(
        pipeline.processAudioChunk(createTestAudioChunk(), Date.now())
      ).rejects.toThrow('Processing failed: ASR failed')
      
      // Should report error to analytics
      expect(pipeline.getErrorCount()).toBe(1)
    })
    
    it('should respect latency timeouts', async () => {
      mockASR.transcribe.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResult), 2000)) // 2s delay
      )
      
      const result = await pipeline.processAudioChunk(createTestAudioChunk(), Date.now())
      
      // Should timeout and fallback
      expect(result.latency).toBeLessThan(1500) // Timeout + fallback
    })
  })
})
```

---

## 3. End-to-End Test Specifications

### Critical User Journeys

```typescript
// tests/e2e/user-journeys.spec.ts
describe('Critical User Journeys', () => {
  describe('New User Discovery Flow', () => {
    it('should guide user through complete dubbing setup', async () => {
      const page = await browser.newPage()
      
      // 1. Landing page
      await page.goto('http://localhost:3000')
      await expect(page.locator('[data-testid="autoplay-player"]')).toBeVisible()
      await expect(page.locator('text="Enable English Dubbing"')).toBeVisible()
      
      // 2. Attempt to enable dubbing (no extension)
      await page.click('text="Enable English Dubbing"')
      await expect(page.locator('text="Install Extension"')).toBeVisible()
      
      // 3. Simulate extension installation
      await page.evaluate(() => {
        window.chrome = {
          runtime: {
            sendMessage: jest.fn().mockResolvedValue({ success: true })
          }
        }
      })
      
      // 4. Enable dubbing with extension
      await page.click('text="Enable English Dubbing"')
      await expect(page.locator('text="Loading AI Models"')).toBeVisible()
      
      // 5. Simulate model loading complete
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('model-loaded', {
          detail: { model: 'all', progress: 100 }
        }))
      })
      
      // 6. Verify dubbing active
      await expect(page.locator('text="🎧 Dubbing Active"')).toBeVisible()
      await expect(page.locator('[data-testid="latency-indicator"]')).toBeVisible()
    })
  })
  
  describe('Extension User Flow', () => {
    beforeEach(async () => {
      // Setup browser with extension installed
      await setupExtensionEnvironment()
    })
    
    it('should enable dubbing immediately for extension users', async () => {
      const page = await browser.newPage()
      
      await page.goto('http://localhost:3000')
      await page.click('text="Enable English Dubbing"')
      
      // Should skip installation flow
      await expect(page.locator('text="Loading AI Models"')).toBeVisible()
      
      // Simulate models already cached
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('models-ready'))
      })
      
      // Should show immediate dubbing
      await expect(page.locator('text="🎧 Dubbing Active"')).toBeVisible({ timeout: 2000 })
    })
    
    it('should maintain dubbing when switching channels', async () => {
      const page = await browser.newPage()
      
      // Enable dubbing on first channel
      await page.goto('http://localhost:3000')
      await enableDubbingFlow(page)
      
      // Switch to different channel
      await page.click('[data-testid="channel-grid"] >> nth=1')
      
      // Dubbing should remain enabled
      await expect(page.locator('text="🎧 Dubbing Active"')).toBeVisible()
      
      // Verify new channel audio is processed
      await verifyAudioProcessing(page)
    })
  })
  
  describe('Fallback Scenarios', () => {
    it('should gracefully degrade when WebGPU unavailable', async () => {
      const page = await browser.newPage()
      
      // Disable WebGPU
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'gpu', { value: undefined })
      })
      
      await page.goto('http://localhost:3000')
      await enableDubbingFlow(page)
      
      // Should show WebAssembly fallback message
      await expect(page.locator('text="Compatibility Mode"')).toBeVisible()
      await expect(page.locator('text="2-3s latency"')).toBeVisible()
      
      // Should still provide dubbing
      await verifyAudioProcessing(page)
    })
    
    it('should fallback to captions when AI models fail', async () => {
      const page = await browser.newPage()
      
      // Simulate model loading failure
      await page.addInitScript(() => {
        window.chrome = {
          runtime: {
            sendMessage: jest.fn().mockRejectedValue(new Error('Model load failed'))
          }
        }
      })
      
      await page.goto('http://localhost:3000')
      await page.click('text="Enable English Dubbing"')
      
      // Should fallback to captions-only
      await expect(page.locator('text="Captions Only"')).toBeVisible()
      await expect(page.locator('[data-testid="captions-display"]')).toBeVisible()
    })
  })
})
```

### Performance Testing

```typescript
// tests/performance/load-testing.spec.ts
describe('Performance Tests', () => {
  describe('API Load Testing', () => {
    it('should handle 100 concurrent channel requests', async () => {
      const requests = Array(100).fill(null).map(() => 
        fetch('http://localhost:3001/v1/channels?country=US&topic=NEWS')
      )
      
      const startTime = Date.now()
      const responses = await Promise.all(requests)
      const duration = Date.now() - startTime
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000) // 5 seconds for 100 requests
      
      // Average response time should be acceptable
      const avgResponseTime = duration / 100
      expect(avgResponseTime).toBeLessThan(500) // 500ms average
    })
  })
  
  describe('Extension Performance', () => {
    it('should maintain <1s dubbing latency under load', async () => {
      const extension = await loadTestExtension()
      const audioStream = createContinuousAudioStream(30000) // 30 seconds
      
      const latencies: number[] = []
      
      extension.on('dubbing-complete', (event) => {
        latencies.push(event.latency)
      })
      
      await extension.processContinuousAudio(audioStream)
      
      // Verify latency requirements
      const p50 = percentile(latencies, 0.5)
      const p95 = percentile(latencies, 0.95)
      
      expect(p50).toBeLessThan(1000) // P50 < 1s
      expect(p95).toBeLessThan(2000) // P95 < 2s
      expect(latencies.length).toBeGreaterThan(25) // Processed most chunks
    })
    
    it('should not exceed memory limits during continuous operation', async () => {
      const extension = await loadTestExtension()
      const memoryBefore = await extension.getMemoryUsage()
      
      // Process 10 minutes of audio
      await extension.processContinuousAudio(createAudioStream(600000))
      
      const memoryAfter = await extension.getMemoryUsage()
      const memoryIncrease = memoryAfter - memoryBefore
      
      // Memory increase should be reasonable (<500MB)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024)
    })
  })
})
```

---

## 4. Quality Gates Configuration

### Pre-Commit Quality Gates

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests with coverage
        run: npm run test:unit -- --coverage --maxWorkers=4
        
      - name: Enforce coverage thresholds
        run: |
          if [ $(cat coverage/coverage-summary.json | jq '.total.lines.pct') -lt 85 ]; then
            echo "Line coverage below 85%"
            exit 1
          fi
          
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
  
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - name: Install Playwright
        run: npx playwright install
        
      - name: Build applications
        run: npm run build
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload E2E artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
  
  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - name: Run load tests
        run: npm run test:performance
        
      - name: Validate performance benchmarks
        run: |
          # API latency must be under 500ms P95
          # Extension latency must be under 2s P95
          npm run validate:performance
```

### Code Quality Standards

```typescript
// Quality validation specifications
interface QualityStandards {
  coverage: {
    lines: 85
    branches: 80
    functions: 85
    statements: 85
  }
  
  complexity: {
    cyclomaticComplexity: 10 // Max per function
    cognitiveComplexity: 15 // Max per function
    maxFileLines: 300
    maxFunctionLines: 50
  }
  
  performance: {
    apiLatencyP95Ms: 500
    dubbingLatencyP95Ms: 2000
    memoryUsageMb: 500
    bundleSizeKb: 2000
  }
  
  security: {
    noSecretsInCode: true
    noSqlInjectionVulnerabilities: true
    noCorsWildcards: true
    noEvalStatements: true
  }
}
```

### Automated Quality Validation

```bash
#!/bin/bash
# scripts/quality-check.sh

set -e

echo "🔍 Running quality gates..."

# 1. Linting
echo "📋 Linting code..."
npm run lint

# 2. Type checking  
echo "📊 Type checking..."
npm run typecheck

# 3. Unit tests with coverage
echo "🧪 Running unit tests..."
npm run test:unit -- --coverage --passWithNoTests

# 4. Check coverage thresholds
echo "📈 Validating coverage..."
npm run coverage:validate

# 5. Security scanning
echo "🔒 Security scanning..."
npm audit --audit-level moderate
npm run security:check

# 6. Bundle size analysis
echo "📦 Bundle size analysis..."
npm run analyze:bundles

# 7. Performance validation
echo "⚡ Performance validation..."
npm run test:performance

echo "✅ All quality gates passed!"
```

This testing specification ensures comprehensive quality validation across all subsystems while maintaining fast feedback loops for development.