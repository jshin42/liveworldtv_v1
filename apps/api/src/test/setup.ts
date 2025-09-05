import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CacheModule } from '@nestjs/cache-manager'
import { DataSource } from 'typeorm'

export const TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/liveworldtv_test'
export const TEST_REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const createTestDatabaseConfig = () => ({
  type: 'postgres' as const,
  url: TEST_DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: false,
  dropSchema: true
})

export const createTestCacheConfig = () => ({
  store: 'memory',
  ttl: 60,
  max: 100
})

export class TestFixtures {
  static async createTestModule(imports: any[] = []) {
    const moduleBuilder = Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDatabaseConfig()),
        CacheModule.register(createTestCacheConfig()),
        ...imports
      ]
    })

    return await moduleBuilder.compile()
  }

  static async cleanDatabase(dataSource: DataSource) {
    const entities = dataSource.entityMetadatas
    
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name)
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`)
    }
  }
}

export const mockChannel = {
  id: 'test-channel-1',
  name: 'Test News Channel',
  country: 'US' as const,
  language: 'en' as const,
  topic: 'news' as const,
  streamUrl: 'https://test.com/stream.m3u8',
  logoUrl: 'https://test.com/logo.png',
  isActive: true,
  quality: 'hd' as const,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z')
}