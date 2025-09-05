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
exports.ChannelListDto = exports.ChannelFilterDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class ChannelFilterDto {
    country;
    topic;
    page;
    limit;
}
exports.ChannelFilterDto = ChannelFilterDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'US', description: 'Two-letter country code' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/, { message: 'Country must be a two-letter uppercase code' }),
    __metadata("design:type", String)
], ChannelFilterDto.prototype, "country", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['NEWS', 'SPORTS', 'MUSIC_DJS'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['NEWS', 'SPORTS', 'MUSIC_DJS'], { message: 'Invalid topic type' }),
    __metadata("design:type", String)
], ChannelFilterDto.prototype, "topic", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ChannelFilterDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20, minimum: 1, maximum: 50 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], ChannelFilterDto.prototype, "limit", void 0);
class ChannelListDto {
    channels;
    pagination;
}
exports.ChannelListDto = ChannelListDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [shared_types_1.Channel] }),
    __metadata("design:type", Array)
], ChannelListDto.prototype, "channels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: {
            page: 1,
            limit: 20,
            total: 45,
            hasNext: true
        }
    }),
    __metadata("design:type", Object)
], ChannelListDto.prototype, "pagination", void 0);
