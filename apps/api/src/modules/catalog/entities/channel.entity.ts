import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { TopicType, ChannelSource, CountryCode } from '@liveworldtv/shared-types'

@Entity('channels')
@Index(['country', 'topic', 'active', 'lastSeen'])
@Index(['active', 'lastSeen'], { where: 'active = true' })
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  name: string

  @Column({ type: 'char', length: 2 })
  country: CountryCode

  @Column({ 
    type: 'enum',
    enum: ['NEWS', 'SPORTS', 'MUSIC_DJS']
  })
  topic: TopicType

  @Column({ 
    type: 'enum',
    enum: ['YOUTUBE_EMBED', 'LICENSED'],
    default: 'YOUTUBE_EMBED'
  })
  sourceType: ChannelSource

  @Column('text')
  @Index('idx_channels_source_url_hash', { unique: true })
  sourceUrl: string

  @Column({ length: 50, nullable: true })
  @Index('idx_channels_youtube_id_hash')
  youtubeChannelId?: string

  @Column({ length: 255, nullable: true })
  owner?: string

  @Column('text', { nullable: true })
  description?: string

  @Column('text', { nullable: true })
  thumbnailUrl?: string

  @Column({ type: 'char', length: 3, default: 'unk' })
  languageCode: string

  @CreateDateColumn()
  firstSeen: Date

  @UpdateDateColumn()
  lastSeen: Date

  @Column({ default: true })
  active: boolean

  @Column({ default: false })
  verified: boolean

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>

  @Column({ type: 'char', length: 16 })
  @Index('idx_channels_fingerprint_hash', { unique: true })
  contentFingerprint: string

  @Column('tsvector', { nullable: true })
  @Index('idx_channels_search_vector', { synchronize: false })
  searchVector?: string
}