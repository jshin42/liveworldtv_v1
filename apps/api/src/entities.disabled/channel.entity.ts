import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum TopicType {
  NEWS = 'NEWS',
  SPORTS = 'SPORTS', 
  MUSIC_DJS = 'MUSIC_DJS'
}

export enum ChannelSource {
  YOUTUBE_EMBED = 'YOUTUBE_EMBED',
  LICENSED = 'LICENSED'
}

@Entity('channels')
@Index(['country', 'topic', 'active', 'lastSeen'])
@Index(['active', 'lastSeen'], { where: 'active = true' })
@Index(['sourceUrl'], { unique: true })
@Index(['contentFingerprint'], { unique: true })
@Index(['youtubeChannelId'])
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('char', { length: 2 })
  country: string;

  @Column({
    type: 'enum',
    enum: TopicType
  })
  topic: TopicType;

  @Column({
    type: 'enum',
    enum: ChannelSource,
    default: ChannelSource.YOUTUBE_EMBED
  })
  sourceType: ChannelSource;

  @Column('text')
  sourceUrl: string;

  @Column('varchar', { length: 50, nullable: true })
  youtubeChannelId?: string;

  @Column('varchar', { length: 255, nullable: true })
  owner?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('text', { nullable: true })
  thumbnailUrl?: string;

  @Column('char', { length: 3, default: 'unk' })
  languageCode: string;

  @Column('timestamptz', { default: () => 'NOW()' })
  firstSeen: Date;

  @Column('timestamptz', { default: () => 'NOW()' })
  lastSeen: Date;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('boolean', { default: false })
  verified: boolean;

  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @Column('char', { length: 16 })
  contentFingerprint: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}