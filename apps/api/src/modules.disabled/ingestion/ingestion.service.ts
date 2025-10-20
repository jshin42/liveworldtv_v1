import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Channel } from '../../entities/channel.entity';
import { ChannelScraper } from './channel-scraper.service';
import { CountryCode } from '../../../../../packages/shared-types/src';
import { TopicType } from '../../entities/channel.entity';

interface IngestionJobData {
  country: CountryCode;
  source: 'youtube' | 'twitch' | 'dailymotion';
  priority: number;
}

interface IngestionResult {
  success: boolean;
  channelsFound: number;
  channelsAdded: number;
  channelsUpdated: number;
  errors: string[];
}

@Injectable()
export class IngestionService {
  constructor(
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
    @InjectQueue('ingestion')
    private ingestionQueue: Queue,
    private channelScraper: ChannelScraper,
  ) {}

  async scheduleIngestion(
    country: CountryCode, 
    source: 'youtube' | 'twitch' | 'dailymotion' = 'youtube',
    priority: number = 1
  ): Promise<{ jobId: string }> {
    const job = await this.ingestionQueue.add(
      'scrape-channels',
      {
        country,
        source,
        priority
      } as IngestionJobData,
      {
        priority,
        delay: priority === 1 ? 0 : 5000 // High priority jobs run immediately
      }
    );

    return { jobId: job.id.toString() };
  }

  async scheduleAllCountries(): Promise<{ jobIds: string[] }> {
    const countries: CountryCode[] = ['US', 'UK', 'DE', 'FR', 'ES', 'JP', 'IT', 'PT', 'RU', 'KR', 'CN'];
    const sources: Array<'youtube' | 'twitch'> = ['youtube', 'twitch'];
    const jobIds: string[] = [];

    for (let i = 0; i < countries.length; i++) {
      const country = countries[i];
      
      for (const source of sources) {
        const priority = i < 3 ? 1 : 2; // Priority for major markets
        const { jobId } = await this.scheduleIngestion(country, source, priority);
        jobIds.push(jobId);
      }
    }

    return { jobIds };
  }

  async ingestChannelsForCountry(country: CountryCode, source: string): Promise<IngestionResult> {
    const result: IngestionResult = {
      success: false,
      channelsFound: 0,
      channelsAdded: 0,
      channelsUpdated: 0,
      errors: []
    };

    try {
      let scrapeResult;
      
      switch (source) {
        case '7pm':
          scrapeResult = await this.channelScraper.scrape7pmChannels(country);
          break;
        case 'youtube':
          scrapeResult = await this.channelScraper.scrapeYouTubeLiveChannels(country);
          break;
        case 'twitch':
          scrapeResult = await this.channelScraper.scrapeTwitchChannels(country);
          break;
        default:
          throw new Error(`Unsupported source: ${source}`);
      }

      result.channelsFound = scrapeResult.channels.length;

      for (const scrapedChannel of scrapeResult.channels) {
        try {
          await this.upsertChannel(scrapedChannel);
          
          const existing = await this.channelRepository.findOne({
            where: { sourceUrl: scrapedChannel.url }
          });
          
          if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
            result.channelsAdded++;
          } else {
            result.channelsUpdated++;
          }
        } catch (error) {
          result.errors.push(`Failed to upsert ${scrapedChannel.name}: ${error.message}`);
        }
      }

      result.success = result.errors.length < scrapeResult.channels.length / 2;

    } catch (error) {
      result.errors.push(`Ingestion failed: ${error.message}`);
    }

    return result;
  }

  private async upsertChannel(scrapedChannel: any): Promise<Channel> {
    const existing = await this.channelRepository.findOne({
      where: { sourceUrl: scrapedChannel.url }
    });

    const channelData = {
      name: scrapedChannel.name,
      sourceUrl: scrapedChannel.url,
      description: scrapedChannel.description,
      languageCode: scrapedChannel.language || 'eng',
      country: scrapedChannel.country,
      topic: scrapedChannel.topic || TopicType.NEWS,
      thumbnailUrl: scrapedChannel.thumbnailUrl,
      lastSeen: new Date(),
      active: true,
      verified: false,
      contentFingerprint: this.generateContentFingerprint(scrapedChannel)
    };

    if (existing) {
      await this.channelRepository.update(existing.id, {
        ...channelData,
        updatedAt: new Date()
      });
      return this.channelRepository.findOne({ where: { id: existing.id } })!;
    } else {
      const channel = this.channelRepository.create({
        ...channelData,
        firstSeen: new Date(),
        metadata: scrapedChannel.metadata || {}
      });
      
      return this.channelRepository.save(channel);
    }
  }

  private generateChannelId(url: string): string {
    const hash = this.simpleHash(url);
    return `ch_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private generateContentFingerprint(channel: any): string {
    const content = `${channel.name}${channel.country}${channel.url}`;
    return this.simpleHash(content).substring(0, 16);
  }

  private calculateQualityScore(channel: any): number {
    let score = 50; // Base score

    if (channel.viewerCount) {
      if (channel.viewerCount > 10000) score += 30;
      else if (channel.viewerCount > 1000) score += 20;
      else if (channel.viewerCount > 100) score += 10;
    }

    if (channel.description && channel.description.length > 50) {
      score += 10;
    }

    if (channel.thumbnailUrl) {
      score += 5;
    }

    if (channel.isLive) {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  async getIngestionStatus(): Promise<{
    queueStats: any;
    recentJobs: any[];
    lastSuccessfulRun?: Date;
  }> {
    const queueStats = {
      waiting: await this.ingestionQueue.getWaiting(),
      active: await this.ingestionQueue.getActive(),
      completed: await this.ingestionQueue.getCompleted(),
      failed: await this.ingestionQueue.getFailed()
    };

    const recentJobs = await this.ingestionQueue.getJobs(
      ['completed', 'failed', 'active'], 
      0, 
      10
    );

    const lastSuccessful = recentJobs.find(job => 
      job.finishedOn && job.returnvalue?.success
    );

    return {
      queueStats: {
        waiting: queueStats.waiting.length,
        active: queueStats.active.length,
        completed: queueStats.completed.length,
        failed: queueStats.failed.length
      },
      recentJobs: recentJobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress(),
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason
      })),
      lastSuccessfulRun: lastSuccessful ? new Date(lastSuccessful.finishedOn!) : undefined
    };
  }
}