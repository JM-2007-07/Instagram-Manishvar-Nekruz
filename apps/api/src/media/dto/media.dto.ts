import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const MEDIA_KINDS = ['IMAGE', 'VIDEO', 'AUDIO'] as const;
export const MEDIA_STATUSES = ['PROCESSING', 'READY', 'FAILED'] as const;
export const MEDIA_PURPOSES = [
  'POST',
  'REEL',
  'STORY',
  'AVATAR',
  'MESSAGE',
  'VOICE',
  'HIGHLIGHT_COVER',
] as const;

// MediaItem из API_CONTRACT §1.4.
export class MediaItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: MEDIA_KINDS })
  kind!: (typeof MEDIA_KINDS)[number];

  @ApiProperty({ enum: MEDIA_STATUSES })
  status!: (typeof MEDIA_STATUSES)[number];

  @ApiProperty({ example: '/api/v1/media/6f1c0b3e-0000-4000-8000-000000000000' })
  url!: string;

  @ApiProperty({ type: String, nullable: true })
  thumbnailUrl!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  width!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  height!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  durationSec!: number | null;
}

// Тело POST /media (multipart/form-data) — только для Swagger: файл принимает multer, purpose проверяет сервис.
export class UploadMediaBodyDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: unknown;

  @ApiProperty({ enum: MEDIA_PURPOSES })
  purpose!: (typeof MEDIA_PURPOSES)[number];
}

export class MediaFileQueryDto {
  @ApiPropertyOptional({ enum: ['thumb'], description: 'thumb — уменьшенная копия или кадр видео' })
  @IsOptional()
  @IsIn(['thumb'])
  variant?: 'thumb';
}
