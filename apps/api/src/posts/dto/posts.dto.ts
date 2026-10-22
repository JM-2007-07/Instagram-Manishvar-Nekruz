import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { LocationDto } from '@/locations/dto/locations.dto';
import { MediaItemDto } from '@/media/dto/media.dto';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

export const POST_TYPES = ['POST', 'REEL'] as const;
export const POST_STATUSES = ['PROCESSING', 'PUBLISHED'] as const;
export const MAX_CAPTION_LENGTH = 2200;
export const MAX_POST_ITEMS = 20;
export const MAX_TAGS_PER_ITEM = 20;
export const MAX_COLLABORATORS = 5;
export const MAX_ALT_LENGTH = 1000;

// ---------- Запросы ----------

export class PostTagInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;
}

export class PostItemInputDto {
  @ApiProperty({ format: 'uuid', description: 'Загруженный файл (POST /media)' })
  @IsUUID()
  mediaId!: string;

  @ApiPropertyOptional({ maxLength: MAX_ALT_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ALT_LENGTH)
  altText?: string;

  @ApiPropertyOptional({ type: [PostTagInputDto], description: 'Отметки людей, до 20 на файл' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_ITEM)
  @ValidateNested({ each: true })
  @Type(() => PostTagInputDto)
  tags?: PostTagInputDto[];
}

export class CreatePostDto {
  @ApiProperty({ enum: POST_TYPES })
  @IsIn(POST_TYPES)
  type!: (typeof POST_TYPES)[number];

  @ApiProperty({ type: [PostItemInputDto], description: '1–20 файлов; reel — ровно одно видео' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_POST_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PostItemInputDto)
  items!: PostItemInputDto[];

  @ApiPropertyOptional({ maxLength: MAX_CAPTION_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CAPTION_LENGTH)
  caption?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Приглашённые соавторы, до 5' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_COLLABORATORS)
  @IsUUID('all', { each: true })
  collaboratorIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideLikeCount?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  commentsDisabled?: boolean;

  @ApiPropertyOptional({ description: 'Формат обрезки (только для клиента), например 1:1' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cropAspect?: string;
}

export class UpdatePostItemDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiPropertyOptional({ maxLength: MAX_ALT_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ALT_LENGTH)
  altText?: string;

  @ApiPropertyOptional({
    type: [PostTagInputDto],
    description: 'Новый полный список отметок на файле',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS_PER_ITEM)
  @ValidateNested({ each: true })
  @Type(() => PostTagInputDto)
  tags?: PostTagInputDto[];
}

export class UpdatePostDto {
  @ApiPropertyOptional({ maxLength: MAX_CAPTION_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CAPTION_LENGTH)
  caption?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'null — убрать место' })
  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @ApiPropertyOptional({ type: [UpdatePostItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => UpdatePostItemDto)
  items?: UpdatePostItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideLikeCount?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  commentsDisabled?: boolean;
}

export const FEED_TABS = ['TOP', 'RECENT'] as const;

// ?tab=TOP|RECENT для выдач хэштега и места.
export class PostsTabQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: FEED_TABS, default: 'TOP' })
  @IsOptional()
  @IsIn(FEED_TABS)
  tab: (typeof FEED_TABS)[number] = 'TOP';
}

export class LikesQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ description: 'Поиск по имени или имени пользователя' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

// ---------- Ответы ----------

export class PostTagDto {
  @ApiProperty({ type: UserSummaryDto })
  user!: UserSummaryDto;

  @ApiProperty()
  x!: number;

  @ApiProperty()
  y!: number;
}

export class PostItemDto {
  @ApiProperty()
  position!: number;

  @ApiProperty({ type: MediaItemDto })
  media!: MediaItemDto;

  @ApiProperty({ type: String, nullable: true })
  altText!: string | null;

  @ApiProperty({ type: [PostTagDto] })
  tags!: PostTagDto[];
}

// Post из API_CONTRACT §1.4.
export class PostDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  shortcode!: string;

  @ApiProperty({ enum: POST_TYPES })
  type!: (typeof POST_TYPES)[number];

  @ApiProperty({ enum: POST_STATUSES })
  status!: (typeof POST_STATUSES)[number];

  @ApiProperty({ type: UserSummaryDto })
  author!: UserSummaryDto;

  @ApiProperty({ type: [UserSummaryDto] })
  collaborators!: UserSummaryDto[];

  @ApiProperty({ type: [PostItemDto] })
  items!: PostItemDto[];

  @ApiProperty({ type: String, nullable: true })
  caption!: string | null;

  @ApiProperty({ type: LocationDto, nullable: true })
  location!: LocationDto | null;

  @ApiProperty({ type: Number, nullable: true, description: 'null — автор скрыл число лайков' })
  likeCount!: number | null;

  @ApiProperty()
  commentCount!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'null — в публикации нет видео' })
  playCount!: number | null;

  @ApiProperty()
  isLikedByMe!: boolean;

  @ApiProperty()
  isSavedByMe!: boolean;

  @ApiProperty()
  commentsDisabled!: boolean;

  @ApiProperty()
  hideLikeCount!: boolean;

  @ApiProperty()
  isPinned!: boolean;

  @ApiProperty()
  isArchived!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  editedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  publishedAt!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'Появятся с модулем comments',
  })
  previewComments!: unknown[];
}

export class PostPageDto {
  @ApiProperty({ type: [PostDto] })
  items!: PostDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class LikerDto extends UserSummaryDto {
  @ApiProperty({ enum: ['NONE', 'FOLLOWING', 'REQUESTED'] })
  followStatus!: 'NONE' | 'FOLLOWING' | 'REQUESTED';
}

export class LikerPageDto {
  @ApiProperty({ type: [LikerDto] })
  items!: LikerDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}
