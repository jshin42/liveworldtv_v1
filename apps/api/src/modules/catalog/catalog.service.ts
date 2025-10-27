import { Injectable } from '@nestjs/common';
import { Channel, PaginatedResponse, CountryCode, TopicType } from '@liveworldtv/shared-types';
import { SEED_CHANNELS } from '../../data/seed-channels';

export interface ChannelFilterDto {
  country?: CountryCode;
  topic?: TopicType;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class CatalogService {
  private channels: Channel[];

  constructor() {
    // Initialize with seed data + timestamps
    this.channels = SEED_CHANNELS.map(ch => ({
      ...ch,
      firstSeen: new Date(),
      lastSeen: new Date(),
      metadata: {},
      contentFingerprint: `fp-${ch.id}`
    }));
  }

  async getChannels(filter: ChannelFilterDto = {}): Promise<PaginatedResponse<Channel>> {
    const { country, topic, search, page = 1, limit = 20 } = filter;

    // Filter channels
    let filtered = this.channels;

    if (country) {
      filtered = filtered.filter(ch => ch.country === country);
    }

    if (topic) {
      filtered = filtered.filter(ch => ch.topic === topic);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(ch => 
        ch.name.toLowerCase().includes(searchLower) ||
        ch.description?.toLowerCase().includes(searchLower)
      );
    }

    // Paginate
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = filtered.slice(start, end);

    return {
      data,
      pagination: {
        page,
        limit,
        total: filtered.length,
        hasNext: end < filtered.length
      }
    };
  }

  async getChannelById(id: string): Promise<Channel | null> {
    return this.channels.find(ch => ch.id === id) || null;
  }

  async getRandomChannel(filter?: { country?: CountryCode; topic?: TopicType }): Promise<Channel | null> {
    let filtered = this.channels;

    if (filter?.country) {
      filtered = filtered.filter(ch => ch.country === filter.country);
    }

    if (filter?.topic) {
      filtered = filtered.filter(ch => ch.topic === filter.topic);
    }

    if (filtered.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex] || null;
  }

  async getCountries(): Promise<string[]> {
    const countries = new Set(this.channels.map(ch => ch.country));
    return Array.from(countries).sort();
  }

  async getTopics(): Promise<TopicType[]> {
    const topics = new Set(this.channels.map(ch => ch.topic));
    return Array.from(topics).sort();
  }
}
