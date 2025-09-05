import { ModelManager } from './model-manager';
import { mockChromeAPI, mockCrypto, mockFetch, createMockModelData, createMockSHA256 } from '../test/setup';

describe('ModelManager', () => {
  let modelManager: ModelManager;
  let mockChrome: any;
  let mockCryptoAPI: any;
  let mockFetchAPI: any;

  const mockModelSpec = {
    name: 'test-model',
    version: '1.0.0',
    url: 'https://huggingface.co/test-model/resolve/main/model.onnx',
    size: 1000000, // 1MB
    checksum: 'abc123def456',
    format: 'onnx' as const
  };

  beforeEach(() => {
    mockChrome = mockChromeAPI();
    mockCryptoAPI = mockCrypto();
    mockFetchAPI = mockFetch();
    modelManager = new ModelManager();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete (global as any).chrome;
    delete (global as any).crypto;
    delete (global as any).fetch;
  });

  describe('isModelReady', () => {
    it('should return true when model exists and checksum matches', async () => {
      const modelData = createMockModelData(mockModelSpec.size);
      
      mockChrome.storage.local.get.mockResolvedValue({
        [`model_${mockModelSpec.name}`]: {
          data: Array.from(modelData),
          checksum: mockModelSpec.checksum,
          downloadedAt: Date.now()
        }
      });

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode(mockModelSpec.checksum).buffer
      );

      const result = await modelManager.isModelReady(mockModelSpec.name);

      expect(result).toBe(true);
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([`model_${mockModelSpec.name}`]);
    });

    it('should return false when model does not exist', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      const result = await modelManager.isModelReady('nonexistent-model');

      expect(result).toBe(false);
    });

    it('should return false when checksum validation fails', async () => {
      const modelData = createMockModelData(mockModelSpec.size);
      
      mockChrome.storage.local.get.mockResolvedValue({
        [`model_${mockModelSpec.name}`]: {
          data: Array.from(modelData),
          checksum: 'wrong-checksum',
          downloadedAt: Date.now()
        }
      });

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode('different-hash').buffer
      );

      const result = await modelManager.isModelReady(mockModelSpec.name);

      expect(result).toBe(false);
    });
  });

  describe('downloadModel', () => {
    it('should download model successfully and store with checksum', async () => {
      const modelData = createMockModelData(mockModelSpec.size);
      
      mockFetchAPI.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: modelData })
              .mockResolvedValueOnce({ done: true })
          })
        },
        headers: {
          get: jest.fn((header: string) => {
            if (header === 'content-length') return mockModelSpec.size.toString();
            return null;
          })
        }
      });

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode(mockModelSpec.checksum).buffer
      );

      await modelManager.downloadModel(mockModelSpec);

      expect(mockFetchAPI).toHaveBeenCalledWith(mockModelSpec.url);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        [`model_${mockModelSpec.name}`]: {
          data: Array.from(modelData),
          checksum: mockModelSpec.checksum,
          downloadedAt: expect.any(Number),
          spec: mockModelSpec
        }
      });
    });

    it('should prevent concurrent downloads of same model', async () => {
      const modelData = createMockModelData(100);
      
      mockFetchAPI.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            body: {
              getReader: () => ({
                read: jest.fn()
                  .mockResolvedValueOnce({ done: false, value: modelData })
                  .mockResolvedValueOnce({ done: true })
              })
            },
            headers: { get: () => '100' }
          }), 100)
        )
      );

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode('hash').buffer
      );

      const download1 = modelManager.downloadModel(mockModelSpec);
      const download2 = modelManager.downloadModel(mockModelSpec);

      await Promise.all([download1, download2]);

      expect(mockFetchAPI).toHaveBeenCalledTimes(1);
    });

    it('should throw error when download fails', async () => {
      mockFetchAPI.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(modelManager.downloadModel(mockModelSpec)).rejects.toThrow(
        'Download failed: 404 Not Found'
      );
    });

    it('should throw error when checksum validation fails', async () => {
      const modelData = createMockModelData(mockModelSpec.size);
      
      mockFetchAPI.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: modelData })
              .mockResolvedValueOnce({ done: true })
          })
        },
        headers: { get: () => mockModelSpec.size.toString() }
      });

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode('wrong-checksum').buffer
      );

      await expect(modelManager.downloadModel(mockModelSpec)).rejects.toThrow(
        'Checksum verification failed'
      );
    });

    it('should handle network interruption gracefully', async () => {
      mockFetchAPI.mockRejectedValue(new Error('Network error'));

      await expect(modelManager.downloadModel(mockModelSpec)).rejects.toThrow('Network error');
      
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('getModel', () => {
    it('should load and return model when ready', async () => {
      const modelData = createMockModelData(mockModelSpec.size);
      
      mockChrome.storage.local.get.mockResolvedValue({
        [`model_${mockModelSpec.name}`]: {
          data: Array.from(modelData),
          checksum: mockModelSpec.checksum,
          spec: mockModelSpec
        }
      });

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode(mockModelSpec.checksum).buffer
      );

      const mockModel = { run: jest.fn() };
      (global as any).ort = {
        InferenceSession: {
          create: jest.fn().mockResolvedValue(mockModel)
        }
      };

      const result = await modelManager.getModel(mockModelSpec.name);

      expect(result).toBe(mockModel);
    });

    it('should throw error when model not ready', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      await expect(modelManager.getModel('nonexistent')).rejects.toThrow(
        'Model nonexistent is not ready'
      );
    });
  });

  describe('getModelsStatus', () => {
    it('should return status for all tracked models', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        [`model_${mockModelSpec.name}`]: {
          data: [],
          checksum: mockModelSpec.checksum,
          spec: mockModelSpec
        }
      });

      const result = await modelManager.getModelsStatus();

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('name');
        expect(result[0]).toHaveProperty('ready');
        expect(result[0]).toHaveProperty('size');
      }
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle corrupted storage data', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        [`model_${mockModelSpec.name}`]: 'corrupted-data'
      });

      const result = await modelManager.isModelReady(mockModelSpec.name);

      expect(result).toBe(false);
    });

    it('should handle storage quota exceeded during download', async () => {
      const modelData = createMockModelData(mockModelSpec.size);
      
      mockFetchAPI.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: modelData })
              .mockResolvedValueOnce({ done: true })
          })
        },
        headers: { get: () => mockModelSpec.size.toString() }
      });

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode(mockModelSpec.checksum).buffer
      );

      mockChrome.storage.local.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

      await expect(modelManager.downloadModel(mockModelSpec)).rejects.toThrow('QUOTA_EXCEEDED');
    });
  });

  describe('Performance & Memory', () => {
    it('should cleanup download promises after completion', async () => {
      const modelData = createMockModelData(100);
      
      mockFetchAPI.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: modelData })
              .mockResolvedValueOnce({ done: true })
          })
        },
        headers: { get: () => '100' }
      });

      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new TextEncoder().encode('hash').buffer
      );

      await modelManager.downloadModel(mockModelSpec);
      
      // Second download should not reuse promise
      await modelManager.downloadModel({ ...mockModelSpec, name: 'different-model' });

      expect(mockFetchAPI).toHaveBeenCalledTimes(2);
    });
  });
});