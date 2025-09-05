import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { 
  AnalyticsEventRequest,
  AnalyticsEventResponse,
  AnalyticsMetrics,
  CountryCode,
  TopicType 
} from '../../../../../packages/shared-types/src';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @ApiOperation({ 
    summary: 'Record analytics event',
    description: 'Records a new analytics event for tracking user behavior and system performance'
  })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        eventType: { type: 'string', enum: ['DUBBING_STARTED', 'DUBBING_STOPPED', 'CHANNEL_DISCOVERED', 'MODEL_LOADED', 'ERROR'] },
        channelId: { type: 'string' },
        metadata: { type: 'object' }
      },
      required: ['sessionId', 'eventType']
    }
  })
  @ApiResponse({ status: 201, description: 'Event recorded successfully' })
  async recordEvent(@Body() eventData: AnalyticsEventRequest): Promise<AnalyticsEventResponse> {
    return this.analyticsService.recordEvent(eventData);
  }

  @Get('metrics/channel/:channelId')
  @ApiOperation({
    summary: 'Get channel analytics metrics',
    description: 'Returns detailed analytics metrics for a specific channel within date range'
  })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-01-31' })
  @ApiResponse({ status: 200, description: 'Channel analytics metrics' })
  async getChannelMetrics(
    @Param('channelId') channelId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<AnalyticsMetrics> {
    return this.analyticsService.getChannelMetrics(
      channelId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('metrics/global')
  @ApiOperation({
    summary: 'Get global analytics metrics',
    description: 'Returns aggregated analytics metrics across all channels and users'
  })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'country', required: false, enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP'] })
  @ApiQuery({ name: 'topic', required: false, enum: ['news', 'entertainment', 'sports', 'tech'] })
  @ApiResponse({ status: 200, description: 'Global analytics metrics' })
  async getGlobalMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('country') country?: CountryCode,
    @Query('topic') topic?: TopicType
  ): Promise<AnalyticsMetrics> {
    return this.analyticsService.getGlobalMetrics(
      new Date(startDate),
      new Date(endDate),
      country,
      topic
    );
  }

  @Get('events/:sessionId')
  @ApiOperation({
    summary: 'Get events for session',
    description: 'Returns all analytics events for a specific session ID'
  })
  @ApiResponse({ status: 200, description: 'Session events' })
  async getSessionEvents(@Param('sessionId') sessionId: string): Promise<AnalyticsEvent[]> {
    return this.analyticsRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' }
    });
  }
}