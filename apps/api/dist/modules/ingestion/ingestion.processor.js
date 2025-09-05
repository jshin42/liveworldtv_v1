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
exports.IngestionProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const ingestion_service_1 = require("./ingestion.service");
let IngestionProcessor = class IngestionProcessor {
    ingestionService;
    constructor(ingestionService) {
        this.ingestionService = ingestionService;
    }
    async processChannelScraping(job) {
        const { country, source } = job.data;
        console.log(`🔍 Starting ${source} ingestion for ${country}`);
        try {
            job.progress(10);
            const result = await this.ingestionService.ingestChannelsForCountry(country, source);
            job.progress(90);
            console.log(`✅ ${source} ingestion complete for ${country}:`, {
                found: result.channelsFound,
                added: result.channelsAdded,
                updated: result.channelsUpdated,
                errors: result.errors.length
            });
            job.progress(100);
            return result;
        }
        catch (error) {
            console.error(`❌ ${source} ingestion failed for ${country}:`, error);
            throw error;
        }
    }
};
exports.IngestionProcessor = IngestionProcessor;
__decorate([
    (0, bull_1.Process)('scrape-channels'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IngestionProcessor.prototype, "processChannelScraping", null);
exports.IngestionProcessor = IngestionProcessor = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)('ingestion'),
    __metadata("design:paramtypes", [ingestion_service_1.IngestionService])
], IngestionProcessor);
