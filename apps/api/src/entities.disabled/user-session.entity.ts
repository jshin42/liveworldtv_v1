import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('user_sessions')
@Index(['expiresAt'])
@Index(['lastActivity'])
@Index(['extensionVersion'], { where: 'extension_version IS NOT NULL' })
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  sessionId: string;

  @Column('jsonb', { default: '{"country": null, "topic": null, "autoplay": true}' })
  preferences: Record<string, any>;

  @Column('uuid', { array: true, default: '{}' })
  recentAutoplays: string[];

  @Column('varchar', { length: 20, nullable: true })
  extensionVersion?: string;

  @Column('char', { length: 32, nullable: true })
  userAgentHash?: string;

  @Column('jsonb', { default: '{}' })
  browserCapabilities: Record<string, any>;

  @Column('timestamptz', { default: () => 'NOW()' })
  createdAt: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  lastActivity: Date;

  @Column('timestamptz', { default: () => "NOW() + INTERVAL '7 days'" })
  expiresAt: Date;
}