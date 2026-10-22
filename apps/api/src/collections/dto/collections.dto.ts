import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const MAX_INITIAL_POSTS = 100;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Подборка в списке и после создания/изменения.
export class CollectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Обложка: выбранный или последний добавленный пост',
  })
  coverUrl!: string | null;

  @ApiProperty({ description: 'Только посты, которые владелец сейчас может видеть' })
  postCount!: number;
}

export class CreateCollectionDto {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Посты для добавления сразу (сохраняются автоматически)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INITIAL_POSTS)
  @IsUUID('all', { each: true })
  postIds?: string[];
}

export class UpdateCollectionDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 50 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Пост из этой подборки; null — сбросить обложку',
  })
  @IsOptional()
  @IsUUID()
  coverPostId?: string | null;
}
