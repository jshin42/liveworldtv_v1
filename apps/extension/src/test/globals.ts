import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for Node.js environment
Object.assign(global, { TextEncoder, TextDecoder });

// Mock MediaStream for web audio APIs
Object.defineProperty(global, 'MediaStream', {
  value: jest.fn(() => ({
    getTracks: () => [],
    addTrack: jest.fn(),
    removeTrack: jest.fn()
  })),
  writable: true
});

// Mock Chrome APIs globally
const mockChrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined)
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    onInstalled: {
      addListener: jest.fn()
    },
    getManifest: jest.fn().mockReturnValue({ version: '0.1.0' })
  },
  tabs: {
    query: jest.fn().mockResolvedValue([{ id: 1, url: 'https://youtube.com/watch?v=test' }]),
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    onRemoved: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    },
    onActivated: {
      addListener: jest.fn()
    }
  },
  tabCapture: {
    capture: jest.fn().mockResolvedValue(new MediaStream())
  }
};

Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
});

// Mock Web Audio API
const mockAudioContext = {
  sampleRate: 16000,
  createMediaStreamSource: jest.fn(),
  createMediaStreamDestination: jest.fn(() => ({
    stream: new MediaStream()
  })),
  audioWorklet: {
    addModule: jest.fn().mockResolvedValue(undefined)
  },
  close: jest.fn().mockResolvedValue(undefined),
  state: 'running'
};

Object.defineProperty(global, 'AudioContext', {
  value: jest.fn(() => mockAudioContext),
  writable: true
});

Object.defineProperty(global, 'AudioWorkletNode', {
  value: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    port: {
      onmessage: null,
      postMessage: jest.fn()
    }
  })),
  writable: true
});

// Mock crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  },
  writable: true
});

// Mock fetch
Object.defineProperty(global, 'fetch', {
  value: jest.fn(),
  writable: true
});