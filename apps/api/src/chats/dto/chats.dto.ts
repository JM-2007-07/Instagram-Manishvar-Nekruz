import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CallDto } from '@/calls/calls.dto';
import { MediaItemDto } from '@/media/dto/media.dto';
import { PostDto } from '@/posts/dto/posts.dto';
import { StoryDto } from '@/stories/dto/stories.dto';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

export const MAX_TITLE_LENGTH = 50;
export const MAX_TEXT_LENGTH = 1000;
export const MAX_GROUP_SIZE = 250;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ChatListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: ['PRIMARY', 'REQUESTS'], default: 'PRIMARY' })
  @IsOptional()
  @IsIn(['PRIMARY', 'REQUESTS'])
  folder: 'PRIMARY' | 'REQUESTS' = 'PRIMARY';
}

export class CreateChatDto {
  @ApiProperty({ type: [String], description: 'Один id — личный чат, несколько — группа' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_SIZE - 1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds!: string[];

  @ApiPropertyOptional({ maxLength: MAX_TITLE_LENGTH, description: 'Название группы' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string;
}

export class UpdateChatDto {
  @ApiPropertyOptional({ maxLength: MAX_TITLE_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Фото группы: файл purpose AVATAR, загруженный через POST /media',
  })
  @IsOptional()
  @IsUUID()
  avatarMediaId?: string;
}

export class AddParticipantsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds!: string[];
}

export class MuteChatDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Без значения — навсегда',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  until?: Date;
}

export class ReadChatDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  messageId!: string;
}

const SEND_TYPES = [
  'TEXT',
  'MEDIA',
  'VOICE',
  'SHARE_POST',
  'SHARE_PROFILE',
  'SHARE_STORY',
] as const;

export class SendMessageDto {
  @ApiProperty({ enum: SEND_TYPES })
  @IsIn(SEND_TYPES)
  type!: (typeof SEND_TYPES)[number];

  @ApiPropertyOptional({ maxLength: MAX_TEXT_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT_LENGTH)
  text?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'MEDIA: 1-10 файлов (purpose MESSAGE); VOICE: один аудиофайл (purpose VOICE)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Публикация (SHARE_POST / share)' })
  @IsOptional()
  @IsUUID()
  sharedPostId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sharedUserId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'История (SHARE_STORY)' })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiProperty({ description: 'id, созданный клиентом (защита от дубля при повторе)' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  clientId!: string;
}

export class EditMessageDto {
  @ApiProperty({ maxLength: MAX_TEXT_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TEXT_LENGTH)
  text!: string;
}

export class ReactionDto {
  @ApiProperty({ example: '❤️' })
  @IsString()
  @Matches(/^(?:\p{Extended_Pictographic}|‍|️|⃣){1,16}$/u, {
    message: 'emoji must be an emoji',
  })
  emoji!: string;
}

export class ShareMessageDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  chatIds?: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Публикация, которой делятся' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Профиль, которым делятся' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'История, которой делятся' })
  @IsOptional()
  @IsUUID()
  storyId?: string;

  @ApiPropertyOptional({ maxLength: MAX_TEXT_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT_LENGTH)
  text?: string;
}

// --- Ответы ---------------------------------------------------------------------------------------

export class ChatParticipantDto extends UserSummaryDto {
  @ApiProperty({ enum: ['MEMBER', 'ADMIN'] })
  role!: 'MEMBER' | 'ADMIN';

  @ApiProperty()
  isOnline!: boolean;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  lastActiveAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    description:
      'До какого сообщения участник прочитал чат («Просмотрено»); null — не читал или чат у него в запросах',
  })
  lastReadMessageId!: string | null;
}

export class MessageReplyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  text!: string | null;

  @ApiProperty()
  senderName!: string;
}

export class MessageReactionGroupDto {
  @ApiProperty()
  emoji!: string;

  @ApiProperty({ type: [UserSummaryDto] })
  users!: UserSummaryDto[];
}

export class MessageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  chatId!: string;

  @ApiProperty({ type: UserSummaryDto, nullable: true })
  sender!: UserSummaryDto | null;

  @ApiProperty({
    enum: [
      'TEXT',
      'MEDIA',
      'VOICE',
      'SHARE_POST',
      'SHARE_PROFILE',
      'SHARE_STORY',
      'STORY_REPLY',
      'STORY_REACTION',
      'CALL',
      'SYSTEM',
    ],
  })
  type!: string;

  @ApiProperty({ type: String, nullable: true })
  text!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'clientId отправителя' })
  clientId!: string | null;

  @ApiProperty({ type: [MediaItemDto] })
  media!: MediaItemDto[];

  @ApiProperty({ type: MessageReplyDto, nullable: true })
  replyTo!: MessageReplyDto | null;

  @ApiProperty({
    type: () => PostDto,
    nullable: true,
    description: 'null, если публикация удалена или недоступна зрителю',
  })
  sharedPost!: PostDto | null;

  @ApiProperty({ type: UserSummaryDto, nullable: true })
  sharedUser!: UserSummaryDto | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'id истории' })
  storyId!: string | null;

  @ApiProperty({
    type: () => StoryDto,
    nullable: true,
    description: 'null, если история истекла или недоступна зрителю',
  })
  story!: StoryDto | null;

  @ApiProperty({ type: () => CallDto, nullable: true })
  call!: CallDto | null;

  @ApiProperty({ type: Object, nullable: true, description: 'Данные системного сообщения' })
  systemData!: Record<string, unknown> | null;

  @ApiProperty({ type: [MessageReactionGroupDto] })
  reactions!: MessageReactionGroupDto[];

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  editedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ChatDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['DIRECT', 'GROUP'] })
  type!: 'DIRECT' | 'GROUP';

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: [ChatParticipantDto] })
  participants!: ChatParticipantDto[];

  @ApiProperty({ type: MessageDto, nullable: true })
  lastMessage!: MessageDto | null;

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty()
  isMuted!: boolean;

  @ApiProperty({ description: 'Запрос на переписку (папка «Запросы»)' })
  isRequest!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class ChatPageDto {
  @ApiProperty({ type: [ChatDto] })
  items!: ChatDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class MessagePageDto {
  @ApiProperty({ type: [MessageDto] })
  items!: MessageDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class ShareResultDto {
  @ApiProperty({ type: [MessageDto] })
  messages!: MessageDto[];
}
