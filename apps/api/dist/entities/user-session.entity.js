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
exports.UserSession = void 0;
const typeorm_1 = require("typeorm");
let UserSession = class UserSession {
    sessionId;
    preferences;
    recentAutoplays;
    extensionVersion;
    userAgentHash;
    browserCapabilities;
    createdAt;
    lastActivity;
    expiresAt;
};
exports.UserSession = UserSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserSession.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: '{"country": null, "topic": null, "autoplay": true}' }),
    __metadata("design:type", Object)
], UserSession.prototype, "preferences", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { array: true, default: '{}' }),
    __metadata("design:type", Array)
], UserSession.prototype, "recentAutoplays", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 20, nullable: true }),
    __metadata("design:type", String)
], UserSession.prototype, "extensionVersion", void 0);
__decorate([
    (0, typeorm_1.Column)('char', { length: 32, nullable: true }),
    __metadata("design:type", String)
], UserSession.prototype, "userAgentHash", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: '{}' }),
    __metadata("design:type", Object)
], UserSession.prototype, "browserCapabilities", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => 'NOW()' }),
    __metadata("design:type", Date)
], UserSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => 'NOW()' }),
    __metadata("design:type", Date)
], UserSession.prototype, "lastActivity", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => "NOW() + INTERVAL '7 days'" }),
    __metadata("design:type", Date)
], UserSession.prototype, "expiresAt", void 0);
exports.UserSession = UserSession = __decorate([
    (0, typeorm_1.Entity)('user_sessions'),
    (0, typeorm_1.Index)(['expiresAt']),
    (0, typeorm_1.Index)(['lastActivity']),
    (0, typeorm_1.Index)(['extensionVersion'], { where: 'extension_version IS NOT NULL' })
], UserSession);
