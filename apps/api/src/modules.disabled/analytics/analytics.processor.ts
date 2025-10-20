import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../../entities/analytics-event.entity';
import { Channel } from '../../entities/channel.entity';

interface AnalyticsJob {
  eventId: string;
  eventType: string;
  channelId?: string;
}

@Injectable()
@Processor('analytics')
export class AnalyticsProcessor {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsRepository: Repository<AnalyticsEvent>,
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
  ) {}

  @Process('process-event')
  async processEvent(job: Job<AnalyticsJob>): Promise<void> {
    const { eventId, eventType, channelId } = job.data;

    try {
      switch (eventType) {
        case 'DUBBING_STARTED':
          await this.processDubbingStarted(eventId, channelId);
          break;
        case 'DUBBING_STOPPED':
          await this.processDubbingStopped(eventId, channelId);
          break;
        case 'CHANNEL_DISCOVERED':
          await this.processChannelDiscovered(eventId, channelId);
          break;
        case 'MODEL_LOADED':
          await this.processModelLoaded(eventId);
          break;
        case 'ERROR':
          await this.processError(eventId);
          break;
      }
    } catch (error) {
      console.error(`Failed to process analytics event ${eventId}:`, error);
      throw error;
    }
  }

  private async processDubbingStarted(eventId: string, channelId?: string): Promise<void> {
    if (!channelId) return;

    await this.channelRepository
      .createQueryBuilder()
      .update(Channel)
      .set({ 
        totalSessions: () => 'total_sessions + 1',
        lastActivity: new Date()
      })
      .where('id = :channelId', { channelId })
      .execute();

    console.log(`✅ Updated channel ${channelId} session count`);
  }

  private async processDubbingStopped(eventId: string, channelId?: string): Promise<void> {
    if (!channelId) return;

    const event = await this.analyticsRepository.findOne({
      where: { id: eventId }
    });

    if (event?.sessionDuration) {
      const avgDurationQuery = await this.analyticsRepository
        .createQueryBuilder('event')
        .select('AVG(event.session_duration)', 'avgDuration')
        .where('event.channel_id = :channelId', { channelId })
        .andWhere('event.session_duration IS NOT NULL')
        .getRawOne();

      const avgDuration = Math.round(parseFloat(avgDurationQuery.avgDuration) || 0);

      await this.channelRepository
        .createQueryBuilder()
        .update(Channel)
        .set({ avgSessionDuration: avgDuration })
        .where('id = :channelId', { channelId })
        .execute();
    }
  }

  private async processChannelDiscovered(eventId: string, channelId?: string): Promise<void> {
    if (!channelId) return;

    await this.channelRepository
      .createQueryBuilder()
      .update(Channel)
      .set({ 
        discoveryCount: () => 'discovery_count + 1',
        lastChecked: new Date()
      })
      .where('id = :channelId', { channelId })
      .execute();
  }

  private async processModelLoaded(eventId: string): Promise<void> {
    const event = await this.analyticsRepository.findOne({
      where: { id: eventId }
    });

    if (event?.metadata?.modelName && event?.metadata?.loadTime) {
      console.log(`📊 Model ${event.metadata.modelName} loaded in ${event.metadata.loadTime}ms`);
    }
  }

  private async processError(eventId: string): Promise<void> {
    const event = await this.analyticsRepository.findOne({
      where: { id: eventId }
    });

    if (event?.metadata?.error) {
      console.error(`🚨 Analytics error logged:`, {
        eventId,
        error: event.metadata.error,
        channelId: event.channelId,
        sessionId: event.sessionId
      });
    }
  }
}