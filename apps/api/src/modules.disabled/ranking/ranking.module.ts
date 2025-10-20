import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { Channel } from '../../entities/channel.entity';
import { AnalyticsEvent } from '../../entities/analytics-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, AnalyticsEvent]),
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 1000,
    }),
  ],
  controllers: [RankingController],
  providers: [RankingService],
  exports: [RankingService],
})
export class RankingModule {}