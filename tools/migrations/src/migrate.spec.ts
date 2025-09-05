import { DatabaseMigrator } from './migrate'
import { Pool } from 'pg'
import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'

const TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/liveworldtv_test'

describe('DatabaseMigrator', () => {
  let migrator: DatabaseMigrator
  let pool: Pool

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    migrator = new DatabaseMigrator(TEST_DATABASE_URL)
  })

  afterAll(async () => {
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query('DROP TABLE IF EXISTS migration_history CASCADE')
    await pool.query('DROP TABLE IF EXISTS channels CASCADE')
    await pool.query('DROP TABLE IF EXISTS live_streams CASCADE')
    await pool.query('DROP TABLE IF EXISTS analytics_events CASCADE')
  })

  describe('checksum validation', () => {
    it('should calculate consistent checksums', async () => {
      const testSql = 'CREATE TABLE test (id SERIAL PRIMARY KEY);'
      const checksum1 = migrator['calculateChecksum'](testSql)
      const checksum2 = migrator['calculateChecksum'](testSql)
      
      expect(checksum1).toBe(checksum2)
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })

    it('should detect modified migration files', async () => {
      const originalSql = 'CREATE TABLE test (id SERIAL);'
      const modifiedSql = 'CREATE TABLE test (id SERIAL, name TEXT);'
      
      const checksum1 = migrator['calculateChecksum'](originalSql)
      const checksum2 = migrator['calculateChecksum'](modifiedSql)
      
      expect(checksum1).not.toBe(checksum2)
    })
  })

  describe('migration execution', () => {
    it('should create migration_history table', async () => {
      await migrator['ensureMigrationTable']()
      
      const result = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'migration_history'
      `)
      
      expect(result.rows).toHaveLength(1)
    })

    it('should track applied migrations', async () => {
      await migrator['ensureMigrationTable']()
      
      const testMigration = {
        id: '001_test_migration',
        filename: '001_test_migration.sql',
        checksum: 'abc123',
        content: 'CREATE TABLE test_table (id SERIAL);'
      }

      await migrator['recordMigration'](testMigration)
      
      const applied = await migrator['getAppliedMigrations']()
      expect(applied.has('001_test_migration')).toBe(true)
    })

    it('should prevent duplicate migration execution', async () => {
      await migrator['ensureMigrationTable']()
      
      const migration = {
        id: '001_test',
        filename: '001_test.sql',
        checksum: 'test123',
        content: 'CREATE TABLE duplicate_test (id SERIAL);'
      }

      await migrator['recordMigration'](migration)
      
      // Attempting to record same migration should not create duplicate
      await migrator['recordMigration'](migration)
      
      const result = await pool.query('SELECT COUNT(*) FROM migration_history WHERE id = $1', [migration.id])
      expect(parseInt(result.rows[0].count)).toBe(1)
    })

    it('should rollback on migration failure', async () => {
      await migrator['ensureMigrationTable']()
      
      const invalidMigration = {
        id: '002_invalid',
        filename: '002_invalid.sql',
        checksum: 'invalid123',
        content: 'INVALID SQL SYNTAX;'
      }

      await expect(
        migrator['executeMigration'](invalidMigration)
      ).rejects.toThrow()

      const applied = await migrator['getAppliedMigrations']()
      expect(applied.has('002_invalid')).toBe(false)
    })
  })

  describe('checksum verification', () => {
    it('should detect tampered migration files', async () => {
      await migrator['ensureMigrationTable']()
      
      const originalChecksum = 'original123'
      const migration = {
        id: '003_tampered',
        filename: '003_tampered.sql',
        checksum: originalChecksum,
        content: 'CREATE TABLE original (id SERIAL);'
      }

      await migrator['recordMigration'](migration)
      
      // Simulate tampered file
      const tamperedChecksum = 'tampered456'
      migration.checksum = tamperedChecksum
      
      await expect(
        migrator['verifyMigrationIntegrity'](migration)
      ).rejects.toThrow(/checksum mismatch/i)
    })
  })

  describe('error handling', () => {
    it('should handle database connection failures', async () => {
      const invalidMigrator = new DatabaseMigrator('postgresql://invalid:invalid@localhost:9999/invalid')
      
      await expect(
        invalidMigrator.runPendingMigrations()
      ).rejects.toThrow(/connection/)
    })

    it('should handle concurrent migration attempts', async () => {
      await migrator['ensureMigrationTable']()
      
      const migration = {
        id: '004_concurrent',
        filename: '004_concurrent.sql', 
        checksum: 'concurrent123',
        content: 'CREATE TABLE concurrent_test (id SERIAL);'
      }

      // Simulate concurrent execution
      const promise1 = migrator['executeMigration'](migration)
      const promise2 = migrator['executeMigration'](migration)
      
      await promise1
      await promise2 // Should not fail or duplicate
      
      const result = await pool.query('SELECT COUNT(*) FROM migration_history WHERE id = $1', [migration.id])
      expect(parseInt(result.rows[0].count)).toBe(1)
    })
  })
})