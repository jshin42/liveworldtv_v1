import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { CountryCode } from '../../../../../packages/shared-types/src';

interface IngestionJobData {
  country: CountryCode;
  source: 'youtube' | 'twitch' | 'dailymotion';
  priority: number;
}

@Injectable()
@Processor('ingestion')
export class IngestionProcessor {
  constructor(private ingestionService: IngestionService) {}

  @Process('scrape-channels')
  async processChannelScraping(job: Job<IngestionJobData>): Promise<any> {
    const { country, source } = job.data;
    
    console.log(`🔍 Starting ${source} ingestion for ${country}`);
    
    try {
      job.progress(10);
      
      const result = await this.ingestionService.ingestChannelsForCountry(country, source);
      
      job.progress(90);
      
      console.log(`✅ ${source} ingestion complete for ${country}:`, {
        found: result.channelsFound,
        added: result.channelsAdded,
        updated: result.channelsUpdated,
        errors: result.errors.length
      });
      
      job.progress(100);
      
      return result;
    } catch (error) {
      console.error(`❌ ${source} ingestion failed for ${country}:`, error);
      throw error;
    }
  }
}