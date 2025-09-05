import { CacheModuleOptions } from '@nestjs/cache-manager'
import { redisStore } from 'cache-manager-redis-store'

export const redisConfig = (): CacheModuleOptions => ({
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  ttl: 300, // Default TTL: 5 minutes
  max: 1000, // Max items in cache
  retryAttempts: 3,
  retryDelay: 1000,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  commandTimeout: 5000
})