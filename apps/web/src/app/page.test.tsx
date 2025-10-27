import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from './page';

// Mock fetch
global.fetch = jest.fn();

// Mock YouTube IFrame API
(global as any).YT = {
  Player: jest.fn().mockImplementation(() => ({
    playVideo: jest.fn(),
    pauseVideo: jest.fn(),
    destroy: jest.fn(),
    getPlayerState: jest.fn().mockReturnValue(1), // PLAYING
  })),
  PlayerState: {
    PLAYING: 1,
    PAUSED: 2,
  },
};

describe('Home Page - Auto-Play Implementation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial Load and Auto-Play', () => {
    it('should render loading state initially', () => {
      render(<Home />);
      expect(screen.getByText(/loading channels/i)).toBeInTheDocument();
    });

    it('should fetch channels from API on mount', async () => {
      const mockUsChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/test',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              description: 'NBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      const mockUkChannels = {
        data: {
          channels: [
            {
              id: '2',
              name: 'BBC News',
              country: 'UK',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/bbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/bbc.jpg',
              description: 'BBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUsChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUkChannels,
        });

      render(<Home />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/channels?country=US&topic=NEWS')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/channels?country=UK&topic=NEWS')
      );
    });

    it('should auto-select first US channel by default', async () => {
      const mockUsChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/test',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              description: 'NBC News',
              active: true,
            },
            {
              id: '2',
              name: 'CNN Live',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/cnn',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/cnn.jpg',
              description: 'CNN News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 2, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUsChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('NBC News Now')).toBeInTheDocument();
      });

      // First US channel should be selected
      const nbcButton = screen.getByText('NBC News Now').closest('button');
      expect(nbcButton).toHaveClass('bg-blue-600'); // Active state
    });

    it('should fallback to first channel if no US channels exist', async () => {
      const mockUkOnlyChannels = {
        data: {
          channels: [
            {
              id: '2',
              name: 'BBC News',
              country: 'UK',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/bbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/bbc.jpg',
              description: 'BBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUkOnlyChannels,
        });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('BBC News')).toBeInTheDocument();
      });

      const bbcButton = screen.getByText('BBC News').closest('button');
      expect(bbcButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should display error message when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load channels/i)).toBeInTheDocument();
      });
    });

    it('should fallback to mock data when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API unavailable'));

      render(<Home />);

      await waitFor(() => {
        // Mock data includes NBC News Now
        expect(screen.getByText(/NBC News Now/i)).toBeInTheDocument();
      });
    });

    it('should handle non-OK response from API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load channels/i)).toBeInTheDocument();
      });
    });

    it('should still auto-play with fallback mock data', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText(/NBC News Now/i)).toBeInTheDocument();
      });

      // Should auto-select first channel even with mock data
      const firstChannelButton = screen.getByText(/NBC News Now/i).closest('button');
      expect(firstChannelButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Channel Selection', () => {
    beforeEach(async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/nbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/nbc.jpg',
              description: 'NBC News',
              active: true,
            },
            {
              id: '2',
              name: 'CNN Live',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/cnn',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/cnn.jpg',
              description: 'CNN News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 2, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });
    });

    it('should switch channels when clicking different channel button', async () => {
      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('NBC News Now')).toBeInTheDocument();
      });

      const cnnButton = screen.getByText('CNN Live');
      fireEvent.click(cnnButton);

      await waitFor(() => {
        const cnnButtonElement = screen.getByText('CNN Live').closest('button');
        expect(cnnButtonElement).toHaveClass('bg-blue-600');
      });
    });

    it('should update player source when channel changes', async () => {
      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('NBC News Now')).toBeInTheDocument();
      });

      // Get initial player iframe
      const initialIframe = document.querySelector('iframe');
      expect(initialIframe?.src).toContain('nbc');

      // Switch channel
      const cnnButton = screen.getByText('CNN Live');
      fireEvent.click(cnnButton);

      await waitFor(() => {
        const updatedIframe = document.querySelector('iframe');
        expect(updatedIframe?.src).toContain('cnn');
      });
    });

    it('should maintain only one active channel at a time', async () => {
      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('NBC News Now')).toBeInTheDocument();
      });

      // Initially NBC should be active
      let nbcButton = screen.getByText('NBC News Now').closest('button');
      let cnnButton = screen.getByText('CNN Live').closest('button');

      expect(nbcButton).toHaveClass('bg-blue-600');
      expect(cnnButton).toHaveClass('bg-gray-700');

      // Click CNN
      fireEvent.click(cnnButton!);

      await waitFor(() => {
        nbcButton = screen.getByText('NBC News Now').closest('button');
        cnnButton = screen.getByText('CNN Live').closest('button');

        expect(cnnButton).toHaveClass('bg-blue-600');
        expect(nbcButton).toHaveClass('bg-gray-700');
      });
    });
  });

  describe('YouTube Player Integration', () => {
    it('should render YouTube iframe player', async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/test',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              description: 'NBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        const iframe = document.querySelector('iframe');
        expect(iframe).toBeInTheDocument();
        expect(iframe?.src).toContain('youtube.com/embed');
      });
    });

    it('should include autoplay parameter in YouTube URL', async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/test',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              description: 'NBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        const iframe = document.querySelector('iframe');
        expect(iframe?.src).toContain('autoplay=1');
      });
    });

    it('should display channel info above player', async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/test',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              description: 'NBC News Coverage',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('NBC News Now')).toBeInTheDocument();
        expect(screen.getByText('NBC News Coverage')).toBeInTheDocument();
        expect(screen.getByText(/US/i)).toBeInTheDocument();
      });
    });
  });

  describe('Channel List Display', () => {
    it('should display all available channels in sidebar', async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/nbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/nbc.jpg',
              description: 'NBC News',
              active: true,
            },
            {
              id: '2',
              name: 'CNN Live',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/cnn',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/cnn.jpg',
              description: 'CNN News',
              active: true,
            },
            {
              id: '3',
              name: 'BBC News',
              country: 'UK',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/bbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/bbc.jpg',
              description: 'BBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 3, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('NBC News Now')).toBeInTheDocument();
        expect(screen.getByText('CNN Live')).toBeInTheDocument();
        expect(screen.getByText('BBC News')).toBeInTheDocument();
      });
    });

    it('should show live indicator for active channels', async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/nbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/nbc.jpg',
              description: 'NBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('LIVE')).toBeInTheDocument();
      });
    });

    it('should display country flags or codes for channels', async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/nbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/nbc.jpg',
              description: 'NBC News',
              active: true,
            },
            {
              id: '2',
              name: 'BBC News',
              country: 'UK',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/bbc',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/bbc.jpg',
              description: 'BBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 2, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        // Country codes should be visible in channel list
        const usText = screen.getAllByText(/US/i);
        const ukText = screen.getAllByText(/UK/i);
        expect(usText.length).toBeGreaterThan(0);
        expect(ukText.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator during fetch', async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValue(promise);

      render(<Home />);

      expect(screen.getByText(/loading channels/i)).toBeInTheDocument();

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({ data: { channels: [], pagination: {} } }),
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading channels/i)).not.toBeInTheDocument();
      });
    });

    it('should hide loading state after channels load', async () => {
      const mockChannels = {
        data: {
          channels: [
            {
              id: '1',
              name: 'NBC News Now',
              country: 'US',
              topic: 'NEWS',
              sourceUrl: 'https://www.youtube.com/embed/test',
              sourceType: 'YOUTUBE_EMBED',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              description: 'NBC News',
              active: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, hasNext: false },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChannels,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { channels: [], pagination: {} } }),
        });

      render(<Home />);

      await waitFor(() => {
        expect(screen.queryByText(/loading channels/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('API Configuration', () => {
    it('should use environment variable for API URL', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';

      const mockChannels = {
        data: {
          channels: [],
          pagination: { page: 1, limit: 20, total: 0, hasNext: false },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockChannels,
      });

      render(<Home />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('https://api.example.com')
        );
      });

      delete process.env.NEXT_PUBLIC_API_URL;
    });

    it('should fallback to localhost when no env var set', async () => {
      delete process.env.NEXT_PUBLIC_API_URL;

      const mockChannels = {
        data: {
          channels: [],
          pagination: { page: 1, limit: 20, total: 0, hasNext: false },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockChannels,
      });

      render(<Home />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('http://localhost:3001')
        );
      });
    });
  });
});
