import { Module, Controller, Get, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';

@Controller()
class AppController {
  @Get()
  getHello() {
    return {
      message: 'LiveWorldTV API',
      version: '0.1.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting configuration
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: parseInt(config.get('RATE_LIMIT_WINDOW_MS', '60000'), 10),
        limit: parseInt(config.get('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
      }],
    }),
    HealthModule,
    CatalogModule,
  ],
  controllers: [AppController],
  providers: [
    // Apply throttle guard globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logger to all routes
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
