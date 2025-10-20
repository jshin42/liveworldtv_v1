import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { RankingService } from './ranking.service';
import { RankingResponse, CountryCode, TopicType } from '../../../../../packages/shared-types/src';

@ApiTags('rankings')
@Controller('rankings')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('trending')
  @ApiOperation({ 
    summary: 'Get trending channels',
    description: 'Returns channels ranked by popularity metrics within specified time window'
  })
  @ApiQuery({ name: 'country', required: false, enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP'] })
  @ApiQuery({ name: 'topic', required: false, enum: ['news', 'entertainment', 'sports', 'tech'] })
  @ApiQuery({ name: 'timeWindow', required: false, enum: ['1h', '24h', '7d'] })
  @ApiResponse({ status: 200, description: 'Trending channels ranking' })
  async getTrending(
    @Query('country') country?: CountryCode,
    @Query('topic') topic?: TopicType,
    @Query('timeWindow') timeWindow?: '1h' | '24h' | '7d'
  ): Promise<RankingResponse> {
    return this.rankingService.getTrendingChannels(country, topic, timeWindow);
  }

  @Get('personalized/:userId')
  @ApiOperation({
    summary: 'Get personalized channel rankings',
    description: 'Returns channels ranked based on user preferences and viewing history'
  })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'topic', required: false })
  @ApiResponse({ status: 200, description: 'Personalized channel rankings' })
  async getPersonalized(
    @Param('userId') userId: string,
    @Query('country') country?: CountryCode,
    @Query('topic') topic?: TopicType
  ): Promise<RankingResponse> {
    return this.rankingService.getPersonalizedRankings(userId, country, topic);
  }

  @Get('channel/:channelId/rank')
  @ApiOperation({
    summary: 'Get specific channel rank',
    description: 'Returns the current ranking position of a specific channel'
  })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'topic', required: false })
  @ApiResponse({ status: 200, description: 'Channel rank information' })
  async getChannelRank(
    @Param('channelId') channelId: string,
    @Query('country') country?: CountryCode,
    @Query('topic') topic?: TopicType
  ): Promise<{ channelId: string; rank: number | null }> {
    const rank = await this.rankingService.getChannelRank(channelId, country, topic);
    return { channelId, rank };
  }
}