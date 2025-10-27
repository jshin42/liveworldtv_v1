import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CatalogService, ChannelFilterDto } from './catalog.service';

@ApiTags('catalog')
@Controller('api/v1/channels')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of channels with optional filters' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'topic', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getChannels(@Query() filter: ChannelFilterDto) {
    return this.catalogService.getChannels(filter);
  }

  @Get('random')
  @ApiOperation({ summary: 'Get a random channel (for autoplay)' })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'topic', required: false })
  async getRandomChannel(
    @Query('country') country?: string,
    @Query('topic') topic?: 'NEWS' | 'SPORTS' | 'MUSIC_DJS'
  ) {
    const filter: { country?: string; topic?: 'NEWS' | 'SPORTS' | 'MUSIC_DJS' } = {};
    if (country) filter.country = country;
    if (topic) filter.topic = topic;
    return this.catalogService.getRandomChannel(filter);
  }

  @Get('countries')
  @ApiOperation({ summary: 'Get list of available countries' })
  async getCountries() {
    return { countries: await this.catalogService.getCountries() };
  }

  @Get('topics')
  @ApiOperation({ summary: 'Get list of available topics' })
  async getTopics() {
    return { topics: await this.catalogService.getTopics() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID' })
  async getChannelById(@Param('id') id: string) {
    const channel = await this.catalogService.getChannelById(id);
    if (!channel) {
      return { error: 'Channel not found' };
    }
    return channel;
  }
}
