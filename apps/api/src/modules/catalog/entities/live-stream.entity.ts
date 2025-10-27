import { Entity, PrimaryGeneratedColumn, Column, Index, JoinColumn, OneToOne } from 'typeorm';
import { Channel } from './channel.entity';

export enum StreamStatus {
  LIVE = 'LIVE',
  OFF = 'OFF',
  UNKNOWN = 'UNKNOWN'
}

@Entity('live_streams')
@Index(['status', 'lastChecked'])
@Index(['lastChecked'], { where: "status = 'OFF'" })
@Index(['status', 'viewerCount'], { where: "status = 'LIVE'" })
export class LiveStream {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index('idx_live_streams_channel_id', { unique: true })
  channelId: string;

  @OneToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({
    type: 'enum',
    enum: StreamStatus,
    default: StreamStatus.UNKNOWN
  })
  status: StreamStatus;

  @Column('timestamptz', { nullable: true })
  startedAt?: Date;

  @Column('timestamptz', { nullable: true })
  endedAt?: Date;

  @Column('integer', { default: 30 })
  delaySeconds: number;

  @Column('integer', { default: 10800 })
  dvrWindowSec: number;

  @Column('integer', { default: 0 })
  viewerCount: number;

  @Column('integer', { default: 0 })
  peakViewerCount: number;

  @Column('timestamptz', { default: () => 'NOW()' })
  lastChecked: Date;

  @Column('jsonb', { default: '{}' })
  qualityMetrics: Record<string, any>;
}