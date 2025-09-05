"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RankingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const cache_manager_1 = require("@nestjs/cache-manager");
const ranking_controller_1 = require("./ranking.controller");
const ranking_service_1 = require("./ranking.service");
const channel_entity_1 = require("../../entities/channel.entity");
const analytics_event_entity_1 = require("../../entities/analytics-event.entity");
let RankingModule = class RankingModule {
};
exports.RankingModule = RankingModule;
exports.RankingModule = RankingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([channel_entity_1.Channel, analytics_event_entity_1.AnalyticsEvent]),
            cache_manager_1.CacheModule.register({
                ttl: 300, // 5 minutes
                max: 1000,
            }),
        ],
        controllers: [ranking_controller_1.RankingController],
        providers: [ranking_service_1.RankingService],
        exports: [ranking_service_1.RankingService],
    })
], RankingModule);
