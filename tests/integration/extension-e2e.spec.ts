import { ExtensionServiceWorker } from '../../apps/extension/src/background/background'
import { mockChromeAPI, mockCrypto, mockFetch, createMockModelData, createMockSHA256 } from '../../apps/extension/src/test/setup'

describe('Extension E2E Flow', () => {
  let serviceWorker: ExtensionServiceWorker
  let mockChrome: ReturnType<typeof mockChromeAPI>
  let mockCryptoAPI: ReturnType<typeof mockCrypto>
  let mockFetchAPI: ReturnType<typeof mockFetch>

  beforeEach(() => {
    mockChrome = mockChromeAPI()
    mockCryptoAPI = mockCrypto() 
    mockFetchAPI = mockFetch()
    
    serviceWorker = new ExtensionServiceWorker()
    
    jest.clearAllMocks()
  })

  describe('complete dubbing enablement flow', () => {
    const testTabId = 123

    beforeEach(async () => {
      // Setup pre-downloaded models
      const mockData = createMockModelData(1024)
      mockChrome.storage.local.get.mockImplementation((keys) => {
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {}
          keys.forEach(key => {
            if (key.startsWith('model_')) {
              result[key] = { data: Array.from(mockData), version: '1.0.0' }
            }
          })
          return Promise.resolve(result)
        }
        return Promise.resolve({})
      })

      // Mock hash verification to pass
      const validHash = createMockSHA256('valid')
      mockCryptoAPI.subtle.digest.mockResolvedValue(
        new Uint8Array(Array.from(validHash.match(/.{2}/g) || [], hex => parseInt(hex, 16))).buffer
      )
    })

    it('should complete full dubbing activation flow', async () => {
      // Mock successful tab capture
      const mockStream = {} as MediaStream
      mockChrome.tabCapture.capture.mockResolvedValue(mockStream)
      
      // Mock offscreen setup
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })
      
      // Mock tab message sending
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true })

      const enableMessage = {
        type: 'ENABLE_DUBBING' as const,
        tabId: testTabId,
        timestamp: Date.now()
      }

      let responseReceived: any = null
      const mockSendResponse = jest.fn((response) => {
        responseReceived = response
      })

      await serviceWorker['handleMessage'](enableMessage, { tab: { id: testTabId } }, mockSendResponse)

      expect(responseReceived.success).toBe(true)
      expect(mockChrome.tabCapture.capture).toHaveBeenCalledWith({
        audio: true,
        video: false
      })
      expect(mockChrome.offscreen.createDocument).toHaveBeenCalled()
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        testTabId,
        expect.objectContaining({ type: 'DUBBING_ENABLED' })
      )
    })

    it('should handle model download during first enable', async () => {
      // Mock models not ready
      mockChrome.storage.local.get.mockResolvedValue({})
      
      // Setup fetch for model downloads
      const modelData = createMockModelData(1024)
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: modelData })
          .mockResolvedValueOnce({ done: true })
      }

      mockFetchAPI.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader }
      })

      mockChrome.storage.local.set.mockResolvedValue(undefined)

      const enableMessage = {
        type: 'ENABLE_DUBBING' as const,
        tabId: testTabId,
        timestamp: Date.now()
      }

      let responseReceived: any = null
      await serviceWorker['handleMessage'](enableMessage, { tab: { id: testTabId } }, (response) => {
        responseReceived = response
      })

      expect(responseReceived.success).toBe(false)
      expect(responseReceived.error).toBe('AI models not available')
    })

    it('should handle tab capture failure', async () => {
      mockChrome.tabCapture.capture.mockResolvedValue(null)

      const enableMessage = {
        type: 'ENABLE_DUBBING' as const,
        tabId: testTabId,
        timestamp: Date.now()
      }

      let responseReceived: any = null
      await serviceWorker['handleMessage'](enableMessage, { tab: { id: testTabId } }, (response) => {
        responseReceived = response
      })

      expect(responseReceived.success).toBe(false)
      expect(responseReceived.error).toBe('Failed to capture tab audio')
    })

    it('should complete disable flow and cleanup', async () => {
      // First enable
      const mockStream = {} as MediaStream
      mockChrome.tabCapture.capture.mockResolvedValue(mockStream)
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true })

      await serviceWorker['enableDubbing'](testTabId)

      // Then disable
      mockChrome.offscreen.closeDocument.mockResolvedValue(undefined)

      const disableMessage = {
        type: 'DISABLE_DUBBING' as const,
        tabId: testTabId,
        timestamp: Date.now()
      }

      let responseReceived: any = null
      await serviceWorker['handleMessage'](disableMessage, { tab: { id: testTabId } }, (response) => {
        responseReceived = response
      })

      expect(responseReceived.success).toBe(true)
      expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled()
    })
  })

  describe('model status reporting', () => {
    it('should return accurate model status', async () => {
      const partialData = createMockModelData(512)
      
      mockChrome.storage.local.get.mockImplementation((key) => {
        if (key === 'model_distil-whisper') {
          return Promise.resolve({ 'model_distil-whisper': { data: Array.from(partialData) } })
        }
        return Promise.resolve({})
      })

      const statusMessage = {
        type: 'GET_MODEL_STATUS' as const,
        timestamp: Date.now()
      }

      let responseReceived: any = null
      await serviceWorker['handleMessage'](statusMessage, {}, (response) => {
        responseReceived = response
      })

      expect(responseReceived.success).toBe(true)
      expect(responseReceived.data['distil-whisper'].loaded).toBe(true)
      expect(responseReceived.data['nllb-200'].loaded).toBe(false)
      expect(responseReceived.data['kokoro-82m'].loaded).toBe(false)
    })
  })

  describe('error resilience', () => {
    it('should handle chrome API failures gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Chrome API error'))

      const message = {
        type: 'GET_MODEL_STATUS' as const,
        timestamp: Date.now()
      }

      let responseReceived: any = null
      await serviceWorker['handleMessage'](message, {}, (response) => {
        responseReceived = response
      })

      expect(responseReceived.success).toBe(false)
      expect(responseReceived.error).toContain('Chrome API error')
    })

    it('should handle storage quota exceeded', async () => {
      const largeData = createMockModelData(1024 * 1024 * 100) // 100MB
      
      mockChrome.storage.local.set.mockRejectedValue(new Error('Quota exceeded'))
      mockChrome.storage.local.get.mockResolvedValue({})
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: largeData })
          .mockResolvedValueOnce({ done: true })
      }

      mockFetchAPI.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader }
      })

      const downloadMessage = {
        type: 'DOWNLOAD_MODELS' as const,
        timestamp: Date.now()
      }

      let responseReceived: any = null
      await serviceWorker['handleMessage'](downloadMessage, {}, (response) => {
        responseReceived = response
      })

      expect(responseReceived.success).toBe(false)
      expect(responseReceived.error).toContain('Quota exceeded')
    })
  })
})