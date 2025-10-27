import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponse } from '@liveworldtv/shared-types';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('health')
@Controller('health')
@SkipThrottle() // Health checks should not be rate limited
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns overall system health and status of all components',
  })
  @SwaggerResponse({
    status: 200,
    description: 'System is healthy',
  })
  @SwaggerResponse({
    status: 503,
    description: 'System is degraded or unhealthy',
  })
  async check(): Promise<HealthResponse> {
    return this.healthService.checkHealth();
  }

  @Get('/readiness')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Kubernetes readiness probe - checks if service is ready to receive traffic',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Service is ready',
  })
  @SwaggerResponse({
    status: 503,
    description: 'Service is not ready',
  })
  async readiness() {
    const health = await this.healthService.checkHealth();

    // Service is ready if it's healthy or degraded (but not unhealthy)
    const isReady = health.status !== 'unhealthy';

    return {
      status: isReady ? 'ready' : 'not ready',
      timestamp: health.timestamp,
    };
  }

  @Get('/liveness')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Kubernetes liveness probe - checks if service is alive and should not be restarted',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Service is alive',
  })
  async liveness() {
    // Liveness only checks if the process is running
    // If this endpoint responds, the service is alive
    return {
      status: 'alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
