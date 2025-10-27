import { Injectable, NotFoundException } from '@nestjs/common'
import { CountryCode, PaginationParams, TopicType, Channel, LiveStream } from '@liveworldtv/shared-types'
import { ChannelListDto } from './dto/channel-list.dto'

@Injectable()
export class CatalogService {
  // Mock channel data for initial implementation
  private mockChannels: Channel[] = [
    {
      id: '1',
      name: 'NBC News Now',
      country: 'US',
      topic: 'NEWS',
      sourceType: 'YOUTUBE_EMBED',
      sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCeY0bbntWzzVIaj2z3QigXg',
      youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg',
      description: 'Breaking news and top stories from NBC News',
      thumbnailUrl: '/images/nbc-news-logo.png',
      languageCode: 'en',
      firstSeen: new Date('2025-01-01'),
      lastSeen: new Date(),
      active: true,
      verified: true,
      metadata: { quality: '1080p' },
      contentFingerprint: 'nbc_news_now'
    },
    {
      id: '2',
      name: 'CNN',
      country: 'US',
      topic: 'NEWS',
      sourceType: 'YOUTUBE_EMBED',
      sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCupvZG-5ko_eiXAupbDfxWw',
      youtubeChannelId: 'UCupvZG-5ko_eiXAupbDfxWw',
      description: 'CNN live breaking news coverage',
      thumbnailUrl: '/images/cnn-logo.png',
      languageCode: 'en',
      firstSeen: new Date('2025-01-01'),
      lastSeen: new Date(),
      active: true,
      verified: true,
      metadata: { quality: '1080p' },
      contentFingerprint: 'cnn_live'
    },
    {
      id: '3',
      name: 'BBC News',
      country: 'UK',
      topic: 'NEWS',
      sourceType: 'YOUTUBE_EMBED',
      sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UC16niRr50-MSBwiO3YDb3RA',
      youtubeChannelId: 'UC16niRr50-MSBwiO3YDb3RA',
      description: 'BBC News live coverage from around the world',
      thumbnailUrl: '/images/bbc-logo.png',
      languageCode: 'en',
      firstSeen: new Date('2025-01-01'),
      lastSeen: new Date(),
      active: true,
      verified: true,
      metadata: { quality: '1080p' },
      contentFingerprint: 'bbc_news_live'
    },
    {
      id: '4',
      name: 'Sky News',
      country: 'UK',
      topic: 'NEWS',
      sourceType: 'YOUTUBE_EMBED',
      sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ',
      youtubeChannelId: 'UCoMdktPbSTixAyNGwb-UYkQ',
      description: 'Sky News live coverage',
      thumbnailUrl: '/images/sky-news-logo.png',
      languageCode: 'en',
      firstSeen: new Date('2025-01-01'),
      lastSeen: new Date(),
      active: true,
      verified: true,
      metadata: { quality: '1080p' },
      contentFingerprint: 'sky_news_live'
    },
    {
      id: '5',
      name: 'ABC News',
      country: 'US',
      topic: 'NEWS',
      sourceType: 'YOUTUBE_EMBED',
      sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCBi2mrWuNuyYy4gbM6fU18Q',
      youtubeChannelId: 'UCBi2mrWuNuyYy4gbM6fU18Q',
      description: 'ABC News live coverage',
      thumbnailUrl: '/images/abc-news-logo.png',
      languageCode: 'en',
      firstSeen: new Date('2025-01-01'),
      lastSeen: new Date(),
      active: true,
      verified: true,
      metadata: { quality: '1080p' },
      contentFingerprint: 'abc_news_live'
    }
  ]

  async getChannelsByCountryTopic(
    country: CountryCode,
    topic?: TopicType,
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<ChannelListDto> {
    // Filter channels by country and topic
    let filteredChannels = this.mockChannels.filter(
      channel => channel.country === country && channel.active
    )

    if (topic) {
      filteredChannels = filteredChannels.filter(
        channel => channel.topic === topic
      )
    }

    // Apply pagination
    const offset = (pagination.page - 1) * pagination.limit
    const paginatedChannels = filteredChannels.slice(offset, offset + pagination.limit)
    const total = filteredChannels.length

    return {
      channels: paginatedChannels,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        hasNext: total > offset + paginatedChannels.length
      }
    }
  }

  async getChannelById(id: string): Promise<Channel> {
    const channel = this.mockChannels.find(
      ch => ch.id === id && ch.active
    )

    if (!channel) {
      throw new NotFoundException(`Channel with ID ${id} not found`)
    }

    return channel
  }

  async getStreamStatus(channelId: string): Promise<LiveStream> {
    // First, verify the channel exists
    const channel = await this.getChannelById(channelId)

    // For YouTube channels, assume live status
    const stream: LiveStream = {
      id: `stream_${channelId}`,
      channelId: channel.id,
      status: 'LIVE',
      delaySeconds: 30,
      dvrWindowSec: 3600,
      viewerCount: Math.floor(Math.random() * 10000) + 100,
      peakViewerCount: Math.floor(Math.random() * 15000) + 1000,
      lastChecked: new Date(),
      qualityMetrics: {
        bitrate: '1080p',
        latency: '2-5s',
        stability: 'excellent'
      }
    }

    return stream
  }

  async matchUrlToChannel(url: string): Promise<Channel | null> {
    // Extract YouTube channel ID from URL
    const channelIdMatch = url.match(/channel[=/]([a-zA-Z0-9_-]+)/)
    const videoIdMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/)

    if (channelIdMatch) {
      const channelId = channelIdMatch[1]
      return this.mockChannels.find(ch => ch.youtubeChannelId === channelId) || null
    }

    return null
  }

  async discoverChannels(country: CountryCode, source?: '7pm' | 'youtube' | 'twitch'): Promise<{ message: string }> {
    // Placeholder for channel discovery
    return {
      message: `Discovery initiated for ${country} from ${source || 'all sources'}`
    }
  }

  async searchChannels(query: string, country?: CountryCode, limit: number = 10): Promise<Channel[]> {
    let channels = this.mockChannels.filter(ch => ch.active)

    if (country) {
      channels = channels.filter(ch => ch.country === country)
    }

    // Simple text search
    const searchTerm = query.toLowerCase()
    channels = channels.filter(ch =>
      ch.name.toLowerCase().includes(searchTerm) ||
      ch.description?.toLowerCase().includes(searchTerm)
    )

    return channels.slice(0, limit)
  }

  async getActiveChannelCount(country?: CountryCode, topic?: TopicType): Promise<number> {
    let channels = this.mockChannels.filter(ch => ch.active)

    if (country) {
      channels = channels.filter(ch => ch.country === country)
    }

    if (topic) {
      channels = channels.filter(ch => ch.topic === topic)
    }

    return channels.length
  }
}