import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bull'
import { CatalogModule } from './modules/catalog/catalog.module'
import { RankingModule } from './modules/ranking/ranking.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { HealthModule } from './modules/health/health.module'
import { IngestionModule } from './modules/ingestion/ingestion.module'
import { databaseConfig } from './config/database.config'
import { redisConfig } from './config/redis.config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env'
    }),
    
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig
    }),
    
    BullModule.forRootAsync({
      useFactory: redisConfig
    }),
    
    CatalogModule,
    RankingModule,
    AnalyticsModule,
    HealthModule,
    IngestionModule
  ]
})
export class AppModule {}