import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CatalogModule } from './modules/catalog/catalog.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env'
    }),
    
    // Temporarily disabled until entities compile properly:
    // TypeOrmModule.forRootAsync({
    //   useFactory: databaseConfig
    // }),
    // 
    // BullModule.forRootAsync({
    //   useFactory: redisConfig
    // }),
    
    CatalogModule,
    HealthModule,
    // Disabled until TypeScript errors resolved:
    // RankingModule,
    // AnalyticsModule,
    // IngestionModule
  ]
})
export class AppModule {}