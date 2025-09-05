export const mockChromeAPI = () => {
  const chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn()
      }
    },
    runtime: {
      onMessage: {
        addListener: jest.fn()
      },
      sendMessage: jest.fn(),
      onInstalled: {
        addListener: jest.fn()
      },
      getManifest: jest.fn(() => ({ version: '0.1.0' }))
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn(),
      onRemoved: {
        addListener: jest.fn()
      }
    },
    tabCapture: {
      capture: jest.fn()
    },
    offscreen: {
      createDocument: jest.fn(),
      closeDocument: jest.fn()
    }
  }

  Object.defineProperty(global, 'chrome', {
    value: chrome,
    writable: true
  })

  return chrome
}

export const mockCrypto = () => {
  const crypto = {
    subtle: {
      digest: jest.fn()
    }
  }

  Object.defineProperty(global, 'crypto', {
    value: crypto,
    writable: true
  })

  return crypto
}

export const mockFetch = () => {
  const mockFetch = jest.fn()
  Object.defineProperty(global, 'fetch', {
    value: mockFetch,
    writable: true
  })
  
  return mockFetch
}

export const createMockModelData = (size: number): Uint8Array => {
  return new Uint8Array(size).fill(0x42)
}

export const createMockSHA256 = (data: string): string => {
  return Array.from({ length: 64 }, (_, i) => 
    (data.charCodeAt(i % data.length) % 16).toString(16)
  ).join('')
}