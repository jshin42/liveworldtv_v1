import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator
} from '@nestjs/terminus';
import { Channel } from '../../entities/channel.entity';
import { AnalyticsEvent } from '../../entities/analytics-event.entity';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
    channels: ComponentHealth;
    analytics: ComponentHealth;
  };
  metadata: {
    uptime: number;
    version: string;
    environment: string;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  metrics?: Record<string, any>;
}

@Injectable()
export class HealthService {
  private startTime = Date.now();

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
    @InjectRepository(AnalyticsEvent)
    private analyticsRepository: Repository<AnalyticsEvent>,
  ) {}

  async getSystemHealth(): Promise<SystemHealth> {
    const components = {
      database: await this.checkDatabase(),
      memory: await this.checkMemory(),
      disk: await this.checkDisk(),
      channels: await this.checkChannels(),
      analytics: await this.checkAnalytics(),
    };

    const overallStatus = this.determineOverallStatus(components);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components,
      metadata: {
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }

  async getLivenessCheck(): Promise<{ status: 'ok'; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  }

  async getReadinessCheck(): Promise<SystemHealth> {
    const health = await this.getSystemHealth();
    
    if (health.status === 'unhealthy') {
      throw new Error('System not ready');
    }
    
    return health;
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      const result = await this.health.check([
        () => this.db.pingCheck('database')
      ]);

      const dbHealth = result.info?.database;
      if (dbHealth?.status === 'up') {
        return {
          status: 'healthy',
          message: 'Database connection healthy',
          metrics: {
            responseTime: dbHealth.responseTime
          }
        };
      }

      return {
        status: 'unhealthy',
        message: 'Database connection failed'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database error: ${error.message}`
      };
    }
  }

  private async checkMemory(): Promise<ComponentHealth> {
    try {
      const result = await this.health.check([
        () => this.memory.checkHeap('memory', 1024 * 1024 * 1024) // 1GB limit
      ]);

      const memHealth = result.info?.memory;
      if (memHealth?.status === 'up') {
        const usedMB = Math.round(memHealth.heapUsed / 1024 / 1024);
        const totalMB = Math.round(memHealth.heapTotal / 1024 / 1024);
        
        return {
          status: usedMB > 800 ? 'degraded' : 'healthy',
          message: `Memory usage: ${usedMB}MB / ${totalMB}MB`,
          metrics: {
            heapUsed: usedMB,
            heapTotal: totalMB
          }
        };
      }

      return {
        status: 'unhealthy',
        message: 'Memory check failed'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Memory error: ${error.message}`
      };
    }
  }

  private async checkDisk(): Promise<ComponentHealth> {
    try {
      const result = await this.health.check([
        () => this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 90
        })
      ]);

      const diskHealth = result.info?.disk;
      if (diskHealth?.status === 'up') {
        return {
          status: 'healthy',
          message: 'Disk space sufficient',
          metrics: {
            free: diskHealth.free,
            size: diskHealth.size,
            used: diskHealth.used
          }
        };
      }

      return {
        status: 'degraded',
        message: 'Low disk space'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Disk error: ${error.message}`
      };
    }
  }

  private async checkChannels(): Promise<ComponentHealth> {
    try {
      const totalChannels = await this.channelRepository.count();
      const recentlyChecked = await this.channelRepository.count({
        where: {
          lastChecked: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      const healthyRatio = totalChannels > 0 ? recentlyChecked / totalChannels : 0;

      return {
        status: healthyRatio > 0.8 ? 'healthy' : healthyRatio > 0.5 ? 'degraded' : 'unhealthy',
        message: `${recentlyChecked}/${totalChannels} channels recently validated`,
        metrics: {
          totalChannels,
          recentlyChecked,
          healthyRatio: Math.round(healthyRatio * 100)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Channel check error: ${error.message}`
      };
    }
  }

  private async checkAnalytics(): Promise<ComponentHealth> {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentEvents = await this.analyticsRepository.count({
        where: {
          createdAt: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      });

      const totalEvents24h = await this.analyticsRepository.count({
        where: {
          createdAt: last24h
        }
      });

      return {
        status: 'healthy',
        message: `${recentEvents} events in last hour`,
        metrics: {
          eventsLastHour: recentEvents,
          eventsLast24h: totalEvents24h,
          eventsPerHour: Math.round(totalEvents24h / 24)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Analytics check error: ${error.message}`
      };
    }
  }

  private determineOverallStatus(components: Record<string, ComponentHealth>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.some(status => status === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}