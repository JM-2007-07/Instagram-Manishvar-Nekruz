import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MediaItemDto } from '@/media/dto/media.dto';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

export const STORY_AUDIENCES = ['EVERYONE', 'CLOSE_FRIENDS'] as const;
export const STICKER_TYPES = [
  'MENTION',
  'LOCATION',
  'HASHTAG',
  'LINK',
  'POLL',
  'QUESTION',
  'SLIDER',
  'QUIZ',
  'COUNTDOWN',
] as const;
export const MAX_STICKERS = 10;
export const MAX_HIGHLIGHT_TITLE = 15;
export const MAX_HIGHLIGHT_STORIES = 100;
export const MAX_REPLY_LENGTH = 2200;

// ---------- Запросы ----------

export class StickerInputDto {
  @ApiProperty({ enum: STICKER_TYPES })
  @IsIn(STICKER_TYPES)
  type!: (typeof STICKER_TYPES)[number];

  @ApiProperty({ minimum: 0, maximum: 1, description: 'Центр стикера, доля ширины' })
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @ApiProperty({ minimum: 0, maximum: 1, description: 'Центр стикера, доля высоты' })
  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  width!: number;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  height!: number;

  @ApiProperty({ description: 'Градусы' })
  @IsNumber()
  @Min(-360)
  @Max(360)
  rotation!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'По типу: MENTION {userId}, LOCATION {locationId}, HASHTAG {tag}, LINK {url}, POLL {question, options[2..4]}, ' +
      'QUESTION {prompt}, SLIDER {question, emoji?}, QUIZ {question, options[2..4], correctIndex}, COUNTDOWN {title, endsAt}',
  })
  @IsObject()
  data!: Record<string, unknown>;
}

export class CreateStoryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Файл, загруженный с purpose=STORY' })
  @IsOptional()
  @IsUUID()
  mediaId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Публикация, которой делимся' })
  @IsOptional()
  @IsUUID()
  sharedPostId?: string;

  @ApiPropertyOptional({ enum: STORY_AUDIENCES, default: 'EVERYONE' })
  @IsOptional()
  @IsIn(STORY_AUDIENCES)
  audience?: (typeof STORY_AUDIENCES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 60, description: 'Секунд на показ (по умолчанию 5)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  durationSec?: number;

  @ApiPropertyOptional({ type: [StickerInputDto], description: `До ${MAX_STICKERS} стикеров` })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STICKERS)
  @ValidateNested({ each: true })
  @Type(() => StickerInputDto)
  stickers?: StickerInputDto[];
}

export class ReplyStoryDto {
  @ApiProperty({ maxLength: MAX_REPLY_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REPLY_LENGTH)
  text!: string;
}

export class ReactStoryDto {
  @ApiProperty({ maxLength: 16, example: '🔥' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  emoji!: string;
}

export class StickerResponseDto {
  @ApiProperty({
    description: 'POLL/QUIZ — номер варианта (число), QUESTION — текст, SLIDER — число 0..1',
  })
  @IsDefined()
  value!: unknown;
}

export class HighlightCreateDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_HIGHLIGHT_TITLE })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_HIGHLIGHT_TITLE)
  title!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Свои истории (в том числе истёкшие), порядок сохраняется',
  })
  @IsArray()
  @ArrayMaxSize(MAX_HIGHLIGHT_STORIES)
  @IsUUID('all', { each: true })
  storyIds!: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Файл с purpose=HIGHLIGHT_COVER' })
  @IsOptional()
  @IsUUID()
  coverMediaId?: string;
}

export class HighlightUpdateDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: MAX_HIGHLIGHT_TITLE })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_HIGHLIGHT_TITLE)
  title?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  coverMediaId?: string;
}

export class HighlightStoriesDto {
  @ApiProperty({ type: [String], format: 'uuid', description: 'Новый состав и порядок' })
  @IsArray()
  @ArrayMaxSize(MAX_HIGHLIGHT_STORIES)
  @IsUUID('all', { each: true })
  storyIds!: string[];
}

// ---------- Ответы ----------

export class StorySharedPostDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  shortcode!: string;

  @ApiProperty({ type: String, nullable: true })
  previewUrl!: string | null;

  @ApiProperty({ type: UserSummaryDto })
  author!: UserSummaryDto;
}

export class StoryStickerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: STICKER_TYPES })
  type!: (typeof STICKER_TYPES)[number];

  @ApiProperty()
  x!: number;

  @ApiProperty()
  y!: number;

  @ApiProperty()
  width!: number;

  @ApiProperty()
  height!: number;

  @ApiProperty()
  rotation!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;

  @ApiProperty({ nullable: true, description: 'Мой ответ на стикер' })
  myResponse!: unknown;
}

export class StoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: UserSummaryDto })
  author!: UserSummaryDto;

  @ApiProperty({ type: MediaItemDto, nullable: true })
  media!: MediaItemDto | null;

  @ApiProperty({ type: StorySharedPostDto, nullable: true })
  sharedPost!: StorySharedPostDto | null;

  @ApiProperty({ enum: STORY_AUDIENCES })
  audience!: (typeof STORY_AUDIENCES)[number];

  @ApiProperty({ type: [StoryStickerDto] })
  stickers!: StoryStickerDto[];

  @ApiProperty()
  durationSec!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  isViewedByMe!: boolean;

  @ApiProperty()
  isLikedByMe!: boolean;

  @ApiProperty({ type: Number, nullable: true, description: 'Только автору' })
  viewerCount!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Только автору' })
  likeCount!: number | null;
}

export class StoryPageDto {
  @ApiProperty({ type: [StoryDto] })
  items!: StoryDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class StoryTrayItemDto {
  @ApiProperty({ type: UserSummaryDto })
  author!: UserSummaryDto;

  @ApiProperty({ type: [String], format: 'uuid', description: 'Активные истории, старые первыми' })
  storyIds!: string[];

  @ApiProperty({ description: 'Есть непросмотренные' })
  hasUnseen!: boolean;

  @ApiProperty({ description: 'Есть история для близких друзей' })
  isCloseFriends!: boolean;

  @ApiProperty()
  latestAt!: string;
}

export class StoryViewerDto extends UserSummaryDto {
  @ApiProperty()
  liked!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Эмодзи-реакция из Direct' })
  reaction!: string | null;

  @ApiProperty()
  viewedAt!: string;
}

export class StoryViewerPageDto {
  @ApiProperty({ type: [StoryViewerDto] })
  items!: StoryViewerDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class StickerResponseItemDto {
  @ApiProperty({ type: UserSummaryDto })
  user!: UserSummaryDto;

  @ApiProperty()
  value!: unknown;

  @ApiProperty()
  createdAt!: string;
}

export class StickerResponsesPageDto {
  @ApiProperty({ type: [StickerResponseItemDto] })
  items!: StickerResponseItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Всего ответов' })
  total!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'POLL/QUIZ — {counts: number[]}, SLIDER — {average}, иначе пусто',
  })
  summary!: Record<string, unknown>;
}

export class HighlightDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  coverUrl!: string | null;

  @ApiProperty()
  storyCount!: number;
}

export class HighlightWithStoriesDto extends HighlightDto {
  @ApiProperty({ type: [StoryDto] })
  stories!: StoryDto[];
}
