import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CacheModule } from '@nestjs/cache-manager'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'
import { Channel } from '../../entities/channel.entity'
import { LiveStream } from './entities/live-stream.entity'
import { redisConfig } from '../../config/redis.config'

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, LiveStream]),
    CacheModule.registerAsync({
      useFactory: redisConfig
    })
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService]
})
export class CatalogModule {}