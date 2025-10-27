import { Module } from '@nestjs/common'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'

@Module({
  imports: [
    // Temporarily disabled until entities compile:
    // TypeOrmModule.forFeature([Channel, LiveStream]),
    // CacheModule.registerAsync({
    //   useFactory: redisConfig
    // })
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService]
})
export class CatalogModule {}