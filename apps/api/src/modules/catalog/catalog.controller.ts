import { Controller, Get, Post, Query, Param, Body, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger'
import { CatalogService } from './catalog.service'
import { ChannelListDto, ChannelFilterDto } from './dto/channel-list.dto'
import { ApiResponse as ApiResponseInterface, CountryCode, TopicType, Channel, LiveStream } from '@liveworldtv/shared-types'

@ApiTags('catalog')
@Controller({ path: 'channels', version: '1' })
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List channels by country and topic' })
  @ApiQuery({ name: 'country', example: 'US', description: 'Two-letter country code' })
  @ApiQuery({ name: 'topic', enum: ['NEWS', 'SPORTS', 'MUSIC_DJS'], required: false })
  @ApiQuery({ name: 'page', example: 1, required: false })
  @ApiQuery({ name: 'limit', example: 20, required: false })
  @ApiResponse({ status: 200, description: 'Channel list retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  async getChannels(@Query() filterDto: ChannelFilterDto): Promise<ApiResponseInterface<ChannelListDto>> {
    const result = await this.catalogService.getChannelsByCountryTopic(
      filterDto.country,
      filterDto.topic,
      {
        page: filterDto.page || 1,
        limit: filterDto.limit || 20
      }
    )
    
    return {
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1.0.0',
        requestId: this.generateRequestId()
      }
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel details by ID' })
  @ApiResponse({ status: 200, description: 'Channel details' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async getChannel(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseInterface<Channel>> {
    const channel = await this.catalogService.getChannelById(id)
    
    return {
      data: channel,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1.0.0',
        requestId: this.generateRequestId()
      }
    }
  }

  @Get(':id/stream')
  @ApiOperation({ summary: 'Get live stream status for channel' })
  @ApiResponse({ status: 200, description: 'Stream status' })
  @ApiResponse({ status: 404, description: 'Stream not found' })
  async getStreamStatus(@Param('id', ParseUUIDPipe) channelId: string): Promise<ApiResponseInterface<LiveStream>> {
    const stream = await this.catalogService.getStreamStatus(channelId)
    
    return {
      data: stream,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1.0.0',
        requestId: this.generateRequestId()
      }
    }
  }

  @Post('match-url')
  @ApiOperation({
    summary: 'Match URL to channel',
    description: 'Finds channel configuration for a given video URL'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' }
      },
      required: ['url']
    }
  })
  @ApiResponse({ status: 200, description: 'Matched channel configuration' })
  @ApiResponse({ status: 404, description: 'No matching channel found' })
  async matchUrl(@Body() body: { url: string }) {
    return this.catalogService.matchUrlToChannel(body.url);
  }

  @Get('discover/:country')
  @ApiOperation({
    summary: 'Discover new channels',
    description: 'Triggers real-time channel discovery for a specific country'
  })
  @ApiParam({ name: 'country', enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP'] })
  @ApiQuery({ name: 'source', required: false, enum: ['7pm', 'youtube', 'twitch'] })
  @ApiResponse({ status: 200, description: 'Discovery initiated' })
  async discoverChannels(
    @Param('country') country: CountryCode,
    @Query('source') source?: '7pm' | 'youtube' | 'twitch'
  ) {
    return this.catalogService.discoverChannels(country, source);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search channels by text query' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchChannels(
    @Query('q') query: string,
    @Query('country') country?: CountryCode,
    @Query('limit') limit?: number
  ): Promise<ApiResponseInterface<Channel[]>> {
    const channels = await this.catalogService.searchChannels(query, country, limit);
    
    return {
      data: channels,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1.0.0',
        requestId: this.generateRequestId()
      }
    };
  }

  @Get('stats/count')
  @ApiOperation({ summary: 'Get channel count statistics' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'topic', required: false })
  @ApiResponse({ status: 200, description: 'Channel count' })
  async getChannelCount(
    @Query('country') country?: CountryCode,
    @Query('topic') topic?: TopicType
  ): Promise<ApiResponseInterface<{ count: number }>> {
    const count = await this.catalogService.getActiveChannelCount(country, topic);
    
    return {
      data: { count },
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1.0.0',
        requestId: this.generateRequestId()
      }
    };
  }

  private generateRequestId(): string {
    return require('crypto').randomBytes(16).toString('hex')
  }
}