// Audio Mixer for Live Dubbing Pipeline
// Coordinates ASR→MT→TTS and mixes with original audio

interface DubbingConfig {
  targetLanguage: string;
  originalVolume: number; // 0.0 to 1.0 (ducking level)
  dubbedVolume: number;   // 0.0 to 1.0 
  latencyTargetMs: number; // Target end-to-end latency
  chunkSizeMs: number;     // Audio chunk size for processing
}

interface AudioChunk {
  id: string;
  audioData: Float32Array;
  timestamp: number;
  sampleRate: number;
}

interface ProcessingPipeline {
  asrWorker: Worker;
  mtWorker: Worker; 
  ttsWorker: Worker;
}

export class AudioMixer {
  private audioContext: AudioContext | null = null;
  private inputGainNode: GainNode | null = null;
  private outputGainNode: GainNode | null = null;
  private dubbedGainNode: GainNode | null = null;
  
  private pipeline: ProcessingPipeline | null = null;
  private config: DubbingConfig;
  private isActive = false;
  
  // Chunk management
  private processingChunks = new Map<string, AudioChunk>();
  private pendingAudio = new Map<string, Float32Array>();
  private chunkCounter = 0;
  
  // Latency management
  private readonly BUFFER_SIZE = 4096;
  private readonly OVERLAP_RATIO = 0.25; // 25% overlap between chunks

  constructor(config: DubbingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize audio context
      this.audioContext = new AudioContext({ 
        sampleRate: 22050,
        latencyHint: 'interactive'
      });

      // Create audio nodes
      this.inputGainNode = this.audioContext.createGain();
      this.outputGainNode = this.audioContext.createGain(); 
      this.dubbedGainNode = this.audioContext.createGain();

      // Set initial volumes
      this.inputGainNode.gain.value = this.config.originalVolume;
      this.dubbedGainNode.gain.value = this.config.dubbedVolume;
      this.outputGainNode.gain.value = 1.0;

      // Connect audio graph
      this.inputGainNode.connect(this.outputGainNode);
      this.dubbedGainNode.connect(this.outputGainNode);
      this.outputGainNode.connect(this.audioContext.destination);

      // Initialize workers
      await this.initializeWorkers();
      
      this.isActive = true;
      console.log('✅ Audio mixer initialized');
      
    } catch (error) {
      console.error('❌ Audio mixer initialization failed:', error);
      throw error;
    }
  }

  private async initializeWorkers(): Promise<void> {
    this.pipeline = {
      asrWorker: new Worker('/workers/asr-worker.js'),
      mtWorker: new Worker('/workers/mt-worker.js'),
      ttsWorker: new Worker('/workers/tts-worker.js')
    };

    // Setup worker message handlers
    this.pipeline.asrWorker.onmessage = (event) => this.handleASRResult(event.data);
    this.pipeline.mtWorker.onmessage = (event) => this.handleMTResult(event.data);
    this.pipeline.ttsWorker.onmessage = (event) => this.handleTTSResult(event.data);
  }

  async startDubbing(inputStream: MediaStream): Promise<MediaStreamAudioDestinationNode> {
    if (!this.audioContext || !this.pipeline) {
      throw new Error('Audio mixer not initialized');
    }

    // Create source from input stream
    const mediaSource = this.audioContext.createMediaStreamSource(inputStream);
    
    // Create processor for chunking audio
    const processor = this.audioContext.createScriptProcessor(
      this.BUFFER_SIZE, 
      1, // mono input
      1  // mono output
    );
    
    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      this.processAudioChunk(inputBuffer);
    };

    // Connect processing chain
    mediaSource.connect(this.inputGainNode!);
    mediaSource.connect(processor);
    processor.connect(this.audioContext.destination);

    // Create output stream
    const outputDestination = this.audioContext.createMediaStreamDestination();
    this.outputGainNode!.connect(outputDestination);

    return outputDestination;
  }

  private processAudioChunk(audioData: Float32Array): void {
    if (!this.isActive || !this.pipeline) return;

    const chunkId = `chunk_${++this.chunkCounter}`;
    const timestamp = performance.now();

    // Create audio chunk with overlap handling
    const chunk: AudioChunk = {
      id: chunkId,
      audioData: new Float32Array(audioData),
      timestamp,
      sampleRate: this.audioContext!.sampleRate
    };

    this.processingChunks.set(chunkId, chunk);

    // Send to ASR worker
    this.pipeline.asrWorker.postMessage({
      type: 'transcribe',
      id: chunkId,
      audioData: chunk.audioData,
      sampleRate: chunk.sampleRate,
      language: this.detectSourceLanguage(audioData)
    });
  }

  private handleASRResult(data: any): void {
    if (data.type === 'asr-result') {
      const { id, text, confidence } = data;
      
      // Only process if confidence is above threshold
      if (confidence < 0.4 || !text.trim()) {
        this.processingChunks.delete(id);
        return;
      }

      // Send to translation worker
      this.pipeline!.mtWorker.postMessage({
        type: 'translate',
        id,
        text,
        sourceLanguage: this.detectSourceLanguage(),
        targetLanguage: this.config.targetLanguage
      });
    }
  }

  private handleMTResult(data: any): void {
    if (data.type === 'mt-result') {
      const { id, translatedText, confidence } = data;
      
      // Only process if translation confidence is sufficient
      if (confidence < 0.3 || !translatedText.trim()) {
        this.processingChunks.delete(id);
        return;
      }

      // Send to TTS worker
      this.pipeline!.ttsWorker.postMessage({
        type: 'synthesize',
        id,
        text: translatedText,
        language: this.config.targetLanguage,
        speed: 1.1 // Slightly faster for live sync
      });
    }
  }

  private handleTTSResult(data: any): void {
    if (data.type === 'tts-result') {
      const { id, audioData, sampleRate } = data;
      const chunk = this.processingChunks.get(id);
      
      if (!chunk || !this.audioContext) {
        this.processingChunks.delete(id);
        return;
      }

      // Calculate latency
      const latency = performance.now() - chunk.timestamp;
      
      // Create audio buffer for dubbed audio
      const audioBuffer = this.audioContext.createBuffer(1, audioData.length, sampleRate);
      audioBuffer.getChannelData(0).set(audioData);

      // Create buffer source and play immediately
      const bufferSource = this.audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      
      // Apply timing compensation for lip sync
      const delay = Math.max(0, this.config.latencyTargetMs - latency) / 1000;
      bufferSource.connect(this.dubbedGainNode!);
      bufferSource.start(this.audioContext.currentTime + delay);

      // Cleanup
      this.processingChunks.delete(id);
      
      // Report performance metrics
      chrome.runtime.sendMessage({
        type: 'dubbing-metrics',
        latency,
        chunkId: id,
        targetLatency: this.config.latencyTargetMs
      }).catch(() => {});
    }
  }

  private detectSourceLanguage(audioData?: Float32Array): string {
    // Simplified language detection - would use ML model in production
    // For now, default to English
    return 'en';
  }

  async updateConfig(newConfig: Partial<DubbingConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.inputGainNode) {
      this.inputGainNode.gain.setValueAtTime(
        this.config.originalVolume, 
        this.audioContext!.currentTime
      );
    }
    
    if (this.dubbedGainNode) {
      this.dubbedGainNode.gain.setValueAtTime(
        this.config.dubbedVolume,
        this.audioContext!.currentTime
      );
    }
  }

  async stopDubbing(): Promise<void> {
    this.isActive = false;
    
    // Clear processing queues
    this.processingChunks.clear();
    this.pendingAudio.clear();

    // Terminate workers
    if (this.pipeline) {
      this.pipeline.asrWorker.terminate();
      this.pipeline.mtWorker.terminate();
      this.pipeline.ttsWorker.terminate();
      this.pipeline = null;
    }

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.inputGainNode = null;
      this.outputGainNode = null;
      this.dubbedGainNode = null;
    }

    console.log('🔇 Dubbing stopped and cleaned up');
  }

  getStatus() {
    return {
      isActive: this.isActive,
      audioContextState: this.audioContext?.state,
      processingChunks: this.processingChunks.size,
      config: this.config,
      workersReady: !!this.pipeline
    };
  }

  // Real-time performance monitoring
  getPerformanceMetrics() {
    const chunks = Array.from(this.processingChunks.values());
    const now = performance.now();
    
    const avgAge = chunks.length > 0 
      ? chunks.reduce((sum, chunk) => sum + (now - chunk.timestamp), 0) / chunks.length
      : 0;

    return {
      activeChunks: chunks.length,
      averageChunkAge: avgAge,
      audioContextLatency: this.audioContext?.baseLatency || 0,
      audioContextSampleRate: this.audioContext?.sampleRate || 0
    };
  }
}