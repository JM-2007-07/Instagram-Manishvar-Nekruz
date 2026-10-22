import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

export type FollowStatusValue = 'NONE' | 'FOLLOWING' | 'REQUESTED';

export class FollowResultDto {
  @ApiProperty({
    enum: ['ACCEPTED', 'PENDING'],
    description: 'PENDING — запрос на закрытый аккаунт',
  })
  status!: 'ACCEPTED' | 'PENDING';
}

// ?q&cursor&limit для списков подписчиков и подписок.
export class FollowListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ description: 'Поиск по имени пользователя и полному имени' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  q?: string;
}

export class FollowListItemDto extends UserSummaryDto {
  @ApiProperty({
    enum: ['NONE', 'FOLLOWING', 'REQUESTED'],
    description: 'Моя подписка на этого пользователя',
  })
  followStatus!: FollowStatusValue;
}

export class FollowListPageDto {
  @ApiProperty({ type: [FollowListItemDto] })
  items!: FollowListItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class FollowRequestItemDto extends UserSummaryDto {
  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt!: Date;
}

export class FollowRequestPageDto {
  @ApiProperty({ type: [FollowRequestItemDto] })
  items!: FollowRequestItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class UserSummaryPageDto {
  @ApiProperty({ type: [UserSummaryDto] })
  items!: UserSummaryDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class SuggestionsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 30, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit: number = 10;
}

export class SuggestionDto extends UserSummaryDto {
  @ApiProperty({ enum: ['FOLLOWED_BY', 'POPULAR'] })
  reason!: 'FOLLOWED_BY' | 'POPULAR';

  @ApiPropertyOptional({
    type: UserSummaryDto,
    description: 'Кто из ваших подписок подписан на него',
  })
  followedBy?: UserSummaryDto;
}
