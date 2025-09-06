// Working TypeORM entity with proper decorator syntax
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { TopicType, ChannelSource, CountryCode } from '@liveworldtv/shared-types'

@Entity('channels')
@Index(['country', 'topic', 'active', 'lastSeen'])  
@Index(['active', 'lastSeen'], { where: 'active = true' })
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 255 })
  name!: string

  @Column({ type: 'char', length: 2 })
  country!: CountryCode

  @Column({
    type: 'enum',
    enum: ['NEWS', 'SPORTS', 'MUSIC_DJS']
  })
  topic!: TopicType

  @Column({
    type: 'enum', 
    enum: ['YOUTUBE_EMBED', 'LICENSED'],
    default: 'YOUTUBE_EMBED'
  })
  sourceType!: ChannelSource

  @Column('text')
  sourceUrl!: string

  @Column({ nullable: true })
  youtubeChannelId?: string

  @Column({ nullable: true })
  owner?: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ nullable: true })
  thumbnailUrl?: string

  @Column({ length: 10, default: 'en' })
  languageCode!: string

  @CreateDateColumn()
  firstSeen!: Date

  @UpdateDateColumn()
  lastSeen!: Date

  @Column({ default: true })
  active!: boolean

  @Column({ default: false })
  verified!: boolean

  @Column('jsonb', { default: {} })
  metadata!: Record<string, any>

  @Column({ length: 64 })
  contentFingerprint!: string

  @Column({ type: 'tsvector', nullable: true })
  searchVector?: string
}