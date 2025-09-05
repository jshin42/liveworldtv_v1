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
exports.RankingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const cache_manager_1 = require("@nestjs/cache-manager");
const channel_entity_1 = require("../../entities/channel.entity");
const analytics_event_entity_1 = require("../../entities/analytics-event.entity");
let RankingService = class RankingService {
    channelRepository;
    analyticsRepository;
    cacheManager;
    constructor(channelRepository, analyticsRepository, cacheManager) {
        this.channelRepository = channelRepository;
        this.analyticsRepository = analyticsRepository;
        this.cacheManager = cacheManager;
    }
    async getTrendingChannels(country, topic, timeWindow = '24h') {
        const cacheKey = `trending:${country || 'global'}:${topic || 'all'}:${timeWindow}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }
        const timeWindowMs = this.getTimeWindowMs(timeWindow);
        const cutoffTime = new Date(Date.now() - timeWindowMs);
        const query = this.analyticsRepository
            .createQueryBuilder('event')
            .select('event.channel_id', 'channelId')
            .addSelect('COUNT(*)', 'viewCount')
            .addSelect('AVG(event.session_duration)', 'avgDuration')
            .innerJoin('event.channel', 'channel')
            .where('event.event_type = :eventType', { eventType: 'DUBBING_STARTED' })
            .andWhere('event.created_at >= :cutoffTime', { cutoffTime })
            .groupBy('event.channel_id')
            .orderBy('viewCount', 'DESC')
            .limit(50);
        if (country) {
            query.andWhere('channel.country = :country', { country });
        }
        if (topic) {
            query.andWhere('channel.topics @> :topic', { topic: JSON.stringify([topic]) });
        }
        const rawResults = await query.getRawMany();
        const channelIds = rawResults.map(result => result.channelId);
        const channels = await this.channelRepository.findByIds(channelIds);
        const channelMap = new Map(channels.map(channel => [channel.id, channel]));
        const rankings = rawResults
            .map(result => {
            const channel = channelMap.get(result.channelId);
            if (!channel)
                return null;
            return {
                rank: 0, // Will be set below
                channel: {
                    id: channel.id,
                    name: channel.name,
                    description: channel.description,
                    url: channel.url,
                    language: channel.language,
                    country: channel.country,
                    topics: channel.topics,
                    qualityScore: channel.qualityScore,
                    lastChecked: channel.lastChecked
                },
                metrics: {
                    viewCount: parseInt(result.viewCount),
                    avgSessionDuration: Math.round(parseFloat(result.avgDuration) || 0),
                    trendScore: this.calculateTrendScore(parseInt(result.viewCount), parseFloat(result.avgDuration) || 0, timeWindow)
                }
            };
        })
            .filter(item => item !== null)
            .map((item, index) => ({ ...item, rank: index + 1 }));
        const response = {
            rankings,
            metadata: {
                timeWindow,
                country: country || null,
                topic: topic || null,
                totalChannels: rankings.length,
                lastUpdated: new Date().toISOString()
            }
        };
        await this.cacheManager.set(cacheKey, response, 300000); // 5 minutes
        return response;
    }
    async getChannelRank(channelId, country, topic) {
        const rankings = await this.getTrendingChannels(country, topic, '24h');
        const channelRanking = rankings.rankings.find(r => r.channel.id === channelId);
        return channelRanking?.rank || null;
    }
    async getPersonalizedRankings(userId, country, topic) {
        const cacheKey = `personalized:${userId}:${country || 'global'}:${topic || 'all'}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }
        const userPreferences = await this.getUserPreferences(userId);
        const globalTrending = await this.getTrendingChannels(country, topic, '24h');
        const personalizedRankings = globalTrending.rankings
            .map(ranking => ({
            ...ranking,
            metrics: {
                ...ranking.metrics,
                trendScore: this.adjustTrendScoreForUser(ranking.metrics.trendScore, ranking.channel, userPreferences)
            }
        }))
            .sort((a, b) => b.metrics.trendScore - a.metrics.trendScore)
            .map((item, index) => ({ ...item, rank: index + 1 }));
        const response = {
            rankings: personalizedRankings,
            metadata: {
                ...globalTrending.metadata,
                personalized: true,
                userId
            }
        };
        await this.cacheManager.set(cacheKey, response, 600000); // 10 minutes
        return response;
    }
    getTimeWindowMs(timeWindow) {
        switch (timeWindow) {
            case '1h': return 60 * 60 * 1000;
            case '24h': return 24 * 60 * 60 * 1000;
            case '7d': return 7 * 24 * 60 * 60 * 1000;
        }
    }
    calculateTrendScore(viewCount, avgDuration, timeWindow) {
        const baseScore = viewCount * (avgDuration / 60);
        const timeWindowMultiplier = {
            '1h': 10,
            '24h': 1,
            '7d': 0.1
        }[timeWindow] || 1;
        return Math.round(baseScore * timeWindowMultiplier);
    }
    async getUserPreferences(userId) {
        return {
            preferredLanguages: ['en'],
            preferredTopics: [],
            watchHistory: []
        };
    }
    adjustTrendScoreForUser(baseScore, channel, userPrefs) {
        let adjustedScore = baseScore;
        if (userPrefs.preferredLanguages.includes(channel.language)) {
            adjustedScore *= 1.2;
        }
        if (userPrefs.preferredTopics.some((topic) => channel.topics.includes(topic))) {
            adjustedScore *= 1.5;
        }
        return Math.round(adjustedScore);
    }
};
exports.RankingService = RankingService;
exports.RankingService = RankingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(channel_entity_1.Channel)),
    __param(1, (0, typeorm_1.InjectRepository)(analytics_event_entity_1.AnalyticsEvent)),
    __param(2, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository, Object])
], RankingService);
