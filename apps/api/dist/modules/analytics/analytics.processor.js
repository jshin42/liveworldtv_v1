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
exports.AnalyticsProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const analytics_event_entity_1 = require("../../entities/analytics-event.entity");
const channel_entity_1 = require("../../entities/channel.entity");
let AnalyticsProcessor = class AnalyticsProcessor {
    analyticsRepository;
    channelRepository;
    constructor(analyticsRepository, channelRepository) {
        this.analyticsRepository = analyticsRepository;
        this.channelRepository = channelRepository;
    }
    async processEvent(job) {
        const { eventId, eventType, channelId } = job.data;
        try {
            switch (eventType) {
                case 'DUBBING_STARTED':
                    await this.processDubbingStarted(eventId, channelId);
                    break;
                case 'DUBBING_STOPPED':
                    await this.processDubbingStopped(eventId, channelId);
                    break;
                case 'CHANNEL_DISCOVERED':
                    await this.processChannelDiscovered(eventId, channelId);
                    break;
                case 'MODEL_LOADED':
                    await this.processModelLoaded(eventId);
                    break;
                case 'ERROR':
                    await this.processError(eventId);
                    break;
            }
        }
        catch (error) {
            console.error(`Failed to process analytics event ${eventId}:`, error);
            throw error;
        }
    }
    async processDubbingStarted(eventId, channelId) {
        if (!channelId)
            return;
        await this.channelRepository
            .createQueryBuilder()
            .update(channel_entity_1.Channel)
            .set({
            totalSessions: () => 'total_sessions + 1',
            lastActivity: new Date()
        })
            .where('id = :channelId', { channelId })
            .execute();
        console.log(`✅ Updated channel ${channelId} session count`);
    }
    async processDubbingStopped(eventId, channelId) {
        if (!channelId)
            return;
        const event = await this.analyticsRepository.findOne({
            where: { id: eventId }
        });
        if (event?.sessionDuration) {
            const avgDurationQuery = await this.analyticsRepository
                .createQueryBuilder('event')
                .select('AVG(event.session_duration)', 'avgDuration')
                .where('event.channel_id = :channelId', { channelId })
                .andWhere('event.session_duration IS NOT NULL')
                .getRawOne();
            const avgDuration = Math.round(parseFloat(avgDurationQuery.avgDuration) || 0);
            await this.channelRepository
                .createQueryBuilder()
                .update(channel_entity_1.Channel)
                .set({ avgSessionDuration: avgDuration })
                .where('id = :channelId', { channelId })
                .execute();
        }
    }
    async processChannelDiscovered(eventId, channelId) {
        if (!channelId)
            return;
        await this.channelRepository
            .createQueryBuilder()
            .update(channel_entity_1.Channel)
            .set({
            discoveryCount: () => 'discovery_count + 1',
            lastChecked: new Date()
        })
            .where('id = :channelId', { channelId })
            .execute();
    }
    async processModelLoaded(eventId) {
        const event = await this.analyticsRepository.findOne({
            where: { id: eventId }
        });
        if (event?.metadata?.modelName && event?.metadata?.loadTime) {
            console.log(`📊 Model ${event.metadata.modelName} loaded in ${event.metadata.loadTime}ms`);
        }
    }
    async processError(eventId) {
        const event = await this.analyticsRepository.findOne({
            where: { id: eventId }
        });
        if (event?.metadata?.error) {
            console.error(`🚨 Analytics error logged:`, {
                eventId,
                error: event.metadata.error,
                channelId: event.channelId,
                sessionId: event.sessionId
            });
        }
    }
};
exports.AnalyticsProcessor = AnalyticsProcessor;
__decorate([
    (0, bull_1.Process)('process-event'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsProcessor.prototype, "processEvent", null);
exports.AnalyticsProcessor = AnalyticsProcessor = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)('analytics'),
    __param(0, (0, typeorm_1.InjectRepository)(analytics_event_entity_1.AnalyticsEvent)),
    __param(1, (0, typeorm_1.InjectRepository)(channel_entity_1.Channel)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AnalyticsProcessor);
