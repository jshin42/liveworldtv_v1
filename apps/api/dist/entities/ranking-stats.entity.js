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
exports.RankingStats = void 0;
const typeorm_1 = require("typeorm");
const channel_entity_1 = require("./channel.entity");
let RankingStats = class RankingStats {
    channelId;
    channel;
    activationCtr;
    avgWatchTimeSec;
    bounceRate;
    ttfmpMs;
    ttfmpP95Ms;
    dubbingLatencyP50Ms;
    dubbingLatencyP95Ms;
    mosProxy;
    speechRatio;
    werProxy;
    contentStability;
    sampleSize;
    lastPlayEvent;
    lastUpdated;
};
exports.RankingStats = RankingStats;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], RankingStats.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => channel_entity_1.Channel),
    (0, typeorm_1.JoinColumn)({ name: 'channel_id' }),
    __metadata("design:type", channel_entity_1.Channel)
], RankingStats.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 4, default: 0.0 }),
    __metadata("design:type", Number)
], RankingStats.prototype, "activationCtr", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 0 }),
    __metadata("design:type", Number)
], RankingStats.prototype, "avgWatchTimeSec", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 4, scale: 3, default: 0.0 }),
    __metadata("design:type", Number)
], RankingStats.prototype, "bounceRate", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "ttfmpMs", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "ttfmpP95Ms", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "dubbingLatencyP50Ms", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "dubbingLatencyP95Ms", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 3, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "mosProxy", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 3, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "speechRatio", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 3, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "werProxy", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 3, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], RankingStats.prototype, "contentStability", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 0 }),
    __metadata("design:type", Number)
], RankingStats.prototype, "sampleSize", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { nullable: true }),
    __metadata("design:type", Date)
], RankingStats.prototype, "lastPlayEvent", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => 'NOW()' }),
    __metadata("design:type", Date)
], RankingStats.prototype, "lastUpdated", void 0);
exports.RankingStats = RankingStats = __decorate([
    (0, typeorm_1.Entity)('ranking_stats'),
    (0, typeorm_1.Index)(['mosProxy', 'activationCtr'], { where: 'mos_proxy IS NOT NULL' }),
    (0, typeorm_1.Index)(['avgWatchTimeSec', 'bounceRate']),
    (0, typeorm_1.Index)(['lastUpdated'])
], RankingStats);
