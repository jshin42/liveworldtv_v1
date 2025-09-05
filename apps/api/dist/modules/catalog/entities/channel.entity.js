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
exports.Channel = void 0;
const typeorm_1 = require("typeorm");
let Channel = class Channel {
    id;
    name;
    country;
    topic;
    sourceType;
    sourceUrl;
    youtubeChannelId;
    owner;
    description;
    thumbnailUrl;
    languageCode;
    firstSeen;
    lastSeen;
    active;
    verified;
    metadata;
    contentFingerprint;
    searchVector;
};
exports.Channel = Channel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Channel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    __metadata("design:type", String)
], Channel.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 2 }),
    __metadata("design:type", String)
], Channel.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['NEWS', 'SPORTS', 'MUSIC_DJS']
    }),
    __metadata("design:type", String)
], Channel.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ['YOUTUBE_EMBED', 'LICENSED'],
        default: 'YOUTUBE_EMBED'
    }),
    __metadata("design:type", String)
], Channel.prototype, "sourceType", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    (0, typeorm_1.Index)('idx_channels_source_url_hash', { unique: true }),
    __metadata("design:type", String)
], Channel.prototype, "sourceUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true }),
    (0, typeorm_1.Index)('idx_channels_youtube_id_hash'),
    __metadata("design:type", String)
], Channel.prototype, "youtubeChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255, nullable: true }),
    __metadata("design:type", String)
], Channel.prototype, "owner", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Channel.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Channel.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 3, default: 'unk' }),
    __metadata("design:type", String)
], Channel.prototype, "languageCode", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Channel.prototype, "firstSeen", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Channel.prototype, "lastSeen", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Channel.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Channel.prototype, "verified", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: {} }),
    __metadata("design:type", Object)
], Channel.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 16 }),
    (0, typeorm_1.Index)('idx_channels_fingerprint_hash', { unique: true }),
    __metadata("design:type", String)
], Channel.prototype, "contentFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)('tsvector', { nullable: true }),
    (0, typeorm_1.Index)('idx_channels_search_vector', { synchronize: false }),
    __metadata("design:type", String)
], Channel.prototype, "searchVector", void 0);
exports.Channel = Channel = __decorate([
    (0, typeorm_1.Entity)('channels'),
    (0, typeorm_1.Index)(['country', 'topic', 'active', 'lastSeen']),
    (0, typeorm_1.Index)(['active', 'lastSeen'], { where: 'active = true' })
], Channel);
