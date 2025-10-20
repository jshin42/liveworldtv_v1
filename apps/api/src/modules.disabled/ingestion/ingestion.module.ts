import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionProcessor } from './ingestion.processor';
import { ChannelScraper } from './channel-scraper.service';
import { Channel } from '../../entities/channel.entity';
import { AnalyticsEvent } from '../../entities/analytics-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, AnalyticsEvent]),
    BullModule.registerQueue({
      name: 'ingestion',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionProcessor, ChannelScraper],
  exports: [IngestionService],
})
export class IngestionModule {}