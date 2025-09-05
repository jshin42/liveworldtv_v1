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
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const catalog_service_1 = require("./catalog.service");
const channel_list_dto_1 = require("./dto/channel-list.dto");
let CatalogController = class CatalogController {
    catalogService;
    constructor(catalogService) {
        this.catalogService = catalogService;
    }
    async getChannels(filterDto) {
        const result = await this.catalogService.getChannelsByCountryTopic(filterDto.country, filterDto.topic, {
            page: filterDto.page || 1,
            limit: filterDto.limit || 20
        });
        return {
            data: result,
            meta: {
                timestamp: new Date().toISOString(),
                version: 'v1.0.0',
                requestId: this.generateRequestId()
            }
        };
    }
    async getChannel(id) {
        const channel = await this.catalogService.getChannelById(id);
        return {
            data: channel,
            meta: {
                timestamp: new Date().toISOString(),
                version: 'v1.0.0',
                requestId: this.generateRequestId()
            }
        };
    }
    async getStreamStatus(channelId) {
        const stream = await this.catalogService.getStreamStatus(channelId);
        return {
            data: stream,
            meta: {
                timestamp: new Date().toISOString(),
                version: 'v1.0.0',
                requestId: this.generateRequestId()
            }
        };
    }
    async matchUrl(body) {
        return this.catalogService.matchUrlToChannel(body.url);
    }
    async discoverChannels(country, source) {
        return this.catalogService.discoverChannels(country, source);
    }
    async searchChannels(query, country, limit) {
        const channels = await this.catalogService.searchChannels(query, country, limit);
        return {
            data: channels,
            meta: {
                timestamp: new Date().toISOString(),
                version: 'v1.0.0',
                requestId: this.generateRequestId()
            }
        };
    }
    async getChannelCount(country, topic) {
        const count = await this.catalogService.getActiveChannelCount(country, topic);
        return {
            data: { count },
            meta: {
                timestamp: new Date().toISOString(),
                version: 'v1.0.0',
                requestId: this.generateRequestId()
            }
        };
    }
    generateRequestId() {
        return require('crypto').randomBytes(16).toString('hex');
    }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List channels by country and topic' }),
    (0, swagger_1.ApiQuery)({ name: 'country', example: 'US', description: 'Two-letter country code' }),
    (0, swagger_1.ApiQuery)({ name: 'topic', enum: ['NEWS', 'SPORTS', 'MUSIC_DJS'], required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', example: 1, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', example: 20, required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel list retrieved successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid parameters' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [channel_list_dto_1.ChannelFilterDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getChannels", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get channel details by ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Channel not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getChannel", null);
__decorate([
    (0, common_1.Get)(':id/stream'),
    (0, swagger_1.ApiOperation)({ summary: 'Get live stream status for channel' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Stream status' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Stream not found' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getStreamStatus", null);
__decorate([
    (0, common_1.Post)('match-url'),
    (0, swagger_1.ApiOperation)({
        summary: 'Match URL to channel',
        description: 'Finds channel configuration for a given video URL'
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                url: { type: 'string', format: 'uri' }
            },
            required: ['url']
        }
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Matched channel configuration' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'No matching channel found' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "matchUrl", null);
__decorate([
    (0, common_1.Get)('discover/:country'),
    (0, swagger_1.ApiOperation)({
        summary: 'Discover new channels',
        description: 'Triggers real-time channel discovery for a specific country'
    }),
    (0, swagger_1.ApiParam)({ name: 'country', enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP'] }),
    (0, swagger_1.ApiQuery)({ name: 'source', required: false, enum: ['7pm', 'youtube', 'twitch'] }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Discovery initiated' }),
    __param(0, (0, common_1.Param)('country')),
    __param(1, (0, common_1.Query)('source')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "discoverChannels", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Search channels by text query' }),
    (0, swagger_1.ApiQuery)({ name: 'q', description: 'Search query' }),
    (0, swagger_1.ApiQuery)({ name: 'country', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, example: 10 }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Search results' }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('country')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "searchChannels", null);
__decorate([
    (0, common_1.Get)('stats/count'),
    (0, swagger_1.ApiOperation)({ summary: 'Get channel count statistics' }),
    (0, swagger_1.ApiQuery)({ name: 'country', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'topic', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel count' }),
    __param(0, (0, common_1.Query)('country')),
    __param(1, (0, common_1.Query)('topic')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getChannelCount", null);
exports.CatalogController = CatalogController = __decorate([
    (0, swagger_1.ApiTags)('catalog'),
    (0, common_1.Controller)('channels'),
    (0, common_1.Version)('1'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], CatalogController);
