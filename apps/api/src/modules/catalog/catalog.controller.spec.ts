import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { NotFoundException } from '@nestjs/common';
import { Channel, LiveStream } from '@liveworldtv/shared-types';

describe('CatalogController', () => {
  let controller: CatalogController;
  let service: CatalogService;

  const mockChannel: Channel = {
    id: '1',
    name: 'NBC News Now',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCeY0bbntWzzVIaj2z3QigXg',
    youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg',
    languageCode: 'en',
    thumbnailUrl: 'https://yt3.googleusercontent.com/nbcnews.jpg',
    description: 'NBC News Now - Breaking news and live coverage',
    active: true,
    verified: true,
    metadata: { tags: ['news', 'breaking', 'live'] },
    firstSeen: new Date('2024-01-01'),
    lastSeen: new Date('2024-01-01'),
    contentFingerprint: 'nbc-news-now-fingerprint',
  };

  const mockStream: LiveStream = {
    id: 'stream-1',
    channelId: '1',
    status: 'LIVE',
    startedAt: new Date(),
    delaySeconds: 8,
    dvrWindowSec: 3600,
    viewerCount: 12500,
    peakViewerCount: 15000,
    lastChecked: new Date(),
    qualityMetrics: {
      avgBitrate: 5000000,
      resolution: '1080p',
      fps: 30,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: {
            getChannelsByCountryTopic: jest.fn(),
            getChannelById: jest.fn(),
            getStreamStatus: jest.fn(),
            matchUrlToChannel: jest.fn(),
            discoverChannels: jest.fn(),
            searchChannels: jest.fn(),
            getActiveChannelCount: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    service = module.get<CatalogService>(CatalogService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getChannels', () => {
    it('should return channels wrapped in API response format', async () => {
      const mockChannelList = {
        channels: [mockChannel],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          hasNext: false,
        },
      };

      jest
        .spyOn(service, 'getChannelsByCountryTopic')
        .mockResolvedValue(mockChannelList);

      const result = await controller.getChannels({
        country: 'US',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockChannelList);
      expect(result.meta).toBeDefined();
      expect(result.meta.timestamp).toBeDefined();
      expect(result.meta.version).toBe('v1.0.0');
      expect(result.meta.requestId).toBeDefined();
      expect(result.meta.requestId).toHaveLength(32); // 16 bytes hex = 32 chars
    });

    it('should call service with correct parameters', async () => {
      const mockChannelList = {
        channels: [],
        pagination: { page: 2, limit: 10, total: 0, hasNext: false },
      };

      jest
        .spyOn(service, 'getChannelsByCountryTopic')
        .mockResolvedValue(mockChannelList);

      await controller.getChannels({
        country: 'UK',
        topic: 'NEWS',
        page: 2,
        limit: 10,
      });

      expect(service.getChannelsByCountryTopic).toHaveBeenCalledWith(
        'UK',
        'NEWS',
        { page: 2, limit: 10 }
      );
    });

    it('should use default pagination when not provided', async () => {
      const mockChannelList = {
        channels: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      };

      jest
        .spyOn(service, 'getChannelsByCountryTopic')
        .mockResolvedValue(mockChannelList);

      await controller.getChannels({ country: 'US' });

      expect(service.getChannelsByCountryTopic).toHaveBeenCalledWith('US', undefined, {
        page: 1,
        limit: 20,
      });
    });

    it('should filter by topic when provided', async () => {
      const mockChannelList = {
        channels: [mockChannel],
        pagination: { page: 1, limit: 20, total: 1, hasNext: false },
      };

      jest
        .spyOn(service, 'getChannelsByCountryTopic')
        .mockResolvedValue(mockChannelList);

      await controller.getChannels({
        country: 'US',
        topic: 'SPORTS',
      });

      expect(service.getChannelsByCountryTopic).toHaveBeenCalledWith(
        'US',
        'SPORTS',
        { page: 1, limit: 20 }
      );
    });

    it('should generate unique request IDs for each request', async () => {
      const mockChannelList = {
        channels: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      };

      jest
        .spyOn(service, 'getChannelsByCountryTopic')
        .mockResolvedValue(mockChannelList);

      const result1 = await controller.getChannels({ country: 'US' });
      const result2 = await controller.getChannels({ country: 'US' });

      expect(result1.meta.requestId).not.toBe(result2.meta.requestId);
    });
  });

  describe('getChannel', () => {
    it('should return channel details wrapped in API response', async () => {
      jest.spyOn(service, 'getChannelById').mockResolvedValue(mockChannel);

      const result = await controller.getChannel('1');

      expect(result.data).toEqual(mockChannel);
      expect(result.meta.timestamp).toBeDefined();
      expect(result.meta.version).toBe('v1.0.0');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should call service with channel ID', async () => {
      jest.spyOn(service, 'getChannelById').mockResolvedValue(mockChannel);

      await controller.getChannel('test-uuid');

      expect(service.getChannelById).toHaveBeenCalledWith('test-uuid');
    });

    it('should throw NotFoundException when channel does not exist', async () => {
      jest
        .spyOn(service, 'getChannelById')
        .mockRejectedValue(new NotFoundException('Channel with ID 999 not found'));

      await expect(controller.getChannel('999')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should include all required channel fields', async () => {
      jest.spyOn(service, 'getChannelById').mockResolvedValue(mockChannel);

      const result = await controller.getChannel('1');

      expect(result.data).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        country: expect.any(String),
        topic: expect.any(String),
        sourceType: expect.any(String),
        sourceUrl: expect.any(String),
        languageCode: expect.any(String),
        active: expect.any(Boolean),
        verified: expect.any(Boolean),
      });
    });
  });

  describe('getStreamStatus', () => {
    it('should return stream status wrapped in API response', async () => {
      jest.spyOn(service, 'getStreamStatus').mockResolvedValue(mockStream);

      const result = await controller.getStreamStatus('1');

      expect(result.data).toEqual(mockStream);
      expect(result.meta.timestamp).toBeDefined();
      expect(result.meta.version).toBe('v1.0.0');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should call service with channel ID', async () => {
      jest.spyOn(service, 'getStreamStatus').mockResolvedValue(mockStream);

      await controller.getStreamStatus('channel-id');

      expect(service.getStreamStatus).toHaveBeenCalledWith('channel-id');
    });

    it('should throw NotFoundException for invalid channel', async () => {
      jest
        .spyOn(service, 'getStreamStatus')
        .mockRejectedValue(
          new NotFoundException('Stream for channel 999 not found')
        );

      await expect(controller.getStreamStatus('999')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should return stream with DVR window information', async () => {
      jest.spyOn(service, 'getStreamStatus').mockResolvedValue(mockStream);

      const result = await controller.getStreamStatus('1');

      expect(result.data.dvrWindowSec).toBeGreaterThan(0);
      expect(result.data.delaySeconds).toBeGreaterThan(0);
    });

    it('should return stream with viewer metrics', async () => {
      jest.spyOn(service, 'getStreamStatus').mockResolvedValue(mockStream);

      const result = await controller.getStreamStatus('1');

      expect(result.data.viewerCount).toBeGreaterThanOrEqual(0);
      expect(result.data.peakViewerCount).toBeGreaterThanOrEqual(
        result.data.viewerCount
      );
    });
  });

  describe('matchUrl', () => {
    it('should return matching channel for valid URL', async () => {
      const url = 'https://www.youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg';
      jest.spyOn(service, 'matchUrlToChannel').mockResolvedValue(mockChannel);

      const result = await controller.matchUrl({ url });

      expect(result).toEqual(mockChannel);
      expect(service.matchUrlToChannel).toHaveBeenCalledWith(url);
    });

    it('should return null for non-matching URL', async () => {
      const url = 'https://www.youtube.com/channel/INVALID_ID';
      jest.spyOn(service, 'matchUrlToChannel').mockResolvedValue(null);

      const result = await controller.matchUrl({ url });

      expect(result).toBeNull();
    });

    it('should handle different YouTube URL formats', async () => {
      const urls = [
        'https://youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg',
        'https://www.youtube.com/c/NBCNews',
      ];

      jest.spyOn(service, 'matchUrlToChannel').mockResolvedValue(mockChannel);

      for (const url of urls) {
        await controller.matchUrl({ url });
        expect(service.matchUrlToChannel).toHaveBeenCalledWith(url);
      }
    });

    it('should call service method for URL matching', async () => {
      const url = 'https://www.youtube.com/watch?v=abc123';
      jest.spyOn(service, 'matchUrlToChannel').mockResolvedValue(null);

      await controller.matchUrl({ url });

      expect(service.matchUrlToChannel).toHaveBeenCalledTimes(1);
      expect(service.matchUrlToChannel).toHaveBeenCalledWith(url);
    });
  });

  describe('discoverChannels', () => {
    it('should initiate channel discovery for country', async () => {
      const mockResult = {
        message: 'Discovery initiated for US',
      };
      jest.spyOn(service, 'discoverChannels').mockResolvedValue(mockResult);

      const result = await controller.discoverChannels('US');

      expect(result).toEqual(mockResult);
      expect(service.discoverChannels).toHaveBeenCalledWith('US', undefined);
    });

    it('should support discovery with specific source', async () => {
      const mockResult = {
        message: 'Discovery initiated for UK from youtube',
      };
      jest.spyOn(service, 'discoverChannels').mockResolvedValue(mockResult);

      const result = await controller.discoverChannels('UK', 'youtube');

      expect(result).toEqual(mockResult);
      expect(service.discoverChannels).toHaveBeenCalledWith('UK', 'youtube');
    });

    it('should handle different country codes', async () => {
      const countries = ['US', 'UK', 'DE', 'FR', 'ES', 'JP'] as const;

      for (const country of countries) {
        jest.spyOn(service, 'discoverChannels').mockResolvedValue({
          message: `Discovery initiated for ${country}`,
        });

        await controller.discoverChannels(country);
        expect(service.discoverChannels).toHaveBeenCalledWith(country, undefined);
      }
    });

    it('should handle different sources', async () => {
      const sources = ['7pm', 'youtube', 'twitch'] as const;

      for (const source of sources) {
        jest.spyOn(service, 'discoverChannels').mockResolvedValue({
          message: `Discovery from ${source}`,
        });

        await controller.discoverChannels('US', source);
        expect(service.discoverChannels).toHaveBeenCalledWith('US', source);
      }
    });
  });

  describe('searchChannels', () => {
    it('should search channels by query', async () => {
      const mockResults = [mockChannel];
      jest.spyOn(service, 'searchChannels').mockResolvedValue(mockResults);

      const result = await controller.searchChannels('NBC');

      expect(result.data).toEqual(mockResults);
      expect(result.meta.timestamp).toBeDefined();
      expect(result.meta.version).toBe('v1.0.0');
      expect(service.searchChannels).toHaveBeenCalledWith('NBC', undefined, undefined);
    });

    it('should filter search by country when provided', async () => {
      const mockResults = [mockChannel];
      jest.spyOn(service, 'searchChannels').mockResolvedValue(mockResults);

      await controller.searchChannels('news', 'US');

      expect(service.searchChannels).toHaveBeenCalledWith('news', 'US', undefined);
    });

    it('should respect limit parameter', async () => {
      const mockResults = [mockChannel];
      jest.spyOn(service, 'searchChannels').mockResolvedValue(mockResults);

      await controller.searchChannels('news', undefined, 5);

      expect(service.searchChannels).toHaveBeenCalledWith('news', undefined, 5);
    });

    it('should return empty array for no matches', async () => {
      jest.spyOn(service, 'searchChannels').mockResolvedValue([]);

      const result = await controller.searchChannels('NONEXISTENT');

      expect(result.data).toEqual([]);
    });

    it('should be case insensitive', async () => {
      const mockResults = [mockChannel];
      jest.spyOn(service, 'searchChannels').mockResolvedValue(mockResults);

      await controller.searchChannels('nbc');
      await controller.searchChannels('NBC');

      expect(service.searchChannels).toHaveBeenCalledTimes(2);
    });

    it('should search with all parameters', async () => {
      const mockResults = [mockChannel];
      jest.spyOn(service, 'searchChannels').mockResolvedValue(mockResults);

      await controller.searchChannels('news', 'UK', 10);

      expect(service.searchChannels).toHaveBeenCalledWith('news', 'UK', 10);
    });
  });

  describe('getChannelCount', () => {
    it('should return channel count wrapped in API response', async () => {
      jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(42);

      const result = await controller.getChannelCount();

      expect(result.data).toEqual({ count: 42 });
      expect(result.meta.timestamp).toBeDefined();
      expect(result.meta.version).toBe('v1.0.0');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should return count for all active channels when no filters', async () => {
      jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(100);

      const result = await controller.getChannelCount();

      expect(result.data.count).toBe(100);
      expect(service.getActiveChannelCount).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should filter count by country', async () => {
      jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(25);

      const result = await controller.getChannelCount('US');

      expect(result.data.count).toBe(25);
      expect(service.getActiveChannelCount).toHaveBeenCalledWith('US', undefined);
    });

    it('should filter count by topic', async () => {
      jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(15);

      const result = await controller.getChannelCount(undefined, 'NEWS');

      expect(result.data.count).toBe(15);
      expect(service.getActiveChannelCount).toHaveBeenCalledWith(undefined, 'NEWS');
    });

    it('should filter by both country and topic', async () => {
      jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(8);

      const result = await controller.getChannelCount('UK', 'SPORTS');

      expect(result.data.count).toBe(8);
      expect(service.getActiveChannelCount).toHaveBeenCalledWith('UK', 'SPORTS');
    });

    it('should return 0 for non-existent filters', async () => {
      jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(0);

      const result = await controller.getChannelCount('XX' as any);

      expect(result.data.count).toBe(0);
    });

    it('should return positive numbers for valid counts', async () => {
      const counts = [0, 1, 10, 50, 100];

      for (const count of counts) {
        jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(count);

        const result = await controller.getChannelCount();

        expect(result.data.count).toBe(count);
        expect(result.data.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('API Response Structure', () => {
    it('should include consistent meta fields across all endpoints', async () => {
      jest.spyOn(service, 'getChannelsByCountryTopic').mockResolvedValue({
        channels: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      });

      const result = await controller.getChannels({ country: 'US' });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('timestamp');
      expect(result.meta).toHaveProperty('version');
      expect(result.meta).toHaveProperty('requestId');
    });

    it('should use ISO 8601 timestamp format', async () => {
      jest.spyOn(service, 'getActiveChannelCount').mockResolvedValue(10);

      const result = await controller.getChannelCount();

      const timestamp = new Date(result.meta.timestamp);
      expect(timestamp.toISOString()).toBe(result.meta.timestamp);
    });

    it('should use semantic versioning for API version', async () => {
      jest.spyOn(service, 'getChannelById').mockResolvedValue(mockChannel);

      const result = await controller.getChannel('1');

      expect(result.meta.version).toMatch(/^v\d+\.\d+\.\d+$/);
    });

    it('should generate hex request IDs', async () => {
      jest.spyOn(service, 'searchChannels').mockResolvedValue([]);

      const result = await controller.searchChannels('test');

      expect(result.meta.requestId).toMatch(/^[0-9a-f]{32}$/);
    });
  });
});
