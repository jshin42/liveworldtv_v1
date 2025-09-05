import { Injectable, NotFoundException, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Channel, TopicType } from '../../entities/channel.entity'
import { LiveStream } from './entities/live-stream.entity'
import { CountryCode, PaginationParams } from '@liveworldtv/shared-types'
import { ChannelListResponse } from './dto/channel-list.dto'

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    
    @InjectRepository(LiveStream)
    private readonly liveStreamRepository: Repository<LiveStream>,
    
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache
  ) {}

  async getChannelsByCountryTopic(
    country: CountryCode,
    topic?: TopicType,
    pagination: PaginationParams = { page: 1, limit: 20 }
  ): Promise<ChannelListResponse> {
    const cacheKey = `channels:${country}:${topic || 'all'}:${pagination.page}:${pagination.limit}`
    
    // Check cache first
    const cached = await this.cacheManager.get<ChannelListResponse>(cacheKey)
    if (cached) {
      return cached
    }

    // Build query
    const queryBuilder = this.channelRepository
      .createQueryBuilder('channel')
      .leftJoinAndSelect('channel.liveStream', 'live_stream')
      .where('channel.active = :active', { active: true })
      .andWhere('channel.verified = :verified', { verified: true })
      .andWhere('channel.country = :country', { country })

    if (topic) {
      queryBuilder.andWhere('channel.topic = :topic', { topic })
    }

    // Pagination
    const offset = (pagination.page - 1) * pagination.limit
    queryBuilder
      .orderBy('channel.lastSeen', 'DESC')
      .skip(offset)
      .take(pagination.limit)

    // Execute query
    const [channels, total] = await queryBuilder.getManyAndCount()

    const result: ChannelListResponse = {
      data: channels,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        hasNext: offset + channels.length < total
      }
    }

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300000)

    return result
  }

  async getChannelById(id: string): Promise<Channel> {
    const cacheKey = `channel:${id}`
    
    // Check cache
    const cached = await this.cacheManager.get<Channel>(cacheKey)
    if (cached) {
      return cached
    }

    // Query database
    const channel = await this.channelRepository.findOne({
      where: { id, active: true },
      relations: ['liveStream']
    })

    if (!channel) {
      throw new NotFoundException(`Channel with id ${id} not found`)
    }

    // Cache for 10 minutes
    await this.cacheManager.set(cacheKey, channel, 600000)

    return channel
  }

  async getStreamStatus(channelId: string): Promise<LiveStream> {
    const cacheKey = `stream:${channelId}`
    
    // Check cache (short TTL for live data)
    const cached = await this.cacheManager.get<LiveStream>(cacheKey)
    if (cached) {
      return cached
    }

    const stream = await this.liveStreamRepository.findOne({
      where: { channelId },
      relations: ['channel']
    })

    if (!stream) {
      throw new NotFoundException(`Stream for channel ${channelId} not found`)
    }

    // Cache for 1 minute (live data changes frequently)
    await this.cacheManager.set(cacheKey, stream, 60000)

    return stream
  }

  async searchChannels(query: string, country?: CountryCode, limit: number = 10): Promise<Channel[]> {
    const searchQuery = this.channelRepository
      .createQueryBuilder('channel')
      .where('channel.active = :active', { active: true })
      .andWhere('channel.verified = :verified', { verified: true })

    if (country) {
      searchQuery.andWhere('channel.country = :country', { country })
    }

    // Use PostgreSQL full-text search
    if (query.trim()) {
      searchQuery
        .andWhere('channel.search_vector @@ plainto_tsquery(:query)', { query })
        .orderBy('ts_rank(channel.search_vector, plainto_tsquery(:query))', 'DESC')
    } else {
      searchQuery.orderBy('channel.lastSeen', 'DESC')
    }

    return searchQuery.take(limit).getMany()
  }

  async updateChannelLastSeen(channelId: string): Promise<void> {
    await this.channelRepository.update(channelId, {
      lastSeen: new Date()
    })
    
    // Invalidate cache
    await this.cacheManager.del(`channel:${channelId}`)
  }

  async getActiveChannelCount(country?: CountryCode, topic?: TopicType): Promise<number> {
    const cacheKey = `count:${country || 'all'}:${topic || 'all'}`
    
    const cached = await this.cacheManager.get<number>(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const queryBuilder = this.channelRepository
      .createQueryBuilder('channel')
      .where('channel.active = :active', { active: true })
      .andWhere('channel.verified = :verified', { verified: true })

    if (country) {
      queryBuilder.andWhere('channel.country = :country', { country })
    }

    if (topic) {
      queryBuilder.andWhere('channel.topic = :topic', { topic })
    }

    const count = await queryBuilder.getCount()
    
    // Cache for 15 minutes
    await this.cacheManager.set(cacheKey, count, 900000)
    
    return count
  }

  async matchUrlToChannel(url: string): Promise<Channel> {
    const existingChannel = await this.channelRepository.findOne({
      where: { sourceUrl: url }
    });

    if (existingChannel) {
      return existingChannel;
    }

    const normalizedUrl = this.normalizeVideoUrl(url);
    const channelByNormalizedUrl = await this.channelRepository.findOne({
      where: { sourceUrl: normalizedUrl }
    });

    if (channelByNormalizedUrl) {
      return channelByNormalizedUrl;
    }

    throw new NotFoundException('Channel not found for URL');
  }

  async discoverChannels(country: CountryCode, source?: string): Promise<{ jobId: string }> {
    const response = await fetch('http://localhost:3001/api/v1/ingestion/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country,
        source: source || 'youtube',
        priority: 1
      })
    });

    if (!response.ok) {
      throw new Error('Failed to schedule discovery');
    }

    return response.json();
  }

  private normalizeVideoUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname.includes('youtube.com')) {
        const videoId = urlObj.searchParams.get('v');
        return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
      }
      
      if (urlObj.hostname.includes('twitch.tv')) {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        return pathParts.length > 0 ? `https://www.twitch.tv/${pathParts[0]}` : url;
      }

      return url;
    } catch {
      return url;
    }
  }
}