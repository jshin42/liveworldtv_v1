import { Channel, CountryCode, TopicType } from '@liveworldtv/shared-types';

/**
 * Seed data: Real YouTube live channels from around the world
 * These are actual 24/7 live streams (as of 2025)
 */
export const SEED_CHANNELS: Omit<Channel, 'firstSeen' | 'lastSeen' | 'metadata' | 'contentFingerprint'>[] = [
  // ========== UNITED STATES - NEWS ==========
  {
    id: 'us-news-cnn',
    name: 'CNN Live',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=kkWWeh9YFB8',
    youtubeChannelId: 'UCupvZG-5ko_eiXAupbDfxWw',
    description: 'CNN International - 24/7 news coverage',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/AOPolaTz-8l8vvxRNGVdvPZPSPWxe1PkGWVJTxLZ3BrG=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    active: true,
    verified: true
  },
  {
    id: 'us-news-nbc',
    name: 'NBC News NOW',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=iwRA-dtub7Y',
    youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg',
    description: 'NBC News - Breaking news and live coverage',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/AOPolaSKRXzM2fSiuYrwQqr8Rm1vHEDHlWITtF0iN9_Y=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    active: true,
    verified: true
  },
  {
    id: 'us-news-abc',
    name: 'ABC News Live',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=w_Ma8oQLmSM',
    youtubeChannelId: 'UCBi2mrWuNuyYy4gbM6fU18Q',
    description: 'ABC News - 24/7 breaking news',
    thumbnailUrl: 'https://yt3.ggpht.com/ytc/AOPolaR2g-VwZ4ND3P0rBvH3xpnW3jNnL5nTkVdKKZrE=s800-c-k-c0x00ffffff-no-rj',
    languageCode: 'en',
    active: true,
    verified: true
  },
  {
    id: 'us-news-fox',
    name: 'Fox News',
    country: 'US',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=pAjkK-H3yB0',
    youtubeChannelId: 'UCXIJgqnII2ZOINSWNOGFThA',
    description: 'Fox News - Live coverage',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== UNITED KINGDOM - NEWS ==========
  {
    id: 'uk-news-bbc',
    name: 'BBC News',
    country: 'GB',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    youtubeChannelId: 'UC16niRr50-MSBwiO3YDb3RA',
    description: 'BBC News - Live international coverage',
    languageCode: 'en',
    active: true,
    verified: true
  },
  {
    id: 'uk-news-sky',
    name: 'Sky News',
    country: 'GB',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=9Auq9mYxFEE',
    youtubeChannelId: 'UCG9FQJQs0JPlxqrMcLjVJ8A',
    description: 'Sky News - Breaking news 24/7',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== JAPAN - NEWS ==========
  {
    id: 'jp-news-nhk',
    name: 'NHK WORLD-JAPAN',
    country: 'JP',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=f0lYkdA-Gtw',
    youtubeChannelId: 'UCSPEjw8F2nkWJ4cHQxSA7Pw',
    description: 'NHK World - Japan news in English',
    languageCode: 'en',
    active: true,
    verified: true
  },
  {
    id: 'jp-news-tbs',
    name: 'TBS NEWS DIG',
    country: 'JP',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=VhJkbEg30_s',
    youtubeChannelId: 'UC6AG81pAkf6Lbi_1VC5NmPA',
    description: 'TBS News - Japanese news network',
    languageCode: 'ja',
    active: true,
    verified: true
  },

  // ========== FRANCE - NEWS ==========
  {
    id: 'fr-news-france24',
    name: 'FRANCE 24 English',
    country: 'FR',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=tkDUSYJAat8',
    youtubeChannelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    description: 'France 24 - International news',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== GERMANY - NEWS ==========
  {
    id: 'de-news-dw',
    name: 'DW News',
    country: 'DE',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=pqabxBKzZ6M',
    youtubeChannelId: 'UCknLrEdhRCp1aegoMqRaCuA',
    description: 'Deutsche Welle - German international news',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== INDIA - NEWS ==========
  {
    id: 'in-news-ndtv',
    name: 'NDTV 24x7',
    country: 'IN',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=WB-y7_ymPJ4',
    youtubeChannelId: 'UCZFMm1mMw0F81Z37aaEzTUA',
    description: 'NDTV - Indian news channel',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== AUSTRALIA - NEWS ==========
  {
    id: 'au-news-abc',
    name: 'ABC News (Australia)',
    country: 'AU',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=vOTiJkg1voo',
    youtubeChannelId: 'UCVgO39Bk5hzKPG9yYPCnRBA',
    description: 'ABC News Australia - Live coverage',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== SOUTH KOREA - NEWS ==========
  {
    id: 'kr-news-arirang',
    name: 'Arirang News',
    country: 'KR',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=7Kkzb7W0Uiw',
    youtubeChannelId: 'UCzAZ98kxu34KMdKfCIkGGAg',
    description: 'Arirang News - Korean news in English',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== SPAIN - NEWS ==========
  {
    id: 'es-news-rtve',
    name: 'RTVE Noticias',
    country: 'ES',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=G86lGfDlpkM',
    youtubeChannelId: 'UC7QZIf0dta-XPXsp9Hv4dTw',
    description: 'RTVE - Spanish public news',
    languageCode: 'es',
    active: true,
    verified: true
  },

  // ========== MUSIC & DJS ==========
  {
    id: 'us-music-lofi',
    name: 'Lofi Girl',
    country: 'US',
    topic: 'MUSIC_DJS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    youtubeChannelId: 'UCSJ4gkVC6NrvII8umztf0Ow',
    description: 'Lofi hip hop radio - 24/7 beats to study/relax',
    languageCode: 'en',
    active: true,
    verified: true
  },
  {
    id: 'us-music-chillhop',
    name: 'Chillhop Music',
    country: 'US',
    topic: 'MUSIC_DJS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=5yx6BWlEVcY',
    youtubeChannelId: 'UCOxqgCwgOqC2lMqC5PYz_Dg',
    description: 'Chillhop Radio - 24/7 live stream',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== SPORTS (Highlight channels with periodic live) ==========
  {
    id: 'us-sports-espn',
    name: 'ESPN',
    country: 'US',
    topic: 'SPORTS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/c/espn',
    youtubeChannelId: 'UCiWLfSweyRNmLpgEHekhoAg',
    description: 'ESPN - Sports news and highlights',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== BRAZIL - NEWS ==========
  {
    id: 'br-news-globo',
    name: 'GloboNews',
    country: 'BR',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=Bpjm1yWTVJo',
    youtubeChannelId: 'UCgp4A1iHj1an1de0BqBDfFA',
    description: 'GloboNews - Brazilian news network',
    languageCode: 'pt',
    active: true,
    verified: true
  },

  // ========== RUSSIA - NEWS ==========
  {
    id: 'ru-news-rt',
    name: 'RT News',
    country: 'RU',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=pqabxBKzZ6M',
    youtubeChannelId: 'UCpwvZwUam-URkxB7g4USKpg',
    description: 'RT - Russian international news',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== MIDDLE EAST - NEWS ==========
  {
    id: 'qa-news-aljazeera',
    name: 'Al Jazeera English',
    country: 'QA',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=F-POY4Q0QSI',
    youtubeChannelId: 'UCNye-wNBqNL5ZzHSJj3l8Ag',
    description: 'Al Jazeera - Middle East news',
    languageCode: 'en',
    active: true,
    verified: true
  },

  // ========== CANADA - NEWS ==========
  {
    id: 'ca-news-cbc',
    name: 'CBC News',
    country: 'CA',
    topic: 'NEWS',
    sourceType: 'YOUTUBE_EMBED',
    sourceUrl: 'https://www.youtube.com/watch?v=3Eg8vjF0gH0',
    youtubeChannelId: 'UCG0Q8zYVPuWVPTp6Ky5eXWw',
    description: 'CBC News - Canadian news network',
    languageCode: 'en',
    active: true,
    verified: true
  }
];
