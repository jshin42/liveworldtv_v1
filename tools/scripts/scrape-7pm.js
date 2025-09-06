#!/usr/bin/env node

const puppeteer = require('puppeteer');
const { DataSource } = require('typeorm');
const crypto = require('crypto');

// Database configuration
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'liveworldtv',
  synchronize: false, // Don't auto-sync in production scraping
  logging: true,
  entities: [
    require.resolve('../../apps/api/src/modules/catalog/entities/channel.entity.ts')
  ]
});

/**
 * 7pm.com Content Scraper
 * 
 * Based on analysis showing JavaScript-heavy SPA structure.
 * Implements respectful scraping with rate limiting and error handling.
 * 
 * Reference: docs/research/7pm-scraping-analysis.md
 */
class SevenPMScraper {
  constructor(options = {}) {
    this.rateLimitMs = options.rateLimitMs || 5000; // 5 seconds between requests
    this.timeout = options.timeout || 30000; // 30 second timeout
    this.userAgent = options.userAgent || 'LiveWorldTV-Bot/1.0 (Content Aggregator)';
    this.maxRetries = options.maxRetries || 3;
  }

  async initialize() {
    console.log('🚀 Initializing 7pm.com scraper...');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    await AppDataSource.initialize();
    console.log('✅ Database connected');

    this.channelRepository = AppDataSource.getRepository('Channel');
  }

  async scrapeCountryTopic(country, topic) {
    console.log(`📡 Scraping ${country}/${topic} from 7pm.com`);

    const page = await this.browser.newPage();
    
    try {
      // Set user agent to identify our bot respectfully
      await page.setUserAgent(this.userAgent);
      
      // Navigate to country/topic page
      const url = `https://7pm.com/${country.toLowerCase()}/${topic.toLowerCase()}`;
      console.log(`🌐 Navigating to: ${url}`);
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      // Wait for JavaScript to render content
      await page.waitForTimeout(2000);

      // Extract iframe sources (YouTube embeds)
      const channels = await page.evaluate((country, topic) => {
        const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
        const results = [];

        iframes.forEach((iframe, index) => {
          const src = iframe.src;
          
          // Extract YouTube channel/video ID from URL
          const channelMatch = src.match(/(?:embed\/|v=)([a-zA-Z0-9_-]+)/);
          const channelId = channelMatch ? channelMatch[1] : null;

          if (channelId) {
            // Try to get channel name from nearby elements
            let channelName = `Unknown Channel ${index + 1}`;
            
            // Look for text content near the iframe
            const parent = iframe.closest('div') || iframe.parentElement;
            if (parent) {
              const textElements = parent.querySelectorAll('h1, h2, h3, h4, h5, h6, span, div');
              for (const element of textElements) {
                const text = element.textContent.trim();
                if (text.length > 5 && text.length < 100 && !text.includes('©')) {
                  channelName = text;
                  break;
                }
              }
            }

            results.push({
              name: channelName,
              country: country.toUpperCase(),
              topic: topic.toUpperCase(),
              sourceUrl: src,
              youtubeChannelId: channelId,
              scrapedAt: new Date().toISOString()
            });
          }
        });

        return results;
      }, country, topic);

      console.log(`📺 Found ${channels.length} channels for ${country}/${topic}`);
      
      // Process and save channels
      for (const channelData of channels) {
        await this.saveChannel(channelData);
        
        // Rate limiting between saves
        await this.sleep(500);
      }

      return channels;

    } catch (error) {
      console.error(`❌ Error scraping ${country}/${topic}:`, error.message);
      
      // Take screenshot for debugging if page exists
      if (page) {
        try {
          await page.screenshot({ 
            path: `debug-${country}-${topic}-${Date.now()}.png`,
            fullPage: true 
          });
          console.log('📸 Debug screenshot saved');
        } catch (screenshotError) {
          console.error('Failed to take debug screenshot:', screenshotError);
        }
      }
      
      return [];
    } finally {
      await page.close();
      
      // Respectful rate limiting between requests
      await this.sleep(this.rateLimitMs);
    }
  }

  async saveChannel(channelData) {
    try {
      // Generate content fingerprint for deduplication
      const fingerprint = crypto
        .createHash('md5')  
        .update(channelData.sourceUrl)
        .digest('hex')
        .substring(0, 16);

      // Check if channel already exists
      const existing = await this.channelRepository.findOne({
        where: { contentFingerprint: fingerprint }
      });

      if (existing) {
        // Update lastSeen timestamp for existing channel
        await this.channelRepository.update(
          { id: existing.id },
          { lastSeen: new Date() }
        );
        console.log(`🔄 Updated existing channel: ${channelData.name}`);
        return existing;
      }

      // Create new channel
      const newChannel = {
        name: channelData.name,
        country: channelData.country,
        topic: channelData.topic,
        sourceType: 'YOUTUBE_EMBED',
        sourceUrl: channelData.sourceUrl,
        youtubeChannelId: channelData.youtubeChannelId,
        languageCode: this.guessLanguageFromCountry(channelData.country),
        active: true,
        verified: false, // Require manual verification for scraped content
        firstSeen: new Date(),
        lastSeen: new Date(),
        contentFingerprint: fingerprint,
        metadata: {
          scrapedFrom: '7pm.com',
          scrapedAt: channelData.scrapedAt,
          needsVerification: true
        }
      };

      const saved = await this.channelRepository.save(newChannel);
      console.log(`✅ Saved new channel: ${channelData.name}`);
      return saved;

    } catch (error) {
      console.error(`❌ Error saving channel ${channelData.name}:`, error);
      return null;
    }
  }

  guessLanguageFromCountry(countryCode) {
    const languageMap = {
      'US': 'en',
      'UK': 'en', 
      'GB': 'en',
      'DE': 'de',
      'FR': 'fr',
      'ES': 'es',
      'IT': 'it',
      'JP': 'ja',
      'KR': 'ko',
      'CN': 'zh'
    };
    return languageMap[countryCode] || 'en';
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeAll() {
    const targets = [
      { country: 'US', topic: 'NEWS' },
      { country: 'UK', topic: 'NEWS' }, 
      { country: 'DE', topic: 'NEWS' },
      { country: 'FR', topic: 'NEWS' },
      { country: 'US', topic: 'SPORTS' },
      { country: 'UK', topic: 'SPORTS' },
      { country: 'US', topic: 'MUSIC_DJS' },
      { country: 'UK', topic: 'MUSIC_DJS' }
    ];

    let totalChannels = 0;

    for (const target of targets) {
      console.log(`\n🎯 Scraping ${target.country}/${target.topic}...`);
      
      try {
        const channels = await this.scrapeCountryTopic(target.country, target.topic);
        totalChannels += channels.length;
      } catch (error) {
        console.error(`Failed to scrape ${target.country}/${target.topic}:`, error);
      }
    }

    console.log(`\n🎉 Scraping complete! Total channels processed: ${totalChannels}`);
    
    // Summary report
    const totalInDb = await this.channelRepository.count();
    const needsVerification = await this.channelRepository.count({
      where: { verified: false }
    });
    
    console.log(`📊 Database summary:`);
    console.log(`   Total channels: ${totalInDb}`);
    console.log(`   Needs verification: ${needsVerification}`);
    console.log(`   Verified channels: ${totalInDb - needsVerification}`);

    return totalChannels;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
    
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔒 Database connection closed');
    }
  }
}

async function main() {
  const scraper = new SevenPMScraper({
    rateLimitMs: 5000, // 5 seconds between requests (respectful)
    timeout: 30000,    // 30 second timeout
    maxRetries: 3      // Retry failed requests up to 3 times
  });

  try {
    await scraper.initialize();
    await scraper.scrapeAll();
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { SevenPMScraper };