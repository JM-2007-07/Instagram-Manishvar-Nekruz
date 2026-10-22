import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { FollowListItemDto } from '@/follows/dto/follows.dto';
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

  @ApiProperty({ type: [Object], description: 'Пока всегда пустой (появится с модулем tags)' })
  hashtags!: unknown[];

  @ApiProperty({ type: [Object], description: 'Пока всегда пустой (появится с модулем locations)' })
  locations!: unknown[];
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
    description: 'Сейчас принимаются только QUERY и USER; HASHTAG и LOCATION — 400',
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

  @ApiPropertyOptional({ description: 'Для HASHTAG (пока не поддерживается)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hashtagName?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Для LOCATION (пока не поддерживается)' })
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

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class SearchHistoryPageDto {
  @ApiProperty({ type: [SearchHistoryEntryDto] })
  items!: SearchHistoryEntryDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}
