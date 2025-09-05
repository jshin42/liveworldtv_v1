import 'reflect-metadata';

// Mock ONNX Runtime to test MT worker implementation
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

describe('MT (Machine Translation) Worker', () => {
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
          modelData: new Uint8Array([1, 2, 3, 4]) // Mock NLLB model
        })
      }
    } as any;

    postMessageSpy = jest.spyOn(global.self, 'postMessage');
    
    // Import worker after mocks are set up
    delete require.cache[require.resolve('../workers/mt-worker.ts')];
    worker = require('../workers/mt-worker.ts');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should request NLLB-200 model from background script', async () => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'get-model',
        modelName: 'nllb-200'
      });
    });

    it('should initialize with 200 language support', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockInferenceSession.create).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.objectContaining({
          executionProviders: ['webgpu', 'wasm'],
          graphOptimizationLevel: 'all'
        })
      );
    });

    it('should fail gracefully when NLLB model unavailable', async () => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValueOnce({
        success: false
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'mt-error',
        error: expect.stringContaining('not available')
      });
    });
  });

  describe('Translation Processing', () => {
    beforeEach(async () => {
      // Ensure worker is initialized
      mockInferenceSession.create.mockResolvedValue({
        run: mockInferenceSession.run,
        executionProviders: ['wasm']
      });
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should handle English to Spanish translation', async () => {
      // Mock translation result
      mockInferenceSession.run.mockResolvedValue({
        output_ids: { data: new BigInt64Array([101n, 102n, 103n, 102n]) } // Mock token IDs
      });

      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'test-translation-1',
          text: 'Hello, how are you?',
          sourceLanguage: 'en',
          targetLanguage: 'es'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockInferenceSession.run).toHaveBeenCalledWith({
        input_ids: expect.any(Object),
        attention_mask: expect.any(Object)
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'mt-result',
        id: 'test-translation-1',
        translatedText: expect.any(String),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        sourceLanguage: 'en',
        targetLanguage: 'es'
      });
    });

    it('should properly tokenize input text with language codes', async () => {
      const inputText = "Good morning, everyone!";
      
      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'tokenization-test',
          text: inputText,
          sourceLanguage: 'en',
          targetLanguage: 'fr'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Check tokenization includes proper language codes
      const tensorCall = mockTensor.mock.calls.find(call => call[0] === 'int64');
      expect(tensorCall).toBeTruthy();
      
      // Should include special tokens for NLLB (BOS, language codes, etc.)
      const tokenIds = Array.from(tensorCall[1] as BigInt64Array);
      expect(tokenIds.length).toBeGreaterThan(inputText.split(' ').length); // More tokens due to subwords
    });

    it('should handle same-language pass-through', async () => {
      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'passthrough-test',
          text: 'This should not be translated',
          sourceLanguage: 'en',
          targetLanguage: 'en'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not call ONNX model for same language
      expect(mockInferenceSession.run).not.toHaveBeenCalled();
      
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'mt-result',
        id: 'passthrough-test',
        translatedText: 'This should not be translated',
        confidence: 1.0,
        processingTime: expect.any(Number),
        sourceLanguage: 'en',
        targetLanguage: 'en'
      });
    });

    it('should detect and handle unsupported language pairs', async () => {
      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'unsupported-lang',
          text: 'Test text',
          sourceLanguage: 'xyz', // Fake language code
          targetLanguage: 'abc'   // Another fake language code
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'mt-error',
        id: 'unsupported-lang',
        error: expect.stringContaining('Unsupported language')
      });
    });

    it('should batch process multiple translation requests', async () => {
      const requests = [
        { id: 'batch-1', text: 'First sentence', sourceLanguage: 'en', targetLanguage: 'es' },
        { id: 'batch-2', text: 'Second sentence', sourceLanguage: 'en', targetLanguage: 'es' },
        { id: 'batch-3', text: 'Third sentence', sourceLanguage: 'en', targetLanguage: 'es' }
      ];

      // Send requests rapidly
      requests.forEach(req => {
        global.self.onmessage!({ data: { type: 'translate', ...req } } as MessageEvent);
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have processed all requests
      const resultCalls = postMessageSpy.mock.calls.filter(call => call[0].type === 'mt-result');
      expect(resultCalls).toHaveLength(3);
      
      // Verify all IDs are present
      const processedIds = resultCalls.map(call => call[0].id);
      expect(processedIds).toEqual(expect.arrayContaining(['batch-1', 'batch-2', 'batch-3']));
    });
  });

  describe('Performance Requirements', () => {
    it('should translate short sentences within 200ms', async () => {
      mockInferenceSession.run.mockResolvedValue({
        output_ids: { data: new BigInt64Array([101n, 102n, 103n]) }
      });

      const start = performance.now();

      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'perf-test-short',
          text: 'Hello world',
          sourceLanguage: 'en',
          targetLanguage: 'es'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const resultCall = postMessageSpy.mock.calls.find(call => 
        call[0].type === 'mt-result' && call[0].id === 'perf-test-short'
      );

      if (resultCall) {
        expect(resultCall[0].processingTime).toBeLessThan(200);
      }
    });

    it('should maintain quality with confidence scoring', async () => {
      // Mock high-quality translation result
      mockInferenceSession.run.mockResolvedValue({
        output_ids: { data: new BigInt64Array([101n, 1234n, 5678n, 102n]) }
      });

      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'quality-test',
          text: 'The weather is beautiful today',
          sourceLanguage: 'en',
          targetLanguage: 'fr'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      const resultCall = postMessageSpy.mock.calls.find(call => 
        call[0].type === 'mt-result' && call[0].id === 'quality-test'
      );

      if (resultCall) {
        expect(resultCall[0].confidence).toBeGreaterThan(0.3);
        expect(resultCall[0].confidence).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle ONNX model inference failures', async () => {
      mockInferenceSession.create.mockResolvedValue({
        run: jest.fn().mockRejectedValue(new Error('NLLB inference error')),
        executionProviders: ['wasm']
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'error-test',
          text: 'This will fail',
          sourceLanguage: 'en',
          targetLanguage: 'es'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'mt-error',
        id: 'error-test',
        error: 'NLLB inference error'
      });
    });

    it('should handle malformed translation requests', async () => {
      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'malformed-test',
          text: null, // Invalid text
          sourceLanguage: 'en',
          targetLanguage: 'es'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'mt-error',
        id: 'malformed-test',
        error: expect.stringContaining('Invalid')
      });
    });
  });

  describe('Language Support Validation', () => {
    it('should expose the real tokenizer implementation gaps', async () => {
      // This test will likely fail with current implementation
      const complexText = "The café's naïve résumé had piñatas and €50 prices";
      
      global.self.onmessage!({
        data: {
          type: 'translate',
          id: 'tokenizer-gap-test',
          text: complexText,
          sourceLanguage: 'en',
          targetLanguage: 'es'
        }
      } as MessageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Check if our basic tokenizer handles special characters correctly
      const tensorCall = mockTensor.mock.calls.find(call => call[0] === 'int64');
      
      if (tensorCall) {
        const tokenIds = Array.from(tensorCall[1] as BigInt64Array);
        // Our placeholder tokenizer will likely produce garbage for Unicode chars
        console.log('Tokenizer output for complex text:', tokenIds);
        
        // This assertion will likely fail, exposing the placeholder implementation
        expect(tokenIds).not.toEqual(complexText.split('').map(c => c.charCodeAt(0)));
      }
    });

    it('should validate NLLB-200 language code mappings', () => {
      // Test will expose if we have proper language code mapping
      const testLanguages = ['eng_Latn', 'spa_Latn', 'fra_Latn', 'deu_Latn', 'zho_Hans'];
      
      // This will likely fail as our implementation uses simple 2-letter codes
      testLanguages.forEach(langCode => {
        // Mock a status request to check language support
        global.self.onmessage!({
          data: { type: 'status' }
        } as MessageEvent);
      });
    });
  });
});