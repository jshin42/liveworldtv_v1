"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
const channel_entity_1 = require("../modules/catalog/entities/channel.entity");
const live_stream_entity_1 = require("../modules/catalog/entities/live-stream.entity");
const ranking_stats_entity_1 = require("../entities/ranking-stats.entity");
const user_session_entity_1 = require("../entities/user-session.entity");
const analytics_event_entity_1 = require("../entities/analytics-event.entity");
const databaseConfig = () => {
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/liveworldtv_dev';
    return {
        type: 'postgres',
        url: databaseUrl,
        entities: [channel_entity_1.Channel, live_stream_entity_1.LiveStream, ranking_stats_entity_1.RankingStats, user_session_entity_1.UserSession, analytics_event_entity_1.PlayEvent],
        synchronize: false, // Use migrations instead
        logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
        retryAttempts: 3,
        retryDelay: 3000,
        maxQueryExecutionTime: 10000, // 10s timeout
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        extra: {
            max: 20, // Connection pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000
        }
    };
};
exports.databaseConfig = databaseConfig;
