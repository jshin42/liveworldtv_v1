import { Entity, Column, PrimaryColumn, Index, JoinColumn, OneToOne } from 'typeorm';
import { Channel } from './channel.entity';

@Entity('ranking_stats')
@Index(['mosProxy', 'activationCtr'], { where: 'mos_proxy IS NOT NULL' })
@Index(['avgWatchTimeSec', 'bounceRate'])
@Index(['lastUpdated'])
export class RankingStats {
  @PrimaryColumn('uuid')
  channelId: string;

  @OneToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column('decimal', { precision: 5, scale: 4, default: 0.0 })
  activationCtr: number;

  @Column('integer', { default: 0 })
  avgWatchTimeSec: number;

  @Column('decimal', { precision: 4, scale: 3, default: 0.0 })
  bounceRate: number;

  @Column('integer', { nullable: true })
  ttfmpMs?: number;

  @Column('integer', { nullable: true })
  ttfmpP95Ms?: number;

  @Column('integer', { nullable: true })
  dubbingLatencyP50Ms?: number;

  @Column('integer', { nullable: true })
  dubbingLatencyP95Ms?: number;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  mosProxy?: number;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  speechRatio?: number;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  werProxy?: number;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  contentStability?: number;

  @Column('integer', { default: 0 })
  sampleSize: number;

  @Column('timestamptz', { nullable: true })
  lastPlayEvent?: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  lastUpdated: Date;
}