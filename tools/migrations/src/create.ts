import * as fs from 'fs'
import * as path from 'path'

interface MigrationTemplate {
  sql: string
  rollback: string
}

class MigrationCreator {
  private readonly templatesDir = path.join(__dirname, '../templates')
  private readonly sqlDir = path.join(__dirname, '../sql')

  async createMigration(name: string, template: string = 'basic'): Promise<void> {
    const timestamp = this.generateTimestamp()
    const migrationId = `${timestamp}_${this.slugify(name)}`
    const filename = `${migrationId}.sql`
    const rollbackFilename = `${migrationId}.rollback.sql`
    
    console.log(`📝 Creating migration: ${filename}`)
    
    // Get template content
    const templateContent = this.getTemplate(template)
    
    // Replace placeholders
    const migrationContent = this.replacePlaceholders(templateContent.sql, {
      migration_id: migrationId,
      migration_name: name,
      timestamp: new Date().toISOString()
    })
    
    const rollbackContent = this.replacePlaceholders(templateContent.rollback, {
      migration_id: migrationId,
      migration_name: name,
      timestamp: new Date().toISOString()
    })
    
    // Write files
    const sqlPath = path.join(this.sqlDir, filename)
    const rollbackPath = path.join(this.sqlDir, rollbackFilename)
    
    fs.writeFileSync(sqlPath, migrationContent)
    fs.writeFileSync(rollbackPath, rollbackContent)
    
    console.log(`✅ Migration created:`)
    console.log(`   Forward:  ${sqlPath}`)
    console.log(`   Rollback: ${rollbackPath}`)
    console.log(``)
    console.log(`Next steps:`)
    console.log(`1. Edit the migration files with your changes`)
    console.log(`2. Run: npm run migrate`)
  }

  private generateTimestamp(): string {
    const now = new Date()
    return [
      now.getFullYear(),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0'),
      now.getHours().toString().padStart(2, '0'),
      now.getMinutes().toString().padStart(2, '0'),
      now.getSeconds().toString().padStart(2, '0')
    ].join('')
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  private getTemplate(templateName: string): MigrationTemplate {
    const templates: Record<string, MigrationTemplate> = {
      basic: {
        sql: `-- Migration: {{migration_id}}
-- Description: {{migration_name}}
-- Applied: {{timestamp}}

-- Add your migration SQL here
-- Example:
-- ALTER TABLE channels ADD COLUMN new_field VARCHAR(50);
-- CREATE INDEX idx_channels_new_field ON channels (new_field);
`,
        rollback: `-- Rollback: {{migration_id}}
-- Description: Rollback {{migration_name}}
-- Applied: {{timestamp}}

-- Add your rollback SQL here
-- Example:
-- DROP INDEX IF EXISTS idx_channels_new_field;
-- ALTER TABLE channels DROP COLUMN IF EXISTS new_field;
`
      },
      
      add_table: {
        sql: `-- Migration: {{migration_id}}
-- Description: {{migration_name}}
-- Applied: {{timestamp}}

CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_new_table_name ON new_table (name);
CREATE INDEX idx_new_table_created_at ON new_table (created_at DESC);
`,
        rollback: `-- Rollback: {{migration_id}}
-- Description: Rollback {{migration_name}}
-- Applied: {{timestamp}}

DROP TABLE IF EXISTS new_table;
`
      },
      
      add_column: {
        sql: `-- Migration: {{migration_id}}
-- Description: {{migration_name}}
-- Applied: {{timestamp}}

ALTER TABLE target_table 
ADD COLUMN new_column VARCHAR(255);

CREATE INDEX idx_target_table_new_column ON target_table (new_column);
`,
        rollback: `-- Rollback: {{migration_id}}
-- Description: Rollback {{migration_name}}
-- Applied: {{timestamp}}

DROP INDEX IF EXISTS idx_target_table_new_column;
ALTER TABLE target_table DROP COLUMN IF EXISTS new_column;
`
      }
    }

    if (!templates[templateName]) {
      throw new Error(`Unknown template: ${templateName}. Available: ${Object.keys(templates).join(', ')}`)
    }

    return templates[templateName]
  }

  private replacePlaceholders(content: string, variables: Record<string, string>): string {
    let result = content
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      result = result.replace(new RegExp(placeholder, 'g'), value)
    }
    
    return result
  }

  listAvailableTemplates(): void {
    console.log('📋 Available migration templates:')
    console.log('  basic     - Empty migration template')
    console.log('  add_table - Create new table template')
    console.log('  add_column - Add column to existing table')
    console.log('')
    console.log('Usage: npm run migration:create <name> [template]')
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args[0] === '--help') {
    new MigrationCreator().listAvailableTemplates()
    return
  }

  const name = args[0]
  const template = args[1] || 'basic'
  
  if (!name) {
    console.error('Migration name is required')
    process.exit(1)
  }

  const creator = new MigrationCreator()
  
  try {
    await creator.createMigration(name, template)
  } catch (error) {
    console.error('Migration creation failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}