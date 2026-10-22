import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const AUDIENCES = ['EVERYONE', 'FOLLOWING', 'MUTUAL', 'NO_ONE'] as const;
export const THEMES = ['LIGHT', 'DARK', 'SYSTEM'] as const;
export const LANGUAGES = ['ru', 'en'] as const;
export const NOTIFICATION_TYPES = [
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

export type Audience = (typeof AUDIENCES)[number];
export type ThemeValue = (typeof THEMES)[number];
export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number];

export class SettingsDto {
  @ApiProperty({ enum: AUDIENCES })
  commentsFrom!: Audience;

  @ApiProperty({ enum: AUDIENCES })
  tagsFrom!: Audience;

  @ApiProperty({ enum: AUDIENCES })
  mentionsFrom!: Audience;

  @ApiProperty()
  showActivityStatus!: boolean;

  @ApiProperty()
  hideLikeCounts!: boolean;

  @ApiProperty()
  allowStoryResharing!: boolean;

  @ApiProperty({ enum: THEMES })
  theme!: ThemeValue;

  @ApiProperty({ enum: LANGUAGES })
  language!: string;
}

// Любое подмножество полей SettingsDto.
export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: AUDIENCES })
  @IsOptional()
  @IsIn(AUDIENCES)
  commentsFrom?: Audience;

  @ApiPropertyOptional({ enum: AUDIENCES })
  @IsOptional()
  @IsIn(AUDIENCES)
  tagsFrom?: Audience;

  @ApiPropertyOptional({ enum: AUDIENCES })
  @IsOptional()
  @IsIn(AUDIENCES)
  mentionsFrom?: Audience;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showActivityStatus?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideLikeCounts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowStoryResharing?: boolean;

  @ApiPropertyOptional({ enum: THEMES })
  @IsOptional()
  @IsIn(THEMES)
  theme?: ThemeValue;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: string;
}

export class NotificationPreferenceDto {
  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsIn(NOTIFICATION_TYPES)
  type!: NotificationTypeValue;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
