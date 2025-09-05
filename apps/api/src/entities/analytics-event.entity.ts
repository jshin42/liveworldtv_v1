import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserSession } from './user-session.entity';
import { Channel } from './channel.entity';

export enum EventType {
  PLAY_START = 'PLAY_START',
  DUB_ENABLED = 'DUB_ENABLED', 
  DUB_DISABLED = 'DUB_DISABLED',
  SEEK = 'SEEK',
  STOP = 'STOP',
  EXTENSION_INSTALLED = 'EXTENSION_INSTALLED',
  MODEL_LOADED = 'MODEL_LOADED',
  QUALITY_FEEDBACK = 'QUALITY_FEEDBACK',
  MODEL_DOWNLOAD_START = 'MODEL_DOWNLOAD_START',
  MODEL_DOWNLOAD_COMPLETE = 'MODEL_DOWNLOAD_COMPLETE'
}

@Entity('play_events')
@Index(['eventTimestamp', 'eventType'])
@Index(['channelId', 'eventType', 'eventTimestamp'], { where: 'channel_id IS NOT NULL' })
@Index(['sessionId', 'eventTimestamp'], { where: 'session_id IS NOT NULL' })
export class PlayEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  sessionId?: string;

  @ManyToOne(() => UserSession, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'session_id' })
  session?: UserSession;

  @Column('uuid', { nullable: true })
  channelId?: string;

  @ManyToOne(() => Channel, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'channel_id' })
  channel?: Channel;

  @Column({
    type: 'enum',
    enum: EventType
  })
  eventType: EventType;

  @Column('timestamptz', { default: () => 'NOW()' })
  eventTimestamp: Date;

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @Column('integer', { nullable: true })
  processingTimeMs?: number;
}