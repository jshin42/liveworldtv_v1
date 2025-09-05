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
exports.AnalyticsEvent = exports.PlayEvent = exports.EventType = void 0;
const typeorm_1 = require("typeorm");
const user_session_entity_1 = require("./user-session.entity");
const channel_entity_1 = require("./channel.entity");
var EventType;
(function (EventType) {
    EventType["PLAY_START"] = "PLAY_START";
    EventType["DUB_ENABLED"] = "DUB_ENABLED";
    EventType["DUB_DISABLED"] = "DUB_DISABLED";
    EventType["SEEK"] = "SEEK";
    EventType["STOP"] = "STOP";
    EventType["EXTENSION_INSTALLED"] = "EXTENSION_INSTALLED";
    EventType["MODEL_LOADED"] = "MODEL_LOADED";
    EventType["QUALITY_FEEDBACK"] = "QUALITY_FEEDBACK";
    EventType["MODEL_DOWNLOAD_START"] = "MODEL_DOWNLOAD_START";
    EventType["MODEL_DOWNLOAD_COMPLETE"] = "MODEL_DOWNLOAD_COMPLETE";
})(EventType || (exports.EventType = EventType = {}));
let PlayEvent = class PlayEvent {
    id;
    sessionId;
    session;
    channelId;
    channel;
    eventType;
    eventTimestamp;
    metadata;
    processingTimeMs;
};
exports.PlayEvent = PlayEvent;
exports.AnalyticsEvent = PlayEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PlayEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    __metadata("design:type", String)
], PlayEvent.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_session_entity_1.UserSession, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'session_id' }),
    __metadata("design:type", user_session_entity_1.UserSession)
], PlayEvent.prototype, "session", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    __metadata("design:type", String)
], PlayEvent.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => channel_entity_1.Channel, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'channel_id' }),
    __metadata("design:type", channel_entity_1.Channel)
], PlayEvent.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: EventType
    }),
    __metadata("design:type", String)
], PlayEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => 'NOW()' }),
    __metadata("design:type", Date)
], PlayEvent.prototype, "eventTimestamp", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: '{}' }),
    __metadata("design:type", Object)
], PlayEvent.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { nullable: true }),
    __metadata("design:type", Number)
], PlayEvent.prototype, "processingTimeMs", void 0);
exports.AnalyticsEvent = exports.PlayEvent = PlayEvent = __decorate([
    (0, typeorm_1.Entity)('play_events'),
    (0, typeorm_1.Index)(['eventTimestamp', 'eventType']),
    (0, typeorm_1.Index)(['channelId', 'eventType', 'eventTimestamp'], { where: 'channel_id IS NOT NULL' }),
    (0, typeorm_1.Index)(['sessionId', 'eventTimestamp'], { where: 'session_id IS NOT NULL' })
], PlayEvent);
