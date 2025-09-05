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
exports.Channel = exports.ChannelSource = exports.TopicType = void 0;
const typeorm_1 = require("typeorm");
var TopicType;
(function (TopicType) {
    TopicType["NEWS"] = "NEWS";
    TopicType["SPORTS"] = "SPORTS";
    TopicType["MUSIC_DJS"] = "MUSIC_DJS";
})(TopicType || (exports.TopicType = TopicType = {}));
var ChannelSource;
(function (ChannelSource) {
    ChannelSource["YOUTUBE_EMBED"] = "YOUTUBE_EMBED";
    ChannelSource["LICENSED"] = "LICENSED";
})(ChannelSource || (exports.ChannelSource = ChannelSource = {}));
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
    createdAt;
    updatedAt;
};
exports.Channel = Channel;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Channel.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], Channel.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('char', { length: 2 }),
    __metadata("design:type", String)
], Channel.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TopicType
    }),
    __metadata("design:type", String)
], Channel.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ChannelSource,
        default: ChannelSource.YOUTUBE_EMBED
    }),
    __metadata("design:type", String)
], Channel.prototype, "sourceType", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], Channel.prototype, "sourceUrl", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 50, nullable: true }),
    __metadata("design:type", String)
], Channel.prototype, "youtubeChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255, nullable: true }),
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
    (0, typeorm_1.Column)('char', { length: 3, default: 'unk' }),
    __metadata("design:type", String)
], Channel.prototype, "languageCode", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => 'NOW()' }),
    __metadata("design:type", Date)
], Channel.prototype, "firstSeen", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { default: () => 'NOW()' }),
    __metadata("design:type", Date)
], Channel.prototype, "lastSeen", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: true }),
    __metadata("design:type", Boolean)
], Channel.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: false }),
    __metadata("design:type", Boolean)
], Channel.prototype, "verified", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: '{}' }),
    __metadata("design:type", Object)
], Channel.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)('char', { length: 16 }),
    __metadata("design:type", String)
], Channel.prototype, "contentFingerprint", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Channel.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Channel.prototype, "updatedAt", void 0);
exports.Channel = Channel = __decorate([
    (0, typeorm_1.Entity)('channels'),
    (0, typeorm_1.Index)(['country', 'topic', 'active', 'lastSeen']),
    (0, typeorm_1.Index)(['active', 'lastSeen'], { where: 'active = true' }),
    (0, typeorm_1.Index)(['sourceUrl'], { unique: true }),
    (0, typeorm_1.Index)(['contentFingerprint'], { unique: true }),
    (0, typeorm_1.Index)(['youtubeChannelId'])
], Channel);
