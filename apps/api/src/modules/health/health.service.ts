import { Injectable, Logger } from '@nestjs/common';
import { HealthResponse, HealthCheck } from '@liveworldtv/shared-types';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  async checkHealth(): Promise<HealthResponse> {
    const components: HealthCheck[] = [];

    // Check API service itself
    components.push(this.checkApiService());

    // Check database (if configured)
    // TODO: Add database health check when TypeORM is enabled
    // components.push(await this.checkDatabase());

    // Check Redis (if configured)
    // TODO: Add Redis health check when cache is enabled
    // components.push(await this.checkRedis());

    // Check memory usage
    components.push(this.checkMemory());

    // Determine overall status
    const hasUnhealthy = components.some((c) => c.status === 'unhealthy');
    const hasDegraded = components.some((c) => c.status === 'degraded');

    const overallStatus = hasUnhealthy
      ? 'unhealthy'
      : hasDegraded
      ? 'degraded'
      : 'healthy';

    return {
      status: overallStatus,
      components,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      timestamp: new Date(),
    };
  }

  private checkApiService(): HealthCheck {
    return {
      component: 'api',
      status: 'healthy',
      metrics: {
        uptime: process.uptime(),
        version: process.env.npm_package_version || '0.1.0',
        nodeVersion: process.version,
        platform: process.platform,
      },
      lastCheck: new Date(),
    };
  }

  private checkMemory(): HealthCheck {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rss = Math.round(usage.rss / 1024 / 1024);
    const percentage = (heapUsedMB / heapTotalMB) * 100;

    // Warn if memory usage is above 80%
    const status = percentage > 90 ? 'unhealthy' : percentage > 80 ? 'degraded' : 'healthy';

    return {
      component: 'memory',
      status,
      metrics: {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        rss: `${rss}MB`,
        percentage: `${percentage.toFixed(1)}%`,
      },
      lastCheck: new Date(),
    };
  }

  // TODO: Implement when TypeORM is enabled
  // private async checkDatabase(): Promise<HealthCheck> {
  //   try {
  //     const start = Date.now();
  //     await this.connection.query('SELECT 1');
  //     const duration = Date.now() - start;
  //
  //     return {
  //       component: 'database',
  //       status: duration < 100 ? 'healthy' : duration < 500 ? 'degraded' : 'unhealthy',
  //       metrics: {
  //         responseTime: `${duration}ms`,
  //         connected: true,
  //       },
  //       lastCheck: new Date(),
  //     };
  //   } catch (error) {
  //     this.logger.error('Database health check failed', error);
  //     return {
  //       component: 'database',
  //       status: 'unhealthy',
  //       metrics: {
  //         connected: false,
  //         error: error.message,
  //       },
  //       lastCheck: new Date(),
  //     };
  //   }
  // }

  // TODO: Implement when Redis is enabled
  // private async checkRedis(): Promise<HealthCheck> {
  //   try {
  //     const start = Date.now();
  //     await this.cacheManager.store.client.ping();
  //     const duration = Date.now() - start;
  //
  //     return {
  //       component: 'redis',
  //       status: duration < 50 ? 'healthy' : duration < 200 ? 'degraded' : 'unhealthy',
  //       metrics: {
  //         responseTime: `${duration}ms`,
  //         connected: true,
  //       },
  //       lastCheck: new Date(),
  //     };
  //   } catch (error) {
  //     this.logger.error('Redis health check failed', error);
  //     return {
  //       component: 'redis',
  //       status: 'unhealthy',
  //       metrics: {
  //         connected: false,
  //         error: error.message,
  //       },
  //       lastCheck: new Date(),
  //     };
  //   }
  // }
}
