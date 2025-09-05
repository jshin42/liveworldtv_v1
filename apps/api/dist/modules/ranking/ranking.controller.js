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
exports.RankingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ranking_service_1 = require("./ranking.service");
let RankingController = class RankingController {
    rankingService;
    constructor(rankingService) {
        this.rankingService = rankingService;
    }
    async getTrending(country, topic, timeWindow) {
        return this.rankingService.getTrendingChannels(country, topic, timeWindow);
    }
    async getPersonalized(userId, country, topic) {
        return this.rankingService.getPersonalizedRankings(userId, country, topic);
    }
    async getChannelRank(channelId, country, topic) {
        const rank = await this.rankingService.getChannelRank(channelId, country, topic);
        return { channelId, rank };
    }
};
exports.RankingController = RankingController;
__decorate([
    (0, common_1.Get)('trending'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get trending channels',
        description: 'Returns channels ranked by popularity metrics within specified time window'
    }),
    (0, swagger_1.ApiQuery)({ name: 'country', required: false, enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP'] }),
    (0, swagger_1.ApiQuery)({ name: 'topic', required: false, enum: ['news', 'entertainment', 'sports', 'tech'] }),
    (0, swagger_1.ApiQuery)({ name: 'timeWindow', required: false, enum: ['1h', '24h', '7d'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Trending channels ranking' }),
    __param(0, (0, common_1.Query)('country')),
    __param(1, (0, common_1.Query)('topic')),
    __param(2, (0, common_1.Query)('timeWindow')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RankingController.prototype, "getTrending", null);
__decorate([
    (0, common_1.Get)('personalized/:userId'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get personalized channel rankings',
        description: 'Returns channels ranked based on user preferences and viewing history'
    }),
    (0, swagger_1.ApiQuery)({ name: 'country', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'topic', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Personalized channel rankings' }),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('country')),
    __param(2, (0, common_1.Query)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RankingController.prototype, "getPersonalized", null);
__decorate([
    (0, common_1.Get)('channel/:channelId/rank'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get specific channel rank',
        description: 'Returns the current ranking position of a specific channel'
    }),
    (0, swagger_1.ApiQuery)({ name: 'country', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'topic', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel rank information' }),
    __param(0, (0, common_1.Param)('channelId')),
    __param(1, (0, common_1.Query)('country')),
    __param(2, (0, common_1.Query)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RankingController.prototype, "getChannelRank", null);
exports.RankingController = RankingController = __decorate([
    (0, swagger_1.ApiTags)('rankings'),
    (0, common_1.Controller)('rankings'),
    __metadata("design:paramtypes", [ranking_service_1.RankingService])
], RankingController);
