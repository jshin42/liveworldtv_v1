import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'

config()

interface AppliedMigration {
  id: string
  filename: string
  applied_at: Date
}

class RollbackRunner {
  private client: Client

  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    await this.client.end()
  }

  async rollbackToMigration(targetMigrationId: string): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations()
    
    const targetIndex = appliedMigrations.findIndex(m => m.id === targetMigrationId)
    if (targetIndex === -1) {
      throw new Error(`Target migration not found: ${targetMigrationId}`)
    }

    const migrationsToRollback = appliedMigrations.slice(targetIndex + 1).reverse()
    
    if (migrationsToRollback.length === 0) {
      console.log('✅ No migrations to rollback')
      return
    }

    console.log(`🔄 Rolling back ${migrationsToRollback.length} migrations...`)

    for (const migration of migrationsToRollback) {
      await this.rollbackMigration(migration)
    }

    console.log(`✅ Rollback completed to migration: ${targetMigrationId}`)
  }

  async rollbackLastMigration(): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations()
    
    if (appliedMigrations.length === 0) {
      console.log('✅ No migrations to rollback')
      return
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1]
    await this.rollbackMigration(lastMigration)
    
    console.log(`✅ Rolled back migration: ${lastMigration.filename}`)
  }

  private async rollbackMigration(migration: AppliedMigration): Promise<void> {
    console.log(`🔄 Rolling back migration: ${migration.filename}`)
    
    const rollbackFile = migration.filename.replace('.sql', '.rollback.sql')
    const rollbackPath = path.join(__dirname, '../sql', rollbackFile)
    
    if (!fs.existsSync(rollbackPath)) {
      console.warn(`⚠️  No rollback file found: ${rollbackFile}`)
      console.warn('   Manual rollback may be required')
      
      // Ask for confirmation to continue
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      })
      
      const answer = await new Promise<string>((resolve) => {
        readline.question('Continue without rollback script? (y/N): ', resolve)
      })
      
      readline.close()
      
      if (answer.toLowerCase() !== 'y') {
        throw new Error('Rollback cancelled - no rollback script available')
      }
    } else {
      const rollbackSQL = fs.readFileSync(rollbackPath, 'utf8')
      
      try {
        await this.client.query('BEGIN')
        
        // Run rollback SQL
        await this.client.query(rollbackSQL)
        
        // Remove from migrations table
        await this.client.query(
          'DELETE FROM schema_migrations WHERE id = $1',
          [migration.id]
        )
        
        await this.client.query('COMMIT')
        console.log(`✅ Rollback completed: ${migration.filename}`)
        
      } catch (error) {
        await this.client.query('ROLLBACK')
        console.error(`❌ Rollback failed: ${migration.filename}`)
        throw error
      }
    }
  }

  private async getAppliedMigrations(): Promise<AppliedMigration[]> {
    const result = await this.client.query(
      'SELECT id, filename, applied_at FROM schema_migrations ORDER BY applied_at'
    )
    return result.rows
  }

  async listAppliedMigrations(): Promise<void> {
    const migrations = await this.getAppliedMigrations()
    
    if (migrations.length === 0) {
      console.log('📝 No migrations applied')
      return
    }
    
    console.log(`📝 Applied migrations (${migrations.length}):`)
    migrations.forEach((migration, index) => {
      console.log(`${index + 1}. ${migration.filename} (${migration.applied_at.toISOString()})`)
    })
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]
  
  const runner = new RollbackRunner()
  
  try {
    await runner.connect()
    
    switch (command) {
      case 'list':
        await runner.listAppliedMigrations()
        break
        
      case 'last':
        await runner.rollbackLastMigration()
        break
        
      case 'to':
        if (!args[1]) {
          console.error('Usage: npm run rollback to <migration_id>')
          process.exit(1)
        }
        await runner.rollbackToMigration(args[1])
        break
        
      default:
        console.log('Usage:')
        console.log('  npm run rollback list     - List applied migrations')
        console.log('  npm run rollback last     - Rollback last migration')
        console.log('  npm run rollback to <id>  - Rollback to specific migration')
        process.exit(1)
    }
    
  } catch (error) {
    console.error('Rollback failed:', error)
    process.exit(1)
  } finally {
    await runner.disconnect()
  }
}

if (require.main === module) {
  main()
}