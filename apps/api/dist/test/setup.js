"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockChannel = exports.TestFixtures = exports.createTestCacheConfig = exports.createTestDatabaseConfig = exports.TEST_REDIS_URL = exports.TEST_DATABASE_URL = void 0;
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const cache_manager_1 = require("@nestjs/cache-manager");
exports.TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/liveworldtv_test';
exports.TEST_REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const createTestDatabaseConfig = () => ({
    type: 'postgres',
    url: exports.TEST_DATABASE_URL,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true,
    logging: false,
    dropSchema: true
});
exports.createTestDatabaseConfig = createTestDatabaseConfig;
const createTestCacheConfig = () => ({
    store: 'memory',
    ttl: 60,
    max: 100
});
exports.createTestCacheConfig = createTestCacheConfig;
class TestFixtures {
    static async createTestModule(imports = []) {
        const moduleBuilder = testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot((0, exports.createTestDatabaseConfig)()),
                cache_manager_1.CacheModule.register((0, exports.createTestCacheConfig)()),
                ...imports
            ]
        });
        return await moduleBuilder.compile();
    }
    static async cleanDatabase(dataSource) {
        const entities = dataSource.entityMetadatas;
        for (const entity of entities) {
            const repository = dataSource.getRepository(entity.name);
            await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`);
        }
    }
}
exports.TestFixtures = TestFixtures;
exports.mockChannel = {
    id: 'test-channel-1',
    name: 'Test News Channel',
    country: 'US',
    language: 'en',
    topic: 'news',
    streamUrl: 'https://test.com/stream.m3u8',
    logoUrl: 'https://test.com/logo.png',
    isActive: true,
    quality: 'hd',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
};
