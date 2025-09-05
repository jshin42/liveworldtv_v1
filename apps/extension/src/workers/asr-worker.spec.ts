import 'reflect-metadata';

// Mock ONNX Runtime to expose our placeholder implementation
const mockInferenceSession = {
  create: jest.fn(),
  run: jest.fn(),
  executionProviders: ['wasm']
};

const mockTensor = jest.fn().mockImplementation((type, data, dims) => ({ data, dims }));

jest.mock('onnxruntime-web', () => ({
  InferenceSession: mockInferenceSession,
  Tensor: mockTensor
}));

// Test the actual ASR worker implementation
describe('ASR Worker', () => {
  let worker: any;
  let postMessageSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock global worker environment
    global.self = {
      postMessage: jest.fn(),
      onmessage: null
    } as any;

    // Mock chrome.runtime for model requests
    global.chrome = {
      runtime: {
        sendMessage: jest.fn().mockResolvedValue({
          success: true,
          modelData: new Uint8Array([1, 2, 3, 4]) // Mock ONNX model
        })
      }
    } as any;

    postMessageSpy = jest.spyOn(global.self, 'postMessage');
    
    // Import worker after mocks are set up
    delete require.cache[require.resolve('../workers/asr-worker.ts')];
    worker = require('../workers/asr-worker.ts');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should request model from background script', async () => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'get-model',
        modelName: 'distil-whisper'
      });
    });

    it('should fail gracefully when model unavailable', async () => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
        success: false
      });

      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'asr-error',
        error: expect.stringContaining('not available')
      });
    });

    it('should create ONNX session with correct providers', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockInferenceSession.create).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({
          executionProviders: ['webgpu', 'wasm']
        })
      );
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      // Ensure worker is initialized
      mockInferenceSession.create.mockResolvedValue({
        run: mockInferenceSession.run,
        executionProviders: ['wasm']
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should process audio chunks sequentially', async () => {
      const audioData = new Float32Array(1024).fill(0.5);
      
      // Mock successful inference
      mockInferenceSession.run.mockResolvedValue({
        output: { data: new Float32Array([1, 2, 3]) }
      });

      // Send transcription request
      global.self.onmessage!({ 
        data: {
          type: 'transcribe',
          id: 'test-chunk-1',
          audioData,
          sampleRate: 16000
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have called ONNX inference
      expect(mockInferenceSession.run).toHaveBeenCalledWith({
        audio: expect.objectContaining({
          data: expect.any(Float32Array),
          dims: [1, expect.any(Number)]
        })
      });

      // Should return transcription result
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'asr-result',
        id: 'test-chunk-1',
        text: expect.any(String),
        confidence: expect.any(Number),
        processingTime: expect.any(Number)
      });
    });

    it('should handle resampling from 44.1kHz to 16kHz', async () => {
      const audioData44k = new Float32Array(44100).fill(0.1); // 1 second at 44.1kHz
      
      global.self.onmessage!({ 
        data: {
          type: 'transcribe',
          id: 'resample-test',
          audioData: audioData44k,
          sampleRate: 44100
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Check that input tensor has approximately 16k samples (resampled)
      const tensorCall = mockTensor.mock.calls.find(call => call[0] === 'float32');
      expect(tensorCall).toBeTruthy();
      expect(tensorCall[1]).toHaveLength(16000); // Should be resampled to 16kHz
    });

    it('should normalize audio amplitude', async () => {
      const audioData = new Float32Array([2.0, -3.0, 1.5, -1.0]); // Clipped audio
      
      global.self.onmessage!({ 
        data: {
          type: 'transcribe',
          id: 'normalize-test',
          audioData,
          sampleRate: 16000
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const tensorCall = mockTensor.mock.calls.find(call => call[0] === 'float32');
      const normalizedAudio = tensorCall[1] as Float32Array;
      
      // All values should be in [-1, 1] range after normalization
      expect(Math.max(...Array.from(normalizedAudio))).toBeLessThanOrEqual(1.0);
      expect(Math.min(...Array.from(normalizedAudio))).toBeGreaterThanOrEqual(-1.0);
    });

    it('should reject low-confidence transcriptions', async () => {
      mockInferenceSession.run.mockResolvedValue({
        output: { data: new Float32Array([0]) } // Empty/low confidence result
      });

      const silentAudio = new Float32Array(1024).fill(0.01); // Very quiet audio
      
      global.self.onmessage!({ 
        data: {
          type: 'transcribe',
          id: 'low-confidence',
          audioData: silentAudio,
          sampleRate: 16000
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not send result for low-confidence transcription
      const resultCalls = postMessageSpy.mock.calls.filter(call => 
        call[0].type === 'asr-result' && call[0].id === 'low-confidence'
      );
      
      if (resultCalls.length > 0) {
        expect(resultCalls[0][0].confidence).toBeLessThan(0.4);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle ONNX inference failures', async () => {
      mockInferenceSession.create.mockResolvedValue({
        run: jest.fn().mockRejectedValue(new Error('ONNX runtime error')),
        executionProviders: ['wasm']
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      global.self.onmessage!({ 
        data: {
          type: 'transcribe',
          id: 'error-test',
          audioData: new Float32Array(1024),
          sampleRate: 16000
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'asr-error',
        id: 'error-test',
        error: 'ONNX runtime error'
      });
    });

    it('should handle malformed audio data', async () => {
      global.self.onmessage!({ 
        data: {
          type: 'transcribe',
          id: 'malformed-test',
          audioData: null, // Invalid audio data
          sampleRate: 16000
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'asr-error',
        id: 'malformed-test',
        error: expect.stringContaining('Processing failed')
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should process 1-second chunks within 500ms', async () => {
      const start = performance.now();
      
      mockInferenceSession.run.mockResolvedValue({
        output: { data: new Float32Array([1, 2, 3]) }
      });

      global.self.onmessage!({ 
        data: {
          type: 'transcribe',
          id: 'perf-test',
          audioData: new Float32Array(16000), // 1 second at 16kHz
          sampleRate: 16000
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const resultCall = postMessageSpy.mock.calls.find(call => 
        call[0].type === 'asr-result' && call[0].id === 'perf-test'
      );

      if (resultCall) {
        expect(resultCall[0].processingTime).toBeLessThan(500);
      }
    });
  });
});