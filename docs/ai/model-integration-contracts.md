# AI Model Integration Contracts

## Overview

This specification defines the contracts, interfaces, and integration patterns for the local AI pipeline components. All models run 100% locally using WebGPU acceleration with WebAssembly fallbacks.

## Model Stack Specifications

### Model Deployment Matrix

| Component | Primary Runtime | Fallback | Model Size | Target Latency |
|-----------|----------------|----------|------------|----------------|
| **ASR** | WebGPU | WASM + SIMD | 57MB | 200-500ms |
| **MT** | WebGPU | WASM | 600MB | 100-200ms |
| **TTS** | WebGPU | WASM | 3.2MB | <300ms |
| **Total** | **660MB** | **660MB** | **660MB** | **<1s / <3s** |

---

## 1. ASR (Automatic Speech Recognition)

### Model: Distil-Whisper Base

```typescript
interface ASRConfig {
  model: {
    name: 'distil-whisper-base'
    size: 57 * 1024 * 1024 // 57MB
    format: 'onnx'
    precision: 'fp16' | 'fp32'
  }
  
  audio: {
    sampleRate: 16000 // Whisper requirement
    chunkSizeMs: 1000 // 1 second chunks
    overlapMs: 200 // Context overlap
    silenceThresholdDb: -40 // Skip silent audio
  }
  
  inference: {
    beamSize: 1 // Greedy decoding for speed
    noSpeechThreshold: 0.6
    logprobThreshold: -1.0
    compressionRatioThreshold: 2.4
  }
}

class ASRWorker {
  private model: DistilWhisperModel | null = null
  private session: InferenceSession | null = null
  private audioProcessor: AudioProcessor
  
  constructor(private config: ASRConfig) {
    this.audioProcessor = new AudioProcessor(config.audio)
  }
  
  async initialize(runtime: 'webgpu' | 'wasm'): Promise<void> {
    try {
      // Load ONNX model with specified runtime
      this.session = await ort.InferenceSession.create(
        `/models/distil-whisper-base.onnx`,
        {
          executionProviders: runtime === 'webgpu' 
            ? ['webgpu', 'wasm'] 
            : ['wasm'],
          graphOptimizationLevel: 'all'
        }
      )
      
      // Warm up model with empty input
      await this.warmupModel()
      
    } catch (error) {
      throw new ASRInitializationError(`Failed to initialize ASR: ${error}`)
    }
  }
  
  async transcribe(audioData: Float32Array): Promise<TranscriptionResult> {
    if (!this.session) throw new Error('ASR not initialized')
    
    const startTime = performance.now()
    
    try {
      // Preprocess audio
      const processedAudio = await this.audioProcessor.preprocess(audioData)
      
      // Check for silence
      if (this.audioProcessor.isSilent(processedAudio)) {
        return { text: '', confidence: 0, latency: 0 }
      }
      
      // Run inference
      const inputTensor = new ort.Tensor('float32', processedAudio, [1, processedAudio.length])
      const results = await this.session.run({ audio: inputTensor })
      
      // Post-process results
      const text = this.decodeTokens(results.tokens)
      const confidence = this.calculateConfidence(results.logprobs)
      
      return {
        text: text.trim(),
        confidence,
        latency: performance.now() - startTime
      }
      
    } catch (error) {
      throw new ASRInferenceError(`Transcription failed: ${error}`)
    }
  }
  
  private async warmupModel(): Promise<void> {
    const dummyAudio = new Float32Array(16000) // 1 second of silence
    await this.transcribe(dummyAudio)
  }
}

interface TranscriptionResult {
  text: string
  confidence: number
  latency: number
}
```

---

## 2. MT (Machine Translation)

### Model: NLLB-200-Distilled-600M

```typescript
interface MTConfig {
  model: {
    name: 'nllb-200-distilled-600m'
    size: 600 * 1024 * 1024 // 600MB
    format: 'onnx'
    precision: 'fp16'
  }
  
  translation: {
    maxInputLength: 512 // Token limit
    beamSize: 4 // Quality vs speed trade-off
    lengthPenalty: 1.0
    repetitionPenalty: 1.1
  }
  
  languages: {
    source: 'auto' // Auto-detect
    target: 'eng_Latn' // English (Latin script)
  }
}

class MTWorker {
  private session: InferenceSession | null = null
  private tokenizer: Tokenizer | null = null
  private cache: TranslationCache
  
  constructor(private config: MTConfig) {
    this.cache = new TranslationCache(1000) // Cache 1000 recent translations
  }
  
  async initialize(runtime: 'webgpu' | 'wasm'): Promise<void> {
    try {
      // Load tokenizer
      this.tokenizer = await AutoTokenizer.from_pretrained('facebook/nllb-200-distilled-600M')
      
      // Load ONNX model
      this.session = await ort.InferenceSession.create(
        `/models/nllb-200-distilled-600m.onnx`,
        {
          executionProviders: runtime === 'webgpu' 
            ? ['webgpu', 'wasm'] 
            : ['wasm'],
          graphOptimizationLevel: 'all'
        }
      )
      
      // Warm up
      await this.translate('Hello world', 'eng_Latn')
      
    } catch (error) {
      throw new MTInitializationError(`Failed to initialize MT: ${error}`)
    }
  }
  
  async translate(text: string, targetLang: string = 'eng_Latn'): Promise<TranslationResult> {
    if (!this.session || !this.tokenizer) throw new Error('MT not initialized')
    
    const startTime = performance.now()
    
    // Check cache first
    const cacheKey = `${text}:${targetLang}`
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return { ...cached, fromCache: true }
    }
    
    try {
      // Detect source language
      const sourceLanguage = await this.detectLanguage(text)
      if (sourceLanguage === targetLang) {
        return { text, confidence: 1.0, latency: 0, fromCache: false }
      }
      
      // Tokenize input
      const tokens = await this.tokenizer.encode(text)
      if (tokens.length > this.config.translation.maxInputLength) {
        // Split long text into sentences
        return await this.translateLongText(text, targetLang)
      }
      
      // Run inference
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(tokens), [1, tokens.length])
      const results = await this.session.run({
        input_ids: inputTensor,
        forced_bos_token_id: this.getLanguageToken(targetLang)
      })
      
      // Decode output
      const outputTokens = Array.from(results.sequences.data)
      const translatedText = await this.tokenizer.decode(outputTokens, { skip_special_tokens: true })
      
      const result = {
        text: translatedText.trim(),
        confidence: this.calculateConfidence(results.scores),
        latency: performance.now() - startTime,
        fromCache: false
      }
      
      // Cache result
      this.cache.set(cacheKey, result)
      
      return result
      
    } catch (error) {
      throw new MTInferenceError(`Translation failed: ${error}`)
    }
  }
  
  private async translateLongText(text: string, targetLang: string): Promise<TranslationResult> {
    const sentences = this.splitIntoSentences(text)
    const translations: string[] = []
    let totalLatency = 0
    let totalConfidence = 0
    
    for (const sentence of sentences) {
      const result = await this.translate(sentence, targetLang)
      translations.push(result.text)
      totalLatency += result.latency
      totalConfidence += result.confidence
    }
    
    return {
      text: translations.join(' '),
      confidence: totalConfidence / sentences.length,
      latency: totalLatency,
      fromCache: false
    }
  }
}

interface TranslationResult {
  text: string
  confidence: number
  latency: number
  fromCache: boolean
}
```

---

## 3. TTS (Text-to-Speech)

### Model: Kokoro-82M

```typescript
interface TTSConfig {
  model: {
    name: 'kokoro-82m'
    size: 3.2 * 1024 * 1024 // 3.2MB
    format: 'onnx'
    precision: 'fp32' // TTS requires higher precision
  }
  
  audio: {
    sampleRate: 24000 // Kokoro output format
    outputFormat: 'float32'
    channels: 1 // Mono output
  }
  
  synthesis: {
    speed: 1.0 // Normal speaking rate
    pitch: 1.0 // Normal pitch
    voice: 'default' // Kokoro voice selection
    maxTextLength: 200 // Characters per synthesis
  }
}

class TTSWorker {
  private session: InferenceSession | null = null
  private processor: KokoroProcessor | null = null
  private cache: SynthesisCache
  
  constructor(private config: TTSConfig) {
    this.cache = new SynthesisCache(500) // Cache 500 recent syntheses
  }
  
  async initialize(runtime: 'webgpu' | 'wasm'): Promise<void> {
    try {
      // Load text processor
      this.processor = new KokoroProcessor()
      
      // Load ONNX model
      this.session = await ort.InferenceSession.create(
        `/models/kokoro-82m.onnx`,
        {
          executionProviders: runtime === 'webgpu' 
            ? ['webgpu', 'wasm'] 
            : ['wasm'],
          graphOptimizationLevel: 'all'
        }
      )
      
      // Warm up with short phrase
      await this.synthesize('Hello')
      
    } catch (error) {
      throw new TTSInitializationError(`Failed to initialize TTS: ${error}`)
    }
  }
  
  async synthesize(text: string): Promise<SynthesisResult> {
    if (!this.session || !this.processor) throw new Error('TTS not initialized')
    
    const startTime = performance.now()
    
    // Check cache
    const cacheKey = `${text}:${this.config.synthesis.voice}`
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return { ...cached, fromCache: true }
    }
    
    try {
      // Preprocess text
      const normalizedText = this.processor.normalizeText(text)
      if (!normalizedText.trim()) {
        return { audio: new Float32Array(0), latency: 0, fromCache: false }
      }
      
      // Handle long text by splitting
      if (normalizedText.length > this.config.synthesis.maxTextLength) {
        return await this.synthesizeLongText(normalizedText)
      }
      
      // Tokenize text
      const tokens = this.processor.tokenize(normalizedText)
      
      // Run synthesis
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(tokens), [1, tokens.length])
      const results = await this.session.run({
        input_ids: inputTensor,
        speaker_id: new ort.Tensor('int64', [0n], [1]) // Default voice
      })
      
      // Convert output to audio
      const audioData = new Float32Array(results.audio.data)
      
      const result = {
        audio: audioData,
        latency: performance.now() - startTime,
        fromCache: false
      }
      
      // Cache result
      this.cache.set(cacheKey, result)
      
      return result
      
    } catch (error) {
      throw new TTSInferenceError(`Synthesis failed: ${error}`)
    }
  }
  
  private async synthesizeLongText(text: string): Promise<SynthesisResult> {
    const sentences = this.processor.splitIntoSentences(text)
    const audioChunks: Float32Array[] = []
    let totalLatency = 0
    
    for (const sentence of sentences) {
      const result = await this.synthesize(sentence)
      audioChunks.push(result.audio)
      totalLatency += result.latency
    }
    
    // Concatenate audio chunks
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combinedAudio = new Float32Array(totalLength)
    let offset = 0
    
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset)
      offset += chunk.length
    }
    
    return {
      audio: combinedAudio,
      latency: totalLatency,
      fromCache: false
    }
  }
}

interface SynthesisResult {
  audio: Float32Array
  latency: number
  fromCache: boolean
}
```

---

## 4. AI Pipeline Coordinator

### Integration Contract

```typescript
interface DubbingPipelineConfig {
  performance: {
    targetLatencyMs: 1000 // <1s for WebGPU
    maxLatencyMs: 3000 // <3s for WebAssembly
    bufferSizeMs: 1000 // 1s audio chunks
    maxConcurrentChunks: 3 // Process 3 chunks in parallel
  }
  
  quality: {
    minConfidenceThreshold: 0.7 // Skip low confidence transcriptions
    maxSilenceDurationMs: 2000 // Skip long silences
    audioQualityGate: true // Enable quality monitoring
  }
  
  fallback: {
    webgpuTimeoutMs: 2000 // Fallback if WebGPU takes >2s
    retryAttempts: 3
    gracefulDegradation: true
  }
}

class DubbingPipeline {
  private asr: ASRWorker
  private mt: MTWorker
  private tts: TTSWorker
  private audioMixer: AudioMixer
  private performanceMonitor: PerformanceMonitor
  
  constructor(private config: DubbingPipelineConfig) {
    this.initializeComponents()
  }
  
  async processAudioChunk(audioData: Float32Array, timestamp: number): Promise<ProcessingResult> {
    const processingId = `${timestamp}-${Math.random()}`
    const startTime = performance.now()
    
    try {
      // 1. Transcription
      const transcription = await this.asr.transcribe(audioData)
      if (transcription.confidence < this.config.quality.minConfidenceThreshold) {
        return this.createEmptyResult(processingId, 'LOW_CONFIDENCE')
      }
      
      // 2. Translation
      const translation = await this.mt.translate(transcription.text)
      if (!translation.text.trim()) {
        return this.createEmptyResult(processingId, 'NO_TRANSLATION')
      }
      
      // 3. Synthesis
      const synthesis = await this.tts.synthesize(translation.text)
      
      // 4. Quality validation
      const totalLatency = performance.now() - startTime
      const qualityScore = this.calculateQualityScore({
        transcription,
        translation,
        synthesis,
        totalLatency
      })
      
      return {
        id: processingId,
        originalAudio: audioData,
        dubbedAudio: synthesis.audio,
        transcription: transcription.text,
        translation: translation.text,
        latency: totalLatency,
        qualityScore,
        timestamp
      }
      
    } catch (error) {
      this.performanceMonitor.recordError(error, processingId)
      throw new PipelineProcessingError(`Processing failed: ${error}`)
    }
  }
  
  private calculateQualityScore(metrics: {
    transcription: TranscriptionResult
    translation: TranslationResult
    synthesis: SynthesisResult
    totalLatency: number
  }): number {
    // Quality score calculation (0-1)
    const transcriptionScore = Math.min(metrics.transcription.confidence, 1)
    const translationScore = Math.min(metrics.translation.confidence, 1)
    const latencyScore = Math.max(0, 1 - (metrics.totalLatency / this.config.performance.maxLatencyMs))
    
    // Weighted average
    return (transcriptionScore * 0.4) + (translationScore * 0.4) + (latencyScore * 0.2)
  }
}

interface ProcessingResult {
  id: string
  originalAudio: Float32Array
  dubbedAudio: Float32Array
  transcription: string
  translation: string
  latency: number
  qualityScore: number
  timestamp: number
}
```

---

## 5. Model Loading & Caching

### Progressive Model Loading

```typescript
class ModelLoader {
  private static readonly CDN_BASE = 'https://cdn.liveworldtv.com/models'
  private static readonly CACHE_DB = 'liveworldtv-models'
  private db: IDBDatabase | null = null
  
  async downloadModelProgressive(modelSpec: ModelSpec): Promise<void> {
    const url = `${ModelLoader.CDN_BASE}/${modelSpec.filename}`
    
    try {
      // Check if model exists in cache
      const cachedModel = await this.getCachedModel(modelSpec.name)
      if (cachedModel && await this.verifyIntegrity(cachedModel, modelSpec.sha256)) {
        return // Model already cached and valid
      }
      
      // Start progressive download
      const response = await fetch(url, {
        headers: this.getResumeHeaders(modelSpec.name)
      })
      
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      
      // Stream download with progress tracking
      const reader = response.body!.getReader()
      const chunks: Uint8Array[] = []
      let downloadedBytes = 0
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        chunks.push(value)
        downloadedBytes += value.length
        
        // Report progress to UI
        this.reportProgress(modelSpec.name, downloadedBytes, modelSpec.size)
        
        // Allow other tasks to run
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      
      // Assemble complete model
      const modelData = this.assembleChunks(chunks, downloadedBytes)
      
      // Verify integrity
      if (!await this.verifyIntegrity(modelData, modelSpec.sha256)) {
        throw new Error('Model integrity verification failed')
      }
      
      // Store in IndexedDB
      await this.storeModel(modelSpec.name, modelData)
      
    } catch (error) {
      this.reportDownloadError(modelSpec.name, error)
      throw error
    }
  }
  
  private async verifyIntegrity(modelData: Uint8Array, expectedSha256: string): Promise<boolean> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', modelData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex === expectedSha256
  }
  
  private reportProgress(modelName: string, downloaded: number, total: number): void {
    const progress = Math.round((downloaded / total) * 100)
    
    // Send to content script for UI update
    chrome.tabs.query({ active: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id!, {
          type: 'MODEL_DOWNLOAD_PROGRESS',
          data: {
            model: modelName,
            progress,
            downloadedMB: Math.round(downloaded / (1024 * 1024)),
            totalMB: Math.round(total / (1024 * 1024))
          }
        })
      }
    })
  }
}
```

### Model Validation & Testing

```typescript
class ModelValidator {
  async validateModel(modelName: string, modelData: Uint8Array): Promise<ValidationResult> {
    const tests: ValidationTest[] = []
    
    switch (modelName) {
      case 'distil-whisper':
        tests.push(
          () => this.testASRWithSample('Hello world'),
          () => this.testASRWithNoise(),
          () => this.testASRLatency()
        )
        break
        
      case 'nllb-200':
        tests.push(
          () => this.testTranslation('Bonjour le monde', 'Hello world'),
          () => this.testLanguageDetection(),
          () => this.testTranslationLatency()
        )
        break
        
      case 'kokoro-82m':
        tests.push(
          () => this.testTTSOutput('Hello world'),
          () => this.testTTSLatency(),
          () => this.testAudioQuality()
        )
        break
    }
    
    const results = await Promise.allSettled(tests.map(test => test()))
    const failures = results.filter(r => r.status === 'rejected')
    
    return {
      isValid: failures.length === 0,
      passedTests: tests.length - failures.length,
      totalTests: tests.length,
      errors: failures.map(f => f.reason)
    }
  }
  
  private async testASRLatency(): Promise<void> {
    const testAudio = this.generateTestAudio(1000) // 1 second
    const startTime = performance.now()
    
    await this.asr.transcribe(testAudio)
    
    const latency = performance.now() - startTime
    if (latency > 1000) { // Must be under 1s for WebGPU
      throw new Error(`ASR latency too high: ${latency}ms`)
    }
  }
}

interface ValidationResult {
  isValid: boolean
  passedTests: number
  totalTests: number
  errors: any[]
}
```

---

## 6. Cross-Component Interfaces

### Shared Types & Contracts

```typescript
// packages/shared-types/src/ai-pipeline.ts
export interface AudioChunk {
  data: Float32Array
  timestamp: number
  duration: number
  sampleRate: number
}

export interface ProcessingMetrics {
  asrLatency: number
  mtLatency: number
  ttsLatency: number
  totalLatency: number
  qualityScore: number
  processingId: string
}

export interface ModelStatus {
  name: string
  loaded: boolean
  runtime: 'webgpu' | 'wasm' | 'cpu'
  size: number
  downloadProgress?: number
  lastUsed?: Date
  errorState?: string
}

export interface PipelineState {
  enabled: boolean
  models: Record<string, ModelStatus>
  currentLatency: number
  averageLatency: number
  successRate: number
  lastError?: string
}

// Error types for type-safe error handling
export class AIModelError extends Error {
  constructor(
    message: string,
    public readonly modelName: string,
    public readonly errorCode: string,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'AIModelError'
  }
}

export class ASRInitializationError extends AIModelError {}
export class MTInitializationError extends AIModelError {}
export class TTSInitializationError extends AIModelError {}
export class PipelineProcessingError extends AIModelError {}
```

### Performance Monitoring Interface

```typescript
// packages/telemetry/src/ai-metrics.ts
export class AIMetricsCollector {
  private metrics: Map<string, PerformanceMetric> = new Map()
  
  recordLatency(component: 'asr' | 'mt' | 'tts', latency: number): void {
    const key = `${component}_latency`
    this.updateMetric(key, latency, 'histogram')
  }
  
  recordQuality(qualityScore: number): void {
    this.updateMetric('dubbing_quality', qualityScore, 'gauge')
  }
  
  recordError(component: string, error: string): void {
    this.updateMetric(`${component}_errors`, 1, 'counter')
  }
  
  getMetrics(): PerformanceReport {
    return {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics),
      summary: this.calculateSummary()
    }
  }
}
```

This AI model integration specification provides the detailed contracts needed for Phase 4 implementation, with concrete performance targets and fallback strategies validated in Phase 1-2 analysis.