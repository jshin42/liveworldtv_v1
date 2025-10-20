import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Channel } from '../../entities/channel.entity';
import { AnalyticsEvent } from '../../entities/analytics-event.entity';
import { RankingResponse, CountryCode, TopicType } from '../../../../../packages/shared-types/src';

@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
    @InjectRepository(AnalyticsEvent)
    private analyticsRepository: Repository<AnalyticsEvent>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getTrendingChannels(
    country?: CountryCode,
    topic?: TopicType,
    timeWindow: '1h' | '24h' | '7d' = '24h'
  ): Promise<RankingResponse> {
    const cacheKey = `trending:${country || 'global'}:${topic || 'all'}:${timeWindow}`;
    
    const cached = await this.cacheManager.get<RankingResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const timeWindowMs = this.getTimeWindowMs(timeWindow);
    const cutoffTime = new Date(Date.now() - timeWindowMs);

    const query = this.analyticsRepository
      .createQueryBuilder('event')
      .select('event.channel_id', 'channelId')
      .addSelect('COUNT(*)', 'viewCount')
      .addSelect('AVG(event.session_duration)', 'avgDuration')
      .innerJoin('event.channel', 'channel')
      .where('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
      .andWhere('event.created_at >= :cutoffTime', { cutoffTime })
      .groupBy('event.channel_id')
      .orderBy('viewCount', 'DESC')
      .limit(50);

    if (country) {
      query.andWhere('channel.country = :country', { country });
    }

    if (topic) {
      query.andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
    }

    const rawResults = await query.getRawMany();

    const channelIds = rawResults.map(result => result.channelId);
    const channels = await this.channelRepository.findByIds(channelIds);
    const channelMap = new Map(channels.map(channel => [channel.id, channel]));

    const rankings = rawResults
      .map(result => {
        const channel = channelMap.get(result.channelId);
        if (!channel) return null;

        return {
          rank: 0, // Will be set below
          channel: {
            id: channel.id,
            name: channel.name,
            description: channel.description,
            url: channel.url,
            language: channel.language,
            country: channel.country,
            topics: channel.topics,
            qualityScore: channel.qualityScore,
            lastChecked: channel.lastChecked
          },
          metrics: {
            viewCount: parseInt(result.viewCount),
            avgSessionDuration: Math.round(parseFloat(result.avgDuration) || 0),
            trendScore: this.calculateTrendScore(
              parseInt(result.viewCount),
              parseFloat(result.avgDuration) || 0,
              timeWindow
            )
          }
        };
      })
      .filter(item => item !== null)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const response: RankingResponse = {
      rankings,
      metadata: {
        timeWindow,
        country: country || null,
        topic: topic || null,
        totalChannels: rankings.length,
        lastUpdated: new Date().toISOString()
      }
    };

    await this.cacheManager.set(cacheKey, response, 300000); // 5 minutes
    return response;
  }

  async getChannelRank(channelId: string, country?: CountryCode, topic?: TopicType): Promise<number | null> {
    const rankings = await this.getTrendingChannels(country, topic, '24h');
    const channelRanking = rankings.rankings.find(r => r.channel.id === channelId);
    return channelRanking?.rank || null;
  }

  async getPersonalizedRankings(
    userId: string,
    country?: CountryCode,
    topic?: TopicType
  ): Promise<RankingResponse> {
    const cacheKey = `personalized:${userId}:${country || 'global'}:${topic || 'all'}`;
    
    const cached = await this.cacheManager.get<RankingResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const userPreferences = await this.getUserPreferences(userId);
    const globalTrending = await this.getTrendingChannels(country, topic, '24h');

    const personalizedRankings = globalTrending.rankings
      .map(ranking => ({
        ...ranking,
        metrics: {
          ...ranking.metrics,
          trendScore: this.adjustTrendScoreForUser(
            ranking.metrics.trendScore,
            ranking.channel,
            userPreferences
          )
        }
      }))
      .sort((a, b) => b.metrics.trendScore - a.metrics.trendScore)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const response: RankingResponse = {
      rankings: personalizedRankings,
      metadata: {
        ...globalTrending.metadata,
        personalized: true,
        userId
      }
    };

    await this.cacheManager.set(cacheKey, response, 600000); // 10 minutes
    return response;
  }

  private getTimeWindowMs(timeWindow: '1h' | '24h' | '7d'): number {
    switch (timeWindow) {
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private calculateTrendScore(viewCount: number, avgDuration: number, timeWindow: string): number {
    const baseScore = viewCount * (avgDuration / 60);
    
    const timeWindowMultiplier = {
      '1h': 10,
      '24h': 1,
      '7d': 0.1
    }[timeWindow] || 1;

    return Math.round(baseScore * timeWindowMultiplier);
  }

  private async getUserPreferences(userId: string): Promise<any> {
    return {
      preferredLanguages: ['en'],
      preferredTopics: [],
      watchHistory: []
    };
  }

  private adjustTrendScoreForUser(baseScore: number, channel: any, userPrefs: any): number {
    let adjustedScore = baseScore;

    if (userPrefs.preferredLanguages.includes(channel.language)) {
      adjustedScore *= 1.2;
    }

    if (userPrefs.preferredTopics.some((topic: string) => channel.topics.includes(topic))) {
      adjustedScore *= 1.5;
    }

    return Math.round(adjustedScore);
  }
}