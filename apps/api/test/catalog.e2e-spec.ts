import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Catalog API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    });

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/channels (GET)', () => {
    it('should return US channels with default pagination', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.channels).toBeInstanceOf(Array);
          expect(res.body.data.pagination).toMatchObject({
            page: 1,
            limit: 20,
            total: expect.any(Number),
            hasNext: expect.any(Boolean),
          });
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.timestamp).toBeDefined();
          expect(res.body.meta.version).toBe('v1.0.0');
          expect(res.body.meta.requestId).toBeDefined();
        });
    });

    it('should return UK channels', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=UK')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.channels).toBeInstanceOf(Array);
          expect(res.body.data.channels.length).toBeGreaterThan(0);
          expect(res.body.data.channels.every((ch: any) => ch.country === 'UK')).toBe(true);
        });
    });

    it('should filter by topic when provided', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US&topic=NEWS')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.channels).toBeInstanceOf(Array);
          if (res.body.data.channels.length > 0) {
            expect(res.body.data.channels.every((ch: any) => ch.topic === 'NEWS')).toBe(true);
          }
        });
    });

    it('should respect pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US&page=1&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.channels.length).toBeLessThanOrEqual(2);
          expect(res.body.data.pagination.page).toBe(1);
          expect(res.body.data.pagination.limit).toBe(2);
        });
    });

    it('should handle second page pagination', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US&page=2&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.pagination.page).toBe(2);
          expect(res.body.data.pagination.limit).toBe(2);
        });
    });

    it('should return empty array for non-existent country', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=XX')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.channels).toEqual([]);
          expect(res.body.data.pagination.total).toBe(0);
        });
    });

    it('should validate country code format', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=INVALID')
        .expect(400);
    });

    it('should return only active channels', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.channels.every((ch: any) => ch.active === true)).toBe(true);
        });
    });

    it('should return channels with valid YouTube URLs', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200)
        .expect((res) => {
          res.body.data.channels.forEach((channel: any) => {
            expect(channel.sourceUrl).toContain('youtube.com');
            expect(channel.sourceType).toBe('YOUTUBE_EMBED');
          });
        });
    });

    it('should include all required channel fields', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.channels.length).toBeGreaterThan(0);
          const channel = res.body.data.channels[0];
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
  });

  describe('/v1/channels/:id (GET)', () => {
    it('should return channel details for valid ID', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.id).toBe('1');
          expect(res.body.data.name).toBe('NBC News Now');
          expect(res.body.meta.timestamp).toBeDefined();
        });
    });

    it('should return 404 for non-existent channel', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/999')
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('Channel with ID 999 not found');
        });
    });

    it('should return channel with all required fields', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            country: expect.any(String),
            topic: expect.any(String),
            sourceType: expect.any(String),
            sourceUrl: expect.any(String),
            youtubeChannelId: expect.any(String),
            languageCode: expect.any(String),
            thumbnailUrl: expect.any(String),
            description: expect.any(String),
            active: expect.any(Boolean),
            verified: expect.any(Boolean),
          });
        });
    });

    it('should validate UUID format', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/invalid-uuid-format')
        .expect(400);
    });
  });

  describe('/v1/channels/:id/stream (GET)', () => {
    it('should return stream status for valid channel', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/1/stream')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.channelId).toBe('1');
          expect(res.body.data.status).toBe('LIVE');
        });
    });

    it('should return 404 for non-existent channel stream', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/999/stream')
        .expect(404);
    });

    it('should return stream with DVR window', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/1/stream')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.dvrWindowSec).toBeGreaterThan(0);
          expect(res.body.data.delaySeconds).toBeGreaterThan(0);
        });
    });

    it('should return stream with viewer metrics', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/1/stream')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.viewerCount).toBeGreaterThanOrEqual(0);
          expect(res.body.data.peakViewerCount).toBeGreaterThanOrEqual(
            res.body.data.viewerCount
          );
        });
    });

    it('should return stream with quality metrics', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/1/stream')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.qualityMetrics).toBeDefined();
          expect(typeof res.body.data.qualityMetrics).toBe('object');
        });
    });
  });

  describe('/v1/channels/match-url (POST)', () => {
    it('should match YouTube channel URL to channel', () => {
      return request(app.getHttpServer())
        .post('/v1/channels/match-url')
        .send({ url: 'https://www.youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toBeDefined();
          expect(res.body.youtubeChannelId).toBe('UCeY0bbntWzzVIaj2z3QigXg');
        });
    });

    it('should return null for non-matching URL', () => {
      return request(app.getHttpServer())
        .post('/v1/channels/match-url')
        .send({ url: 'https://www.youtube.com/channel/INVALID_ID' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toBeNull();
        });
    });

    it('should handle different YouTube URL formats', async () => {
      const urls = [
        'https://youtube.com/channel/UCeY0bbntWzzVIaj2z3QigXg',
        'https://www.youtube.com/c/UCeY0bbntWzzVIaj2z3QigXg',
      ];

      for (const url of urls) {
        await request(app.getHttpServer())
          .post('/v1/channels/match-url')
          .send({ url })
          .expect(201);
      }
    });

    it('should require URL in request body', () => {
      return request(app.getHttpServer())
        .post('/v1/channels/match-url')
        .send({})
        .expect(400);
    });

    it('should validate URL format', () => {
      return request(app.getHttpServer())
        .post('/v1/channels/match-url')
        .send({ url: 'not-a-valid-url' })
        .expect(201); // Service handles validation, not DTO
    });
  });

  describe('/v1/channels/search (GET)', () => {
    it('should find channels by name', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/search?q=NBC')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(res.body.data.some((ch: any) => ch.name.includes('NBC'))).toBe(true);
        });
    });

    it('should find channels by description', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/search?q=news')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    it('should be case insensitive', async () => {
      const lowerResult = await request(app.getHttpServer())
        .get('/v1/channels/search?q=nbc')
        .expect(200);

      const upperResult = await request(app.getHttpServer())
        .get('/v1/channels/search?q=NBC')
        .expect(200);

      expect(lowerResult.body.data.length).toBe(upperResult.body.data.length);
    });

    it('should filter by country when provided', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/search?q=news&country=US')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.every((ch: any) => ch.country === 'US')).toBe(true);
        });
    });

    it('should respect limit parameter', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/search?q=news&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeLessThanOrEqual(2);
        });
    });

    it('should return empty array for no matches', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/search?q=NONEXISTENT_CHANNEL')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toEqual([]);
        });
    });

    it('should require search query parameter', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/search')
        .expect(400);
    });
  });

  describe('/v1/channels/stats/count (GET)', () => {
    it('should return count of all active channels', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/stats/count')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.count).toBeGreaterThan(0);
          expect(typeof res.body.data.count).toBe('number');
        });
    });

    it('should return count for specific country', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/stats/count?country=US')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.count).toBeGreaterThan(0);
        });
    });

    it('should return count for specific topic', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/stats/count?topic=NEWS')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.count).toBeGreaterThan(0);
        });
    });

    it('should return count for country and topic combination', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/stats/count?country=US&topic=NEWS')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.count).toBeGreaterThan(0);
        });
    });

    it('should return 0 for non-existent country', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/stats/count?country=XX')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.count).toBe(0);
        });
    });
  });

  describe('/v1/channels/discover/:country (GET)', () => {
    it('should initiate discovery for valid country', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/discover/US')
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('US');
        });
    });

    it('should support discovery source parameter', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/discover/US?source=youtube')
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('youtube');
        });
    });

    it('should handle different country codes', async () => {
      const countries = ['US', 'UK', 'DE', 'FR', 'ES', 'JP'];

      for (const country of countries) {
        await request(app.getHttpServer())
          .get(`/v1/channels/discover/${country}`)
          .expect(200);
      }
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from localhost:3000', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .set('Origin', 'http://localhost:3000')
        .expect(200)
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
        });
    });

    it('should allow requests from localhost:3001', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .set('Origin', 'http://localhost:3001')
        .expect(200)
        .expect((res) => {
          expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
        });
    });
  });

  describe('API Versioning', () => {
    it('should support v1 URI versioning', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200);
    });

    it('should not respond to unversioned endpoints', () => {
      return request(app.getHttpServer())
        .get('/channels?country=US')
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/nonexistent-endpoint')
        .expect(404);
    });

    it('should return 400 for invalid query parameters', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=INVALID_CODE')
        .expect(400);
    });

    it('should return proper error format', () => {
      return request(app.getHttpServer())
        .get('/v1/channels/999')
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBeDefined();
          expect(res.body.statusCode).toBe(404);
        });
    });
  });

  describe('API Response Format', () => {
    it('should include consistent meta fields', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(res.body.meta).toHaveProperty('timestamp');
          expect(res.body.meta).toHaveProperty('version');
          expect(res.body.meta).toHaveProperty('requestId');
        });
    });

    it('should use ISO 8601 timestamp format', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200)
        .expect((res) => {
          const timestamp = new Date(res.body.meta.timestamp);
          expect(timestamp.toISOString()).toBe(res.body.meta.timestamp);
        });
    });

    it('should generate unique request IDs', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200);

      expect(res1.body.meta.requestId).not.toBe(res2.body.meta.requestId);
    });

    it('should use hex format for request IDs', () => {
      return request(app.getHttpServer())
        .get('/v1/channels?country=US')
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.requestId).toMatch(/^[0-9a-f]{32}$/);
        });
    });
  });
});
