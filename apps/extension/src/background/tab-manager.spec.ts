import { TabManager } from './tab-manager'
import { mockChromeAPI } from '../test/setup'

describe('TabManager', () => {
  let tabManager: TabManager
  let mockChrome: ReturnType<typeof mockChromeAPI>

  beforeEach(() => {
    mockChrome = mockChromeAPI()
    tabManager = new TabManager()
    
    jest.clearAllMocks()
  })

  describe('setupOffscreenProcessor', () => {
    const mockStream = {} as MediaStream
    const testTabId = 123

    it('should create offscreen document and setup processor', async () => {
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      await tabManager.setupOffscreenProcessor(testTabId, mockStream)

      expect(mockChrome.offscreen.createDocument).toHaveBeenCalledWith({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Process audio for real-time AI dubbing'
      })
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'SETUP_AUDIO_PROCESSOR',
        data: {
          tabId: testTabId,
          offscreenId: expect.stringMatching(/^offscreen_123_\d+$/),
          stream: mockStream
        }
      })
    })

    it('should prevent duplicate processors for same tab', async () => {
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      await tabManager.setupOffscreenProcessor(testTabId, mockStream)

      await expect(
        tabManager.setupOffscreenProcessor(testTabId, mockStream)
      ).rejects.toThrow('Offscreen processor already exists for tab 123')
    })

    it('should clean up on setup failure', async () => {
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Message failed'))

      await expect(
        tabManager.setupOffscreenProcessor(testTabId, mockStream)
      ).rejects.toThrow('Message failed')

      // Should not track the tab as having an active processor
      const isActive = await tabManager.isProcessorActive(testTabId)
      expect(isActive).toBe(false)
    })

    it('should handle offscreen creation failure', async () => {
      mockChrome.offscreen.createDocument.mockRejectedValue(new Error('Offscreen failed'))

      await expect(
        tabManager.setupOffscreenProcessor(testTabId, mockStream)
      ).rejects.toThrow('Offscreen failed')
    })
  })

  describe('stopOffscreenProcessor', () => {
    const testTabId = 123
    const mockStream = {
      getTracks: jest.fn(() => [
        { stop: jest.fn() },
        { stop: jest.fn() }
      ])
    } as any

    beforeEach(async () => {
      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })
      
      await tabManager.setupOffscreenProcessor(testTabId, mockStream)
      jest.clearAllMocks()
    })

    it('should stop processor and clean up resources', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })
      mockChrome.offscreen.closeDocument.mockResolvedValue(undefined)

      await tabManager.stopOffscreenProcessor(testTabId)

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'STOP_AUDIO_PROCESSOR',
        data: { 
          tabId: testTabId, 
          offscreenId: expect.stringMatching(/^offscreen_123_\d+$/)
        }
      })
      
      expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled()
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
      expect(mockStream.getTracks()[1].stop).toHaveBeenCalled()

      const isActive = await tabManager.isProcessorActive(testTabId)
      expect(isActive).toBe(false)
    })

    it('should handle graceful shutdown on non-active tab', async () => {
      await tabManager.stopOffscreenProcessor(999) // Non-existent tab

      // Should not throw and not call cleanup methods
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled()
      expect(mockChrome.offscreen.closeDocument).not.toHaveBeenCalled()
    })

    it('should handle cleanup errors gracefully', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Message failed'))
      mockChrome.offscreen.closeDocument.mockRejectedValue(new Error('Close failed'))

      await expect(
        tabManager.stopOffscreenProcessor(testTabId)
      ).resolves.not.toThrow()

      // Should still clean up tracking
      const isActive = await tabManager.isProcessorActive(testTabId)
      expect(isActive).toBe(false)
    })
  })

  describe('isProcessorActive', () => {
    it('should return true for active processors', async () => {
      const testTabId = 123
      const mockStream = {} as MediaStream

      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      await tabManager.setupOffscreenProcessor(testTabId, mockStream)

      const isActive = await tabManager.isProcessorActive(testTabId)
      expect(isActive).toBe(true)
    })

    it('should return false for inactive processors', async () => {
      const isActive = await tabManager.isProcessorActive(999)
      expect(isActive).toBe(false)
    })
  })

  describe('getActiveProcessors', () => {
    it('should return list of active tab IDs', async () => {
      const mockStream = {} as MediaStream

      mockChrome.offscreen.createDocument.mockResolvedValue(undefined)
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      await tabManager.setupOffscreenProcessor(123, mockStream)
      await tabManager.setupOffscreenProcessor(456, mockStream)

      const activeProcessors = await tabManager.getActiveProcessors()
      expect(activeProcessors).toEqual(expect.arrayContaining([123, 456]))
      expect(activeProcessors).toHaveLength(2)
    })

    it('should return empty array when no processors active', async () => {
      const activeProcessors = await tabManager.getActiveProcessors()
      expect(activeProcessors).toEqual([])
    })
  })
})