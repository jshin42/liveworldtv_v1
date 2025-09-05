import { Injectable, NotFoundException } from '@nestjs/common'
import { CountryCode, PaginationParams, TopicType, Channel, LiveStream } from '@liveworldtv/shared-types'
import { ChannelListResponse } from './dto/channel-list.dto'

@Injectable()
export class CatalogService {
  constructor() {}

  async getChannelsByCountryTopic(
    country: CountryCode,
    topic?: TopicType,
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<ChannelListResponse> {
    // For MVP, return mock data until entities compile
    const mockChannels = [
      {
        id: '1',
        name: 'CNN International',
        country,
        topic: topic || 'NEWS',
        sourceType: 'YOUTUBE_EMBED',
        sourceUrl: 'https://www.youtube.com/watch?v=live_stream_id',
        languageCode: 'en',
        active: true,
        verified: true,
        firstSeen: new Date(),
        lastSeen: new Date(),
        metadata: {},
        contentFingerprint: 'mock'
      }
    ] as any[]

    const result: ChannelListResponse = {
      data: mockChannels,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: 1,
        hasNext: false
      }
    }

    return result
  }

  async getChannelById(id: string): Promise<Channel> {
    // Mock implementation for MVP
    const mockChannel = {
      id,
      name: 'CNN International',
      country: 'US',
      topic: 'NEWS',
      sourceType: 'YOUTUBE_EMBED',
      sourceUrl: 'https://www.youtube.com/watch?v=live_stream_id',
      languageCode: 'en',
      active: true,
      verified: true,
      firstSeen: new Date(),
      lastSeen: new Date(),
      metadata: {},
      contentFingerprint: 'mock'
    } as Channel

    return mockChannel
  }

  async getStreamStatus(channelId: string): Promise<LiveStream> {
    const mockStream = {
      id: '1',
      channelId,
      status: 'LIVE',
      delaySeconds: 30,
      dvrWindowSec: 3600,
      viewerCount: 1000,
      peakViewerCount: 1200,
      lastChecked: new Date(),
      qualityMetrics: {}
    } as LiveStream

    return mockStream
  }
}