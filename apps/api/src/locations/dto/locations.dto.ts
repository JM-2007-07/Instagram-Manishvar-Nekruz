import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { CursorQueryDto } from '@/common/pagination/cursor-query.dto';

export class LocationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ nullable: true, type: String }) state!: string | null;
  @ApiProperty({ nullable: true, type: String }) zipCode!: string | null;
  @ApiProperty() country!: string;
  @ApiProperty({ nullable: true, type: Number }) latitude!: number | null;
  @ApiProperty({ nullable: true, type: Number }) longitude!: number | null;
}

export class LocationDetailsDto extends LocationDto {
  @ApiProperty({ description: 'Число публикаций; пока модуль posts не готов — 0' })
  postCount!: number;
}

export class LocationPageDto {
  @ApiProperty({ type: [LocationDto] }) items!: LocationDto[];
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
}

export class LocationsQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ description: 'Поиск по названию и городу' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) zipCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
}

export class CreateLocationDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(1, 100)
  city!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  state?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  zipCode?: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(1, 100)
  country!: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
