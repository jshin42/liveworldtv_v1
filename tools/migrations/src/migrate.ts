import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'

config()

interface Migration {
  id: string
  filename: string
  sql: string
  checksum: string
}

class MigrationRunner {
  private client: Client

  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
    await this.ensureMigrationsTable()
  }

  async disconnect(): Promise<void> {
    await this.client.end()
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  async runPendingMigrations(): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations()
    const availableMigrations = await this.getAvailableMigrations()
    
    const pendingMigrations = availableMigrations.filter(
      migration => !appliedMigrations.has(migration.id)
    )

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations')
      return
    }

    console.log(`📦 Running ${pendingMigrations.length} pending migrations...`)

    for (const migration of pendingMigrations) {
      await this.runMigration(migration)
    }

    console.log('✅ All migrations completed successfully')
  }

  private async runMigration(migration: Migration): Promise<void> {
    console.log(`⚡ Running migration: ${migration.filename}`)
    
    try {
      await this.client.query('BEGIN')
      
      // Run the migration SQL
      await this.client.query(migration.sql)
      
      // Record migration as applied
      await this.client.query(
        'INSERT INTO schema_migrations (id, filename, checksum) VALUES ($1, $2, $3)',
        [migration.id, migration.filename, migration.checksum]
      )
      
      await this.client.query('COMMIT')
      console.log(`✅ Migration completed: ${migration.filename}`)
      
    } catch (error) {
      await this.client.query('ROLLBACK')
      console.error(`❌ Migration failed: ${migration.filename}`)
      throw error
    }
  }

  private async getAppliedMigrations(): Promise<Set<string>> {
    const result = await this.client.query(
      'SELECT id FROM schema_migrations ORDER BY applied_at'
    )
    return new Set(result.rows.map(row => row.id))
  }

  private async getAvailableMigrations(): Promise<Migration[]> {
    const migrationsDir = path.join(__dirname, '../sql')
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()

    const migrations: Migration[] = []

    for (const filename of files) {
      const filepath = path.join(migrationsDir, filename)
      const sql = fs.readFileSync(filepath, 'utf8')
      const checksum = this.calculateChecksum(sql)
      const id = filename.replace('.sql', '')

      migrations.push({ id, filename, sql, checksum })
    }

    return migrations
  }

  private calculateChecksum(content: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  async validateChecksums(): Promise<boolean> {
    const appliedMigrations = await this.client.query(
      'SELECT id, filename, checksum FROM schema_migrations ORDER BY applied_at'
    )
    
    const availableMigrations = await this.getAvailableMigrations()
    const availableMap = new Map(availableMigrations.map(m => [m.id, m]))
    
    for (const applied of appliedMigrations.rows) {
      const available = availableMap.get(applied.id)
      
      if (!available) {
        console.error(`❌ Applied migration not found in files: ${applied.filename}`)
        return false
      }
      
      if (available.checksum !== applied.checksum) {
        console.error(`❌ Checksum mismatch for: ${applied.filename}`)
        console.error(`   Applied: ${applied.checksum}`)
        console.error(`   Current: ${available.checksum}`)
        return false
      }
    }
    
    console.log('✅ All migration checksums valid')
    return true
  }
}

async function main(): Promise<void> {
  const runner = new MigrationRunner()
  
  try {
    await runner.connect()
    
    // Validate existing migrations haven't been modified
    await runner.validateChecksums()
    
    // Run pending migrations
    await runner.runPendingMigrations()
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await runner.disconnect()
  }
}

if (require.main === module) {
  main()
}