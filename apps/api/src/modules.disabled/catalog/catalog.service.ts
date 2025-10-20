import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CountryCode, PaginationParams, TopicType, Channel as ChannelInterface, LiveStream } from '@liveworldtv/shared-types'
import { ChannelListResponse } from './dto/channel-list.dto'
import { Channel } from './entities/channel.entity'

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>
  ) {}

  async getChannelsByCountryTopic(
    country: CountryCode,
    topic?: TopicType,
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<ChannelListResponse> {
    const query = this.channelRepository
      .createQueryBuilder('channel')
      .where('channel.country = :country', { country })
      .andWhere('channel.active = :active', { active: true })

    if (topic) {
      query.andWhere('channel.topic = :topic', { topic })
    }

    // Add pagination
    const offset = (pagination.page - 1) * pagination.limit
    query.skip(offset).take(pagination.limit)

    // Order by most recently seen first (most active channels)
    query.orderBy('channel.lastSeen', 'DESC')

    const [channels, total] = await query.getManyAndCount()

    const result: ChannelListResponse = {
      data: channels,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        hasNext: total > offset + channels.length
      }
    }

    return result
  }

  async getChannelById(id: string): Promise<Channel> {
    const channel = await this.channelRepository.findOne({
      where: { id, active: true }
    })

    if (!channel) {
      throw new NotFoundException(`Channel with ID ${id} not found`)
    }

    return channel
  }

  async getStreamStatus(channelId: string): Promise<LiveStream> {
    // First, verify the channel exists
    const channel = await this.getChannelById(channelId)

    // For YouTube channels, assume live status
    // In production, this would check YouTube API for actual live status
    const stream: LiveStream = {
      id: `stream_${channelId}`,
      channelId: channel.id,
      status: 'LIVE',
      delaySeconds: 30,
      dvrWindowSec: 3600,
      viewerCount: Math.floor(Math.random() * 10000) + 100, // Simulated for now
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
}