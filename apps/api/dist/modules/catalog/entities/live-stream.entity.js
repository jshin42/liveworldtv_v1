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
exports.LiveStream = exports.StreamStatus = void 0;
const typeorm_1 = require("typeorm");
const channel_entity_1 = require("../../../entities/channel.entity");
var StreamStatus;
(function (StreamStatus) {
    StreamStatus["LIVE"] = "LIVE";
    StreamStatus["OFF"] = "OFF";
    StreamStatus["UNKNOWN"] = "UNKNOWN";
})(StreamStatus || (exports.StreamStatus = StreamStatus = {}));
let LiveStream = class LiveStream {
    id;
    channelId;
    channel;
    status;
    startedAt;
    endedAt;
    delaySeconds;
    dvrWindowSec;
    viewerCount;
    peakViewerCount;
    lastChecked;
    qualityMetrics;
};
exports.LiveStream = LiveStream;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LiveStream.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    (0, typeorm_1.Index)('idx_live_streams_channel_id', { unique: true }),
    __metadata("design:type", String)
], LiveStream.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => channel_entity_1.Channel),
    (0, typeorm_1.JoinColumn)({ name: 'channel_id' }),
    __metadata("design:type", channel_entity_1.Channel)
], LiveStream.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: StreamStatus,
        default: StreamStatus.UNKNOWN
    }),
    __metadata("design:type", String)
], LiveStream.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { nullable: true }),
    __metadata("design:type", Date)
], LiveStream.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { nullable: true }),
    __metadata("design:type", Date)
], LiveStream.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 30 }),
    __metadata("design:type", Number)
], LiveStream.prototype, "delaySeconds", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 10800 }),
    __metadata("design:type", Number)
], LiveStream.prototype, "dvrWindowSec", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 0 }),
    __metadata("design:type", Number)
], LiveStream.prototype, "viewerCount", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 0 }),
    __metadata("design:type", Number)
], LiveStream.prototype, "peakViewerCount", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => 'NOW()' }),
    __metadata("design:type", Date)
], LiveStream.prototype, "lastChecked", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: '{}' }),
    __metadata("design:type", Object)
], LiveStream.prototype, "qualityMetrics", void 0);
exports.LiveStream = LiveStream = __decorate([
    (0, typeorm_1.Entity)('live_streams'),
    (0, typeorm_1.Index)(['status', 'lastChecked']),
    (0, typeorm_1.Index)(['lastChecked'], { where: "status = 'OFF'" }),
    (0, typeorm_1.Index)(['status', 'viewerCount'], { where: "status = 'LIVE'" })
], LiveStream);
