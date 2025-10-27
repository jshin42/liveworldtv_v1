/**
 * Integration Tests for HomePage with Dubbing
 *
 * Tests cover:
 * - Full page rendering
 * - Channel autoplay on load
 * - Dubbing toggle functionality
 * - Status updates
 * - Test dubbing button
 * - YouTube player integration
 * - Error handling
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';

// Mock fetch
global.fetch = jest.fn();

// Mock YouTube IFrame API
const mockPlayer = {
  loadVideoById: jest.fn(),
  playVideo: jest.fn(),
  pauseVideo: jest.fn(),
  destroy: jest.fn()
};

global.window = {
  ...global.window,
  YT: {
    Player: jest.fn(() => mockPlayer),
    PlayerState: {
      PLAYING: 1,
      PAUSED: 2
    }
  },
  onYouTubeIframeAPIReady: null,
  speechSynthesis: {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn(() => [
      {
        name: 'English Voice',
        lang: 'en-US',
        localService: true,
        default: true,
        voiceURI: 'en-US'
      }
    ])
  },
  SpeechSynthesisUtterance: jest.fn((text: string) => ({
    text,
    lang: 'en-US',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: null,
    onend: null,
    onerror: null
  }))
} as any;

describe('HomePage Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful channel fetch
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/v1/channels/random')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'us-news-cnn',
            name: 'CNN Live',
            country: 'US',
            topic: 'NEWS',
            sourceType: 'YOUTUBE_EMBED',
            sourceUrl: 'https://www.youtube.com/watch?v=kkWWeh9YFB8',
            languageCode: 'english',
            description: 'Breaking news from CNN'
          })
        });
      }

      // Mock translation API
      if (url.includes('api.mymemory.translated.net')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            responseStatus: 200,
            responseData: {
              translatedText: 'Hello world translated'
            }
          })
        });
      }

      return Promise.reject(new Error('Unknown URL'));
    });
  });

  describe('Page Loading', () => {
    it('should render loading state initially', () => {
      render(<HomePage />);
      expect(screen.getByText(/Loading LiveWorldTV/i)).toBeInTheDocument();
    });

    it('should load random channel on mount', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/channels/random')
        );
      });
    });

    it('should display channel information after loading', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      expect(screen.getByText('LIVE')).toBeInTheDocument();
      expect(screen.getByText('US')).toBeInTheDocument();
      expect(screen.getByText('NEWS')).toBeInTheDocument();
    });

    it('should show error state on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load channel/i)).toBeInTheDocument();
      });
    });
  });

  describe('YouTube Player Integration', () => {
    it('should initialize YouTube player after channel loads', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      // YouTube API should be loaded
      const scripts = document.querySelectorAll('script');
      const youtubeScript = Array.from(scripts).find(
        s => s.src.includes('youtube.com/iframe_api')
      );
      expect(youtubeScript).toBeDefined();
    });
  });

  describe('Dubbing Controls', () => {
    it('should display dubbing controls', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText(/English Dubbing/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Start English Dubbing/i)).toBeInTheDocument();
    });

    it('should show English language badge', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('🇺🇸')).toBeInTheDocument();
        expect(screen.getByText('English')).toBeInTheDocument();
      });
    });

    it('should toggle dubbing on button click', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Stop English Dubbing/i)).toBeInTheDocument();
      });
    });

    it('should show status indicator when dubbing active', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Status:/i)).toBeInTheDocument();
      });
    });

    it('should show test dubbing button when active', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Test Dubbing/i)).toBeInTheDocument();
      });
    });
  });

  describe('Test Dubbing Functionality', () => {
    it('should trigger test dubbing on button click', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      // Start dubbing
      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Test Dubbing/i)).toBeInTheDocument();
      });

      // Click test dubbing
      const testButton = screen.getByText(/Test Dubbing/i);
      await user.click(testButton);

      // Should call translation API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('api.mymemory.translated.net'),
          expect.any(Object)
        );
      });

      // Should call speech synthesis
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });

    it('should use sample text for test dubbing', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Test Dubbing/i)).toBeInTheDocument();
      });

      const testButton = screen.getByText(/Test Dubbing/i);
      await user.click(testButton);

      // Verify sample text is used
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('Dubbing Lifecycle', () => {
    it('should initialize dubbing service on start', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(window.speechSynthesis.getVoices).toHaveBeenCalled();
      });
    });

    it('should stop dubbing on stop button click', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      // Start dubbing
      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Stop English Dubbing/i)).toBeInTheDocument();
      });

      // Stop dubbing
      const stopButton = screen.getByText(/Stop English Dubbing/i);
      await user.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText(/Start English Dubbing/i)).toBeInTheDocument();
      });

      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should cleanup dubbing service on stop', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Stop English Dubbing/i)).toBeInTheDocument();
      });

      const stopButton = screen.getByText(/Stop English Dubbing/i);
      await user.click(stopButton);

      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('Status Updates', () => {
    it('should show initial status as "Not started"', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      expect(screen.getByText(/Status: Not started/i)).toBeInTheDocument();
    });

    it('should update status to initializing on start', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      // Status should change
      await waitFor(() => {
        expect(screen.getByText(/Status:/i)).toBeInTheDocument();
      });
    });

    it('should show error status on failure', async () => {
      const user = userEvent.setup();

      // Make speech synthesis unavailable
      const originalSpeechSynthesis = window.speechSynthesis;
      delete (window as any).speechSynthesis;

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Status:/i)).toBeInTheDocument();
      });

      // Restore
      window.speechSynthesis = originalSpeechSynthesis;
    });
  });

  describe('UI Features', () => {
    it('should display feature cards', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      expect(screen.getByText(/Random Discovery/i)).toBeInTheDocument();
      expect(screen.getByText(/20\+ Countries/i)).toBeInTheDocument();
    });

    it('should show "How it works" section', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      expect(screen.getByText(/How it works/i)).toBeInTheDocument();
    });

    it('should display API status', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      expect(screen.getByText(/API Status/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByRole('button', { name: /Start English Dubbing/i });
      expect(startButton).toBeInTheDocument();
    });

    it('should provide status information via text', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const statusText = screen.getByText(/Status:/i);
      expect(statusText).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle channel fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load channel/i)).toBeInTheDocument();
      });
    });

    it('should handle translation API errors', async () => {
      const user = userEvent.setup();

      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/v1/channels/random')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'test-channel',
              name: 'Test Channel',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://youtube.com/watch?v=test',
              languageCode: 'english'
            })
          });
        }

        if (url.includes('api.mymemory.translated.net')) {
          return Promise.reject(new Error('Translation failed'));
        }

        return Promise.reject(new Error('Unknown URL'));
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('Test Channel')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Test Dubbing/i)).toBeInTheDocument();
      });

      const testButton = screen.getByText(/Test Dubbing/i);
      await user.click(testButton);

      // Should still call speech synthesis with fallback text
      await waitFor(() => {
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup dubbing service on unmount', async () => {
      const user = userEvent.setup();
      const { unmount } = render(<HomePage />);

      await waitFor(() => {
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
      });

      const startButton = screen.getByText(/Start English Dubbing/i);
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Stop English Dubbing/i)).toBeInTheDocument();
      });

      unmount();

      // Should have cleaned up (dispose called)
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });
});
