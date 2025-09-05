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
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bull_1 = require("@nestjs/bull");
const analytics_event_entity_1 = require("../../entities/analytics-event.entity");
const channel_entity_1 = require("../../entities/channel.entity");
let AnalyticsService = class AnalyticsService {
    analyticsRepository;
    channelRepository;
    analyticsQueue;
    constructor(analyticsRepository, channelRepository, analyticsQueue) {
        this.analyticsRepository = analyticsRepository;
        this.channelRepository = channelRepository;
        this.analyticsQueue = analyticsQueue;
    }
    async recordEvent(eventData) {
        const event = this.analyticsRepository.create({
            sessionId: eventData.sessionId,
            eventType: eventData.eventType,
            channelId: eventData.channelId,
            metadata: eventData.metadata,
            createdAt: new Date()
        });
        const savedEvent = await this.analyticsRepository.save(event);
        await this.analyticsQueue.add('process-event', {
            eventId: savedEvent.id,
            eventType: eventData.eventType,
            channelId: eventData.channelId
        });
        return {
            id: savedEvent.id,
            success: true,
            timestamp: savedEvent.createdAt.toISOString()
        };
    }
    async getChannelMetrics(channelId, startDate, endDate) {
        const events = await this.analyticsRepository
            .createQueryBuilder('event')
            .where('event.channel_id = :channelId', { channelId })
            .andWhere('event.created_at >= :startDate', { startDate })
            .andWhere('event.created_at <= :endDate', { endDate })
            .getMany();
        const sessions = new Set(events.map(e => e.sessionId)).size;
        const dubbingStarted = events.filter(e => e.eventType === 'DUBBING_STARTED').length;
        const dubbingCompleted = events.filter(e => e.eventType === 'DUBBING_STOPPED').length;
        const sessionDurations = events
            .filter(e => e.sessionDuration && e.sessionDuration > 0)
            .map(e => e.sessionDuration);
        const avgSessionDuration = sessionDurations.length > 0
            ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
            : 0;
        const maxSessionDuration = sessionDurations.length > 0
            ? Math.max(...sessionDurations)
            : 0;
        return {
            channelId,
            dateRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            },
            totalSessions: sessions,
            totalDubbingStarted: dubbingStarted,
            totalDubbingCompleted: dubbingCompleted,
            avgSessionDuration: Math.round(avgSessionDuration),
            maxSessionDuration,
            completionRate: dubbingStarted > 0 ? (dubbingCompleted / dubbingStarted) * 100 : 0,
            popularLanguages: await this.getPopularLanguages(channelId, startDate, endDate),
            hourlyDistribution: await this.getHourlyDistribution(channelId, startDate, endDate)
        };
    }
    async getGlobalMetrics(startDate, endDate, country, topic) {
        const query = this.analyticsRepository
            .createQueryBuilder('event')
            .where('event.created_at >= :startDate', { startDate })
            .andWhere('event.created_at <= :endDate', { endDate });
        if (country) {
            query.innerJoin('event.channel', 'channel')
                .andWhere('channel.country = :country', { country });
        }
        if (topic) {
            query.innerJoin('event.channel', 'channel')
                .andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
        }
        const events = await query.getMany();
        const uniqueChannels = new Set(events.map(e => e.channelId)).size;
        const sessions = new Set(events.map(e => e.sessionId)).size;
        const dubbingStarted = events.filter(e => e.eventType === 'DUBBING_STARTED').length;
        const dubbingCompleted = events.filter(e => e.eventType === 'DUBBING_STOPPED').length;
        const sessionDurations = events
            .filter(e => e.sessionDuration && e.sessionDuration > 0)
            .map(e => e.sessionDuration);
        const avgSessionDuration = sessionDurations.length > 0
            ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
            : 0;
        return {
            channelId: 'global',
            dateRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            },
            totalSessions: sessions,
            totalDubbingStarted: dubbingStarted,
            totalDubbingCompleted: dubbingCompleted,
            avgSessionDuration: Math.round(avgSessionDuration),
            maxSessionDuration: sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0,
            completionRate: dubbingStarted > 0 ? (dubbingCompleted / dubbingStarted) * 100 : 0,
            uniqueChannels,
            popularLanguages: await this.getPopularLanguagesGlobal(startDate, endDate, country, topic),
            hourlyDistribution: await this.getHourlyDistributionGlobal(startDate, endDate, country, topic)
        };
    }
    async getPopularLanguages(channelId, startDate, endDate) {
        const results = await this.analyticsRepository
            .createQueryBuilder('event')
            .select("event.metadata->>'targetLanguage'", 'language')
            .addSelect('COUNT(*)', 'count')
            .where('event.channel_id = :channelId', { channelId })
            .andWhere('event.created_at >= :startDate', { startDate })
            .andWhere('event.created_at <= :endDate', { endDate })
            .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
            .andWhere("event.metadata->>'targetLanguage' IS NOT NULL")
            .groupBy("event.metadata->>'targetLanguage'")
            .orderBy('count', 'DESC')
            .limit(10)
            .getRawMany();
        return results.map(result => ({
            language: result.language,
            count: parseInt(result.count)
        }));
    }
    async getPopularLanguagesGlobal(startDate, endDate, country, topic) {
        const query = this.analyticsRepository
            .createQueryBuilder('event')
            .select("event.metadata->>'targetLanguage'", 'language')
            .addSelect('COUNT(*)', 'count')
            .where('event.created_at >= :startDate', { startDate })
            .andWhere('event.created_at <= :endDate', { endDate })
            .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
            .andWhere("event.metadata->>'targetLanguage' IS NOT NULL");
        if (country) {
            query.innerJoin('event.channel', 'channel')
                .andWhere('channel.country = :country', { country });
        }
        if (topic) {
            query.innerJoin('event.channel', 'channel')
                .andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
        }
        const results = await query
            .groupBy("event.metadata->>'targetLanguage'")
            .orderBy('count', 'DESC')
            .limit(10)
            .getRawMany();
        return results.map(result => ({
            language: result.language,
            count: parseInt(result.count)
        }));
    }
    async getHourlyDistribution(channelId, startDate, endDate) {
        const results = await this.analyticsRepository
            .createQueryBuilder('event')
            .select('EXTRACT(HOUR FROM event.created_at)', 'hour')
            .addSelect('COUNT(*)', 'count')
            .where('event.channel_id = :channelId', { channelId })
            .andWhere('event.created_at >= :startDate', { startDate })
            .andWhere('event.created_at <= :endDate', { endDate })
            .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
            .groupBy('EXTRACT(HOUR FROM event.created_at)')
            .orderBy('hour', 'ASC')
            .getRawMany();
        return results.map(result => ({
            hour: parseInt(result.hour),
            count: parseInt(result.count)
        }));
    }
    async getHourlyDistributionGlobal(startDate, endDate, country, topic) {
        const query = this.analyticsRepository
            .createQueryBuilder('event')
            .select('EXTRACT(HOUR FROM event.created_at)', 'hour')
            .addSelect('COUNT(*)', 'count')
            .where('event.created_at >= :startDate', { startDate })
            .andWhere('event.created_at <= :endDate', { endDate })
            .andWhere('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' });
        if (country) {
            query.innerJoin('event.channel', 'channel')
                .andWhere('channel.country = :country', { country });
        }
        if (topic) {
            query.innerJoin('event.channel', 'channel')
                .andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
        }
        const results = await query
            .groupBy('EXTRACT(HOUR FROM event.created_at)')
            .orderBy('hour', 'ASC')
            .getRawMany();
        return results.map(result => ({
            hour: parseInt(result.hour),
            count: parseInt(result.count)
        }));
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(analytics_event_entity_1.AnalyticsEvent)),
    __param(1, (0, typeorm_1.InjectRepository)(channel_entity_1.Channel)),
    __param(2, (0, bull_1.InjectQueue)('analytics')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository, Object])
], AnalyticsService);
