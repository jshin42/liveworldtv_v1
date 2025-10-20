import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogModule } from './catalog.module';
import { Channel } from '../../entities/channel.entity';
import { createTestDatabaseConfig, createTestCacheConfig } from '../../test/setup';

describe('CatalogController (Integration)', () => {
  let app: INestApplication;
  let channelRepository: Repository<Channel>;

  const testChannels = [
    {
      id: 'ch_us_news_001',
      name: 'USA Today News',
      url: 'https://youtube.com/watch?v=usa_news_live',
      description: 'Live breaking news from USA Today',
      language: 'en',
      country: 'US',
      topics: ['news'],
      thumbnailUrl: 'https://test.com/usa_thumb.jpg',
      isLive: true,
      currentViewers: 2500,
      qualityScore: 90,
      totalSessions: 150,
      avgSessionDuration: 240,
      discoveryCount: 10,
      lastChecked: new Date(),
      lastActivity: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ch_uk_news_001',
      name: 'BBC News',
      url: 'https://youtube.com/watch?v=bbc_news_live',
      description: 'BBC World News live stream',
      language: 'en',
      country: 'UK',
      topics: ['news'],
      thumbnailUrl: 'https://test.com/bbc_thumb.jpg',
      isLive: true,
      currentViewers: 5000,
      qualityScore: 95,
      totalSessions: 300,
      avgSessionDuration: 180,
      discoveryCount: 25,
      lastChecked: new Date(),
      lastActivity: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDatabaseConfig()),
        CacheModule.register(createTestCacheConfig()),
        CatalogModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    channelRepository = moduleFixture.get<Repository<Channel>>(getRepositoryToken(Channel));
  });

  beforeEach(async () => {
    // Clean database
    await channelRepository.query('TRUNCATE TABLE "channels" CASCADE');
    
    // Seed test data
    await channelRepository.save(testChannels);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /channels', () => {
    it('should return channels filtered by country', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/channels?country=US&page=1&limit=10')
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].country).toBe('US');
      expect(response.body.data.data[0].name).toBe('USA Today News');
    });

    it('should return channels filtered by country and topic', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/channels?country=UK&topic=news&page=1&limit=10')
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].country).toBe('UK');
      expect(response.body.data.data[0].topics).toContain('news');
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/channels?country=US&page=1&limit=1')
        .expect(200);

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should return 400 for invalid country code', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/channels?country=INVALID')
        .expect(400);
    });

    it('should enforce maximum limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/channels?country=US&limit=9999')
        .expect(200);

      expect(response.body.data.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /channels/:id', () => {
    it('should return channel details for valid ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/channels/ch_us_news_001')
        .expect(200);

      expect(response.body.data.id).toBe('ch_us_news_001');
      expect(response.body.data.name).toBe('USA Today News');
      expect(response.body.meta).toHaveProperty('requestId');
    });

    it('should return 404 for nonexistent channel', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/channels/nonexistent')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/channels/invalid-id')
        .expect(400);
    });
  });

  describe('POST /channels/match-url', () => {
    it('should match exact URL to channel', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/channels/match-url')
        .send({ url: 'https://youtube.com/watch?v=usa_news_live' })
        .expect(200);

      expect(response.body.id).toBe('ch_us_news_001');
      expect(response.body.name).toBe('USA Today News');
    });

    it('should normalize and match YouTube URLs', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/channels/match-url')
        .send({ url: 'https://youtube.com/watch?v=usa_news_live&t=60s&list=xyz' })
        .expect(200);

      expect(response.body.id).toBe('ch_us_news_001');
    });

    it('should return 404 when no channel matches URL', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/channels/match-url')
        .send({ url: 'https://youtube.com/watch?v=nonexistent' })
        .expect(404);
    });

    it('should return 400 for invalid URL format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/channels/match-url')
        .send({ url: 'not-a-url' })
        .expect(400);
    });

    it('should return 400 when URL is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/channels/match-url')
        .send({})
        .expect(400);
    });
  });

  describe('Performance & Caching', () => {
    it('should serve cached results faster than database queries', async () => {
      // First request - cold cache
      const start1 = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/channels?country=US')
        .expect(200);
      const duration1 = Date.now() - start1;

      // Second request - warm cache  
      const start2 = Date.now();
      await request(app.getHttpServer())
        .get('/api/v1/channels?country=US')
        .expect(200);
      const duration2 = Date.now() - start2;

      // Cached request should be faster (allowing some variance)
      expect(duration2).toBeLessThan(duration1 * 0.8);
    });

    it('should handle concurrent requests without race conditions', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/channels?country=US')
          .expect(200)
      );

      const responses = await Promise.all(requests);

      // All responses should be identical
      const firstResponse = responses[0].body;
      responses.slice(1).forEach(response => {
        expect(response.body).toEqual(firstResponse);
      });
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle database connection issues gracefully', async () => {
      // Force close database connection
      const connection = app.get('DataSource');
      await connection.close();

      await request(app.getHttpServer())
        .get('/api/v1/channels?country=US')
        .expect(500);
    });

    it('should validate input parameters strictly', async () => {
      const invalidRequests = [
        '/api/v1/channels?country=ZZ',     // Invalid country
        '/api/v1/channels?topic=invalid',  // Invalid topic  
        '/api/v1/channels?page=-1',        // Negative page
        '/api/v1/channels?limit=0',        // Zero limit
        '/api/v1/channels?page=abc',       // Non-numeric page
      ];

      for (const url of invalidRequests) {
        await request(app.getHttpServer())
          .get(url)
          .expect(400);
      }
    });
  });
});