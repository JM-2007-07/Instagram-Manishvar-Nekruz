import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';

export const TARGET_TYPES = ['POST', 'COMMENT', 'USER', 'MESSAGE', 'STORY'] as const;
export const REASONS = [
  'SPAM',
  'NUDITY',
  'HATE',
  'VIOLENCE',
  'HARASSMENT',
  'FALSE_INFORMATION',
  'SCAM',
  'INTELLECTUAL_PROPERTY',
  'SELF_HARM',
  'OTHER',
] as const;
export const REPORT_STATUSES = ['OPEN', 'RESOLVED', 'REJECTED'] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

export class CreateReportDto {
  @ApiProperty({ enum: TARGET_TYPES }) @IsIn(TARGET_TYPES) targetType!: TargetType;
  @ApiProperty({ format: 'uuid' }) @IsUUID() targetId!: string;
  @ApiProperty({ enum: REASONS }) @IsIn(REASONS) reason!: (typeof REASONS)[number];
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}

export class ReportIdDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
}

export class ReportsQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: REPORT_STATUSES })
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  status?: (typeof REPORT_STATUSES)[number];

  @ApiPropertyOptional({ enum: TARGET_TYPES })
  @IsOptional()
  @IsIn(TARGET_TYPES)
  targetType?: TargetType;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ['RESOLVED', 'REJECTED'] })
  @IsIn(['RESOLVED', 'REJECTED'])
  status!: 'RESOLVED' | 'REJECTED';

  @ApiPropertyOptional({ enum: ['NONE', 'REMOVE_CONTENT', 'BAN_USER'] })
  @IsOptional()
  @IsIn(['NONE', 'REMOVE_CONTENT', 'BAN_USER'])
  action?: 'NONE' | 'REMOVE_CONTENT' | 'BAN_USER';
}

export class ReportUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() userName!: string;
}

export class ReportTargetDto {
  @ApiProperty({ description: 'false — объект уже удалён' }) exists!: boolean;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) ownerId!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Короткий предпросмотр' })
  preview!: string | null;
}

export class ReportDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: TARGET_TYPES }) targetType!: TargetType;
  @ApiProperty({ format: 'uuid' }) targetId!: string;
  @ApiProperty({ enum: REASONS }) reason!: string;
  @ApiProperty({ nullable: true, type: String }) details!: string | null;
  @ApiProperty({ enum: REPORT_STATUSES }) status!: string;
  @ApiProperty({ type: ReportUserDto }) reporter!: ReportUserDto;
  @ApiProperty({ type: ReportTargetDto }) target!: ReportTargetDto;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) resolvedById!: string | null;
  @ApiProperty({ nullable: true, type: String }) resolvedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class ReportPageDto {
  @ApiProperty({ type: [ReportDto] }) items!: ReportDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}
