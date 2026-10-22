import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

const NOTIFICATION_TYPES = [
  'POST_LIKE',
  'COMMENT_LIKE',
  'COMMENT',
  'COMMENT_REPLY',
  'MENTION_POST',
  'MENTION_COMMENT',
  'MENTION_STORY',
  'POST_TAG',
  'FOLLOW',
  'FOLLOW_REQUEST',
  'FOLLOW_ACCEPTED',
  'COLLAB_INVITE',
] as const;

export class NotificationPostDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  shortcode!: string;

  @ApiProperty({ type: String, nullable: true })
  thumbnailUrl!: string | null;
}

export class NotificationCommentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  text!: string;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid', description: 'Id самого нового уведомления группы' })
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  type!: (typeof NOTIFICATION_TYPES)[number];

  @ApiProperty({ type: [UserSummaryDto], description: 'До 3 последних авторов группы' })
  actors!: UserSummaryDto[];

  @ApiProperty({ description: 'Сколько всего авторов в группе' })
  actorCount!: number;

  @ApiProperty({ type: NotificationPostDto, nullable: true })
  post!: NotificationPostDto | null;

  @ApiProperty({ type: NotificationCommentDto, nullable: true })
  comment!: NotificationCommentDto | null;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto] })
  items!: NotificationDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class MarkReadDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Отметить прочитанными всё до этого уведомления включительно; по умолчанию все',
  })
  @IsOptional()
  @IsUUID()
  upToId?: string;
}

export class BadgesDto {
  @ApiProperty()
  unreadNotifications!: number;

  @ApiProperty()
  unreadChats!: number;

  @ApiProperty()
  followRequests!: number;
}
