import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { Channel } from '../modules/catalog/entities/channel.entity'
import { LiveStream } from '../modules/catalog/entities/live-stream.entity'
import { RankingStats } from '../modules/ranking/entities/ranking-stats.entity'
import { UserSession } from '../modules/analytics/entities/user-session.entity'
import { PlayEvent } from '../modules/analytics/entities/play-event.entity'

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Channel, LiveStream, RankingStats, UserSession, PlayEvent],
  synchronize: false, // Use migrations instead
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
  retryAttempts: 3,
  retryDelay: 3000,
  maxQueryExecutionTime: 10000, // 10s timeout
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  extra: {
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000
  }
})