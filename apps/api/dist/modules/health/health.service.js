"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const terminus_1 = require("@nestjs/terminus");
const channel_entity_1 = require("../../entities/channel.entity");
const analytics_event_entity_1 = require("../../entities/analytics-event.entity");
let HealthService = class HealthService {
    health;
    db;
    memory;
    disk;
    channelRepository;
    analyticsRepository;
    startTime = Date.now();
    constructor(health, db, memory, disk, channelRepository, analyticsRepository) {
        this.health = health;
        this.db = db;
        this.memory = memory;
        this.disk = disk;
        this.channelRepository = channelRepository;
        this.analyticsRepository = analyticsRepository;
    }
    async getSystemHealth() {
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
    async getLivenessCheck() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString()
        };
    }
    async getReadinessCheck() {
        const health = await this.getSystemHealth();
        if (health.status === 'unhealthy') {
            throw new Error('System not ready');
        }
        return health;
    }
    async checkDatabase() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: `Database error: ${error.message}`
            };
        }
    }
    async checkMemory() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: `Memory error: ${error.message}`
            };
        }
    }
    async checkDisk() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: `Disk error: ${error.message}`
            };
        }
    }
    async checkChannels() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: `Channel check error: ${error.message}`
            };
        }
    }
    async checkAnalytics() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: `Analytics check error: ${error.message}`
            };
        }
    }
    determineOverallStatus(components) {
        const statuses = Object.values(components).map(c => c.status);
        if (statuses.some(status => status === 'unhealthy')) {
            return 'unhealthy';
        }
        if (statuses.some(status => status === 'degraded')) {
            return 'degraded';
        }
        return 'healthy';
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, typeorm_1.InjectRepository)(channel_entity_1.Channel)),
    __param(5, (0, typeorm_1.InjectRepository)(analytics_event_entity_1.AnalyticsEvent)),
    __metadata("design:paramtypes", [terminus_1.HealthCheckService,
        terminus_1.TypeOrmHealthIndicator,
        terminus_1.MemoryHealthIndicator,
        terminus_1.DiskHealthIndicator,
        typeorm_2.Repository,
        typeorm_2.Repository])
], HealthService);
