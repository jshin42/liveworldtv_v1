import { Test } from '@nestjs/testing'
import { CacheModule } from '@nestjs/cache-manager'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'
import { CountryCode, TopicType } from '@liveworldtv/shared-types'
import { createTestCacheConfig } from '../../test/setup'

describe('CatalogController', () => {
  let controller: CatalogController
  let catalogService: jest.Mocked<CatalogService>

  const mockChannelResponse = {
    channels: [
      {
        id: 'test-1',
        name: 'Test Channel',
        country: 'US' as CountryCode,
        language: 'en',
        topic: 'news' as TopicType,
        streamUrl: 'https://test.com/stream',
        logoUrl: 'https://test.com/logo.png',
        isActive: true,
        quality: 'hd'
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    }
  }

  beforeEach(async () => {
    const mockCatalogService = {
      getChannelsByCountryTopic: jest.fn(),
      getChannelById: jest.fn()
    }

    const module = await Test.createTestingModule({
      imports: [CacheModule.register(createTestCacheConfig())],
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: mockCatalogService
        }
      ]
    }).compile()

    controller = module.get<CatalogController>(CatalogController)
    catalogService = module.get(CatalogService)
  })

  describe('getChannels', () => {
    it('should return channels for valid country', async () => {
      catalogService.getChannelsByCountryTopic.mockResolvedValue(mockChannelResponse)

      const result = await controller.getChannels('US')

      expect(result).toEqual(mockChannelResponse)
      expect(catalogService.getChannelsByCountryTopic).toHaveBeenCalledWith('US', undefined, { page: 1, limit: 20 })
    })

    it('should handle pagination parameters', async () => {
      catalogService.getChannelsByCountryTopic.mockResolvedValue(mockChannelResponse)

      await controller.getChannels('US', 'news', 2, 50)

      expect(catalogService.getChannelsByCountryTopic).toHaveBeenCalledWith('US', 'news', { page: 2, limit: 50 })
    })

    it('should throw for invalid country code', async () => {
      await expect(
        controller.getChannels('INVALID' as any)
      ).rejects.toThrow()
    })

    it('should enforce pagination limits', async () => {
      await expect(
        controller.getChannels('US', undefined, 1, 1000)
      ).rejects.toThrow('Limit cannot exceed 100')
    })

    it('should handle service errors gracefully', async () => {
      catalogService.getChannelsByCountryTopic.mockRejectedValue(new Error('Database error'))

      await expect(
        controller.getChannels('US')
      ).rejects.toThrow('Database error')
    })
  })

  describe('getChannel', () => {
    it('should return channel by id', async () => {
      const mockChannel = mockChannelResponse.channels[0]
      catalogService.getChannelById.mockResolvedValue(mockChannel)

      const result = await controller.getChannel('test-1')

      expect(result).toEqual(mockChannel)
      expect(catalogService.getChannelById).toHaveBeenCalledWith('test-1')
    })

    it('should handle non-existent channel', async () => {
      catalogService.getChannelById.mockResolvedValue(null)

      const result = await controller.getChannel('non-existent')

      expect(result).toBeNull()
    })

    it('should validate channel id format', async () => {
      await expect(
        controller.getChannel('')
      ).rejects.toThrow()
    })
  })
})