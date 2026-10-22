import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsString, MaxLength } from 'class-validator';
import { UserSummaryDto } from '@/users/dto/user-summary.dto';

export class MuteDto {
  @ApiProperty({ description: 'Скрыть посты' })
  @IsBoolean()
  posts!: boolean;

  @ApiProperty({ description: 'Скрыть истории' })
  @IsBoolean()
  stories!: boolean;
}

export class MutedUserDto extends UserSummaryDto {
  @ApiProperty()
  posts!: boolean;

  @ApiProperty()
  stories!: boolean;
}

export class MutedUserPageDto {
  @ApiProperty({ type: [MutedUserDto] })
  items!: MutedUserDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class HiddenWordsDto {
  @ApiProperty({ type: [String], description: 'До 100 слов, каждое до 50 символов' })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((w: unknown) => (typeof w === 'string' ? w.trim().toLowerCase() : w))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  words!: string[];

  @ApiProperty()
  @IsBoolean()
  filterOffensive!: boolean;
}
