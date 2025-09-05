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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
let CatalogService = class CatalogService {
    constructor() { }
    async getChannelsByCountryTopic(country, topic, pagination = { page: 1, limit: 20 }) {
        // For MVP, return mock data until entities compile
        const mockChannels = [
            {
                id: '1',
                name: 'CNN International',
                country,
                topic: topic || 'NEWS',
                sourceType: 'YOUTUBE_EMBED',
                sourceUrl: 'https://www.youtube.com/watch?v=live_stream_id',
                languageCode: 'en',
                active: true,
                verified: true,
                firstSeen: new Date(),
                lastSeen: new Date(),
                metadata: {},
                contentFingerprint: 'mock'
            }
        ];
        const result = {
            data: mockChannels,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: 1,
                hasNext: false
            }
        };
        return result;
    }
    async getChannelById(id) {
        // Mock implementation for MVP
        const mockChannel = {
            id,
            name: 'CNN International',
            country: 'US',
            topic: 'NEWS',
            sourceType: 'YOUTUBE_EMBED',
            sourceUrl: 'https://www.youtube.com/watch?v=live_stream_id',
            languageCode: 'en',
            active: true,
            verified: true,
            firstSeen: new Date(),
            lastSeen: new Date(),
            metadata: {},
            contentFingerprint: 'mock'
        };
        return mockChannel;
    }
    async getStreamStatus(channelId) {
        const mockStream = {
            id: '1',
            channelId,
            status: 'LIVE',
            delaySeconds: 30,
            dvrWindowSec: 3600,
            viewerCount: 1000,
            peakViewerCount: 1200,
            lastChecked: new Date(),
            qualityMetrics: {}
        };
        return mockStream;
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CatalogService);
