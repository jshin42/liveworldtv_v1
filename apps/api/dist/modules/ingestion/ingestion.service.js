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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bull_1 = require("@nestjs/bull");
const channel_entity_1 = require("../../entities/channel.entity");
const channel_scraper_service_1 = require("./channel-scraper.service");
const channel_entity_2 = require("../../entities/channel.entity");
let IngestionService = class IngestionService {
    channelRepository;
    ingestionQueue;
    channelScraper;
    constructor(channelRepository, ingestionQueue, channelScraper) {
        this.channelRepository = channelRepository;
        this.ingestionQueue = ingestionQueue;
        this.channelScraper = channelScraper;
    }
    async scheduleIngestion(country, source = 'youtube', priority = 1) {
        const job = await this.ingestionQueue.add('scrape-channels', {
            country,
            source,
            priority
        }, {
            priority,
            delay: priority === 1 ? 0 : 5000 // High priority jobs run immediately
        });
        return { jobId: job.id.toString() };
    }
    async scheduleAllCountries() {
        const countries = ['US', 'UK', 'DE', 'FR', 'ES', 'JP', 'IT', 'PT', 'RU', 'KR', 'CN'];
        const sources = ['youtube', 'twitch'];
        const jobIds = [];
        for (let i = 0; i < countries.length; i++) {
            const country = countries[i];
            for (const source of sources) {
                const priority = i < 3 ? 1 : 2; // Priority for major markets
                const { jobId } = await this.scheduleIngestion(country, source, priority);
                jobIds.push(jobId);
            }
        }
        return { jobIds };
    }
    async ingestChannelsForCountry(country, source) {
        const result = {
            success: false,
            channelsFound: 0,
            channelsAdded: 0,
            channelsUpdated: 0,
            errors: []
        };
        try {
            let scrapeResult;
            switch (source) {
                case '7pm':
                    scrapeResult = await this.channelScraper.scrape7pmChannels(country);
                    break;
                case 'youtube':
                    scrapeResult = await this.channelScraper.scrapeYouTubeLiveChannels(country);
                    break;
                case 'twitch':
                    scrapeResult = await this.channelScraper.scrapeTwitchChannels(country);
                    break;
                default:
                    throw new Error(`Unsupported source: ${source}`);
            }
            result.channelsFound = scrapeResult.channels.length;
            for (const scrapedChannel of scrapeResult.channels) {
                try {
                    await this.upsertChannel(scrapedChannel);
                    const existing = await this.channelRepository.findOne({
                        where: { sourceUrl: scrapedChannel.url }
                    });
                    if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
                        result.channelsAdded++;
                    }
                    else {
                        result.channelsUpdated++;
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to upsert ${scrapedChannel.name}: ${error.message}`);
                }
            }
            result.success = result.errors.length < scrapeResult.channels.length / 2;
        }
        catch (error) {
            result.errors.push(`Ingestion failed: ${error.message}`);
        }
        return result;
    }
    async upsertChannel(scrapedChannel) {
        const existing = await this.channelRepository.findOne({
            where: { sourceUrl: scrapedChannel.url }
        });
        const channelData = {
            name: scrapedChannel.name,
            sourceUrl: scrapedChannel.url,
            description: scrapedChannel.description,
            languageCode: scrapedChannel.language || 'eng',
            country: scrapedChannel.country,
            topic: scrapedChannel.topic || channel_entity_2.TopicType.NEWS,
            thumbnailUrl: scrapedChannel.thumbnailUrl,
            lastSeen: new Date(),
            active: true,
            verified: false,
            contentFingerprint: this.generateContentFingerprint(scrapedChannel)
        };
        if (existing) {
            await this.channelRepository.update(existing.id, {
                ...channelData,
                updatedAt: new Date()
            });
            return this.channelRepository.findOne({ where: { id: existing.id } });
        }
        else {
            const channel = this.channelRepository.create({
                ...channelData,
                firstSeen: new Date(),
                metadata: scrapedChannel.metadata || {}
            });
            return this.channelRepository.save(channel);
        }
    }
    generateChannelId(url) {
        const hash = this.simpleHash(url);
        return `ch_${hash}`;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    generateContentFingerprint(channel) {
        const content = `${channel.name}${channel.country}${channel.url}`;
        return this.simpleHash(content).substring(0, 16);
    }
    calculateQualityScore(channel) {
        let score = 50; // Base score
        if (channel.viewerCount) {
            if (channel.viewerCount > 10000)
                score += 30;
            else if (channel.viewerCount > 1000)
                score += 20;
            else if (channel.viewerCount > 100)
                score += 10;
        }
        if (channel.description && channel.description.length > 50) {
            score += 10;
        }
        if (channel.thumbnailUrl) {
            score += 5;
        }
        if (channel.isLive) {
            score += 15;
        }
        return Math.min(100, Math.max(0, score));
    }
    async getIngestionStatus() {
        const queueStats = {
            waiting: await this.ingestionQueue.getWaiting(),
            active: await this.ingestionQueue.getActive(),
            completed: await this.ingestionQueue.getCompleted(),
            failed: await this.ingestionQueue.getFailed()
        };
        const recentJobs = await this.ingestionQueue.getJobs(['completed', 'failed', 'active'], 0, 10);
        const lastSuccessful = recentJobs.find(job => job.finishedOn && job.returnvalue?.success);
        return {
            queueStats: {
                waiting: queueStats.waiting.length,
                active: queueStats.active.length,
                completed: queueStats.completed.length,
                failed: queueStats.failed.length
            },
            recentJobs: recentJobs.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress(),
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                failedReason: job.failedReason
            })),
            lastSuccessfulRun: lastSuccessful ? new Date(lastSuccessful.finishedOn) : undefined
        };
    }
};
exports.IngestionService = IngestionService;
exports.IngestionService = IngestionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(channel_entity_1.Channel)),
    __param(1, (0, bull_1.InjectQueue)('ingestion')),
    __metadata("design:paramtypes", [typeorm_2.Repository, Object, channel_scraper_service_1.ChannelScraper])
], IngestionService);
