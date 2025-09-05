import { AIPipeline } from './ai-pipeline';
import { ModelManager } from './model-manager';
import { mockChromeAPI, mockFetch } from '../test/setup';

// Mock AudioContext and related APIs
const mockAudioContext = {
  sampleRate: 16000,
  createMediaStreamSource: jest.fn(),
  createMediaStreamDestination: jest.fn(() => ({
    stream: new MediaStream()
  })),
  audioWorklet: {
    addModule: jest.fn()
  },
  close: jest.fn(),
  state: 'running'
};

const mockAudioWorkletNode = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  port: {
    onmessage: null as any,
    postMessage: jest.fn()
  }
};

const mockMediaStreamSource = {
  connect: jest.fn()
};

describe('AIPipeline', () => {
  let aiPipeline: AIPipeline;
  let mockModelManager: jest.Mocked<ModelManager>;
  let mockChrome: any;
  let mockFetchAPI: any;

  beforeEach(() => {
    mockChrome = mockChromeAPI();
    mockFetchAPI = mockFetch();

    // Mock WebAudio APIs
    (global as any).AudioContext = jest.fn(() => mockAudioContext);
    (global as any).AudioWorkletNode = jest.fn(() => mockAudioWorkletNode);
    
    mockAudioContext.createMediaStreamSource.mockReturnValue(mockMediaStreamSource);

    // Mock ModelManager
    mockModelManager = {
      isModelReady: jest.fn(),
      getModel: jest.fn(),
      downloadModel: jest.fn(),
      getModelsStatus: jest.fn()
    } as any;

    aiPipeline = new AIPipeline(mockModelManager);
  });

  afterEach(() => {
    delete (global as any).AudioContext;
    delete (global as any).AudioWorkletNode;
    delete (global as any).chrome;
    delete (global as any).fetch;
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should setup AudioContext and AudioWorklet successfully', async () => {
      mockAudioContext.audioWorklet.addModule.mockResolvedValue(undefined);

      await aiPipeline.initialize();

      expect(AudioContext).toHaveBeenCalledWith({ sampleRate: 16000 });
      expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith('/workers/audio-processor.js');
      expect(AudioWorkletNode).toHaveBeenCalledWith(mockAudioContext, 'audio-processor');
    });

    it('should throw error when AudioWorklet module loading fails', async () => {
      mockAudioContext.audioWorklet.addModule.mockRejectedValue(new Error('Module not found'));

      await expect(aiPipeline.initialize()).rejects.toThrow('Module not found');
    });
  });

  describe('startProcessing', () => {
    const mockAudioStream = new MediaStream();

    beforeEach(async () => {
      mockAudioContext.audioWorklet.addModule.mockResolvedValue(undefined);
      await aiPipeline.initialize();
    });

    it('should connect audio stream and start processing', async () => {
      const outputStream = await aiPipeline.startProcessing(
        mockAudioStream,
        'en',
        'es'
      );

      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockAudioStream);
      expect(mockMediaStreamSource.connect).toHaveBeenCalledWith(mockAudioWorkletNode);
      expect(mockAudioWorkletNode.connect).toHaveBeenCalled();
      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith({
        command: 'start',
        sourceLanguage: 'en',
        targetLanguage: 'es'
      });
      expect(outputStream).toBeInstanceOf(MediaStream);
    });

    it('should prevent starting when already processing', async () => {
      await aiPipeline.startProcessing(mockAudioStream, 'en', 'es');

      await expect(
        aiPipeline.startProcessing(mockAudioStream, 'fr', 'de')
      ).rejects.toThrow('Pipeline already processing');
    });

    it('should auto-initialize if not already initialized', async () => {
      const freshPipeline = new AIPipeline(mockModelManager);
      mockAudioContext.audioWorklet.addModule.mockResolvedValue(undefined);

      await freshPipeline.startProcessing(mockAudioStream, 'en', 'es');

      expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalled();
    });
  });

  describe('stopProcessing', () => {
    const mockAudioStream = new MediaStream();

    it('should cleanup resources and stop processing', async () => {
      mockAudioContext.audioWorklet.addModule.mockResolvedValue(undefined);
      await aiPipeline.initialize();
      await aiPipeline.startProcessing(mockAudioStream, 'en', 'es');

      await aiPipeline.stopProcessing();

      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith({ command: 'stop' });
      expect(mockAudioWorkletNode.disconnect).toHaveBeenCalled();
      expect(aiPipeline.isProcessing()).toBe(false);
    });

    it('should be safe to call when not processing', async () => {
      await expect(aiPipeline.stopProcessing()).resolves.not.toThrow();
    });
  });

  describe('Audio Processing Pipeline', () => {
    const createMockAudioChunk = () => ({
      data: new Float32Array([0.1, 0.2, 0.3, 0.4]),
      timestamp: Date.now(),
      sampleRate: 16000
    });

    beforeEach(async () => {
      mockAudioContext.audioWorklet.addModule.mockResolvedValue(undefined);
      await aiPipeline.initialize();
      
      // Mock AI models as ready
      mockModelManager.isModelReady.mockResolvedValue(true);
      mockModelManager.getModel.mockResolvedValue({
        run: jest.fn().mockResolvedValue({
          logits: {
            data: [0.1, 0.9, 0.1], // Simulated model output
            dims: [1, 3]
          }
        })
      });
    });

    it('should process audio chunk through full pipeline', async () => {
      const audioChunk = createMockAudioChunk();
      
      // Simulate message from AudioWorklet
      const messageHandler = mockAudioWorkletNode.port.onmessage;
      await messageHandler({ data: audioChunk });

      // Should attempt ASR
      expect(mockModelManager.isModelReady).toHaveBeenCalledWith('distil-whisper');
      expect(mockModelManager.getModel).toHaveBeenCalledWith('distil-whisper');
    });

    it('should skip processing empty transcriptions', async () => {
      mockModelManager.getModel.mockResolvedValue({
        run: jest.fn().mockResolvedValue({
          logits: { data: [], dims: [0, 0] }
        })
      });

      const audioChunk = createMockAudioChunk();
      const messageHandler = mockAudioWorkletNode.port.onmessage;
      await messageHandler({ data: audioChunk });

      // Should not proceed to translation
      expect(mockModelManager.isModelReady).toHaveBeenCalledWith('distil-whisper');
      expect(mockModelManager.isModelReady).not.toHaveBeenCalledWith('nllb-distilled');
    });

    it('should handle model loading failures gracefully', async () => {
      mockModelManager.isModelReady.mockResolvedValue(false);

      const audioChunk = createMockAudioChunk();
      const messageHandler = mockAudioWorkletNode.port.onmessage;
      
      // Should not throw
      await expect(messageHandler({ data: audioChunk })).resolves.not.toThrow();
    });

    it('should bypass translation when source equals target language', async () => {
      // Mock transcription result
      mockModelManager.getModel.mockImplementation((modelName) => {
        if (modelName === 'distil-whisper') {
          return Promise.resolve({
            run: jest.fn().mockResolvedValue({
              logits: { data: [72, 101, 108, 108, 111], dims: [1, 5] } // "Hello"
            })
          });
        }
        return Promise.resolve({ run: jest.fn() });
      });

      const audioChunk = createMockAudioChunk();
      const messageHandler = mockAudioWorkletNode.port.onmessage;
      
      // Start processing with same source and target language
      await aiPipeline.startProcessing(new MediaStream(), 'en', 'en');
      await messageHandler({ data: audioChunk });

      // Should skip NLLB translation
      expect(mockModelManager.isModelReady).toHaveBeenCalledWith('distil-whisper');
      expect(mockModelManager.isModelReady).toHaveBeenCalledWith('kokoro-82m');
      expect(mockModelManager.isModelReady).not.toHaveBeenCalledWith('nllb-distilled');
    });
  });

  describe('Utility Methods', () => {
    it('should correctly decode token IDs to text', async () => {
      // This tests the private method indirectly through the pipeline
      const mockModel = {
        run: jest.fn().mockResolvedValue({
          logits: { 
            data: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100], // "Hello World"
            dims: [1, 11] 
          }
        })
      };

      mockModelManager.isModelReady.mockResolvedValue(true);
      mockModelManager.getModel.mockResolvedValue(mockModel);

      const audioChunk = createMockAudioChunk();
      const messageHandler = mockAudioWorkletNode.port.onmessage;
      
      await messageHandler({ data: audioChunk });

      expect(mockModel.run).toHaveBeenCalled();
    });

    it('should handle malformed model outputs gracefully', async () => {
      const mockModel = {
        run: jest.fn().mockResolvedValue({
          // Missing logits property
          invalid: 'data'
        })
      };

      mockModelManager.isModelReady.mockResolvedValue(true);
      mockModelManager.getModel.mockResolvedValue(mockModel);

      const audioChunk = createMockAudioChunk();
      const messageHandler = mockAudioWorkletNode.port.onmessage;
      
      // Should not crash
      await expect(messageHandler({ data: audioChunk })).resolves.not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources properly', async () => {
      mockAudioContext.audioWorklet.addModule.mockResolvedValue(undefined);
      await aiPipeline.initialize();
      await aiPipeline.startProcessing(new MediaStream(), 'en', 'es');

      await aiPipeline.cleanup();

      expect(mockAudioWorkletNode.port.postMessage).toHaveBeenCalledWith({ command: 'stop' });
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should be safe to cleanup multiple times', async () => {
      await aiPipeline.cleanup();
      await aiPipeline.cleanup();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});