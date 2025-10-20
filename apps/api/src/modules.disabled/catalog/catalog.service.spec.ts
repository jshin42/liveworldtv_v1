import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Channel } from '../../entities/channel.entity';
import { LiveStream } from './entities/live-stream.entity';

describe('CatalogService', () => {
  let service: CatalogService;
  let channelRepository: jest.Mocked<Repository<Channel>>;
  let cacheManager: jest.Mocked<any>;

  const mockChannel: Partial<Channel> = {
    id: 'ch_123',
    name: 'Test Channel',
    sourceUrl: 'https://youtube.com/watch?v=test123',
    description: 'Test channel description',
    languageCode: 'eng',
    country: 'US',
    topic: 'NEWS' as any,
    sourceType: 'YOUTUBE_EMBED' as any,
    thumbnailUrl: 'https://test.com/thumb.jpg',
    active: true,
    verified: true,
    contentFingerprint: 'test_fingerprint',
    firstSeen: new Date('2024-01-01T00:00:00Z'),
    lastSeen: new Date('2024-01-01T11:45:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z'),
    metadata: {}
  };

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      findByIds: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0)
      })),
      update: jest.fn()
    };

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: getRepositoryToken(Channel),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(LiveStream),
          useValue: mockRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    channelRepository = module.get(getRepositoryToken(Channel));
    cacheManager = module.get(CACHE_MANAGER);
  });

  describe('getChannelsByCountryTopic', () => {
    it('should return cached results when available', async () => {
      const cachedResult = {
        data: [mockChannel],
        pagination: { page: 1, limit: 20, total: 1, hasNext: false }
      };
      
      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.getChannelsByCountryTopic('US');

      expect(result).toEqual(cachedResult);
      expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should query database when cache miss and cache results', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      const queryBuilder = channelRepository.createQueryBuilder() as any;
      queryBuilder.getManyAndCount.mockResolvedValue([[mockChannel], 1]);

      const result = await service.getChannelsByCountryTopic('US', 'news', { page: 1, limit: 20 });

      expect(queryBuilder.where).toHaveBeenCalledWith('channel.active = :active', { active: true });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('channel.country = :country', { country: 'US' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('channel.topic = :topic', { topic: 'news' });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'channels:US:news:1:20',
        expect.objectContaining({ data: [mockChannel] }),
        300000
      );
    });

    it('should handle pagination correctly', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      const queryBuilder = channelRepository.createQueryBuilder() as any;
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.getChannelsByCountryTopic('US', undefined, { page: 3, limit: 10 });

      expect(queryBuilder.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getChannelById', () => {
    it('should return channel when found', async () => {
      cacheManager.get.mockResolvedValue(null);
      channelRepository.findOne.mockResolvedValue(mockChannel);

      const result = await service.getChannelById('ch_123');

      expect(result).toEqual(mockChannel);
      expect(channelRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'ch_123', active: true },
        relations: ['liveStream']
      });
    });

    it('should throw NotFoundException when channel not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      channelRepository.findOne.mockResolvedValue(null);

      await expect(service.getChannelById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should cache successful lookups', async () => {
      cacheManager.get.mockResolvedValue(null);
      channelRepository.findOne.mockResolvedValue(mockChannel);

      await service.getChannelById('ch_123');

      expect(cacheManager.set).toHaveBeenCalledWith('channel:ch_123', mockChannel, 600000);
    });
  });

  describe('matchUrlToChannel', () => {
    it('should find exact URL match', async () => {
      channelRepository.findOne.mockResolvedValue(mockChannel);

      const result = await service.matchUrlToChannel('https://youtube.com/watch?v=test123');

      expect(result).toEqual(mockChannel);
      expect(channelRepository.findOne).toHaveBeenCalledWith({
        where: { sourceUrl: 'https://youtube.com/watch?v=test123' }
      });
    });

    it('should normalize YouTube URLs and find match', async () => {
      channelRepository.findOne
        .mockResolvedValueOnce(null) // First call fails
        .mockResolvedValueOnce(mockChannel); // Second call succeeds

      const result = await service.matchUrlToChannel('https://youtube.com/watch?v=test123&t=30s');

      expect(result).toEqual(mockChannel);
      expect(channelRepository.findOne).toHaveBeenCalledTimes(2);
      expect(channelRepository.findOne).toHaveBeenLastCalledWith({
        where: { sourceUrl: 'https://www.youtube.com/watch?v=test123' }
      });
    });

    it('should normalize Twitch URLs correctly', async () => {
      channelRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockChannel,
          url: 'https://www.twitch.tv/teststreamer'
        });

      const result = await service.matchUrlToChannel('https://twitch.tv/teststreamer/profile');

      expect(channelRepository.findOne).toHaveBeenLastCalledWith({
        where: { sourceUrl: 'https://www.twitch.tv/teststreamer' }
      });
    });

    it('should throw NotFoundException when no match found', async () => {
      channelRepository.findOne.mockResolvedValue(null);

      await expect(
        service.matchUrlToChannel('https://unsupported.com/video')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchChannels', () => {
    it('should perform full-text search with PostgreSQL', async () => {
      const queryBuilder = channelRepository.createQueryBuilder() as any;
      queryBuilder.getMany.mockResolvedValue([mockChannel]);

      const result = await service.searchChannels('news', 'US', 5);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'channel.search_vector @@ plainto_tsquery(:query)', 
        { query: 'news' }
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'ts_rank(channel.search_vector, plainto_tsquery(:query))', 
        'DESC'
      );
      expect(queryBuilder.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual([mockChannel]);
    });

    it('should filter by country when specified', async () => {
      const queryBuilder = channelRepository.createQueryBuilder() as any;
      queryBuilder.getMany.mockResolvedValue([]);

      await service.searchChannels('test', 'DE');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('channel.country = :country', { country: 'DE' });
    });

    it('should handle empty search query', async () => {
      const queryBuilder = channelRepository.createQueryBuilder() as any;
      queryBuilder.getMany.mockResolvedValue([]);

      await service.searchChannels('   ', 'US');

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('channel.lastSeen', 'DESC');
      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('search_vector'), 
        expect.anything()
      );
    });
  });
});