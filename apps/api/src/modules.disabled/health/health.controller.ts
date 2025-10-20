import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'System health check',
    description: 'Returns comprehensive system health status including all components'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string' },
        components: {
          type: 'object',
          properties: {
            database: { $ref: '#/components/schemas/ComponentHealth' },
            memory: { $ref: '#/components/schemas/ComponentHealth' },
            disk: { $ref: '#/components/schemas/ComponentHealth' },
            channels: { $ref: '#/components/schemas/ComponentHealth' },
            analytics: { $ref: '#/components/schemas/ComponentHealth' }
          }
        }
      }
    }
  })
  async getHealth() {
    return this.healthService.getSystemHealth();
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Simple endpoint to verify service is running'
  })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async getLiveness() {
    return this.healthService.getLivenessCheck();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Endpoint to verify service is ready to handle requests'
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async getReadiness() {
    return this.healthService.getReadinessCheck();
  }
}