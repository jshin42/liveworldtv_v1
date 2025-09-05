export type CountryCode = string // ISO 3166-1 alpha-2
export type TopicType = 'NEWS' | 'SPORTS' | 'MUSIC_DJS'
export type ChannelSource = 'YOUTUBE_EMBED' | 'LICENSED'
export type StreamStatus = 'LIVE' | 'OFF' | 'UNKNOWN'
export type EventType = 
  | 'PLAY_START' 
  | 'DUB_ENABLED' 
  | 'DUB_DISABLED' 
  | 'SEEK' 
  | 'STOP'
  | 'EXTENSION_INSTALLED' 
  | 'MODEL_LOADED' 
  | 'QUALITY_FEEDBACK'
  | 'MODEL_DOWNLOAD_START'
  | 'MODEL_DOWNLOAD_COMPLETE'

export interface Channel {
  id: string
  name: string
  country: CountryCode
  topic: TopicType
  sourceType: ChannelSource
  sourceUrl: string
  youtubeChannelId?: string
  owner?: string
  description?: string
  thumbnailUrl?: string
  languageCode: string
  firstSeen: Date
  lastSeen: Date
  active: boolean
  verified: boolean
  metadata: Record<string, any>
  contentFingerprint: string
}

export interface LiveStream {
  id: string
  channelId: string
  status: StreamStatus
  startedAt?: Date
  endedAt?: Date
  delaySeconds: number
  dvrWindowSec: number
  viewerCount: number
  peakViewerCount: number
  lastChecked: Date
  qualityMetrics: Record<string, any>
}

export interface RankingStats {
  channelId: string
  activationCtr: number
  avgWatchTimeSec: number
  bounceRate: number
  ttfmpMs?: number
  ttfmpP95Ms?: number
  dubbingLatencyP50Ms?: number
  dubbingLatencyP95Ms?: number
  mosProxy?: number
  speechRatio?: number
  werProxy?: number
  contentStability?: number
  sampleSize: number
  lastPlayEvent?: Date
  lastUpdated: Date
}

export interface UserSession {
  sessionId: string
  preferences: {
    country?: CountryCode
    topic?: TopicType
    autoplay: boolean
  }
  recentAutoplays: string[]
  extensionVersion?: string
  userAgentHash?: string
  browserCapabilities: Record<string, any>
  createdAt: Date
  lastActivity: Date
  expiresAt: Date
}

export interface PlayEvent {
  id: string
  sessionId?: string
  channelId?: string
  eventType: EventType
  eventTimestamp: Date
  metadata: Record<string, any>
  processingTimeMs?: number
}

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationResult {
  page: number
  limit: number
  total: number
  hasNext: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationResult
}

export interface ApiResponse<T> {
  data: T
  meta: {
    timestamp: string
    version: string
    requestId: string
  }
  pagination?: PaginationResult
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
  meta: {
    timestamp: string
    requestId: string
  }
}

export interface RankedChannel {
  channel: Channel
  score: number
  rank: number
  reason?: string
}

export interface TopicRail {
  topic: TopicType
  channels: RankedChannel[]
}

export interface HomeRanking {
  rails: TopicRail[]
  autoplay: {
    channel: RankedChannel
    reason: 'TRENDING' | 'POPULAR' | 'RANDOM' | 'PERSONALIZED'
  }
  lastUpdated: Date
}

export interface HealthCheck {
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  metrics: Record<string, any>
  lastCheck: Date
}