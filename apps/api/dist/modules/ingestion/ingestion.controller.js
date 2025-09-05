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
exports.IngestionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ingestion_service_1 = require("./ingestion.service");
let IngestionController = class IngestionController {
    ingestionService;
    constructor(ingestionService) {
        this.ingestionService = ingestionService;
    }
    async scheduleIngestion(body) {
        return this.ingestionService.scheduleIngestion(body.country, body.source, body.priority);
    }
    async scheduleAllCountries() {
        return this.ingestionService.scheduleAllCountries();
    }
    async getIngestionStatus() {
        return this.ingestionService.getIngestionStatus();
    }
};
exports.IngestionController = IngestionController;
__decorate([
    (0, common_1.Post)('schedule'),
    (0, swagger_1.ApiOperation)({
        summary: 'Schedule channel ingestion',
        description: 'Schedules a background job to scrape channels for specified country and source'
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                country: { type: 'string', enum: ['US', 'UK', 'DE', 'FR', 'ES', 'JP', 'IT', 'PT', 'RU', 'KR', 'CN'] },
                source: { type: 'string', enum: ['youtube', 'twitch', 'dailymotion'] },
                priority: { type: 'number', minimum: 1, maximum: 10 }
            },
            required: ['country']
        }
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Ingestion job scheduled' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "scheduleIngestion", null);
__decorate([
    (0, common_1.Post)('schedule-all'),
    (0, swagger_1.ApiOperation)({
        summary: 'Schedule ingestion for all countries',
        description: 'Schedules background jobs to scrape channels for all supported countries'
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'All ingestion jobs scheduled' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "scheduleAllCountries", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get ingestion status',
        description: 'Returns current status of ingestion queue and recent job history'
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Ingestion queue status',
        schema: {
            type: 'object',
            properties: {
                queueStats: {
                    type: 'object',
                    properties: {
                        waiting: { type: 'number' },
                        active: { type: 'number' },
                        completed: { type: 'number' },
                        failed: { type: 'number' }
                    }
                },
                recentJobs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            progress: { type: 'number' },
                            processedOn: { type: 'number' },
                            finishedOn: { type: 'number' },
                            failedReason: { type: 'string' }
                        }
                    }
                },
                lastSuccessfulRun: { type: 'string', format: 'date-time' }
            }
        }
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "getIngestionStatus", null);
exports.IngestionController = IngestionController = __decorate([
    (0, swagger_1.ApiTags)('ingestion'),
    (0, common_1.Controller)('ingestion'),
    __metadata("design:paramtypes", [ingestion_service_1.IngestionService])
], IngestionController);
