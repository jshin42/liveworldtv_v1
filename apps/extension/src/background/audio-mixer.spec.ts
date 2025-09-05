import 'reflect-metadata';

// Mock Web Audio API
const mockAudioContext = {
  createGain: jest.fn(),
  createMediaStreamSource: jest.fn(),
  createScriptProcessor: jest.fn(),
  createMediaStreamDestination: jest.fn(),
  createBufferSource: jest.fn(),
  createBuffer: jest.fn(),
  destination: {},
  sampleRate: 22050,
  currentTime: 0,
  baseLatency: 0.01,
  state: 'running',
  close: jest.fn()
};

const mockGainNode = {
  connect: jest.fn(),
  gain: { value: 1.0, setValueAtTime: jest.fn() }
};

const mockMediaStreamSource = {
  connect: jest.fn()
};

const mockScriptProcessor = {
  connect: jest.fn(),
  onaudioprocess: null
};

const mockMediaStreamDestination = {
  connect: jest.fn(),
  stream: new MediaStream()
};

const mockBufferSource = {
  connect: jest.fn(),
  start: jest.fn(),
  buffer: null
};

const mockAudioBuffer = {
  getChannelData: jest.fn().mockReturnValue(new Float32Array(1024))
};

global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
global.MediaStream = jest.fn().mockImplementation(() => ({ getTracks: () => [] }));

mockAudioContext.createGain.mockReturnValue(mockGainNode);
mockAudioContext.createMediaStreamSource.mockReturnValue(mockMediaStreamSource);
mockAudioContext.createScriptProcessor.mockReturnValue(mockScriptProcessor);
mockAudioContext.createMediaStreamDestination.mockReturnValue(mockMediaStreamDestination);
mockAudioContext.createBufferSource.mockReturnValue(mockBufferSource);
mockAudioContext.createBuffer.mockReturnValue(mockAudioBuffer);

// Mock Worker
global.Worker = jest.fn().mockImplementation(() => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null
}));

// Mock chrome.runtime
global.chrome = {
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({ success: true })
  }
} as any;

// Mock performance API
global.performance = {
  now: jest.fn().mockReturnValue(1000)
} as any;

import { AudioMixer } from './audio-mixer';

describe('AudioMixer Integration', () => {
  let audioMixer: AudioMixer;
  let mockWorkers: { [key: string]: any };

  const defaultConfig = {
    targetLanguage: 'es',
    originalVolume: 0.15,
    dubbedVolume: 0.8,
    latencyTargetMs: 1500,
    chunkSizeMs: 1000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock workers
    mockWorkers = {
      asr: { postMessage: jest.fn(), terminate: jest.fn(), onmessage: null },
      mt: { postMessage: jest.fn(), terminate: jest.fn(), onmessage: null },
      tts: { postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }
    };

    (global.Worker as jest.Mock).mockImplementation((scriptPath) => {
      if (scriptPath.includes('asr-worker')) return mockWorkers.asr;
      if (scriptPath.includes('mt-worker')) return mockWorkers.mt;
      if (scriptPath.includes('tts-worker')) return mockWorkers.tts;
      return { postMessage: jest.fn(), terminate: jest.fn(), onmessage: null };
    });

    audioMixer = new AudioMixer(defaultConfig);
  });

  describe('Initialization', () => {
    it('should initialize audio context with correct settings', async () => {
      await audioMixer.initialize();

      expect(AudioContext).toHaveBeenCalledWith({
        sampleRate: 22050,
        latencyHint: 'interactive'
      });
    });

    it('should create and connect audio nodes correctly', async () => {
      await audioMixer.initialize();

      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(3); // input, output, dubbed
      expect(mockGainNode.connect).toHaveBeenCalledTimes(2); // input->output, dubbed->output
    });

    it('should initialize all three workers', async () => {
      await audioMixer.initialize();

      expect(global.Worker).toHaveBeenCalledWith('/workers/asr-worker.js');
      expect(global.Worker).toHaveBeenCalledWith('/workers/mt-worker.js');
      expect(global.Worker).toHaveBeenCalledWith('/workers/tts-worker.js');
    });

    it('should set initial volume levels correctly', async () => {
      await audioMixer.initialize();

      expect(mockGainNode.gain.value).toBe(1.0); // Final call is output gain
    });
  });

  describe('Audio Pipeline Flow', () => {
    beforeEach(async () => {
      await audioMixer.initialize();
    });

    it('should process complete ASR→MT→TTS pipeline', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Simulate audio chunk processing
      const mockAudioData = new Float32Array(1024).fill(0.5);
      
      // Trigger audio processing
      if (mockScriptProcessor.onaudioprocess) {
        mockScriptProcessor.onaudioprocess({
          inputBuffer: {
            getChannelData: () => mockAudioData
          }
        });
      }

      // Verify ASR worker was called
      expect(mockWorkers.asr.postMessage).toHaveBeenCalledWith({
        type: 'transcribe',
        id: expect.stringMatching(/chunk_\d+/),
        audioData: expect.any(Float32Array),
        sampleRate: 22050,
        language: 'en'
      });

      // Simulate ASR result
      mockWorkers.asr.onmessage({
        data: {
          type: 'asr-result',
          id: 'chunk_1',
          text: 'Hello world',
          confidence: 0.9
        }
      });

      // Verify MT worker was called
      expect(mockWorkers.mt.postMessage).toHaveBeenCalledWith({
        type: 'translate',
        id: 'chunk_1',
        text: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'es'
      });

      // Simulate MT result
      mockWorkers.mt.onmessage({
        data: {
          type: 'mt-result',
          id: 'chunk_1',
          translatedText: 'Hola mundo',
          confidence: 0.85
        }
      });

      // Verify TTS worker was called
      expect(mockWorkers.tts.postMessage).toHaveBeenCalledWith({
        type: 'synthesize',
        id: 'chunk_1',
        text: 'Hola mundo',
        language: 'es',
        speed: 1.1
      });
    });

    it('should handle low-confidence ASR results by dropping them', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Simulate low-confidence ASR result
      mockWorkers.asr.onmessage({
        data: {
          type: 'asr-result',
          id: 'chunk_1',
          text: 'unclear mumbling',
          confidence: 0.2 // Below 0.4 threshold
        }
      });

      // Should not proceed to MT worker
      expect(mockWorkers.mt.postMessage).not.toHaveBeenCalled();
    });

    it('should handle low-confidence translation results', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Setup valid ASR result first
      mockWorkers.asr.onmessage({
        data: {
          type: 'asr-result',
          id: 'chunk_1',
          text: 'Hello world',
          confidence: 0.9
        }
      });

      // Simulate low-confidence MT result
      mockWorkers.mt.onmessage({
        data: {
          type: 'mt-result',
          id: 'chunk_1',
          translatedText: '',
          confidence: 0.1 // Below 0.3 threshold
        }
      });

      // Should not proceed to TTS worker
      expect(mockWorkers.tts.postMessage).not.toHaveBeenCalled();
    });

    it('should apply timing compensation for lip sync', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Mock performance.now for latency calculation
      let timeCounter = 1000;
      (performance.now as jest.Mock).mockImplementation(() => timeCounter++);

      // Complete pipeline simulation
      mockWorkers.asr.onmessage({
        data: { type: 'asr-result', id: 'chunk_1', text: 'Hello', confidence: 0.9 }
      });

      mockWorkers.mt.onmessage({
        data: { type: 'mt-result', id: 'chunk_1', translatedText: 'Hola', confidence: 0.8 }
      });

      // Simulate TTS completion after some time
      timeCounter = 1600; // 600ms processing time
      mockWorkers.tts.onmessage({
        data: {
          type: 'tts-result',
          id: 'chunk_1',
          audioData: new Float32Array(22050),
          sampleRate: 22050
        }
      });

      // Should have applied delay compensation
      expect(mockBufferSource.start).toHaveBeenCalledWith(
        expect.any(Number) // currentTime + calculated delay
      );
    });

    it('should report performance metrics to background script', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Complete TTS processing
      mockWorkers.tts.onmessage({
        data: {
          type: 'tts-result',
          id: 'chunk_1',
          audioData: new Float32Array(22050),
          sampleRate: 22050
        }
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'dubbing-metrics',
        latency: expect.any(Number),
        chunkId: 'chunk_1',
        targetLatency: 1500
      });
    });
  });

  describe('Real-time Performance', () => {
    beforeEach(async () => {
      await audioMixer.initialize();
    });

    it('should handle concurrent audio chunks without blocking', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Simulate rapid audio chunks
      const chunks = Array.from({ length: 5 }, (_, i) => new Float32Array(1024).fill(0.1 * i));
      
      chunks.forEach((chunk, i) => {
        if (mockScriptProcessor.onaudioprocess) {
          mockScriptProcessor.onaudioprocess({
            inputBuffer: { getChannelData: () => chunk }
          });
        }
      });

      // Should have queued all chunks for processing
      expect(mockWorkers.asr.postMessage).toHaveBeenCalledTimes(5);
      
      const calls = (mockWorkers.asr.postMessage as jest.Mock).mock.calls;
      calls.forEach((call, i) => {
        expect(call[0].id).toBe(`chunk_${i + 1}`);
      });
    });

    it('should maintain audio quality under load', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Get performance metrics
      const metrics = audioMixer.getPerformanceMetrics();

      expect(metrics).toEqual({
        activeChunks: expect.any(Number),
        averageChunkAge: expect.any(Number),
        audioContextLatency: 0.01,
        audioContextSampleRate: 22050
      });
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await audioMixer.initialize();
    });

    it('should update volume levels dynamically', async () => {
      await audioMixer.updateConfig({
        originalVolume: 0.05,
        dubbedVolume: 0.9
      });

      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(
        0.05,
        expect.any(Number)
      );
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(
        0.9,
        expect.any(Number)
      );
    });

    it('should update target language for MT pipeline', async () => {
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      await audioMixer.updateConfig({ targetLanguage: 'fr' });

      // Next ASR result should use new target language
      mockWorkers.asr.onmessage({
        data: { type: 'asr-result', id: 'chunk_1', text: 'Hello', confidence: 0.9 }
      });

      expect(mockWorkers.mt.postMessage).toHaveBeenCalledWith({
        type: 'translate',
        id: 'chunk_1',
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'fr'
      });
    });
  });

  describe('Error Handling and Cleanup', () => {
    it('should handle worker initialization failures gracefully', async () => {
      (global.Worker as jest.Mock).mockImplementation(() => {
        throw new Error('Worker failed to initialize');
      });

      await expect(audioMixer.initialize()).rejects.toThrow();
    });

    it('should cleanup all resources on stop', async () => {
      await audioMixer.initialize();
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      await audioMixer.stopDubbing();

      // Should terminate all workers
      expect(mockWorkers.asr.terminate).toHaveBeenCalled();
      expect(mockWorkers.mt.terminate).toHaveBeenCalled();
      expect(mockWorkers.tts.terminate).toHaveBeenCalled();

      // Should close audio context
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should provide comprehensive status information', async () => {
      await audioMixer.initialize();

      const status = audioMixer.getStatus();

      expect(status).toEqual({
        isActive: true,
        audioContextState: 'running',
        processingChunks: 0,
        config: defaultConfig,
        workersReady: true
      });
    });
  });

  describe('Latency Analysis', () => {
    it('should expose end-to-end latency bottlenecks', async () => {
      await audioMixer.initialize();
      const mockInputStream = new MediaStream();
      await audioMixer.startDubbing(mockInputStream);

      // Track timing through pipeline
      let startTime = 1000;
      (performance.now as jest.Mock).mockReturnValueOnce(startTime);

      // Simulate audio chunk
      if (mockScriptProcessor.onaudioprocess) {
        mockScriptProcessor.onaudioprocess({
          inputBuffer: { getChannelData: () => new Float32Array(1024) }
        });
      }

      // ASR takes 200ms (realistic for Distil-Whisper)
      (performance.now as jest.Mock).mockReturnValueOnce(startTime + 200);
      mockWorkers.asr.onmessage({
        data: { type: 'asr-result', id: 'chunk_1', text: 'Hello', confidence: 0.9 }
      });

      // MT takes 150ms (realistic for NLLB-200) 
      (performance.now as jest.Mock).mockReturnValueOnce(startTime + 350);
      mockWorkers.mt.onmessage({
        data: { type: 'mt-result', id: 'chunk_1', translatedText: 'Hola', confidence: 0.8 }
      });

      // TTS takes 800ms (realistic for Kokoro-82M)
      (performance.now as jest.Mock).mockReturnValueOnce(startTime + 1150);
      mockWorkers.tts.onmessage({
        data: {
          type: 'tts-result',
          id: 'chunk_1',
          audioData: new Float32Array(22050),
          sampleRate: 22050
        }
      });

      // Total pipeline latency: 1150ms
      // With target of 1500ms, delay should be: max(0, 1500-1150) = 350ms
      expect(mockBufferSource.start).toHaveBeenCalledWith(0 + 0.35); // currentTime + 350ms
    });
  });
});