import { Injectable } from '@nestjs/common';
import { CountryCode } from '../../../../../packages/shared-types/src';
import { TopicType } from '../../entities/channel.entity';

interface ScrapedChannel {
  name: string;
  url: string;
  description: string;
  language: string;
  country: CountryCode;
  topic: TopicType;
  metadata?: Record<string, any>;
  thumbnailUrl?: string;
  isLive: boolean;
  viewerCount?: number;
}

interface ScrapeResult {
  channels: ScrapedChannel[];
  source: string;
  scrapedAt: Date;
  metadata: Record<string, any>;
}

@Injectable()
export class ChannelScraper {
  private readonly USER_AGENT = 'LiveWorldTV-Bot/1.0 (+https://liveworldtv.com/bot)';
  private readonly REQUEST_DELAY = 2000;

  async scrape7pmChannels(country: CountryCode): Promise<ScrapeResult> {
    const channels: ScrapedChannel[] = [];
    
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      await page.setUserAgent(this.USER_AGENT);
      await page.goto(`https://7pm.com/country/${country.toLowerCase()}`, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      const iframes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          title: iframe.title || iframe.getAttribute('data-title') || '',
          id: iframe.id || ''
        }));
      });
      
      for (const iframe of iframes) {
        if (iframe.src.includes('youtube.com/embed')) {
          const channelData = this.parseYouTubeEmbed(iframe, country);
          if (channelData) {
            channels.push(channelData);
          }
        }
      }
      
      await browser.close();
      await this.delay(5000); // Respectful delay
      
      return {
        channels: this.deduplicateChannels(channels),
        source: '7pm',
        scrapedAt: new Date(),
        metadata: {
          country,
          iframesFound: iframes.length,
          youtubeEmbeds: channels.length
        }
      };
    } catch (error) {
      console.error(`7pm scraping failed for ${country}:`, error);
      return this.scrapeYouTubeLiveChannels(country); // Fallback to YouTube API
    }
  }

  async scrapeYouTubeLiveChannels(country: CountryCode): Promise<ScrapeResult> {
    const channels: ScrapedChannel[] = [];
    
    try {
      const searchQueries = [
        `${country} news live`,
        `${country} tv live stream`,
        `${country} radio live`
      ];

      for (const query of searchQueries) {
        const searchResults = await this.searchYouTubeLive(query, country);
        channels.push(...searchResults);
        await this.delay(this.REQUEST_DELAY);
      }

      return {
        channels: this.deduplicateChannels(channels),
        source: 'youtube',
        scrapedAt: new Date(),
        metadata: {
          country,
          queriesUsed: searchQueries.length,
          totalResultsFound: channels.length
        }
      };
    } catch (error) {
      console.error(`YouTube scraping failed for ${country}:`, error);
      throw error;
    }
  }

  async scrapeTwitchChannels(country: CountryCode): Promise<ScrapeResult> {
    const channels: ScrapedChannel[] = [];
    
    try {
      const categories = ['Just Chatting', 'News & Politics', 'Talk Shows & Podcasts'];
      
      for (const category of categories) {
        const categoryResults = await this.searchTwitchByCategory(category, country);
        channels.push(...categoryResults);
        await this.delay(this.REQUEST_DELAY);
      }

      return {
        channels: this.deduplicateChannels(channels),
        source: 'twitch',
        scrapedAt: new Date(),
        metadata: {
          country,
          categoriesSearched: categories,
          totalResultsFound: channels.length
        }
      };
    } catch (error) {
      console.error(`Twitch scraping failed for ${country}:`, error);
      throw error;
    }
  }

  private async searchYouTubeLive(query: string, country: CountryCode): Promise<ScrapedChannel[]> {
    const channels: ScrapedChannel[] = [];
    
    const searchUrl = new URL('https://www.youtube.com/results');
    searchUrl.searchParams.set('search_query', query);
    searchUrl.searchParams.set('sp', 'EgJAAQ%3D%3D'); // Live filter

    try {
      const response = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });

      if (!response.ok) {
        throw new Error(`YouTube API returned ${response.status}`);
      }

      const html = await response.text();
      const parsedChannels = this.parseYouTubeSearchResults(html, country);
      channels.push(...parsedChannels);

    } catch (error) {
      console.warn(`Failed to scrape YouTube for "${query}":`, error);
    }

    return channels;
  }

  private parseYouTubeSearchResults(html: string, country: CountryCode): ScrapedChannel[] {
    const channels: ScrapedChannel[] = [];
    
    try {
      const videoDataRegex = /var ytInitialData = ({.+?});/;
      const match = html.match(videoDataRegex);
      
      if (!match) {
        return channels;
      }

      const data = JSON.parse(match[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      
      if (!contents) {
        return channels;
      }

      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents || [];
        
        for (const item of items) {
          const videoRenderer = item?.videoRenderer;
          if (!videoRenderer || !videoRenderer.badges?.some((b: any) => b.metadataBadgeRenderer?.label === 'LIVE')) {
            continue;
          }

          const title = videoRenderer.title?.runs?.[0]?.text;
          const channelName = videoRenderer.ownerText?.runs?.[0]?.text;
          const videoId = videoRenderer.videoId;
          
          if (title && channelName && videoId) {
            channels.push({
              name: channelName,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              description: title,
              language: this.getLanguageForCountry(country),
              country,
              topic: this.inferTopicFromTitle(title),
              metadata: { videoId, searchQuery: query },
              thumbnailUrl: videoRenderer.thumbnail?.thumbnails?.[0]?.url,
              isLive: true,
              viewerCount: this.parseViewerCount(videoRenderer.viewCountText?.simpleText)
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse YouTube results:', error);
    }

    return channels;
  }

  private async searchTwitchByCategory(category: string, country: CountryCode): Promise<ScrapedChannel[]> {
    const channels: ScrapedChannel[] = [];
    
    const searchUrl = new URL('https://www.twitch.tv/directory/category/' + encodeURIComponent(category));

    try {
      const response = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });

      if (!response.ok) {
        throw new Error(`Twitch returned ${response.status}`);
      }

      const html = await response.text();
      const parsedChannels = this.parseTwitchCategoryResults(html, country, category);
      channels.push(...parsedChannels);

    } catch (error) {
      console.warn(`Failed to scrape Twitch category "${category}":`, error);
    }

    return channels;
  }

  private parseTwitchCategoryResults(html: string, country: CountryCode, category: string): ScrapedChannel[] {
    const channels: ScrapedChannel[] = [];
    
    try {
      const streamLinkRegex = /href="\/([^"]+)"/g;
      const titleRegex = /data-a-target="preview-card-title-link"[^>]*>([^<]+)</g;
      const viewerRegex = /(\d+(?:,\d+)*)\s+viewers?/gi;

      let streamMatch;
      const streamNames: string[] = [];
      
      while ((streamMatch = streamLinkRegex.exec(html)) !== null) {
        const streamName = streamMatch[1];
        if (streamName && !streamName.includes('/') && streamName.length < 30) {
          streamNames.push(streamName);
        }
      }

      let titleMatch;
      const titles: string[] = [];
      
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        titles.push(titleMatch[1]);
      }

      for (let i = 0; i < Math.min(streamNames.length, titles.length, 10); i++) {
        const streamName = streamNames[i];
        const title = titles[i];
        
        if (this.isCountryRelevant(title, country) || this.isCountryRelevant(streamName, country)) {
          channels.push({
            name: streamName,
            url: `https://www.twitch.tv/${streamName}`,
            description: title,
            language: this.getLanguageForCountry(country),
            country,
            topic: this.inferTopicFromCategory(category),
            metadata: { twitchCategory: category },
            isLive: true,
            viewerCount: this.parseViewerCount(title)
          });
        }
      }
    } catch (error) {
      console.warn('Failed to parse Twitch results:', error);
    }

    return channels;
  }

  private deduplicateChannels(channels: ScrapedChannel[]): ScrapedChannel[] {
    const seen = new Set<string>();
    const deduplicated: ScrapedChannel[] = [];

    for (const channel of channels) {
      const key = `${channel.url}|${channel.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(channel);
      }
    }

    return deduplicated;
  }

  private getLanguageForCountry(country: CountryCode): string {
    const languageMap: Record<string, string> = {
      'US': 'en',
      'UK': 'en', 
      'DE': 'de',
      'FR': 'fr',
      'ES': 'es',
      'JP': 'ja',
      'IT': 'it',
      'PT': 'pt',
      'RU': 'ru',
      'KR': 'ko',
      'CN': 'zh'
    };
    return languageMap[country] || 'en';
  }

  private inferTopicFromTitle(title: string): TopicType {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('news') || lowerTitle.includes('breaking')) {
      return TopicType.NEWS;
    }
    if (lowerTitle.includes('sport') || lowerTitle.includes('football') || lowerTitle.includes('soccer')) {
      return TopicType.SPORTS;
    }
    if (lowerTitle.includes('music') || lowerTitle.includes('dj') || lowerTitle.includes('radio')) {
      return TopicType.MUSIC_DJS;
    }

    return TopicType.NEWS; // Default fallback
  }

  private inferTopicFromCategory(category: string): TopicType {
    if (category.includes('News') || category.includes('Politics')) {
      return TopicType.NEWS;
    }
    if (category.includes('Sports')) {
      return TopicType.SPORTS;
    }
    if (category.includes('Music') || category.includes('DJ')) {
      return TopicType.MUSIC_DJS;
    }
    
    return TopicType.NEWS;
  }

  private isCountryRelevant(text: string, country: CountryCode): boolean {
    const countryKeywords: Record<string, string[]> = {
      'US': ['america', 'usa', 'united states'],
      'UK': ['britain', 'england', 'uk', 'british'],
      'DE': ['germany', 'deutsch', 'german'],
      'FR': ['france', 'french', 'français'],
      'ES': ['spain', 'spanish', 'españa'],
      'JP': ['japan', 'japanese', 'nihon'],
      'IT': ['italy', 'italian', 'italia'],
      'PT': ['portugal', 'portuguese', 'brasil'],
      'RU': ['russia', 'russian', 'россия'],
      'KR': ['korea', 'korean', '한국'],
      'CN': ['china', 'chinese', '中国']
    };

    const keywords = countryKeywords[country] || [];
    const lowerText = text.toLowerCase();
    
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  private parseViewerCount(text?: string): number | undefined {
    if (!text) return undefined;
    
    const match = text.match(/(\d+(?:,\d+)*)\s*(?:viewers?|watching)/i);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    
    return undefined;
  }

  private parseYouTubeEmbed(iframe: any, country: CountryCode): ScrapedChannel | null {
    try {
      const url = new URL(iframe.src);
      const videoId = url.pathname.split('/embed/')[1]?.split('?')[0];
      
      if (!videoId) return null;
      
      // Extract channel information from iframe context
      const title = iframe.title || 'Live Stream';
      const channelName = title.split(' - ')[0] || title.split('|')[0] || title;
      
      return {
        name: channelName.trim(),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description: title,
        language: this.getLanguageForCountry(country),
        country,
        topic: this.inferTopicFromTitle(title),
        isLive: true,
        metadata: {
          embedSrc: iframe.src,
          iframe: iframe.id || iframe.title,
          source: '7pm'
        }
      };
    } catch (error) {
      console.warn('Failed to parse YouTube embed:', error);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}