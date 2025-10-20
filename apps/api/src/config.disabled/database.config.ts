import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { Channel } from '../modules/catalog/entities/channel.entity'
import { LiveStream } from '../modules/catalog/entities/live-stream.entity'
import { RankingStats } from '../entities/ranking-stats.entity'
import { UserSession } from '../entities/user-session.entity'
import { PlayEvent } from '../entities/analytics-event.entity'

export const databaseConfig = (): TypeOrmModuleOptions => {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/liveworldtv_dev'
  
  return {
    type: 'postgres',
    url: databaseUrl,
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
  }
}