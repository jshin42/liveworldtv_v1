#!/usr/bin/env node

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
  synchronize: true, // Enable for development - creates tables automatically
  logging: true,
  entities: [
    require.resolve('../../apps/api/src/modules/catalog/entities/channel.entity.ts')
  ]
});

// Seed data matching the 7pm.com reference - real news channels
const seedChannels = [
  // US News Channels
  {
    name: 'NBC News Now',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCeY0bbntWzzVIaj2z3QigXg',
    youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg',
    description: 'Breaking news and top stories from NBC News',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKZQ-nbcNH3i_XTg9TyNbCfCv2Yev8k2aV4wMoJV=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: { 
      genre: 'news',
      tags: ['breaking-news', 'politics', 'world-news']
    }
  },
  {
    name: 'CNN',
    country: 'US', 
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCupvZG-5ko_eiXAupbDfxWw',
    youtubeChannelId: 'UCupvZG-5ko_eiXAupbDfxWw',
    description: 'CNN live breaking news coverage and analysis',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKb68yl4YKIQsm2TJnmdYAoTHs5zGY7VBr7VrIUv=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: {
      genre: 'news',
      tags: ['cnn', 'breaking-news', 'politics']
    }
  },
  {
    name: 'Fox News',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED', 
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCXIJgqnII2ZOINSWNOGFThA',
    youtubeChannelId: 'UCXIJgqnII2ZOINSWNOGFThA',
    description: 'Fox News Channel live streaming news and commentary',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKaKKwRPBVVbPXYi6RKTmf5KE5KJVBp4OzJ4hFrv=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: {
      genre: 'news',
      tags: ['fox-news', 'politics', 'conservative']
    }
  },
  {
    name: 'ABC News Live',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCBi2mrWuNuyYy4gbM6fU18Q',
    youtubeChannelId: 'UCBi2mrWuNuyYy4gbM6fU18Q',
    description: 'ABC News live coverage of breaking news and events',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKb4L2xZ8s4V0fHjL4JwPq5KOiJcVWd3mHhVdHQa=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: {
      genre: 'news',
      tags: ['abc-news', 'breaking-news', 'world-news']
    }
  },

  // UK News Channels
  {
    name: 'BBC News',
    country: 'UK',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UC16niRr50-MSBwiO3YDb3RA',
    youtubeChannelId: 'UC16niRr50-MSBwiO3YDb3RA',
    description: 'BBC News live coverage and analysis from around the world',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKaoFd8H-qOiTzKU2vw4wzP5M-lVVH6hHd3JNcw=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: {
      genre: 'news',
      tags: ['bbc', 'uk-news', 'world-news']
    }
  },
  {
    name: 'Sky News',
    country: 'UK',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCoMdktPbSTixAyNGwb-UYkQ',
    youtubeChannelId: 'UCoMdktPbSTixAyNGwb-UYkQ',
    description: 'Sky News live breaking news from the UK and around the world',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKZqDnBTGd5vV8FYYCg2XJnK3hH-5xI0c1iWnAFq=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: {
      genre: 'news', 
      tags: ['sky-news', 'uk-news', 'breaking-news']
    }
  },

  // German News
  {
    name: 'Deutsche Welle',
    country: 'DE',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg',
    youtubeChannelId: 'UCknLrEdhRCp1aegoMqRaCZg',
    description: 'Deutsche Welle international news in English',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKa9LsTkI2CQALgY0qQYUe8rVdz5nJ1Sc3Gq9Ek=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: {
      genre: 'news',
      tags: ['deutsche-welle', 'german-news', 'international']
    }
  },

  // French News
  {
    name: 'France 24 English',
    country: 'FR',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/embed/live_stream?channel=UCQfwfsi5VrQ8yKZ-UWmAEFg',
    youtubeChannelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    description: 'France 24 live international news in English',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/APkrFKZqDnBTGd5vV8FYYCg2XJnK3hH-5xI0c1iWnAFq=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    verified: true,
    metadata: {
      genre: 'news',
      tags: ['france24', 'french-news', 'international']
    }
  }
];

async function seedDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('Connected to database');

    const channelRepository = AppDataSource.getRepository('Channel');

    // Clear existing data
    await channelRepository.delete({});
    console.log('Cleared existing channels');

    // Insert seed data
    for (const channelData of seedChannels) {
      // Generate content fingerprint
      const fingerprint = crypto
        .createHash('md5')
        .update(channelData.sourceUrl)
        .digest('hex')
        .substring(0, 16);

      const channel = {
        ...channelData,
        active: true,
        firstSeen: new Date(),
        lastSeen: new Date(),
        contentFingerprint: fingerprint
      };

      await channelRepository.save(channel);
      console.log(`✅ Inserted channel: ${channelData.name}`);
    }

    console.log(`\n🎉 Successfully seeded ${seedChannels.length} channels`);

    // Verify the data
    const count = await channelRepository.count();
    console.log(`📊 Total channels in database: ${count}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedChannels };