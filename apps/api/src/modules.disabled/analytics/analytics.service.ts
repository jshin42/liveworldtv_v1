import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AnalyticsEvent } from '../../entities/analytics-event.entity';
import { Channel } from '../../entities/channel.entity';
import { 
  AnalyticsEventRequest,
  AnalyticsEventResponse,
  AnalyticsMetrics,
  CountryCode,
  TopicType 
} from '../../../../../packages/shared-types/src';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsRepository: Repository<AnalyticsEvent>,
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
    @InjectQueue('analytics') private analyticsQueue: Queue,
  ) {}

  async recordEvent(eventData: AnalyticsEventRequest): Promise<AnalyticsEventResponse> {
    const event = this.analyticsRepository.create({
      sessionId: eventData.sessionId,
      eventType: eventData.eventType,
      channelId: eventData.channelId,
      metadata: eventData.metadata,
      createdAt: new Date()
    });

    const savedEvent = await this.analyticsRepository.save(event);

    await this.analyticsQueue.add('process-event', {
      eventId: savedEvent.id,
      eventType: eventData.eventType,
      channelId: eventData.channelId
    });

    return {
      id: savedEvent.id,
      success: true,
      timestamp: savedEvent.createdAt.toISOString()
    };
  }

  async getChannelMetrics(
    channelId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsMetrics> {
    const events = await this.analyticsRepository
      .createQueryBuilder('event')
      .where('event.channel_id = :channelId', { channelId })
      .andWhere('event.created_at >= :startDate', { startDate })
      .andWhere('event.created_at <= :endDate', { endDate })
      .getMany();

    const sessions = new Set(events.map(e => e.sessionId)).size;
    const dubbingStarted = events.filter(e => e.eventType === 'DUBBING_STARTED').length;
    const dubbingCompleted = events.filter(e => e.eventType === 'DUBBING_STOPPED').length;

    const sessionDurations = events
      .filter(e => e.sessionDuration && e.sessionDuration > 0)
      .map(e => e.sessionDuration!);

    const avgSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0;

    const maxSessionDuration = sessionDurations.length > 0 
      ? Math.max(...sessionDurations) 
      : 0;

    return {
      channelId,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      totalSessions: sessions,
      totalDubbingStarted: dubbingStarted,
      totalDubbingCompleted: dubbingCompleted,
      avgSessionDuration: Math.round(avgSessionDuration),
      maxSessionDuration,
      completionRate: dubbingStarted > 0 ? (dubbingCompleted / dubbingStarted) * 100 : 0,
      popularLanguages: await this.getPopularLanguages(channelId, startDate, endDate),
      hourlyDistribution: await this.getHourlyDistribution(channelId, startDate, endDate)
    };
  }

  async getGlobalMetrics(
    startDate: Date,
    endDate: Date,
    country?: CountryCode,
    topic?: TopicType
  ): Promise<AnalyticsMetrics> {
    const query = this.analyticsRepository
      .createQueryBuilder('event')
      .where('event.created_at >= :startDate', { startDate })
      .andWhere('event.created_at <= :endDate', { endDate });

    if (country) {
      query.innerJoin('event.channel', 'channel')
        .andWhere('channel.country = :country', { country });
    }

    if (topic) {
      query.innerJoin('event.channel', 'channel')
        .andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
    }

    const events = await query.getMany();

    const uniqueChannels = new Set(events.map(e => e.channelId)).size;
    const sessions = new Set(events.map(e => e.sessionId)).size;
    const dubbingStarted = events.filter(e => e.eventType === 'DUBBING_STARTED').length;
    const dubbingCompleted = events.filter(e => e.eventType === 'DUBBING_STOPPED').length;

    const sessionDurations = events
      .filter(e => e.sessionDuration && e.sessionDuration > 0)
      .map(e => e.sessionDuration!);

    const avgSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0;

    return {
      channelId: 'global',
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      totalSessions: sessions,
      totalDubbingStarted: dubbingStarted,
      totalDubbingCompleted: dubbingCompleted,
      avgSessionDuration: Math.round(avgSessionDuration),
      maxSessionDuration: sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0,
      completionRate: dubbingStarted > 0 ? (dubbingCompleted / dubbingStarted) * 100 : 0,
      uniqueChannels,
      popularLanguages: await this.getPopularLanguagesGlobal(startDate, endDate, country, topic),
      hourlyDistribution: await this.getHourlyDistributionGlobal(startDate, endDate, country, topic)
    };
  }

  private async getPopularLanguages(channelId: string, startDate: Date, endDate: Date): Promise<Array<{language: string, count: number}>> {
    const results = await this.analyticsRepository
      .createQueryBuilder('event')
      .select("event.metadata->>'targetLanguage'", 'language')
      .addSelect('COUNT(*)', 'count')
      .where('event.channel_id = :channelId', { channelId })
      .andWhere('event.created_at >= :startDate', { startDate })
      .andWhere('event.created_at <= :endDate', { endDate })
      .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
      .andWhere("event.metadata->>'targetLanguage' IS NOT NULL")
      .groupBy("event.metadata->>'targetLanguage'")
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return results.map(result => ({
      language: result.language,
      count: parseInt(result.count)
    }));
  }

  private async getPopularLanguagesGlobal(
    startDate: Date, 
    endDate: Date, 
    country?: CountryCode, 
    topic?: TopicType
  ): Promise<Array<{language: string, count: number}>> {
    const query = this.analyticsRepository
      .createQueryBuilder('event')
      .select("event.metadata->>'targetLanguage'", 'language')
      .addSelect('COUNT(*)', 'count')
      .where('event.created_at >= :startDate', { startDate })
      .andWhere('event.created_at <= :endDate', { endDate })
      .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
      .andWhere("event.metadata->>'targetLanguage' IS NOT NULL");

    if (country) {
      query.innerJoin('event.channel', 'channel')
        .andWhere('channel.country = :country', { country });
    }

    if (topic) {
      query.innerJoin('event.channel', 'channel')
        .andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
    }

    const results = await query
      .groupBy("event.metadata->>'targetLanguage'")
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return results.map(result => ({
      language: result.language,
      count: parseInt(result.count)
    }));
  }

  private async getHourlyDistribution(channelId: string, startDate: Date, endDate: Date): Promise<Array<{hour: number, count: number}>> {
    const results = await this.analyticsRepository
      .createQueryBuilder('event')
      .select('EXTRACT(HOUR FROM event.created_at)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('event.channel_id = :channelId', { channelId })
      .andWhere('event.created_at >= :startDate', { startDate })
      .andWhere('event.created_at <= :endDate', { endDate })
      .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
      .groupBy('EXTRACT(HOUR FROM event.created_at)')
      .orderBy('hour', 'ASC')
      .getRawMany();

    return results.map(result => ({
      hour: parseInt(result.hour),
      count: parseInt(result.count)
    }));
  }

  private async getHourlyDistributionGlobal(
    startDate: Date,
    endDate: Date,
    country?: CountryCode,
    topic?: TopicType
  ): Promise<Array<{hour: number, count: number}>> {
    const query = this.analyticsRepository
      .createQueryBuilder('event')
      .select('EXTRACT(HOUR FROM event.created_at)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('event.created_at >= :startDate', { startDate })
      .andWhere('event.created_at <= :endDate', { endDate })
      .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' });

    if (country) {
      query.innerJoin('event.channel', 'channel')
        .andWhere('channel.country = :country', { country });
    }

    if (topic) {
      query.innerJoin('event.channel', 'channel')
        .andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
    }

    const results = await query
      .groupBy('EXTRACT(HOUR FROM event.created_at)')
      .orderBy('hour', 'ASC')
      .getRawMany();

    return results.map(result => ({
      hour: parseInt(result.hour),
      count: parseInt(result.count)
    }));
  }
}