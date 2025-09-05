"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bull_1 = require("@nestjs/bull");
const ingestion_controller_1 = require("./ingestion.controller");
const ingestion_service_1 = require("./ingestion.service");
const ingestion_processor_1 = require("./ingestion.processor");
const channel_scraper_service_1 = require("./channel-scraper.service");
const channel_entity_1 = require("../../entities/channel.entity");
const analytics_event_entity_1 = require("../../entities/analytics-event.entity");
let IngestionModule = class IngestionModule {
};
exports.IngestionModule = IngestionModule;
exports.IngestionModule = IngestionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([channel_entity_1.Channel, analytics_event_entity_1.AnalyticsEvent]),
            bull_1.BullModule.registerQueue({
                name: 'ingestion',
                defaultJobOptions: {
                    removeOnComplete: 100,
                    removeOnFail: 50,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                },
            }),
        ],
        controllers: [ingestion_controller_1.IngestionController],
        providers: [ingestion_service_1.IngestionService, ingestion_processor_1.IngestionProcessor, channel_scraper_service_1.ChannelScraper],
        exports: [ingestion_service_1.IngestionService],
    })
], IngestionModule);
