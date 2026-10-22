import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

export const MAX_COMMENT_LENGTH = 2200;
export const COMMENT_SORTS = ['TOP', 'NEWEST'] as const;

// ---------- Запросы ----------

export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_COMMENT_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_LENGTH)
  text!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ответ — только на комментарий верхнего уровня',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_COMMENT_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_LENGTH)
  text!: string;
}

export class CommentsQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: COMMENT_SORTS, default: 'TOP' })
  @IsOptional()
  @IsIn(COMMENT_SORTS)
  sort: (typeof COMMENT_SORTS)[number] = 'TOP';
}

// ---------- Ответы ----------

// Comment из API_CONTRACT §1.4.
export class CommentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  postId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: UserSummaryDto })
  author!: UserSummaryDto;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  likeCount!: number;

  @ApiProperty()
  isLikedByMe!: boolean;

  @ApiProperty()
  replyCount!: number;

  @ApiProperty()
  isPinned!: boolean;

  @ApiProperty()
  isPendingApproval!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  editedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CommentPageDto {
  @ApiProperty({ type: [CommentDto] })
  items!: CommentDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class CommentLikerPageDto {
  @ApiProperty({ type: [UserSummaryDto] })
  items!: UserSummaryDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}
