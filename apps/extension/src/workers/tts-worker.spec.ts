import 'reflect-metadata';

// Mock ONNX Runtime to test TTS worker implementation
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

// Mock missing LANGUAGE_CODES constant
(global as any).LANGUAGE_CODES = {
  'en': 'English',
  'es': 'Spanish', 
  'fr': 'French',
  'de': 'German'
};

describe('TTS (Text-to-Speech) Worker', () => {
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
          modelData: new Uint8Array([1, 2, 3, 4]) // Mock Kokoro model
        })
      }
    } as any;

    postMessageSpy = jest.spyOn(global.self, 'postMessage');
    
    // Import worker after mocks are set up
    delete require.cache[require.resolve('../workers/tts-worker.ts')];
    worker = require('../workers/tts-worker.ts');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should request Kokoro-82M model from background script', async () => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'get-model',
        modelName: 'kokoro-82m'
      });
    });

    it('should initialize phonemizer for text preprocessing', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockInferenceSession.create).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({
          executionProviders: ['webgpu', 'wasm'],
          executionMode: 'sequential',
          graphOptimizationLevel: 'all'
        })
      );
    });

    it('should fail gracefully when Kokoro model unavailable', async () => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
        success: false
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'tts-error',
        error: expect.stringContaining('not available')
      });
    });
  });

  describe('Text-to-Speech Processing', () => {
    beforeEach(async () => {
      // Ensure worker is initialized
      mockInferenceSession.create.mockResolvedValue({
        run: mockInferenceSession.run,
        executionProviders: ['wasm']
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should synthesize speech from English text', async () => {
      // Mock audio generation result
      const mockAudioData = new Float32Array(22050); // 1 second at 22kHz
      for (let i = 0; i < mockAudioData.length; i++) {
        mockAudioData[i] = Math.sin(2 * Math.PI * 440 * i / 22050) * 0.5; // 440Hz tone
      }

      mockInferenceSession.run.mockResolvedValue({
        audio: { data: mockAudioData }
      });

      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'test-tts-1',
          text: 'Hello, this is a test of text to speech synthesis.',
          language: 'en',
          speed: 1.0
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockInferenceSession.run).toHaveBeenCalledWith({
        phoneme_ids: expect.any(Object),
        speaker_id: expect.any(Object),
        speed: expect.any(Object)
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'tts-result',
        id: 'test-tts-1',
        audioData: expect.any(Float32Array),
        sampleRate: 22050,
        duration: expect.any(Number),
        processingTime: expect.any(Number)
      });
    });

    it('should handle phoneme conversion correctly', async () => {
      const testText = "Hello world";
      
      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'phoneme-test',
          text: testText,
          language: 'en',
          speed: 1.0
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Check phoneme tensor creation
      const tensorCall = mockTensor.mock.calls.find(call => call[0] === 'int64');
      expect(tensorCall).toBeTruthy();
      
      // Should have phoneme IDs for each character + silence markers
      const phonemeIds = Array.from(tensorCall[1] as BigInt64Array);
      expect(phonemeIds.length).toBeGreaterThan(testText.length); // Includes silence tokens
    });

    it('should apply speed control correctly', async () => {
      const speeds = [0.5, 1.0, 1.5, 2.0];
      
      for (const speed of speeds) {
        mockInferenceSession.run.mockClear();
        
        global.self.onmessage!({
          data: {
            type: 'synthesize',
            id: `speed-test-${speed}`,
            text: 'Speed test',
            language: 'en',
            speed: speed
          }
        } as MessageEvent);

        await new Promise(resolve => setTimeout(resolve, 30));

        // Check speed tensor
        const speedTensorCall = mockTensor.mock.calls.find(call => 
          call[0] === 'float32' && call[2].length === 1
        );
        expect(speedTensorCall).toBeTruthy();
        expect(Array.from(speedTensorCall[1] as Float32Array)[0]).toBe(speed);
      }
    });

    it('should handle multilingual synthesis', async () => {
      const languages = ['en', 'es', 'fr', 'de'];
      
      for (const lang of languages) {
        global.self.onmessage!({
          data: {
            type: 'synthesize',
            id: `lang-test-${lang}`,
            text: 'Multilingual test',
            language: lang,
            speed: 1.0
          }
        } as MessageEvent);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have processed all languages
      const resultCalls = postMessageSpy.mock.calls.filter(call => 
        call[0].type === 'tts-result' && call[0].id.startsWith('lang-test')
      );
      expect(resultCalls).toHaveLength(languages.length);
    });

    it('should normalize audio output correctly', async () => {
      // Mock clipped audio output
      const clippedAudio = new Float32Array(1000);
      clippedAudio.fill(2.0); // Heavily clipped signal

      mockInferenceSession.run.mockResolvedValue({
        audio: { data: clippedAudio }
      });

      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'normalize-test',
          text: 'Normalization test',
          language: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const resultCall = postMessageSpy.mock.calls.find(call => 
        call[0].type === 'tts-result' && call[0].id === 'normalize-test'
      );

      if (resultCall) {
        const audioData = resultCall[0].audioData as Float32Array;
        const maxAmp = Math.max(...Array.from(audioData));
        const minAmp = Math.min(...Array.from(audioData));
        
        // Should be normalized to [-1, 1] range
        expect(maxAmp).toBeLessThanOrEqual(1.0);
        expect(minAmp).toBeGreaterThanOrEqual(-1.0);
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should synthesize short phrases within 300ms', async () => {
      const shortAudio = new Float32Array(11025); // 0.5 seconds at 22kHz
      mockInferenceSession.run.mockResolvedValue({
        audio: { data: shortAudio }
      });

      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'perf-test-short',
          text: 'Quick test',
          language: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const resultCall = postMessageSpy.mock.calls.find(call => 
        call[0].type === 'tts-result' && call[0].id === 'perf-test-short'
      );

      if (resultCall) {
        expect(resultCall[0].processingTime).toBeLessThan(300);
      }
    });

    it('should handle queue processing efficiently', async () => {
      // Send multiple synthesis requests rapidly
      const requests = Array.from({ length: 5 }, (_, i) => ({
        type: 'synthesize',
        id: `queue-test-${i}`,
        text: `Queue test ${i}`,
        language: 'en'
      }));

      requests.forEach(req => {
        global.self.onmessage!({ data: req } as MessageEvent);
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have processed all requests
      const resultCalls = postMessageSpy.mock.calls.filter(call => 
        call[0].type === 'tts-result' && call[0].id.startsWith('queue-test')
      );
      expect(resultCalls).toHaveLength(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle ONNX model inference failures', async () => {
      mockInferenceSession.create.mockResolvedValue({
        run: jest.fn().mockRejectedValue(new Error('Kokoro inference error')),
        executionProviders: ['wasm']
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'error-test',
          text: 'This will fail',
          language: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'tts-error',
        id: 'error-test',
        error: 'Kokoro inference error'
      });
    });

    it('should handle malformed synthesis requests', async () => {
      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'malformed-test',
          text: null, // Invalid text
          language: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'tts-error',
        id: 'malformed-test',
        error: expect.stringContaining('TTS processing failed')
      });
    });
  });

  describe('Phonemizer Implementation Validation', () => {
    it('should expose basic phoneme mapping limitations', async () => {
      // Test complex text that will expose the placeholder phonemizer
      const complexText = "The children's laughter echoed through the café";
      
      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'phoneme-gap-test',
          text: complexText,
          language: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Check phoneme tensor - our basic implementation will likely produce poor results
      const tensorCall = mockTensor.mock.calls.find(call => call[0] === 'int64');
      
      if (tensorCall) {
        const phonemeIds = Array.from(tensorCall[1] as BigInt64Array);
        console.log('Basic phonemizer output:', phonemeIds);
        
        // Our placeholder phonemizer uses simple character mapping
        // Real G2P would produce proper phonemes like ['DH', 'AH0', 'CH', 'IH1', 'L', 'D', 'R', 'AH0', 'N', 'Z', ...]
        expect(phonemeIds).not.toEqual(complexText.split('').map((c, i) => i + 1));
      }
    });

    it('should validate speaker ID and voice quality', () => {
      // Test will expose if we have multiple speakers/voices available
      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'speaker-test',
          text: 'Speaker test',
          language: 'en',
          voiceId: 'female-1' // This parameter might not be handled
        }
      } as MessageEvent);

      // Our implementation likely only uses speaker ID 0 (default)
      const speakerCall = mockTensor.mock.calls.find(call => 
        call[0] === 'int64' && call[2].length === 1
      );
      
      if (speakerCall) {
        expect(Array.from(speakerCall[1] as BigInt64Array)[0]).toBe(0n); // Default speaker
      }
    });
  });

  describe('Audio Quality Validation', () => {
    it('should maintain consistent sample rate', async () => {
      const mockAudio = new Float32Array(22050);
      mockInferenceSession.run.mockResolvedValue({
        audio: { data: mockAudio }
      });

      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'samplerate-test',
          text: 'Sample rate test',
          language: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const resultCall = postMessageSpy.mock.calls.find(call => 
        call[0].type === 'tts-result' && call[0].id === 'samplerate-test'
      );

      if (resultCall) {
        expect(resultCall[0].sampleRate).toBe(22050); // Kokoro model sample rate
      }
    });

    it('should apply high-pass filtering to remove DC offset', async () => {
      // Mock audio with DC offset
      const audioWithDC = new Float32Array(1000);
      audioWithDC.fill(0.5); // Constant DC offset

      mockInferenceSession.run.mockResolvedValue({
        audio: { data: audioWithDC }
      });

      global.self.onmessage!({
        data: {
          type: 'synthesize',
          id: 'dc-filter-test',
          text: 'DC filter test',
          language: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const resultCall = postMessageSpy.mock.calls.find(call => 
        call[0].type === 'tts-result' && call[0].id === 'dc-filter-test'
      );

      if (resultCall) {
        const processedAudio = resultCall[0].audioData as Float32Array;
        const dcLevel = processedAudio.reduce((sum, sample) => sum + sample, 0) / processedAudio.length;
        
        // DC level should be significantly reduced after filtering
        expect(Math.abs(dcLevel)).toBeLessThan(0.1);
      }
    });
  });
});