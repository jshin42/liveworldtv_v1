import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { Channel } from '../../entities/channel.entity';
import { AnalyticsEvent } from '../../entities/analytics-event.entity';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule.forFeature([Channel, AnalyticsEvent]),
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}