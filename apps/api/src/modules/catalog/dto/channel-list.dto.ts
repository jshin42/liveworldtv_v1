import { IsString, IsEnum, IsOptional, IsInt, Min, Max, Matches } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Channel, PaginatedResponse, TopicType, CountryCode } from '@liveworldtv/shared-types'

export class ChannelFilterDto {
  @ApiProperty({ example: 'US', description: 'Two-letter country code' })
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'Country must be a two-letter uppercase code' })
  country: CountryCode

  @ApiPropertyOptional({ enum: ['NEWS', 'SPORTS', 'MUSIC_DJS'] })
  @IsOptional()
  @IsEnum(['NEWS', 'SPORTS', 'MUSIC_DJS'], { message: 'Invalid topic type' })
  topic?: TopicType

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class ChannelListDto {
  @ApiProperty({ type: [Channel] })
  channels: Channel[]

  @ApiProperty({
    example: {
      page: 1,
      limit: 20,
      total: 45,
      hasNext: true
    }
  })
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
  }
}

export type ChannelListResponse = PaginatedResponse<Channel>