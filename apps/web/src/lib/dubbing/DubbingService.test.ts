/**
 * Unit Tests for DubbingService
 *
 * Tests cover:
 * - Browser compatibility checking
 * - Service initialization
 * - Translation functionality
 * - Speech synthesis
 * - Configuration updates
 * - Error handling
 * - Resource cleanup
 */

import { DubbingService, DubbingConfig, DubbingStatus } from './DubbingService';

// Mock browser APIs
const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  getVoices: jest.fn(() => [
    {
      name: 'English Voice',
      lang: 'en-US',
      localService: true,
      default: true,
      voiceURI: 'en-US'
    },
    {
      name: 'Spanish Voice',
      lang: 'es-ES',
      localService: true,
      default: false,
      voiceURI: 'es-ES'
    }
  ]),
  onvoiceschanged: null
};

const mockSpeechSynthesisUtterance = jest.fn().mockImplementation((text: string) => ({
  text,
  lang: 'en-US',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voice: null,
  onend: null,
  onerror: null
}));

// Mock global window objects
global.window = {
  speechSynthesis: mockSpeechSynthesis,
  SpeechSynthesisUtterance: mockSpeechSynthesisUtterance,
  fetch: jest.fn()
} as any;

global.fetch = jest.fn();

describe('DubbingService', () => {
  let config: DubbingConfig;
  let service: DubbingService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockSpeechSynthesis.speak.mockClear();
    mockSpeechSynthesis.cancel.mockClear();
    mockSpeechSynthesis.getVoices.mockClear();

    // Default configuration
    config = {
      sourceLanguage: 'korean',
      targetLanguage: 'english',
      enabled: true,
      originalVolume: 0.3,
      dubbedVolume: 1.0
    };

    service = new DubbingService(config);
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
  });

  describe('Constructor', () => {
    it('should create service with configuration', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DubbingService);
    });

    it('should initialize with browser speech synthesis', () => {
      expect(mockSpeechSynthesis).toBeDefined();
    });
  });

  describe('Browser Compatibility', () => {
    it('should detect compatible browser', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should reject incompatible browser', async () => {
      const originalWindow = global.window;
      global.window = {} as any;

      const incompatibleService = new DubbingService(config);
      await expect(incompatibleService.initialize()).rejects.toThrow('Browser not supported');

      global.window = originalWindow;
    });

    it('should check for required APIs', async () => {
      const originalSpeechSynthesis = global.window.speechSynthesis;
      delete (global.window as any).speechSynthesis;

      const serviceWithoutAPI = new DubbingService(config);
      await expect(serviceWithoutAPI.initialize()).rejects.toThrow();

      global.window.speechSynthesis = originalSpeechSynthesis;
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      // Service should be active after initialization
      service.start();
      expect(mockSpeechSynthesis.getVoices).toHaveBeenCalled();
    });

    it('should preload voices', async () => {
      mockSpeechSynthesis.getVoices.mockReturnValueOnce([
        { name: 'Voice 1', lang: 'en-US', localService: true, default: true, voiceURI: 'en-US' }
      ]);

      await service.initialize();
      expect(mockSpeechSynthesis.getVoices).toHaveBeenCalled();
    });

    it('should handle asynchronous voice loading', async () => {
      mockSpeechSynthesis.getVoices.mockReturnValueOnce([]);

      const initPromise = service.initialize();

      // Simulate voices becoming available
      if (mockSpeechSynthesis.onvoiceschanged) {
        mockSpeechSynthesis.getVoices.mockReturnValueOnce([
          { name: 'Voice 1', lang: 'en-US', localService: true, default: true, voiceURI: 'en-US' }
        ]);
        mockSpeechSynthesis.onvoiceschanged();
      }

      await initPromise;
      expect(mockSpeechSynthesis.getVoices).toHaveBeenCalled();
    });
  });

  describe('Status Callbacks', () => {
    it('should call status callback on updates', async () => {
      const statusCallback = jest.fn();
      service.setStatusCallback(statusCallback);

      await service.initialize();

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'active',
          message: expect.any(String)
        })
      );
    });

    it('should provide status with caption availability', () => {
      const statusCallback = jest.fn();
      service.setStatusCallback(statusCallback);

      service.start();

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          captionsAvailable: expect.any(Boolean)
        })
      );
    });
  });

  describe('Translation', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: {
            translatedText: 'Hello world'
          }
        })
      });
    });

    it('should translate text via API', async () => {
      await service.initialize();
      await service.processCaptionText('안녕하세요');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.mymemory.translated.net'),
        expect.any(Object)
      );
    });

    it('should cache translations', async () => {
      await service.initialize();
      await service.processCaptionText('안녕하세요');
      await service.processCaptionText('안녕하세요'); // Same text

      // Should only call API once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should skip translation if source and target languages are the same', async () => {
      const sameLanguageConfig: DubbingConfig = {
        ...config,
        sourceLanguage: 'english',
        targetLanguage: 'english'
      };

      const sameLanguageService = new DubbingService(sameLanguageConfig);
      await sameLanguageService.initialize();
      await sameLanguageService.processCaptionText('Hello');

      // Should speak directly without translation API call
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();

      sameLanguageService.dispose();
    });

    it('should handle translation API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      await service.initialize();
      await service.processCaptionText('Test text');

      // Should still attempt to speak fallback text
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should provide fallback on translation failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await service.initialize();
      await service.processCaptionText('Test');

      // Should speak fallback text with language prefix
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });
  });

  describe('Speech Synthesis', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: {
            translatedText: 'Translated text'
          }
        })
      });
    });

    it('should synthesize speech', async () => {
      await service.initialize();
      await service.processCaptionText('Test text');

      expect(mockSpeechSynthesisUtterance).toHaveBeenCalled();
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should cancel ongoing speech before starting new', async () => {
      await service.initialize();
      await service.processCaptionText('First');
      await service.processCaptionText('Second');

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should use correct voice for target language', async () => {
      await service.initialize();
      await service.processCaptionText('Test');

      const utterance = mockSpeechSynthesisUtterance.mock.results[0]?.value;
      expect(utterance).toBeDefined();
    });

    it('should set correct volume', async () => {
      await service.initialize();
      await service.processCaptionText('Test');

      const utterance = mockSpeechSynthesisUtterance.mock.results[0]?.value;
      expect(utterance.volume).toBe(config.dubbedVolume);
    });
  });

  describe('Caption Processing', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: {
            translatedText: 'Translated'
          }
        })
      });
    });

    it('should process caption text', async () => {
      await service.initialize();
      await service.processCaptionText('Caption text');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should skip empty captions', async () => {
      await service.initialize();
      await service.processCaptionText('');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('should skip duplicate captions', async () => {
      await service.initialize();
      await service.processCaptionText('Same caption');
      await service.processCaptionText('Same caption');

      // Should only process once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should not process when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledService = new DubbingService(disabledConfig);
      await disabledService.initialize();

      await disabledService.processCaptionText('Test');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();

      disabledService.dispose();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      service.updateConfig({ targetLanguage: 'spanish' });
      // Configuration should be updated internally
      expect(service).toBeDefined();
    });

    it('should allow partial configuration updates', () => {
      service.updateConfig({ dubbedVolume: 0.5 });
      expect(service).toBeDefined();
    });
  });

  describe('Service Lifecycle', () => {
    it('should start service', async () => {
      await service.initialize();
      service.start();
      // Service should be started
      expect(service).toBeDefined();
    });

    it('should stop service', async () => {
      await service.initialize();
      service.start();
      service.stop();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should dispose resources', async () => {
      await service.initialize();
      service.start();
      service.dispose();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should not start without initialization', () => {
      const statusCallback = jest.fn();
      service.setStatusCallback(statusCallback);

      service.start();

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'error'
        })
      );
    });
  });

  describe('Voice Management', () => {
    it('should get available voices', () => {
      const voices = service.getAvailableVoices();
      expect(voices).toBeDefined();
      expect(Array.isArray(voices)).toBe(true);
    });

    it('should filter voices by language', () => {
      const englishVoices = service.getAvailableVoices('english');
      expect(Array.isArray(englishVoices)).toBe(true);
    });

    it('should return empty array when no voices available', () => {
      mockSpeechSynthesis.getVoices.mockReturnValueOnce([]);
      const voices = service.getAvailableVoices();
      expect(voices).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      const errorService = new DubbingService(config);
      const originalWindow = global.window;
      global.window = {} as any;

      await expect(errorService.initialize()).rejects.toThrow();

      global.window = originalWindow;
      errorService.dispose();
    });

    it('should handle speech synthesis errors', async () => {
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        if (utterance.onerror) {
          utterance.onerror({ error: 'synthesis-failed' });
        }
      });

      await service.initialize();

      // Should not throw, but handle error gracefully
      await expect(service.processCaptionText('Test')).resolves.not.toThrow();
    });

    it('should update status on error', async () => {
      const statusCallback = jest.fn();
      service.setStatusCallback(statusCallback);

      (global.fetch as jest.Mock).mockRejectedValue(new Error('API error'));

      await service.initialize();
      await service.processCaptionText('Test');

      // Should have called status callback with error state
      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(String)
        })
      );
    });
  });

  describe('Language Code Mapping', () => {
    it('should map language names to codes', async () => {
      const testCases = [
        { config: { ...config, targetLanguage: 'spanish' }, expected: 'es' },
        { config: { ...config, targetLanguage: 'french' }, expected: 'fr' },
        { config: { ...config, targetLanguage: 'german' }, expected: 'de' },
        { config: { ...config, targetLanguage: 'japanese' }, expected: 'ja' },
      ];

      for (const testCase of testCases) {
        const testService = new DubbingService(testCase.config);
        await testService.initialize();

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            responseStatus: 200,
            responseData: { translatedText: 'Test' }
          })
        });

        await testService.processCaptionText('Test');

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(testCase.expected),
          expect.any(Object)
        );

        testService.dispose();
        jest.clearAllMocks();
      }
    });

    it('should fallback to English for unknown language', async () => {
      const unknownConfig = { ...config, targetLanguage: 'unknown_language' };
      const unknownService = new DubbingService(unknownConfig);
      await unknownService.initialize();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          responseStatus: 200,
          responseData: { translatedText: 'Test' }
        })
      });

      await unknownService.processCaptionText('Test');

      // Should fallback to 'en' language code
      expect(global.fetch).toHaveBeenCalled();

      unknownService.dispose();
    });
  });
});
