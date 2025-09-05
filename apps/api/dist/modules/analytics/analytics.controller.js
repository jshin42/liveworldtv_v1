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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const analytics_service_1 = require("./analytics.service");
let AnalyticsController = class AnalyticsController {
    analyticsService;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async recordEvent(eventData) {
        return this.analyticsService.recordEvent(eventData);
    }
    async getChannelMetrics(channelId, startDate, endDate) {
        return this.analyticsService.getChannelMetrics(channelId, new Date(startDate), new Date(endDate));
    }
    async getGlobalMetrics(startDate, endDate, country, topic) {
        return this.analyticsService.getGlobalMetrics(new Date(startDate), new Date(endDate), country, topic);
    }
    async getSessionEvents(sessionId) {
        return this.analyticsRepository.find({
            where: { sessionId },
            order: { createdAt: 'ASC' }
        });
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Post)('events'),
    (0, swagger_1.ApiOperation)({
        summary: 'Record analytics event',
        description: 'Records a new analytics event for tracking user behavior and system performance'
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                sessionId: { type: 'string' },
                eventType: { type: 'string', enum: ['DUBBING_STARTED', 'DUBBING_STOPPED', 'CHANNEL_DISCOVERED', 'MODEL_LOADED', 'ERROR'] },
                channelId: { type: 'string' },
                metadata: { type: 'object' }
            },
            required: ['sessionId', 'eventType']
        }
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Event recorded successfully' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "recordEvent", null);
__decorate([
    (0, common_1.Get)('metrics/channel/:channelId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get channel analytics metrics',
        description: 'Returns detailed analytics metrics for a specific channel within date range'
    }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: true, example: '2024-01-01' }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: true, example: '2024-01-31' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel analytics metrics' }),
    __param(0, (0, common_1.Param)('channelId')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getChannelMetrics", null);
__decorate([
    (0, common_1.Get)('metrics/global'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get global analytics metrics',
        description: 'Returns aggregated analytics metrics across all channels and users'
    }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'country', required: false, enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP'] }),
    (0, swagger_1.ApiQuery)({ name: 'topic', required: false, enum: ['news', 'entertainment', 'sports', 'tech'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Global analytics metrics' }),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('country')),
    __param(3, (0, common_1.Query)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getGlobalMetrics", null);
__decorate([
    (0, common_1.Get)('events/:sessionId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get events for session',
        description: 'Returns all analytics events for a specific session ID'
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Session events' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSessionEvents", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('analytics'),
    (0, common_1.Controller)('analytics'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
