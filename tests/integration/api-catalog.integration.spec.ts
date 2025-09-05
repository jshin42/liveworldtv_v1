import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CacheModule } from '@nestjs/cache-manager'
import * as request from 'supertest'
import { AppModule } from '../../apps/api/src/app.module'
import { Channel } from '../../apps/api/src/modules/catalog/entities/channel.entity'
import { Repository } from 'typeorm'
import { getRepositoryToken } from '@nestjs/typeorm'
import { createTestDatabaseConfig, createTestCacheConfig, TestFixtures } from '../../apps/api/src/test/setup'

describe('Catalog API Integration', () => {
  let app: INestApplication
  let channelRepository: Repository<Channel>

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    })
    .overrideModule(TypeOrmModule.forRoot({}))
    .useModule(TypeOrmModule.forRoot(createTestDatabaseConfig()))
    .overrideModule(CacheModule.register({}))
    .useModule(CacheModule.register(createTestCacheConfig()))
    .compile()

    app = moduleFixture.createNestApplication()
    channelRepository = moduleFixture.get<Repository<Channel>>(getRepositoryToken(Channel))
    
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await channelRepository.clear()
  })

  describe('GET /api/catalog/channels/:country', () => {
    beforeEach(async () => {
      await channelRepository.save([
        {
          id: 'us-cnn',
          name: 'CNN International',
          country: 'US',
          language: 'en',
          topic: 'news',
          streamUrl: 'https://cnn.com/live',
          logoUrl: 'https://cnn.com/logo.png',
          isActive: true,
          quality: 'hd'
        },
        {
          id: 'us-espn',
          name: 'ESPN',
          country: 'US',
          language: 'en', 
          topic: 'sports',
          streamUrl: 'https://espn.com/live',
          logoUrl: 'https://espn.com/logo.png',
          isActive: true,
          quality: 'hd'
        },
        {
          id: 'uk-bbc',
          name: 'BBC One',
          country: 'UK',
          language: 'en',
          topic: 'news',
          streamUrl: 'https://bbc.co.uk/live',
          logoUrl: 'https://bbc.co.uk/logo.png',
          isActive: true,
          quality: 'hd'
        }
      ])
    })

    it('should return channels for valid country', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/catalog/channels/US')
        .expect(200)

      expect(response.body.channels).toHaveLength(2)
      expect(response.body.channels.every((ch: any) => ch.country === 'US')).toBe(true)
      expect(response.body.pagination.total).toBe(2)
    })

    it('should filter by topic', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/catalog/channels/US?topic=news')
        .expect(200)

      expect(response.body.channels).toHaveLength(1)
      expect(response.body.channels[0].topic).toBe('news')
    })

    it('should handle pagination', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/api/catalog/channels/US?page=1&limit=1')
        .expect(200)

      const page2 = await request(app.getHttpServer())
        .get('/api/catalog/channels/US?page=2&limit=1')
        .expect(200)

      expect(page1.body.channels).toHaveLength(1)
      expect(page2.body.channels).toHaveLength(1)
      expect(page1.body.channels[0].id).not.toBe(page2.body.channels[0].id)
    })

    it('should return 400 for invalid country', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/channels/INVALID')
        .expect(400)
    })

    it('should return 400 for invalid pagination', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/channels/US?page=0&limit=10')
        .expect(400)
    })

    it('should return empty results for countries with no channels', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/catalog/channels/ZZ')
        .expect(200)

      expect(response.body.channels).toHaveLength(0)
      expect(response.body.pagination.total).toBe(0)
    })
  })

  describe('GET /api/catalog/channels/:id', () => {
    beforeEach(async () => {
      await channelRepository.save({
        id: 'test-channel',
        name: 'Test Channel',
        country: 'US',
        language: 'en',
        topic: 'news',
        streamUrl: 'https://test.com/live',
        logoUrl: 'https://test.com/logo.png',
        isActive: true,
        quality: 'hd'
      })
    })

    it('should return channel by id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/catalog/channels/test-channel')
        .expect(200)

      expect(response.body.id).toBe('test-channel')
      expect(response.body.name).toBe('Test Channel')
    })

    it('should return 404 for non-existent channel', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/channels/non-existent')
        .expect(404)
    })

    it('should handle malformed channel ids', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/channels/')
        .expect(404) // Route not found

      await request(app.getHttpServer())
        .get('/api/catalog/channels/%20%20%20')
        .expect(400)
    })
  })

  describe('caching behavior', () => {
    beforeEach(async () => {
      await channelRepository.save({
        id: 'cache-test',
        name: 'Cache Test Channel', 
        country: 'US',
        language: 'en',
        topic: 'news',
        streamUrl: 'https://cache-test.com/live',
        logoUrl: 'https://cache-test.com/logo.png',
        isActive: true,
        quality: 'hd'
      })
    })

    it('should serve cached responses', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/catalog/channels/US')
        .expect(200)

      const response2 = await request(app.getHttpServer())
        .get('/api/catalog/channels/US')
        .expect(200)

      expect(response1.body).toEqual(response2.body)
      
      // Verify cache headers
      expect(response2.headers['x-cache']).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle database connection failures', async () => {
      // Simulate database failure by closing connection
      await app.get('DataSource').destroy()

      await request(app.getHttpServer())
        .get('/api/catalog/channels/US')
        .expect(500)
    })

    it('should handle malformed requests gracefully', async () => {
      await request(app.getHttpServer())
        .get('/api/catalog/channels/US?limit=abc')
        .expect(400)

      await request(app.getHttpServer())
        .get('/api/catalog/channels/US?page=999999999999')
        .expect(400)
    })
  })
})