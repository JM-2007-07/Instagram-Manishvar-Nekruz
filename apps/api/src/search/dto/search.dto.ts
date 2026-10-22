import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { FollowListItemDto } from '@/follows/dto/follows.dto';
import { LocationDto } from '@/locations/dto/locations.dto';
import { HashtagDto } from '@/tags/dto/tags.dto';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const SEARCH_HISTORY_TYPES = ['QUERY', 'USER', 'HASHTAG', 'LOCATION'] as const;
export type SearchHistoryTypeValue = (typeof SEARCH_HISTORY_TYPES)[number];

// ?q для /search и /search/mentions: 1–50 символов после обрезки пробелов.
export class SearchQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  q!: string;
}

// ?q&cursor&limit для /search/users.
export class SearchUsersQueryDto extends CursorQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  q!: string;
}

export class SearchResultDto {
  @ApiProperty({ type: [UserSummaryDto], description: 'До 10 аккаунтов' })
  users!: UserSummaryDto[];

  @ApiProperty({ type: [HashtagDto], description: 'До 10 хэштегов' })
  hashtags!: HashtagDto[];

  @ApiProperty({ type: [LocationDto], description: 'До 10 мест' })
  locations!: LocationDto[];
}

export class SearchHashtagsPageDto {
  @ApiProperty({ type: [HashtagDto] })
  items!: HashtagDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class SearchLocationsPageDto {
  @ApiProperty({ type: [LocationDto] })
  items!: LocationDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class SearchUsersPageDto {
  @ApiProperty({ type: [FollowListItemDto] })
  items!: FollowListItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

// --- История поиска -------------------------------------------------------------------------

export class SearchHistoryQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: SEARCH_HISTORY_TYPES, description: 'Без type — все типы' })
  @IsOptional()
  @IsIn(SEARCH_HISTORY_TYPES)
  type?: SearchHistoryTypeValue;
}

export class ClearSearchHistoryQueryDto {
  @ApiPropertyOptional({ enum: SEARCH_HISTORY_TYPES, description: 'Без type — очистить всё' })
  @IsOptional()
  @IsIn(SEARCH_HISTORY_TYPES)
  type?: SearchHistoryTypeValue;
}

export class AddSearchHistoryDto {
  @ApiProperty({
    enum: SEARCH_HISTORY_TYPES,
    description: 'QUERY (нужен query), USER (userId), HASHTAG (hashtagName), LOCATION (locationId)',
  })
  @IsIn(SEARCH_HISTORY_TYPES)
  type!: SearchHistoryTypeValue;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50, description: 'Обязателен для QUERY' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  query?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Обязателен для USER' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Обязателен для HASHTAG' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hashtagName?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Обязателен для LOCATION' })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class SearchHistoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: SEARCH_HISTORY_TYPES })
  type!: SearchHistoryTypeValue;

  @ApiPropertyOptional({ description: 'Для QUERY' })
  query?: string;

  @ApiPropertyOptional({ type: UserSummaryDto, description: 'Для USER' })
  user?: UserSummaryDto;

  @ApiPropertyOptional({ type: HashtagDto, description: 'Для HASHTAG' })
  hashtag?: HashtagDto;

  @ApiPropertyOptional({ type: LocationDto, description: 'Для LOCATION' })
  location?: LocationDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class SearchHistoryPageDto {
  @ApiProperty({ type: [SearchHistoryEntryDto] })
  items!: SearchHistoryEntryDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}
