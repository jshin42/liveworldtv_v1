import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { CountryCode } from '../../../../../packages/shared-types/src';

@ApiTags('ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('schedule')
  @ApiOperation({
    summary: 'Schedule channel ingestion',
    description: 'Schedules a background job to scrape channels for specified country and source'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        country: { type: 'string', enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP', 'IT', 'PT', 'RU', 'KR', 'CN'] },
        source: { type: 'string', enum: ['youtube', 'twitch', 'dailymotion'] },
        priority: { type: 'number', minimum: 1, maximum: 10 }
      },
      required: ['country']
    }
  })
  @ApiResponse({ status: 201, description: 'Ingestion job scheduled' })
  async scheduleIngestion(
    @Body() body: {
      country: CountryCode;
      source?: 'youtube' | 'twitch' | 'dailymotion';
      priority?: number;
    }
  ) {
    return this.ingestionService.scheduleIngestion(
      body.country,
      body.source,
      body.priority
    );
  }

  @Post('schedule-all')
  @ApiOperation({
    summary: 'Schedule ingestion for all countries',
    description: 'Schedules background jobs to scrape channels for all supported countries'
  })
  @ApiResponse({ status: 201, description: 'All ingestion jobs scheduled' })
  async scheduleAllCountries() {
    return this.ingestionService.scheduleAllCountries();
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get ingestion status',
    description: 'Returns current status of ingestion queue and recent job history'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Ingestion queue status',
    schema: {
      type: 'object',
      properties: {
        queueStats: {
          type: 'object',
          properties: {
            waiting: { type: 'number' },
            active: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' }
          }
        },
        recentJobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              progress: { type: 'number' },
              processedOn: { type: 'number' },
              finishedOn: { type: 'number' },
              failedReason: { type: 'string' }
            }
          }
        },
        lastSuccessfulRun: { type: 'string', format: 'date-time' }
      }
    }
  })
  async getIngestionStatus() {
    return this.ingestionService.getIngestionStatus();
  }
}