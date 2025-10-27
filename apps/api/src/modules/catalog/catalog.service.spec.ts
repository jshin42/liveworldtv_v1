import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { NotFoundException } from '@nestjs/common';

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getChannelsByCountryTopic', () => {
    it('should return US channels when country is US', async () => {
      const result = await service.getChannelsByCountryTopic('US');

      expect(result.channels).toBeDefined();
      expect(result.channels.length).toBeGreaterThan(0);
      expect(result.channels.every(ch => ch.country === 'US')).toBe(true);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: expect.any(Number),
        hasNext: false,
      });
    });

    it('should return UK channels when country is UK', async () => {
      const result = await service.getChannelsByCountryTopic('UK');

      expect(result.channels).toBeDefined();
      expect(result.channels.length).toBeGreaterThan(0);
      expect(result.channels.every(ch => ch.country === 'UK')).toBe(true);
    });

    it('should filter by topic when provided', async () => {
      const result = await service.getChannelsByCountryTopic('US', 'NEWS');

      expect(result.channels).toBeDefined();
      expect(result.channels.every(ch => ch.topic === 'NEWS')).toBe(true);
    });

    it('should return empty array for country with no channels', async () => {
      const result = await service.getChannelsByCountryTopic('XX' as any);

      expect(result.channels).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should respect pagination parameters', async () => {
      const result = await service.getChannelsByCountryTopic('US', undefined, {
        page: 1,
        limit: 2,
      });

      expect(result.channels.length).toBeLessThanOrEqual(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
    });

    it('should handle second page pagination', async () => {
      const result = await service.getChannelsByCountryTopic('US', undefined, {
        page: 2,
        limit: 2,
      });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(2);
    });

    it('should set hasNext correctly when more pages exist', async () => {
      const result = await service.getChannelsByCountryTopic('US', undefined, {
        page: 1,
        limit: 1,
      });

      // If total > 1, hasNext should be true
      if (result.pagination.total > 1) {
        expect(result.pagination.hasNext).toBe(true);
      }
    });

    it('should return all active channels', async () => {
      const result = await service.getChannelsByCountryTopic('US');

      expect(result.channels.every(ch => ch.active === true)).toBe(true);
    });

    it('should return channels with valid YouTube URLs', async () => {
      const result = await service.getChannelsByCountryTopic('US');

      result.channels.forEach(channel => {
        expect(channel.sourceUrl).toContain('youtube.com');
        expect(channel.sourceType).toBe('YOUTUBE_EMBED');
      });
    });
  });

  describe('getChannelById', () => {
    it('should return channel when ID exists', async () => {
      const channel = await service.getChannelById('1');

      expect(channel).toBeDefined();
      expect(channel.id).toBe('1');
      expect(channel.name).toBe('NBC News Now');
    });

    it('should throw NotFoundException when ID does not exist', async () => {
      await expect(service.getChannelById('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with descriptive message', async () => {
      await expect(service.getChannelById('999')).rejects.toThrow(
        'Channel with ID 999 not found',
      );
    });

    it('should return channel with all required fields', async () => {
      const channel = await service.getChannelById('1');

      expect(channel).toMatchObject({
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
    it('should return stream status for valid channel', async () => {
      const stream = await service.getStreamStatus('1');

      expect(stream).toBeDefined();
      expect(stream.channelId).toBe('1');
      expect(stream.status).toBe('LIVE');
    });

    it('should throw NotFoundException for invalid channel', async () => {
      await expect(service.getStreamStatus('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return stream with DVR window', async () => {
      const stream = await service.getStreamStatus('1');

      expect(stream.dvrWindowSec).toBeGreaterThan(0);
      expect(stream.delaySeconds).toBeGreaterThan(0);
    });

    it('should return stream with viewer metrics', async () => {
      const stream = await service.getStreamStatus('1');

      expect(stream.viewerCount).toBeGreaterThanOrEqual(0);
      expect(stream.peakViewerCount).toBeGreaterThanOrEqual(
        stream.viewerCount,
      );
    });

    it('should return stream with quality metrics', async () => {
      const stream = await service.getStreamStatus('1');

      expect(stream.qualityMetrics).toBeDefined();
      expect(typeof stream.qualityMetrics).toBe('object');
    });
  });

  describe('matchUrlToChannel', () => {
    it('should match YouTube channel URL to channel', async () => {
      const url =
        'https://www.youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg';
      const channel = await service.matchUrlToChannel(url);

      expect(channel).toBeDefined();
      expect(channel?.youtubeChannelId).toBe('UCeY0bbntWzzVIaj2z3QigXg');
    });

    it('should return null for non-matching URL', async () => {
      const url = 'https://www.youtube.com/channel/INVALID_ID';
      const channel = await service.matchUrlToChannel(url);

      expect(channel).toBeNull();
    });

    it('should handle different YouTube URL formats', async () => {
      const urls = [
        'https://youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg',
        'https://www.youtube.com/c/UCeY0bbntWzzVIaj2z3QigXg',
      ];

      for (const url of urls) {
        const channel = await service.matchUrlToChannel(url);
        if (channel) {
          expect(channel.youtubeChannelId).toBeTruthy();
        }
      }
    });
  });

  describe('searchChannels', () => {
    it('should find channels by name', async () => {
      const results = await service.searchChannels('NBC');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(ch => ch.name.includes('NBC'))).toBe(true);
    });

    it('should find channels by description', async () => {
      const results = await service.searchChannels('news');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case insensitive', async () => {
      const lowerResults = await service.searchChannels('nbc');
      const upperResults = await service.searchChannels('NBC');

      expect(lowerResults.length).toBe(upperResults.length);
    });

    it('should filter by country when provided', async () => {
      const results = await service.searchChannels('news', 'US');

      expect(results.every(ch => ch.country === 'US')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const results = await service.searchChannels('news', undefined, 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await service.searchChannels('NONEXISTENT_CHANNEL');

      expect(results).toEqual([]);
    });
  });

  describe('getActiveChannelCount', () => {
    it('should return count of all active channels', async () => {
      const count = await service.getActiveChannelCount();

      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should return count for specific country', async () => {
      const count = await service.getActiveChannelCount('US');

      expect(count).toBeGreaterThan(0);
    });

    it('should return count for specific topic', async () => {
      const count = await service.getActiveChannelCount(undefined, 'NEWS');

      expect(count).toBeGreaterThan(0);
    });

    it('should return count for country and topic combination', async () => {
      const count = await service.getActiveChannelCount('US', 'NEWS');

      expect(count).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent country', async () => {
      const count = await service.getActiveChannelCount('XX' as any);

      expect(count).toBe(0);
    });
  });

  describe('discoverChannels', () => {
    it('should return success message', async () => {
      const result = await service.discoverChannels('US');

      expect(result).toBeDefined();
      expect(result.message).toContain('US');
    });

    it('should handle source parameter', async () => {
      const result = await service.discoverChannels('US', 'youtube');

      expect(result.message).toContain('youtube');
    });
  });
});
